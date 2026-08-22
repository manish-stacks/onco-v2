/**
 * Server-Sent Events — for pushing live updates to the admin panel.
 *
 * Push instead of polling: a new order arrived, stock ran out, a prescription
 * was uploaded — it reaches every connected admin instantly.
 *
 * In-process (no Redis pub/sub), so in PM2 cluster mode each worker
 * will have their own clients. That is why events are also broadcast over Redis pub/sub
 * so that an event raised on any worker reaches the clients of every worker.
 */
const redis = require('../config/redis');

const CHANNEL = 'admin:events';

/** connected SSE clients: Map<clientId, { res, adminId, permissions }> */
const clients = new Map();
let nextId = 1;

/** The subscriber needs its own connection — in subscriber mode ioredis
 *  does not allow normal commands */
let subscriber = null;

function initSubscriber() {
  if (subscriber) return;
  try {
    subscriber = redis.duplicate();
    subscriber.subscribe(CHANNEL, (err) => {
      if (err) console.error('[sse] subscribe fail:', err.message);
      else console.log('[sse] event channel subscribed');
    });
    subscriber.on('message', (channel, payload) => {
      if (channel !== CHANNEL) return;
      try {
        const event = JSON.parse(payload);
        deliver(event);
      } catch (err) {
        console.error('[sse] bad payload:', err.message);
      }
    });
    subscriber.on('error', (err) => console.error('[sse] subscriber error:', err.message));
  } catch (err) {
    console.error('[sse] subscriber init fail:', err.message);
  }
}

/** Register one client. Returns a cleanup function. */
function addClient(res, { adminId, permissions = [] }) {
  initSubscriber();

  const id = nextId++;
  clients.set(id, { res, adminId, permissions });

  // SSE handshake
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering — otherwise events get stuck
  });
  res.write(`retry: 5000\n\n`);
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

  // heartbeat — proxies cut idle connections, otherwise
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* client ja chuka */ }
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(id);
  };

  return cleanup;
}

/**
 * Emit an event. If Redis is running it reaches every worker, otherwise only
 * is worker ke clients tak (degraded but working).
 *
 * @param {string} type      'order.created' | 'order.status' | 'stock.low' | ...
 * @param {object} data      payload
 * @param {string} permission  who should see this event (optional)
 */
function emit(type, data, permission = null) {
  const event = { type, data, permission, at: new Date().toISOString() };

  try {
    redis.publish(CHANNEL, JSON.stringify(event)).catch(() => deliver(event));
  } catch {
    deliver(event); // redis down — kam se kam local clients ko to bhej do
  }
}

/** Actual write to connected clients */
function deliver(event) {
  const payload = JSON.stringify({ type: event.type, data: event.data, at: event.at });

  clients.forEach((client, id) => {
    // permission-gated event — do not send it to anyone without the permission
    if (event.permission && !client.permissions.includes(event.permission)) return;

    try {
      client.res.write(`event: ${event.type}\ndata: ${payload}\n\n`);
    } catch {
      clients.delete(id);
    }
  });
}

function clientCount() {
  return clients.size;
}

module.exports = { addClient, emit, clientCount, CHANNEL };
