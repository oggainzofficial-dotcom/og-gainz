const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    reason: {
      type: String,
      enum: ['ADMIN_ADJUSTMENT', 'ORDER_PAYMENT', 'REFUND', 'REFERRAL', 'CASHBACK', 'MANUAL'],
      default: 'MANUAL',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    balanceBefore: {
      type: Number,
      min: 0,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      min: 0,
      default: 0,
    },
    createdBy: {
      type: String,
      enum: ['ADMIN', 'SYSTEM', 'USER'],
      default: 'SYSTEM',
      index: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: undefined,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ reason: 1, createdAt: -1 });

module.exports = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', walletTransactionSchema);
