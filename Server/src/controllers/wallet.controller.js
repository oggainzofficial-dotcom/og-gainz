const mongoose = require('mongoose');

const User = require('../models/User.model');
const WalletTransaction = require('../models/WalletTransaction.model');

const safeString = (v) => String(v || '').trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || '').trim());

const mapReasonToClient = (reason) => {
  const key = String(reason || '').toUpperCase();
  switch (key) {
    case 'ADMIN_ADJUSTMENT':
      return 'admin_adjustment';
    case 'ORDER_PAYMENT':
      return 'order_payment';
    case 'REFUND':
      return 'refund';
    case 'REFERRAL':
      return 'referral';
    case 'CASHBACK':
      return 'cashback';
    default:
      return 'admin_adjustment';
  }
};

const mapTypeToClient = (type) => (String(type || '').toUpperCase() === 'DEBIT' ? 'debit' : 'credit');

const getWalletSummary = async (req, res, next) => {
  try {
    const userId = safeString(req.user?.id || req.user?.userId);
    if (!isValidObjectId(userId)) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const user = await User.findById(userId).select({ walletBalance: 1 }).lean();
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    return res.json({
      status: 'success',
      data: {
        walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : 0,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const listWalletTransactions = async (req, res, next) => {
  try {
    const userId = safeString(req.user?.id || req.user?.userId);
    if (!isValidObjectId(userId)) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const limitRaw = Number(req.query?.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.round(limitRaw))) : 50;
    const cursor = safeString(req.query?.cursor);

    const filter = { userId };
    if (cursor) {
      if (!isValidObjectId(cursor)) return res.status(400).json({ status: 'error', message: 'Invalid cursor' });
      filter._id = { $lt: cursor };
    }

    const txns = await WalletTransaction.find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .lean();

    const items = (txns || []).map((t) => ({
      id: String(t._id),
      userId: String(t.userId),
      type: mapTypeToClient(t.type),
      amount: Number(t.amount || 0),
      reason: mapReasonToClient(t.reason),
      description: String(t.description || ''),
      createdAt: t.createdAt,
    }));

    const nextCursor = txns.length ? String(txns[txns.length - 1]._id) : null;
    return res.json({ status: 'success', data: { items, nextCursor } });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getWalletSummary,
  listWalletTransactions,
};
