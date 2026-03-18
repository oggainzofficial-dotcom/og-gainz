const express = require('express');
const cors = require('cors');
const { ENV } = require('./config/env.config');
const routes = require('./routes/index.routes');
const adminSettingsRoutes = require('./routes/admin.settings.routes');
const { errorHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger.util');

const app = express();

const allowedOrigins = [
  "https://oggainz.com",
  "https://www.oggainz.com",
  "https://og-gainz.vercel.app",
  "http://localhost:5173"
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'https:' && (parsed.hostname === 'oggainz.com' || parsed.hostname.endsWith('.oggainz.com'))) {
      return true;
    }
  } catch (_) {
    // Ignore malformed origin and fall through to deny.
  }

  return false;
};

// Status logger for debugging 401s
app.use((req, res, next) => {
  const originalStatus = res.status;
  res.status = function (code) {
    if (code === 401) {
      console.log(`[debug] 401 status set for ${req.method} ${req.path}`);
      console.trace();
    }
    return originalStatus.apply(this, arguments);
  };
  next();
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Keep popup-based OAuth flows compatible across origins.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// Capture raw body for Razorpay webhook signature verification.
// Must be done before JSON parsing mutates the payload.
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        const url = String(req.originalUrl || req.url || '');
        if (url.startsWith('/api/webhooks/razorpay')) {
          req.rawBody = buf;
        }
      } catch (_) {
        // no-op
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  const maskedAuth = auth ? (auth.length > 20 ? auth.substring(0, 15) + '...' : 'present') : 'missing';
  logger.info(`${req.method} ${req.path} [Auth: ${maskedAuth}]`);
  next();
});

const auth = require('./middlewares/auth.middleware');
const authOptional = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return auth(req, res, next);
};

// Health check route
app.get('/health', authOptional, (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'OG Gainz Server is running',
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV,
    authed: !!req.user,
    userId: req.user?.id
  });
});

// API Routes
app.use('/api', routes);
app.use('/api/admin/settings', adminSettingsRoutes);

// 404 handler - catches all unmatched routes
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
