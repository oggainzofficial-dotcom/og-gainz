const Razorpay = require('razorpay');
const crypto = require('crypto');

const Order = require('../models/Order.model');
const User = require('../models/User.model');
const MealPack = require('../models/MealPack.model');
const { getMealUnitPrice } = require('../utils/mealPricing.util');
const { ENV } = require('../config/env.config');

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeOrderDetailsByItemId = (value) => {
  if (!value || typeof value !== 'object') return {};

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key) continue;
    if (!raw || typeof raw !== 'object') continue;

    const startDate = typeof raw.startDate === 'string' ? raw.startDate.trim() : undefined;
    const deliveryTime = typeof raw.deliveryTime === 'string' ? raw.deliveryTime.trim() : undefined;
    const deliveryShift = typeof raw.deliveryShift === 'string' ? raw.deliveryShift.trim().toUpperCase() : undefined;
    const immediateDelivery = typeof raw.immediateDelivery === 'boolean' ? raw.immediateDelivery : undefined;

    out[String(key)] = {
      startDate: startDate || undefined,
      deliveryTime: deliveryTime || undefined,
      deliveryShift: deliveryShift || undefined,
      immediateDelivery,
    };
  }
  return out;
};

const VALID_SHIFTS = new Set(['MORNING', 'AFTERNOON', 'EVENING']);

const validateOrderDetailsForItems = ({ items, orderDetailsByItemId }) => {
  const arr = Array.isArray(items) ? items : [];
  for (const item of arr) {
    const cartItemId = String(item?.cartItemId || item?.id || '').trim();
    if (!cartItemId) continue;

    const plan = String(item?.plan || '').trim();
    const details = orderDetailsByItemId[cartItemId];
    if (!details) {
      const err = new Error(`Missing order details for cart item ${cartItemId}`);
      err.statusCode = 400;
      throw err;
    }

    const immediate = Boolean(details.immediateDelivery);
    const deliveryShift = typeof details.deliveryShift === 'string' ? details.deliveryShift.trim().toUpperCase() : '';
    if (deliveryShift && !VALID_SHIFTS.has(deliveryShift)) {
      const err = new Error(`Invalid deliveryShift for cart item ${cartItemId}`);
      err.statusCode = 400;
      throw err;
    }
    const needsSchedule = plan === 'weekly' || plan === 'monthly' || !immediate;

    if (needsSchedule) {
      const hasShift = typeof details.deliveryShift === 'string' && details.deliveryShift.trim().length > 0;
      const hasTime = typeof details.deliveryTime === 'string' && details.deliveryTime.trim().length > 0;
      if (!details.startDate || (!hasShift && !hasTime)) {
        const err = new Error(`Missing startDate/deliveryShift for cart item ${cartItemId}`);
        err.statusCode = 400;
        throw err;
      }
    }
  }
};

const normalizePlan = (value) => String(value || '').trim().toLowerCase();

