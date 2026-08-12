require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const cookieParser = require('cookie-parser');
const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // nginx ke peeche chalega, real IP chahiye

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression({
  // SSE stream compress mat karo — warna events buffer ho ke atak jaate hain
  filter: (req, res) => (req.path === '/api/admin/events' ? false : compression.filter(req, res)),
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  credentials: true,
}));
app.use(cookieParser());

/**
 * ZAROORI: Razorpay webhook ko RAW body chahiye (HMAC verify ke liye).
 * Isliye express.json() se pehle, sirf usi path pe raw parser lagta hai.
 */
app.use('/api/app/payments/razorpay/webhook', express.raw({ type: '*/*' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// general rate limit
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bahut zyada requests, thodi der baad try karo' },
}));

// auth endpoints pe sakht limit (brute force se bachao)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Bahut baar try kiya, 15 minute baad try karo' },
});
app.use('/api/app/auth/login', authLimiter);
app.use('/api/app/auth/otp/request', authLimiter);
app.use('/api/admin/auth/login', authLimiter);

// uploaded files (S3 se pehle wali, aur local fallback)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));

/**
 * Cached image proxy. S3 se ek baar laata hai, disk pe rakhta hai, aage se
 * wahin se serve karta hai — har page load pe S3 hit nahi hoti.
 * CloudFront lag jaye to MEDIA_SERVE_MODE hata do, URLs seedha CDN ki ban jayengi.
 */
app.use('/media', require('./src/routes/media.routes'));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`[server] oncohealthmart API — port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// graceful shutdown — chal rahi requests complete hone do
['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => {
    console.log(`[server] ${signal} mila, band kar rahe hain...`);
    server.close(() => {
      require('./src/config/db').end().catch(() => {});
      require('./src/config/redis').quit().catch(() => {});
      process.exit(0);
    });
  });
});

module.exports = app;
