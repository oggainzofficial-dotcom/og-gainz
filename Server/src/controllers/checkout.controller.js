const Razorpay = require('razorpay');

const Order = require('../models/Order.model');
const User = require('../models/User.model');
const { quoteCartData } = require('./cart.controller');
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
    const immediateDelivery = typeof raw.immediateDelivery === 'boolean' ? raw.immediateDelivery : undefined;

    out[String(key)] = {
      startDate: startDate || undefined,
      deliveryTime: deliveryTime || undefined,
      immediateDelivery,
    };
  }
  return out;
};

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
    const needsSchedule = plan === 'weekly' || plan === 'monthly' || !immediate;

    if (needsSchedule) {
      if (!details.startDate || !details.deliveryTime) {
        const err = new Error(`Missing startDate/deliveryTime for cart item ${cartItemId}`);
        err.statusCode = 400;
        throw err;
      }
    }
  }
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
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ status: 'error', message: 'Razorpay is not configured' });
    }

    const deliveryAddress = await resolveDeliveryAddress({
      userId,
      deliveryAddressId: req.body?.deliveryAddressId,
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

    const quote = await quoteCartData({
      userId,
      items: req.body?.items,
      creditsToApply: req.body?.creditsToApply,
      deliveryLocation,
    });

    if (!quote.isServiceable) {
      return res.status(400).json({ status: 'error', message: 'Delivery location is outside service area' });
    }

    const orderDetailsByItemId = normalizeOrderDetailsByItemId(req.body?.orderDetailsByItemId);
    validateOrderDetailsForItems({ items: req.body?.items, orderDetailsByItemId });

    const orderItems = mapQuotedItemsToOrderItems(quote.items, req.body?.items, orderDetailsByItemId);
    const orderDoc = await Order.create({
      userId,
      items: orderItems,
      subtotal: quote.subtotal,
      deliveryFee: quote.deliveryFee,
      creditsApplied: quote.creditsApplied,
      total: quote.total,
      deliveryDistanceKm: quote.distanceKm,
      isServiceable: quote.isServiceable,
      deliveryAddress,
      status: 'pending_payment',
      paymentProvider: 'razorpay',
    });

    const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
    const amountPaise = Math.round(Number(quote.total || 0) * 100);
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
      data: {
        keyId: razorpayKeyId,
        razorpayOrder: {
          id: rpOrder.id,
          amount: rpOrder.amount,
          currency: rpOrder.currency,
          receipt: rpOrder.receipt,
        },
        order: {
          id: String(orderDoc._id),
          subtotal: quote.subtotal,
          deliveryFee: quote.deliveryFee,
          creditsApplied: quote.creditsApplied,
          total: quote.total,
          deliveryDistanceKm: quote.distanceKm,
          items: quote.items,
        },
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

module.exports = {
  initiateCheckout,
  retryCheckout,
};
