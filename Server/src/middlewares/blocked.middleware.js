const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { ENV } = require('../config/env.config');

const resolveUserId = (req) => {
	const fromReqUser = String(req.user?.id || req.user?.userId || '').trim();
	if (fromReqUser) return fromReqUser;

	const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
	const match = authHeader.match(/^Bearer\s+(.+)$/i);
	if (!match || !match[1]) return '';

	try {
		const token = String(match[1]).trim().replace(/^"+|"+$/g, '');
		const payload = jwt.verify(token, ENV.JWT_SECRET);
		return String(payload?.userId || payload?.id || '').trim();
	} catch {
		return '';
	}
};

module.exports = async (req, res, next) => {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({
				status: 'error',
				error: 'AUTH_FAILED',
				source: 'blocked-middleware',
				reason: 'missing_user_on_request',
				message: 'Authentication required',
			});
		}

		const user = await User.findById(userId).select({ isBlocked: 1 }).lean();
		if (!user) {
			return res.status(401).json({
				status: 'error',
				error: 'AUTH_FAILED',
				source: 'blocked-middleware',
				reason: 'invalid_token_user',
				message: 'Invalid token user',
			});
		}

		if (!req.user) {
			req.user = { id: userId, userId };
		}

		if (user?.isBlocked) {
			return res.status(403).json({
				status: 'error',
				message: 'Your account is blocked. Please contact support.',
				code: 'USER_BLOCKED',
			});
		}

		return next();
	} catch (err) {
		return next(err);
	}
};