const buildVerifiedMealItems = async (items) => {
  const normalized = Array.isArray(items) ? items : [];
  if (!normalized.length) {
    const err = new Error('Items are required');
    err.statusCode = 400;
    throw err;
  }

  const mealIds = normalized.map((i) => String(i?.mealId || '').trim()).filter(Boolean);
  if (!mealIds.length) {
    const err = new Error('No valid mealId provided');
    err.statusCode = 400;
    throw err;
  }

  const meals = await MealPack.find({ _id: { $in: mealIds }, isActive: true, deletedAt: { $exists: false } })
    .select({ name: 1, pricing: 1, proteinPricingMode: 1, proteinPricing: 1, isTrialEligible: 1 })
    .lean();
  const mealsById = new Map(meals.map((m) => [String(m._id), m]));

  const orderItems = [];
  let subtotal = 0;

  normalized.forEach((item, index) => {
    const mealId = String(item?.mealId || '').trim();
    if (!mealId) {
      const err = new Error('mealId is required');
      err.statusCode = 400;
      throw err;
    }

    const meal = mealsById.get(mealId);
    if (!meal) {
      const err = new Error(`Meal not found: ${mealId}`);
      err.statusCode = 400;
      throw err;
    }

    const plan = normalizePlan(item?.plan);
    if (!plan) {
      const err = new Error(`Invalid plan ${String(item?.plan || '')}`);
      err.statusCode = 400;
      throw err;
    }

    if (plan === 'trial' && !meal.isTrialEligible) {
      const err = new Error(`Invalid plan ${plan}`);
      err.statusCode = 400;
      throw err;
    }

    const requestedQuantity = Number(item?.quantity);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1) {
      const err = new Error(`Invalid quantity for meal ${mealId}`);
      err.statusCode = 400;
      throw err;
    }

    const unitPrice = getMealUnitPrice({ meal, plan });
    if (!(unitPrice > 0)) {
      const err = new Error(`Invalid plan ${plan}`);
      err.statusCode = 400;
      throw err;
    }

    const quantity = (plan === 'weekly' || plan === 'monthly') ? 1 : Math.floor(requestedQuantity);
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;

    orderItems.push({
      cartItemId: `meal-${mealId}-${index}`,
      type: 'meal',
      plan,
      mealId: meal._id,
      quantity,
      pricingSnapshot: {
        title: meal.name,
        unitPrice,
        lineTotal,
      },
    });
  });

  return { orderItems, subtotal };
};

const resolveDeliveryAddress = async ({ userId, deliveryAddressId, deliveryAddress }) => {
  if (deliveryAddressId) {
    const user = await User.findById(userId).select({ addresses: 1 }).lean();
    const addr = (user?.addresses || []).find((a) => String(a._id) === String(deliveryAddressId));
    if (!addr) {
      const err = new Error('Invalid deliveryAddressId');
      err.statusCode = 400;
      throw err;
    }

    // Phase 4/7: Ensure snapshots for Order model won't fail due to missing required fields
    if (!addr.addressLine1 || !addr.city || !addr.state || !addr.pincode) {
      const err = new Error('The selected address is incomplete (missing city, state, or pincode)');
      err.statusCode = 400;
      throw err;
    }

    return {
      label: addr.label,
      username: addr.username,
      contactNumber: addr.contactNumber,
      housePlotNo: addr.housePlotNo,
      street: addr.street,
      area: addr.area,
      district: addr.district,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      landmark: addr.landmark,
      latitude: typeof addr.latitude === 'number' ? addr.latitude : undefined,
      longitude: typeof addr.longitude === 'number' ? addr.longitude : undefined,
      googleMapsLink: addr.googleMapsLink,
    };
  }

  if (!deliveryAddress || typeof deliveryAddress !== 'object') {
    const err = new Error('deliveryAddress is required');
    err.statusCode = 400;
    throw err;
  }

  const required = ['addressLine1', 'city', 'state', 'pincode'];
  for (const key of required) {
    if (!String(deliveryAddress[key] || '').trim()) {
      const err = new Error(`${key} is required`);
      err.statusCode = 400;
      throw err;
    }
  }

  return {
    label: String(deliveryAddress.label || '').trim() || undefined,
    username: String(deliveryAddress.username || '').trim() || undefined,
    contactNumber: String(deliveryAddress.contactNumber || '').trim() || undefined,
    housePlotNo: String(deliveryAddress.housePlotNo || '').trim() || undefined,
    street: String(deliveryAddress.street || '').trim() || undefined,
    area: String(deliveryAddress.area || '').trim() || undefined,
    district: String(deliveryAddress.district || '').trim() || undefined,
    addressLine1: String(deliveryAddress.addressLine1 || '').trim(),
    addressLine2: String(deliveryAddress.addressLine2 || '').trim() || undefined,
    city: String(deliveryAddress.city || '').trim(),
    state: String(deliveryAddress.state || '').trim(),
    pincode: String(deliveryAddress.pincode || '').trim(),
    landmark: String(deliveryAddress.landmark || '').trim() || undefined,
    latitude: toFiniteNumber(deliveryAddress.latitude),
    longitude: toFiniteNumber(deliveryAddress.longitude),
    googleMapsLink: String(deliveryAddress.googleMapsLink || '').trim() || undefined,
  };
};

