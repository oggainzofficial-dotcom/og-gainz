const mongoose = require('mongoose');

const CART_ITEM_TYPES = ['meal', 'addon', 'byo'];
const PLAN_TYPES = ['single', 'trial', 'weekly', 'monthly'];

// Phase 6C: Admin acceptance layer (separate from Phase 6A lifecycle)
const ORDER_ACCEPTANCE_STATUSES = ['PENDING_REVIEW', 'CONFIRMED', 'DECLINED'];

const OrderItemSchema = new mongoose.Schema(
  {
    cartItemId: { type: String, required: true },
    type: { type: String, required: true, enum: CART_ITEM_TYPES },
    plan: { type: String, required: true, enum: PLAN_TYPES },

    mealId: { type: mongoose.Schema.Types.ObjectId, ref: 'MealPack', required: false },
    addonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Addon', required: false },

    quantity: { type: Number, required: true, min: 1 },

    byoSelections: {
      type: [
        {
          itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuildYourOwnItem', required: true },
          quantity: { type: Number, required: true, min: 1 },
        },
      ],
      required: false,
      default: undefined,
    },

    pricingSnapshot: {
      title: { type: String, required: true },
      unitPrice: { type: Number, required: true, min: 0 },
      lineTotal: { type: Number, required: true, min: 0 },
    },

    orderDetails: {
      startDate: { type: String, required: false },
      deliveryTime: { type: String, required: false },
      immediateDelivery: { type: Boolean, required: false },
    },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    label: { type: String, required: false, trim: true },
    // Phase 7D: snapshot recipient/contact info at checkout (additive)
    username: { type: String, required: false, trim: true },
    contactNumber: { type: String, required: false, trim: true },
    // Phase 7E: snapshot full structured address parts (additive)
    housePlotNo: { type: String, required: false, trim: true },
    street: { type: String, required: false, trim: true },
    area: { type: String, required: false, trim: true },
    district: { type: String, required: false, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, required: false, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    landmark: { type: String, required: false, trim: true },
    latitude: { type: Number, required: false },
    longitude: { type: Number, required: false },
    googleMapsLink: { type: String, required: false, trim: true },
  },
  { _id: false }
);

const OrderPaymentSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, enum: ['razorpay'], default: 'razorpay' },
    orderId: { type: String, required: true },
    paymentId: { type: String, required: false },
    signature: { type: String, required: false },
    method: { type: String, required: false },
    status: { type: String, required: true, enum: ['CREATED', 'PAID', 'FAILED'], default: 'CREATED' },
    paidAt: { type: Date, required: false },
  },
  { _id: false }
);

// Phase 6A: post-payment lifecycle tracking (admin-controlled)
const ORDER_LIFECYCLE_STATUSES = ['PAID', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const OrderStatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true, enum: ORDER_LIFECYCLE_STATUSES },
    changedAt: { type: Date, required: true, default: Date.now },
    changedBy: { type: String, required: true, enum: ['SYSTEM', 'ADMIN'] },
  },
  { _id: false }
);

// Phase 5C: multiple payment attempts per order (for safe retries)
const PaymentAttemptSchema = new mongoose.Schema(
  {
    attemptId: { type: String, required: true },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, required: false },
    status: { type: String, required: true, enum: ['CREATED', 'FAILED', 'PAID'], default: 'CREATED' },
    reason: { type: String, required: false },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [OrderItemSchema], required: true },

    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    creditsApplied: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    deliveryDistanceKm: { type: Number, required: false },
    isServiceable: { type: Boolean, required: true, default: true },
    deliveryAddress: { type: AddressSchema, required: true },

    status: {
      type: String,
      required: true,
      // Keep legacy Phase-4 values, plus Phase-5A webhook-driven values.
      enum: ['pending_payment', 'paid', 'cancelled', 'PAID', 'PAYMENT_FAILED'],
      default: 'pending_payment',
    },

    // Phase 5A payment verification (webhook-driven)
    paymentStatus: { type: String, required: false, enum: ['PAID', 'FAILED'], default: undefined },
    paymentFailureReason: { type: String, required: false },

    paymentProvider: { type: String, required: true, enum: ['razorpay'], default: 'razorpay' },
    razorpayOrderId: { type: String, required: false },
    razorpayPaymentId: { type: String, required: false },
    razorpaySignature: { type: String, required: false },

    // Phase 5C retry support (do not remove existing payment fields)
    paymentAttempts: { type: [PaymentAttemptSchema], required: false, default: undefined },
    retryCount: { type: Number, required: true, default: 0, min: 0 },
    lastPaymentAttemptAt: { type: Date, required: false },

    // Phase 6A: strict forward-only lifecycle after payment (admin-controlled)
    currentStatus: {
      type: String,
      required: false,
      enum: ORDER_LIFECYCLE_STATUSES,
      default: 'PAID',
      index: true,
    },

    // Phase 6C: decision-focused admin acceptance (independent from Phase 6A lifecycle)
    // IMPORTANT: do NOT default this at schema-level. It is set on verified payment success (webhook).
    acceptanceStatus: {
      type: String,
      required: false,
      enum: ORDER_ACCEPTANCE_STATUSES,
      default: undefined,
      index: true,
    },

    // Phase 6C: single-admin "seen" tracking (set when opening admin order details)
    adminSeenAt: { type: Date, required: false, default: undefined, index: true },

    // Phase 6C: kitchen gate (acceptance can no longer be toggled after this)
    movedToKitchenAt: { type: Date, required: false, default: undefined, index: true },

    statusHistory: { type: [OrderStatusHistorySchema], required: false, default: undefined },

    estimatedDeliveryWindow: {
      from: { type: Date, required: false },
      to: { type: Date, required: false },
    },

    adminNotes: { type: String, required: false },

    payment: { type: OrderPaymentSchema, required: false, default: undefined },
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ 'items.mealId': 1, userId: 1, createdAt: -1 });
OrderSchema.index({ 'payment.paymentId': 1 }, { unique: true, sparse: true });
OrderSchema.index({ razorpayOrderId: 1 }, { sparse: true });
OrderSchema.index({ 'paymentAttempts.razorpayOrderId': 1 }, { sparse: true });
OrderSchema.index({ 'paymentAttempts.razorpayPaymentId': 1 }, { sparse: true });

module.exports = mongoose.model('Order', OrderSchema);
