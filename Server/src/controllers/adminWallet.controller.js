const mongoose = require('mongoose');

const User = require('../models/User.model');
const WalletTransaction = require('../models/WalletTransaction.model');

const safeString = (v) => String(v || '').trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || '').trim());

const toFiniteNumber = (v) => {
	const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
	return Number.isFinite(n) ? n : null;
};

const getWalletSummary = async (req, res, next) => {
	try {
		const agg = await User.aggregate([
			{
				$group: {
					_id: null,
					totalUsers: { $sum: 1 },
					totalWalletBalance: { $sum: { $ifNull: ['$walletBalance', 0] } },
					usersWithBalance: {
						$sum: {
							$cond: [{ $gt: [{ $ifNull: ['$walletBalance', 0] }, 0] }, 1, 0],
						},
					},
					maxWalletBalance: { $max: { $ifNull: ['$walletBalance', 0] } },
					_nonZeroSum: {
						$sum: {
							$cond: [{ $gt: [{ $ifNull: ['$walletBalance', 0] }, 0] }, { $ifNull: ['$walletBalance', 0] }, 0],
						},
					},
					_nonZeroCount: {
						$sum: {
							$cond: [{ $gt: [{ $ifNull: ['$walletBalance', 0] }, 0] }, 1, 0],
						},
					},
				},
			},
			{
				$project: {
					_id: 0,
					totalUsers: 1,
					usersWithBalance: 1,
					totalWalletBalance: 1,
					maxWalletBalance: 1,
					avgWalletBalance: {
						$cond: [
							{ $gt: ['$_nonZeroCount', 0] },
							{ $divide: ['$_nonZeroSum', '$_nonZeroCount'] },
							0,
						],
					},
				},
			},
		]);

		const doc = Array.isArray(agg) && agg.length ? agg[0] : null;
		return res.json({
			status: 'success',
			data: {
				totalUsers: Number(doc?.totalUsers || 0),
				usersWithBalance: Number(doc?.usersWithBalance || 0),
				totalWalletBalance: Number(doc?.totalWalletBalance || 0),
				avgWalletBalance: Number(doc?.avgWalletBalance || 0),
				maxWalletBalance: Number(doc?.maxWalletBalance || 0),
			},
		});
	} catch (err) {
		return next(err);
	}
};

const addWalletCredits = async (req, res, next) => {
	try {
		const userId = safeString(req.body?.userId);
		if (!isValidObjectId(userId)) return res.status(400).json({ status: 'error', message: 'Invalid userId' });

		const amountRaw = toFiniteNumber(req.body?.amount);
		const amount = amountRaw == null ? null : Math.round(amountRaw);
		if (amount == null || amount <= 0) {
			return res.status(400).json({ status: 'error', message: 'amount must be a positive number' });
		}
		if (amount > 1_000_000) {
			return res.status(400).json({ status: 'error', message: 'amount is too large' });
		}

		const note = safeString(req.body?.note || '').slice(0, 200) || undefined;

		const session = await mongoose.startSession();
		let updated;
		try {
			await session.withTransaction(async () => {
				const before = await User.findById(userId).select({ walletBalance: 1 }).session(session).lean();
				if (!before) {
					const err = new Error('User not found');
					err.statusCode = 404;
					throw err;
				}
				const balanceBefore = Number(before.walletBalance || 0);
				const balanceAfter = Math.max(0, balanceBefore + amount);

				updated = await User.findByIdAndUpdate(
					userId,
					{ $inc: { walletBalance: amount } },
					{ new: true, select: { walletBalance: 1 }, session }
				).lean();

				await WalletTransaction.create(
					[
						{
							userId,
							type: 'CREDIT',
							amount,
							currency: 'INR',
							reason: 'ADMIN_ADJUSTMENT',
							description: note || 'Admin wallet credit',
							balanceBefore: Math.max(0, Math.round(balanceBefore)),
							balanceAfter: Math.max(0, Math.round(balanceAfter)),
							createdBy: 'ADMIN',
							createdByUserId: req.user?.id || undefined,
						},
					],
					{ session }
				);
			});
		} finally {
			session.endSession();
		}

		if (!updated) return res.status(404).json({ status: 'error', message: 'User not found' });

		return res.json({
			status: 'success',
			data: {
				userId,
				amount,
				note,
				walletBalance: typeof updated.walletBalance === 'number' ? updated.walletBalance : 0,
				createdAt: new Date().toISOString(),
			},
		});
	} catch (err) {
		return next(err);
	}
};

const listWalletTransactions = async (req, res, next) => {
	try {
		const userId = safeString(req.query?.userId);
		const limitRaw = toFiniteNumber(req.query?.limit);
		const limit = limitRaw == null ? 50 : Math.min(200, Math.max(1, Math.round(limitRaw)));
		const cursor = safeString(req.query?.cursor);

		const filter = {};
		if (userId) {
			if (!isValidObjectId(userId)) return res.status(400).json({ status: 'error', message: 'Invalid userId' });
			filter.userId = userId;
		}
		if (cursor) {
			if (!isValidObjectId(cursor)) return res.status(400).json({ status: 'error', message: 'Invalid cursor' });
			filter._id = { $lt: cursor };
		}

		const txns = await WalletTransaction.find(filter)
			.sort({ _id: -1 })
			.limit(limit)
			.populate('userId', 'email name')
			.lean();

		const nextCursor = txns.length ? String(txns[txns.length - 1]._id) : null;
		return res.json({ status: 'success', data: { items: txns, nextCursor } });
	} catch (err) {
		return next(err);
	}
};

module.exports = {
	getWalletSummary,
	addWalletCredits,
	listWalletTransactions,
};
