const jwt = require('jsonwebtoken');

const { ENV } = require('../config/env.config');
const User = require('../models/User.model');

const sanitizeToken = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  const unquoted = trimmed.replace(/^"+|"+$/g, '');
  return unquoted || null;
};

const getBearerToken = (req) => {
  const header = req.headers.authorization;
  if (typeof header === 'string') {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      return sanitizeToken(match[1]);
    }
  }

  // Optional fallback for proxies/clients that use a custom header.
  const alt = req.headers['x-access-token'];
  if (typeof alt === 'string') {
    return sanitizeToken(alt);
  }

  return null;
};

module.exports = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (ENV.NODE_ENV !== 'production') {
      const authHeader = req.headers.authorization || 'NONE';
      const maskedToken = token ? `${String(token).slice(0, 10)}...` : 'NONE';
      console.log(`AUTH HEADER: ${authHeader}`);
      console.log(`TOKEN: ${maskedToken}`);
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        error: 'AUTH_FAILED',
        source: 'auth-middleware',
        reason: 'NO_TOKEN',
        message: 'Authentication required',
      });
    }

    const payload = jwt.verify(token, ENV.JWT_SECRET);

    if (!payload || typeof payload !== 'object' || !payload.userId) {
      return res.status(401).json({
        status: 'error',
        error: 'AUTH_FAILED',
        source: 'auth-middleware',
        reason: 'invalid_jwt_payload',
        message: 'Invalid token',
      });
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        error: 'AUTH_FAILED',
        source: 'auth-middleware',
        reason: 'user_not_found',
        message: 'Invalid token user',
      });
    }

    const resolvedUserId = String(user._id);
    req.user = {
      id: resolvedUserId,
      userId: resolvedUserId,
      role: user.role,
    };

    return next();
  } catch (err) {
    // jsonwebtoken errors: JsonWebTokenError / TokenExpiredError
    return res.status(401).json({
      status: 'error',
      error: 'AUTH_FAILED',
      source: 'auth-middleware',
      reason: 'jwt_verify_failed',
      message: 'Invalid or expired token',
    });
  }
};
