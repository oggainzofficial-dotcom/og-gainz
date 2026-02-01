const mongoose = require('mongoose');

// Phase 7: Pause/Skip request log
// - Used for user -> admin request/approval workflow.
// - Stores both PAUSE requests (date ranges) and SKIP requests (single day/delivery).

const REQUEST_TYPES = ['PAUSE', 'SKIP', 'WITHDRAW_PAUSE'];
const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN'];
const REQUEST_KINDS = ['customMeal', 'addon', 'mealPack', 'delivery', 'unknown'];

const PauseSkipLogSchema = new mongoose.Schema(
  {
    requestType: { type: String, required: true, enum: REQUEST_TYPES, uppercase: true, index: true },
    status: { type: String, required: true, enum: REQUEST_STATUSES, uppercase: true, default: 'PENDING', index: true },

    // Scope helpers
    kind: { type: String, required: true, enum: REQUEST_KINDS, default: 'unknown', index: true },
    subscriptionId: { type: String, required: false, default: undefined, index: true },
    deliveryId: { type: String, required: false, default: undefined, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Request details
    reason: { type: String, required: false, trim: true, default: undefined },
    pauseStartDate: { type: String, required: false, default: undefined }, // YYYY-MM-DD
    pauseEndDate: { type: String, required: false, default: undefined }, // YYYY-MM-DD
    skipDate: { type: String, required: false, default: undefined }, // YYYY-MM-DD

    // WITHDRAW_PAUSE: links to the original PAUSE request being withdrawn.
    linkedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'PauseSkipLog', required: false, default: undefined, index: true },

    // Admin decision
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: undefined, index: true },
    decidedAt: { type: Date, required: false, default: undefined },
    adminNote: { type: String, required: false, trim: true, default: undefined },
  },
  { timestamps: true }
);

PauseSkipLogSchema.index({ userId: 1, createdAt: -1 });
PauseSkipLogSchema.index({ status: 1, createdAt: -1 });
PauseSkipLogSchema.index({ requestType: 1, linkedTo: 1, createdAt: -1 });

module.exports = mongoose.model('PauseSkipLog', PauseSkipLogSchema);
