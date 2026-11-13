/**
 * Realtime SSE Hub cho Restaurant Service
 * Quản lý kết nối Server-Sent Events (SSE) theo kênh:
 *  - merchant:{ownerId} : Thông báo chuông, lệnh khóa/mở khóa, ví đối tác, đơn mới cho chủ quán
 *  - store:{storeId}    : Cập nhật trạng thái quán, menu, đánh giá
 *  - admin              : Phê duyệt quán, voucher, cảnh báo, đơn/đánh giá cho Admin Portal
 *  - public             : Trạng thái mở/đóng cửa, còn/hết món, rating hiển thị trên app khách hàng
 */

const clients = new Set();

function addClient(res, channels = []) {
  const channelSet = new Set(Array.isArray(channels) ? channels.filter(Boolean) : [channels].filter(Boolean));
  const client = {
    id: `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    res,
    channels: channelSet
  };
  clients.add(client);
  return client;
}

function removeClient(client) {
  if (client) {
    clients.delete(client);
  }
}

function writeEvent(res, eventName, payload) {
  if (!res || res.writableEnded || res.destroyed) return false;
  try {
    const serialized = JSON.stringify({
      ...(payload && typeof payload === 'object' ? payload : { data: payload }),
      serverTime: Date.now()
    });
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${serialized}\n\n`);
    if (typeof res.flush === 'function') {
      res.flush();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Khởi tạo SSE Response Stream cho Express route
 */
function subscribe(req, res, channels = []) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const client = addClient(res, channels);
  writeEvent(res, 'connected', {
    clientId: client.id,
    channels: Array.from(client.channels)
  });

  // Giữ kết nối qua Proxy (Vercel/Render/Nginx) bằng comment heartbeat mỗi 25s
  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      removeClient(client);
      return;
    }
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      removeClient(client);
    }
  }, 25000);

  if (typeof heartbeat.unref === 'function') {
    heartbeat.unref();
  }

  const cleanup = () => {
    clearInterval(heartbeat);
    removeClient(client);
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  return client;
}

/**
 * Gửi sự kiện realtime tới danh sách kênh đích
 */
function broadcast(targetChannels, eventName, payload = {}) {
  if (clients.size === 0) return 0;
  const targets = Array.isArray(targetChannels) ? targetChannels.filter(Boolean) : [targetChannels].filter(Boolean);
  if (targets.length === 0) return 0;

  let delivered = 0;
  for (const client of Array.from(clients)) {
    const matched = targets.some((ch) => client.channels.has(ch));
    if (!matched) continue;

    const ok = writeEvent(client.res, eventName, payload);
    if (ok) {
      delivered += 1;
    } else {
      removeClient(client);
    }
  }
  return delivered;
}

/**
 * Phát đồng bộ cập nhật cửa hàng tới Chủ quán, Admin và (tùy chọn) Khách hàng Public
 */
function emitStoreUpdate({ store, ownerId, storeId, event = 'store.updated', notification = null, includePublic = false, extra = {} } = {}) {
  const resolvedStoreId = storeId || (store && store._id ? String(store._id) : null);
  const resolvedOwnerId = ownerId || (store && store.ownerId ? String(store.ownerId) : null);

  const channels = ['admin'];
  if (resolvedOwnerId) channels.push(`merchant:${resolvedOwnerId}`);
  if (resolvedStoreId) channels.push(`store:${resolvedStoreId}`);
  if (includePublic) channels.push('public');

  const payload = {
    type: event,
    storeId: resolvedStoreId,
    ownerId: resolvedOwnerId,
    status: store?.status,
    notification: notification || undefined,
    ...extra
  };

  return broadcast(channels, event, payload);
}

function broadcastAdminEvent(event = 'admin.updated', payload = {}) {
  return broadcast(['admin'], event, { type: event, ...payload });
}

function broadcastPublicEvent(event = 'public.updated', payload = {}) {
  return broadcast(['public'], event, { type: event, ...payload });
}

function emitUserEvent(userId, event = 'notification.created', payload = {}) {
  if (!userId) return 0;
  return broadcast([`user:${userId}`, 'public'], event, { type: event, ...payload });
}

function getActiveClientCount() {
  return clients.size;
}

module.exports = {
  subscribe,
  broadcast,
  emitStoreUpdate,
  broadcastAdminEvent,
  broadcastPublicEvent,
  emitUserEvent,
  getActiveClientCount
};

