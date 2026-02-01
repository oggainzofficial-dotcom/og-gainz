const Order = require('../models/Order.model');
const DailyDelivery = require('../models/DailyDelivery.model');
const { getScheduleMetaByUserAndSubscription, localTodayISO } = require('../utils/subscriptionSchedule.util');

const toPublicOrderItem = (item) => {
  if (!item) return item;
  return {
    cartItemId: item.cartItemId,
    type: item.type,
    plan: item.plan,
    mealId: item.mealId ? String(item.mealId) : undefined,
    addonId: item.addonId ? String(item.addonId) : undefined,
    quantity: item.quantity,
    byoSelections: Array.isArray(item.byoSelections)
      ? item.byoSelections.map((s) => ({
        itemId: s.itemId ? String(s.itemId) : undefined,
        quantity: s.quantity,
      }))
      : undefined,
    pricingSnapshot: item.pricingSnapshot,
    orderDetails: item.orderDetails,
  };
};

const toAddressSummary = (addr) => {
  if (!addr) return undefined;
  const parts = [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode].filter(Boolean);
  return parts.join(', ');
};

const toPublicOrder = (order) => {
  if (!order) return order;
  return {
    id: String(order._id),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentFailureReason: order.paymentFailureReason,
    paymentProvider: order.paymentProvider,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,

    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    creditsApplied: order.creditsApplied,
    total: order.total,

    deliveryDistanceKm: order.deliveryDistanceKm,
    deliveryAddress: order.deliveryAddress,
    deliveryAddressSummary: toAddressSummary(order.deliveryAddress),

    paidAt: order.payment?.paidAt || undefined,
    paymentMethod: order.payment?.method || undefined,

    // Phase 5C retry support
    retryCount: order.retryCount,
    lastPaymentAttemptAt: order.lastPaymentAttemptAt,
    paymentAttempts: Array.isArray(order.paymentAttempts)
      ? order.paymentAttempts.map((a) => ({
        attemptId: a.attemptId,
        razorpayOrderId: a.razorpayOrderId,
        razorpayPaymentId: a.razorpayPaymentId,
        status: a.status,
        reason: a.reason,
        createdAt: a.createdAt,
      }))
      : undefined,

    createdAt: order.createdAt,
    updatedAt: order.updatedAt,

    items: Array.isArray(order.items) ? order.items.map(toPublicOrderItem) : [],
  };
};

const attachScheduleMetaToOrders = async ({ userId, orders }) => {
  const uid = String(userId || '').trim();
  const list = Array.isArray(orders) ? orders : [];
  if (!uid || !list.length) return list;

  const pairs = [];
  for (const o of list) {
    for (const it of o.items || []) {
      const subscriptionId = String(it?.cartItemId || '').trim();
      if (!subscriptionId) continue;
      pairs.push({ userId: uid, subscriptionId });
    }
  }

  const metaMap = await getScheduleMetaByUserAndSubscription({ DailyDelivery, pairs, todayISO: localTodayISO() });
  for (const o of list) {
    for (const it of o.items || []) {
      const subscriptionId = String(it?.cartItemId || '').trim();
      if (!subscriptionId) continue;
      const key = `${uid}|${subscriptionId}`;
      const sm = metaMap.get(key);
      if (!sm) continue;
      it.subscriptionSchedule = {
        scheduleEndDate: sm.scheduleEndDate,
        nextServingDate: sm.nextServingDate,
        deliveredCount: sm.deliveredCount,
        skippedCount: sm.skippedCount,
        scheduledCount: sm.scheduledCount,
      };
    }
  }

  return list;
};

const listMyOrders = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 20)));
    const page = Math.max(1, Number(req.query?.page || 1));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Order.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({
          status: 1,
          paymentStatus: 1,
          paymentFailureReason: 1,
          paymentProvider: 1,
          razorpayOrderId: 1,
          razorpayPaymentId: 1,
          payment: 1,
          subtotal: 1,
          deliveryFee: 1,
          creditsApplied: 1,
          total: 1,
          deliveryDistanceKm: 1,
          deliveryAddress: 1,
          items: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .lean(),
      Order.countDocuments({ userId }),
    ]);

    const publicOrders = items.map(toPublicOrder);
    await attachScheduleMetaToOrders({ userId, orders: publicOrders });

    return res.json({
      status: 'success',
      data: {
        items: publicOrders,
        meta: {
          page,
          limit,
          total,
          hasNextPage: skip + items.length < total,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

const getMyOrderById = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const orderId = String(req.params?.orderId || '').trim();
    if (!orderId) return res.status(400).json({ status: 'error', message: 'orderId is required' });

    const order = await Order.findOne({ _id: orderId, userId }).lean();
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

    const publicOrder = toPublicOrder(order);
    await attachScheduleMetaToOrders({ userId, orders: [publicOrder] });
    return res.json({ status: 'success', data: publicOrder });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listMyOrders,
  getMyOrderById,
};