const mapQuotedItemsToOrderItems = (quotedItems, requestItems, orderDetailsByItemId) => {
  const requestByCartItemId = new Map(
    (Array.isArray(requestItems) ? requestItems : []).map((i) => [String(i?.cartItemId || i?.id || ''), i])
  );

  return quotedItems.map((q) => {
    const type = q.type;
    const plan = q.plan;
    const reqItem = requestByCartItemId.get(String(q.cartItemId));
    const byoSelections =
      type === 'byo'
        ? (Array.isArray(reqItem?.selections) ? reqItem.selections : []).map((s) => ({
          itemId: s.itemId,
          quantity: s.quantity,
        }))
        : undefined;

    return {
      cartItemId: q.cartItemId,
      type,
      plan,
      mealId: type === 'meal' ? q.mealId : undefined,
      addonId: type === 'addon' ? q.addonId : undefined,
      quantity: q.quantity,
      byoSelections,
      pricingSnapshot: {
        title: q.title,
        unitPrice: q.unitPrice,
        lineTotal: q.lineTotal,
      },
      orderDetails: orderDetailsByItemId?.[String(q.cartItemId)] || undefined,
    };
  });
};

const initiateCheckout = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    console.log(`[checkout.initiate] userId: ${userId}`);
    console.log(`[checkout.initiate] body: ${JSON.stringify(req.body)}`);
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ status: 'error', message: 'Razorpay is not configured' });
    }

    const deliveryAddress = await resolveDeliveryAddress({
      userId,
      deliveryAddressId: req.body?.deliveryAddressId || req.body?.addressId,
      deliveryAddress: req.body?.deliveryAddress,
    });

    // Quote based on delivery coords (if provided)
    const deliveryLocation =
      typeof deliveryAddress.latitude === 'number' && typeof deliveryAddress.longitude === 'number'
        ? {
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
          address: [deliveryAddress.addressLine1, deliveryAddress.city, deliveryAddress.pincode].filter(Boolean).join(', '),
        }
        : undefined;

    const { orderItems, subtotal } = await buildVerifiedMealItems(req.body?.items);
    const deliveryFee = 0;
    const creditsApplied = 0;
    const total = Math.max(0, subtotal + deliveryFee - creditsApplied);

    const orderDoc = await Order.create({
      userId,
      items: orderItems,
      subtotal,
      deliveryFee,
      creditsApplied,
      total,
      deliveryDistanceKm: undefined,
      isServiceable: true,
      deliveryAddress,
      status: 'pending_payment',
      paymentProvider: 'razorpay',
    });

    const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
    const amountPaise = Math.round(Number(total || 0) * 100);
    if (!(amountPaise > 0)) {
      return res.status(400).json({ status: 'error', message: 'Invalid payable amount' });
    }

    const rpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      payment_capture: 1,
      receipt: `og_${String(orderDoc._id)}`,
      notes: {
        appOrderId: String(orderDoc._id),
        userId: String(userId),
      },
    });

    orderDoc.razorpayOrderId = rpOrder.id;
    await orderDoc.save();

    return res.json({
      status: 'success',
      keyId: razorpayKeyId,
      razorpayOrder: {
        id: rpOrder.id,
        amount: rpOrder.amount,
        currency: rpOrder.currency,
        receipt: rpOrder.receipt,
      },
      order: {
        id: String(orderDoc._id),
        subtotal,
        deliveryFee,
        creditsApplied,
        total,
        deliveryDistanceKm: undefined,
        items: orderItems,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Phase 5C: retry payment for an existing order (order is immutable; payments can be retried)
const retryCheckout = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) return res.status(400).json({ status: 'error', message: 'orderId is required' });

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ status: 'error', message: 'Razorpay is not configured' });
    }

    const maxRetries = (Number.isFinite(ENV.MAX_PAYMENT_RETRIES) && ENV.MAX_PAYMENT_RETRIES > 0)
      ? ENV.MAX_PAYMENT_RETRIES
      : 3;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

    const alreadyPaid = String(order.paymentStatus || '').toUpperCase() === 'PAID' || String(order.status || '').toUpperCase() === 'PAID';
    if (alreadyPaid) {
      return res.status(400).json({ status: 'error', message: 'Order is already paid' });
    }

    const retryCount = Number(order.retryCount || 0);
    if (retryCount >= maxRetries) {
      return res.status(400).json({ status: 'error', message: 'Maximum retry attempts reached' });
    }

    // Idempotency guard: if there is a recent CREATED attempt, reuse it instead of creating multiple Razorpay orders.
    const attempts = Array.isArray(order.paymentAttempts) ? order.paymentAttempts : [];
    const lastAttempt = attempts.length ? attempts[attempts.length - 1] : undefined;
    const lastCreatedAt = lastAttempt?.createdAt ? new Date(lastAttempt.createdAt).getTime() : 0;
    const isRecentCreated = lastAttempt?.status === 'CREATED' && lastAttempt?.razorpayOrderId && Date.now() - lastCreatedAt < 15 * 60 * 1000;
    if (isRecentCreated) {
      return res.json({
        status: 'success',
        data: {
          keyId: razorpayKeyId,
          razorpayOrder: { id: lastAttempt.razorpayOrderId, amount: Math.round(Number(order.total || 0) * 100), currency: 'INR' },
          orderId: String(order._id),
        },
      });
    }

    const amountPaise = Math.round(Number(order.total || 0) * 100);
    if (!(amountPaise > 0)) {
      return res.status(400).json({ status: 'error', message: 'Invalid payable amount' });
    }

    const attemptId = `att_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
    const rpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      payment_capture: 1,
      receipt: `og_${String(order._id)}_${attemptId}`,
      notes: {
        appOrderId: String(order._id),
        attemptId,
        userId: String(userId),
      },
    });

    order.paymentAttempts = Array.isArray(order.paymentAttempts) ? order.paymentAttempts : [];
    order.paymentAttempts.push({
      attemptId,
      razorpayOrderId: rpOrder.id,
      status: 'CREATED',
      createdAt: new Date(),
    });
    order.retryCount = retryCount + 1;
    order.lastPaymentAttemptAt = new Date();
    await order.save();

    return res.json({
      status: 'success',
      data: {
        keyId: razorpayKeyId,
        razorpayOrder: {
          id: rpOrder.id,
          amount: rpOrder.amount,
          currency: rpOrder.currency,
        },
        orderId: String(order._id),
      },
    });
  } catch (err) {
    return next(err);
  }
};

const verifyCheckout = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ status: 'error', message: 'Missing payment details' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return res.status(500).json({ status: 'error', message: 'Razorpay secret not configured' });

    const generated = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated !== razorpay_signature) {
      return res.status(400).json({ status: 'error', message: 'Invalid payment signature' });
    }

    // Mark order as PAID
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, userId },
      {
        $set: {
          paymentStatus: 'PAID',
          status: 'PAID',
          'payment.paymentId': razorpay_payment_id,
          'payment.signature': razorpay_signature,
          'payment.status': 'PAID',
          'payment.paidAt': new Date(),
        },
        $push: {
          statusHistory: { status: 'PAID', changedAt: new Date(), changedBy: 'SYSTEM' },
        },
      },
      { new: true }
    );

    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

    return res.json({ status: 'success', message: 'Payment verified', data: { orderId: order._id } });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  initiateCheckout,
  retryCheckout,
  verifyCheckout,
};
