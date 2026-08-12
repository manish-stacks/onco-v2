/**
 * Server-Sent Events — admin panel ko live updates bhejne ke liye.
 *
 * Polling ki jagah push: naya order aaya, stock khatam hua, prescription
 * upload hua — turant sab connected admins ko chala jaata hai.
 *
 * In-process hai (koi Redis pub/sub nahi), to PM2 cluster mode me har worker
 * ke apne clients honge. Isliye events Redis pub/sub se bhi broadcast hote
 * hain — taaki kisi bhi worker pe hua event sab workers ke clients tak pahunche.
 */
const redis = require('../config/redis');

const CHANNEL = 'admin:events';

/** connected SSE clients: Map<clientId, { res, adminId, permissions }> */
const clients = new Map();
let nextId = 1;

/** Alag connection chahiye subscriber ke liye — ioredis subscriber mode me
 *  normal commands allow nahi karta */
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

/** Ek client register karo. Returns cleanup function. */
function addClient(res, { adminId, permissions = [] }) {
  initSubscriber();

  const id = nextId++;
  clients.set(id, { res, adminId, permissions });

  // SSE handshake
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx buffering band — warna events atak jaate hain
  });
  res.write(`retry: 5000\n\n`);
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

  // heartbeat — proxies idle connection kaat dete hain warna
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
 * Event bhejo. Redis chalu hai to sab workers tak jaayega, warna sirf
 * is worker ke clients tak (degraded but working).
 *
 * @param {string} type      'order.created' | 'order.status' | 'stock.low' | ...
 * @param {object} data      payload
 * @param {string} permission  jisko ye event dikhna chahiye (optional)
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
    // permission-gated event — jiske paas permission nahi usko mat bhejo
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
