import { buildStreamUrl } from '../api/client';

const BROADCAST_CHANNEL_NAME = 'foodfast_realtime_sync';
const STORAGE_PULSE_KEY = 'foodfast_realtime_pulse';

let sharedChannel = null;
function getBroadcastChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!sharedChannel) {
    try {
      sharedChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return sharedChannel;
}

/**
 * Phát tín hiệu đồng bộ tức thì tới tất cả các tab trình duyệt cùng domain
 */
export function publishRealtimeSignal(channel, payload = {}) {
  const message = {
    channel,
    payload,
    ts: Date.now(),
    nonce: Math.random().toString(36).slice(2, 8)
  };

  try {
    const bc = getBroadcastChannel();
    if (bc) {
      bc.postMessage(message);
    }
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_PULSE_KEY, JSON.stringify(message));
    }
  } catch {}
}

/**
 * Phát âm thanh thông báo nhẹ nhàng (dùng Web Audio API, không cần file audio ngoài)
 */
export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1174.66, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 500);
  } catch {}
}

/**
 * Đăng ký kết hợp đa tầng Realtime:
 *  1. Server-Sent Events (SSE EventSource) với auto-reconnect backoff
 *  2. Cross-tab BroadcastChannel + localStorage pulse (< 5ms)
 *  3. Window Focus & Document VisibilityChange refresh
 *  4. Smart Silent Polling fallback (tự động bỏ qua khi tab ẩn)
 */
export function subscribeRealtimeStream({
  service = 'restaurant',
  path = '',
  params = {},
  events = [],
  onEvent,
  onPoll,
  fallbackIntervalMs = 5000,
  broadcastChannels = [],
  enabled = true
} = {}) {
  if (typeof window === 'undefined' || !enabled) {
    return () => {};
  }

  let closed = false;
  let pollingInFlight = false;
  let es = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;

  const triggerSafePoll = async (reason = 'poll') => {
    if (closed || !onPoll || pollingInFlight) return;
    pollingInFlight = true;
    try {
      await onPoll(reason);
    } catch {
      // Giữ trạng thái hiện tại ở UI khi mạng chập chờn
    } finally {
      pollingInFlight = false;
    }
  };

  // Tầng 1: SSE EventSource
  const connectSSE = () => {
    if (closed || !path || typeof EventSource === 'undefined') return;
    try {
      const streamUrl = buildStreamUrl(service, path, params);
      es = new EventSource(streamUrl);

      es.onopen = () => {
        reconnectAttempt = 0;
      };

      const handleIncoming = (eventName, e) => {
        let parsed = {};
        try {
          parsed = e?.data ? JSON.parse(e.data) : {};
        } catch {}
        if (typeof onEvent === 'function') {
          onEvent(eventName, parsed);
        }
        triggerSafePoll(`sse:${eventName}`);
      };

      events.forEach((evtName) => {
        es.addEventListener(evtName, (e) => handleIncoming(evtName, e));
      });

      es.onmessage = (e) => handleIncoming('message', e);

      es.onerror = () => {
        if (es) {
          try {
            es.close();
          } catch {}
          es = null;
        }
        if (closed) return;
        reconnectAttempt = Math.min(reconnectAttempt + 1, 5);
        const delayMs = Math.min(30000, 2000 * Math.pow(1.6, reconnectAttempt));
        reconnectTimer = setTimeout(connectSSE, delayMs);
      };
    } catch {
      // Fallback sang silent polling nếu SSE bị chặn
    }
  };

  connectSSE();

  // Tầng 2: BroadcastChannel + storage event (đồng bộ tức thì giữa các tab)
  const targetSet = new Set(Array.isArray(broadcastChannels) ? broadcastChannels : []);
  const handleCrossTabMessage = (msg) => {
    if (closed || !msg || !msg.channel) return;
    if (targetSet.size === 0 || targetSet.has(msg.channel)) {
      if (typeof onEvent === 'function') {
        onEvent(`broadcast:${msg.channel}`, msg.payload || {});
      }
      triggerSafePoll(`broadcast:${msg.channel}`);
    }
  };

  const bc = getBroadcastChannel();
  const bcHandler = (e) => handleCrossTabMessage(e?.data);
  if (bc) {
    bc.addEventListener('message', bcHandler);
  }

  const storageHandler = (e) => {
    if (e.key === STORAGE_PULSE_KEY && e.newValue) {
      try {
        handleCrossTabMessage(JSON.parse(e.newValue));
      } catch {}
    }
  };
  window.addEventListener('storage', storageHandler);

  // Tầng 3: Làm mới ngay lập tức khi quay lại tab / focus cửa sổ
  const handleVisibility = () => {
    if (!document.hidden) {
      triggerSafePoll('visibility');
    }
  };
  const handleFocus = () => triggerSafePoll('focus');
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleFocus);

  // Tầng 4: Smart Silent Polling Fallback
  let pollTimer = null;
  if (fallbackIntervalMs > 0 && typeof onPoll === 'function') {
    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      triggerSafePoll('interval');
    }, fallbackIntervalMs);
  }

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (es) {
      try {
        es.close();
      } catch {}
      es = null;
    }
    if (bc) {
      bc.removeEventListener('message', bcHandler);
    }
    window.removeEventListener('storage', storageHandler);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleFocus);
  };
}

