require('dotenv').config();

const getEnv = (key) => process.env[key];

const requireEnv = (key) => {
  const value = getEnv(key);
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const toNumber = (value, key) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
};

// Phase 1 required env vars (fail fast)
// Legacy compatibility: PORT, CLIENT_URL, MONGODB_URI still work, but standardize on:
// SERVER_PORT, CLIENT_ORIGIN, MONGO_URI
const resolvedKeys = {
  SERVER_PORT: getEnv('SERVER_PORT')
    ? 'SERVER_PORT'
    : (getEnv('PORT') ? 'PORT' : 'SERVER_PORT'),
  CLIENT_ORIGIN: getEnv('CLIENT_ORIGIN')
    ? 'CLIENT_ORIGIN'
    : (getEnv('CLIENT_URL') ? 'CLIENT_URL' : 'CLIENT_ORIGIN'),
  MONGO_URI: getEnv('MONGO_URI')
    ? 'MONGO_URI'
    : (getEnv('MONGODB_URI') ? 'MONGODB_URI' : 'MONGO_URI'),
};

const ENV = {
  NODE_ENV: getEnv('NODE_ENV') || 'development',

  SERVER_PORT: requireEnv(resolvedKeys.SERVER_PORT),
  CLIENT_ORIGIN: requireEnv(resolvedKeys.CLIENT_ORIGIN),
  MONGO_URI: requireEnv(resolvedKeys.MONGO_URI),

  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN') || '7d',

  // Phase 2B (Google) - optional at boot; auth route will error if missing.
  GOOGLE_CLIENT_ID: getEnv('GOOGLE_CLIENT_ID') || '',

  // Phase 3 (Cloudinary) - optional at boot; upload routes will error if missing.
  CLOUDINARY_CLOUD_NAME: getEnv('CLOUDINARY_CLOUD_NAME') || '',
  CLOUDINARY_API_KEY: getEnv('CLOUDINARY_API_KEY') || '',
  CLOUDINARY_API_SECRET: getEnv('CLOUDINARY_API_SECRET') || '',

  // GOOGLE_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI
  // are required only for OAuth redirect/code flow.
  // Phase 2B uses Google ID-token flow only.
  GOOGLE_CLIENT_SECRET: getEnv('GOOGLE_CLIENT_SECRET') || '',
  GOOGLE_OAUTH_REDIRECT_URI: getEnv('GOOGLE_OAUTH_REDIRECT_URI') || '',

  REDIS_HOST: getEnv('REDIS_HOST') || '',
  REDIS_PORT: toNumber(getEnv('REDIS_PORT'), 'REDIS_PORT'),
  REDIS_PASSWORD: getEnv('REDIS_PASSWORD') || '',

  EMAIL_HOST: getEnv('EMAIL_HOST') || '',
  EMAIL_PORT: toNumber(getEnv('EMAIL_PORT'), 'EMAIL_PORT'),
  EMAIL_USER: getEnv('EMAIL_USER') || '',
  EMAIL_PASSWORD: getEnv('EMAIL_PASSWORD') || '',

  STRIPE_SECRET_KEY: getEnv('STRIPE_SECRET_KEY') || '',
  STRIPE_WEBHOOK_SECRET: getEnv('STRIPE_WEBHOOK_SECRET') || '',

  // Phase 4 (Razorpay) - optional at boot; checkout initiation will error if missing.
  RAZORPAY_KEY_ID: getEnv('RAZORPAY_KEY_ID') || '',
  RAZORPAY_KEY_SECRET: getEnv('RAZORPAY_KEY_SECRET') || '',
  // Phase 5A (Razorpay webhooks) - should match the secret configured in Razorpay Dashboard > Webhooks.
  RAZORPAY_WEBHOOK_SECRET: getEnv('RAZORPAY_WEBHOOK_SECRET') || '',

  // Phase 5C (Checkout retry) - max retries per order
  MAX_PAYMENT_RETRIES: toNumber(getEnv('MAX_PAYMENT_RETRIES'), 'MAX_PAYMENT_RETRIES'),

  MAX_DELIVERY_DISTANCE_KM: toNumber(getEnv('MAX_DELIVERY_DISTANCE_KM'), 'MAX_DELIVERY_DISTANCE_KM'),
  BASE_DELIVERY_FEE: toNumber(getEnv('BASE_DELIVERY_FEE'), 'BASE_DELIVERY_FEE'),
  DELIVERY_FEE_PER_KM: toNumber(getEnv('DELIVERY_FEE_PER_KM'), 'DELIVERY_FEE_PER_KM'),

  // Phase 7 (Pause/Skip workflows) - optional
  // - Skip requests only allowed for today's delivery before this local time.
  SKIP_REQUEST_CUTOFF_HHMM: getEnv('SKIP_REQUEST_CUTOFF_HHMM') || '06:00',
  // - Skip requests must be submitted at least N minutes before the scheduled delivery time.
  //   (Preferred over HH:mm cutoff; defaults to 120.)
  SKIP_REQUEST_CUTOFF_MINUTES: toNumber(getEnv('SKIP_REQUEST_CUTOFF_MINUTES'), 'SKIP_REQUEST_CUTOFF_MINUTES'),
  // - Pause requests must be made at least N hours before pauseStartDate.
  PAUSE_REQUEST_CUTOFF_HOURS: toNumber(getEnv('PAUSE_REQUEST_CUTOFF_HOURS'), 'PAUSE_REQUEST_CUTOFF_HOURS'),
  // - Pause requests must be made at least N minutes before the next scheduled delivery.
  //   (Preferred; defaults to 120.)
  PAUSE_REQUEST_CUTOFF_MINUTES: toNumber(getEnv('PAUSE_REQUEST_CUTOFF_MINUTES'), 'PAUSE_REQUEST_CUTOFF_MINUTES'),
};

module.exports = { ENV };
