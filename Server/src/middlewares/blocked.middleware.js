const User = require('../models/User.model');

module.exports = async (req, res, next) => {
	try {
		const userId = String(req.user?.id || req.user?.userId || '').trim();
		if (!userId) {
			return res.status(401).json({ status: 'error', message: 'Authentication required' });
		}

		const user = await User.findById(userId).select({ isBlocked: 1 }).lean();
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
