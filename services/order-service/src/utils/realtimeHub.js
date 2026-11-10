/**
 * Realtime SSE Hub cho Order Service
 * Cho phép Khách hàng, Chủ quán và Admin theo dõi trạng thái đơn hàng tức thì không cần F5.
 */

const clients = new Set();

function subscribe(req, res, filters = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const client = {
    id: `ord_sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    res,
    customerId: filters.customerId ? String(filters.customerId) : null,
    restaurantId: filters.restaurantId ? String(filters.restaurantId) : null,
    orderId: filters.orderId ? String(filters.orderId) : null
  };
  clients.add(client);

  const sendRaw = (eventName, payload) => {
    if (!res || res.writableEnded || res.destroyed) return false;
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify({ ...payload, serverTime: Date.now() })}\n\n`);
      if (typeof res.flush === 'function') res.flush();
      return true;
    } catch {
      return false;
    }
  };

  sendRaw('connected', { clientId: client.id });

  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      clients.delete(client);
      return;
    }
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(client);
    }
  }, 25000);

  if (typeof heartbeat.unref === 'function') {
    heartbeat.unref();
  }

  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(client);
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
  return client;
}

function emitOrderEvent(eventName, order = {}) {
  if (clients.size === 0 || !order) return 0;

  const orderId = order._id ? String(order._id) : (order.orderId ? String(order.orderId) : null);
  const customerId = order.customerId ? String(order.customerId) : null;
  const restaurantId = order.restaurantId ? String(order.restaurantId) : null;

  const payload = {
    type: eventName,
    orderId,
    customerId,
    restaurantId,
    status: order.status,
    updatedAt: order.updatedAt || new Date()
  };

  let delivered = 0;
  for (const client of Array.from(clients)) {
    const matchOrder = client.orderId && orderId && client.orderId === orderId;
    const matchCustomer = client.customerId && customerId && client.customerId === customerId;
    const matchRestaurant = client.restaurantId && restaurantId && client.restaurantId === restaurantId;
    const isWildcard = !client.orderId && !client.customerId && !client.restaurantId;

    if (!isWildcard && !matchOrder && !matchCustomer && !matchRestaurant) {
      continue;
    }

    if (!client.res || client.res.writableEnded || client.res.destroyed) {
      clients.delete(client);
      continue;
    }

    try {
      client.res.write(`event: ${eventName}\n`);
      client.res.write(`data: ${JSON.stringify({ ...payload, serverTime: Date.now() })}\n\n`);
      if (typeof client.res.flush === 'function') client.res.flush();
      delivered += 1;
    } catch {
      clients.delete(client);
    }
  }

  return delivered;
}

module.exports = {
  subscribe,
  emitOrderEvent
};

