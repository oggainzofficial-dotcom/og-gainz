const jwt = require('jsonwebtoken');

const { ENV } = require('../config/env.config');
const { verifyGoogleToken, verifyGoogleAccessToken } = require('../config/googleOAuth.config');
const User = require('../models/User.model');

const buildUserResponse = (user) => ({
  id: String(user._id),
  email: user.email,
  name: user.name,
  role: user.role,
  avatar: user.avatar,
  provider: user.provider,
  addresses: Array.isArray(user.addresses)
    ? user.addresses.map((a) => ({
      id: String(a._id),
      label: a.label,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      landmark: a.landmark,
      latitude: a.latitude,
      longitude: a.longitude,
      isDefault: Boolean(a.isDefault),
    }))
    : [],
  walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : 0,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const issueToken = (user) =>
  jwt.sign({ userId: String(user._id), role: user.role }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
  });

const login = async (req, res, next) => {
  try {
    const { email, name } = req.body ?? {};

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'email is required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const update = {};
    if (name && typeof name === 'string') {
      update.name = name.trim();
    }

    // Role is server-controlled; do not accept role from client.
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $setOnInsert: {
          email: normalizedEmail,
          role: 'user',
          provider: 'email',
        },
        ...(Object.keys(update).length ? { $set: update } : {}),
      },
      { new: true, upsert: true }
    );

    const token = issueToken(user);

    return res.status(200).json({
      status: 'success',
      token,
      user: buildUserResponse(user),
    });
  } catch (err) {
    return next(err);
  }
};

const google = async (req, res, next) => {
  try {
    const { idToken, credential, accessToken } = req.body ?? {};

    const effectiveIdToken = idToken || credential;

    const payload = effectiveIdToken
      ? await verifyGoogleToken(effectiveIdToken)
      : await verifyGoogleAccessToken(accessToken);

    const email = payload.email;
    const name = payload.name;
    const avatar = payload.picture || payload.avatar;
    const googleId = payload.sub || payload.id;

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Google account email is required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const set = {};
    if (name && typeof name === 'string' && name.trim().length > 0) set.name = name.trim();
    if (avatar && typeof avatar === 'string' && avatar.trim().length > 0) set.avatar = avatar.trim();
    if (googleId && typeof googleId === 'string' && googleId.trim().length > 0) set.googleId = googleId.trim();

    // Role is server-controlled; do not trust role from Google.
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $setOnInsert: {
          email: normalizedEmail,
          role: 'user',
          provider: 'google',
        },
        ...(Object.keys(set).length ? { $set: set } : {}),
      },
      { new: true, upsert: true }
    );

    const token = issueToken(user);

    return res.status(200).json({
      status: 'success',
      token,
      user: buildUserResponse(user),
    });
  } catch (err) {
    // google-auth-library throws on invalid/expired tokens
    return next(err);
  }
};

// Minimal signup endpoint (Phase 2 compatible): create user if missing and issue JWT.
// This keeps semantics simple for now and avoids breaking existing clients.
const signup = async (req, res, next) => {
  try {
    return login(req, res, next);
  } catch (err) {
    return next(err);
  }
};

const verify = async (req, res, next) => {
  try {
    // auth.middleware attaches req.user from JWT
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token user',
      });
    }

    return res.status(200).json({
      status: 'success',
      user: buildUserResponse(user),
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  login,
  signup,
  google,
  verify,
};
