const mongoose = require('mongoose');

const ManualOrder = require('../models/ManualOrder.model');
const MealPack = require('../models/MealPack.model');
const Addon = require('../models/Addon.model');
const BuildYourOwnItem = require('../models/BuildYourOwnItem.model');
const BuildYourOwnConfig = require('../models/BuildYourOwnConfig.model');
const Settings = require('../models/Settings.model');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const DailyDelivery = require('../models/DailyDelivery.model');
const logger = require('../utils/logger.util');
const { getMealUnitPrice, getAddonUnitPrice, getByoItemUnitPrice } = require('../utils/mealPricing.util');
const { calculateDeliveryCost } = require('../utils/deliveryCostCalculator');
const { calculateDeliveryFee } = require('../services/deliveryFeeCalculator');
const {
  normalizeSubscriptionDays,
  buildDeliverySchedule,
  buildManualOrderBillHtml,
  toISODate,
  normalizeTime,
} = require('../utils/manualOrder.util');
const { normalizeShift, resolveShiftFromTime } = require('../utils/deliveryShift.util');

const safeString = (value) => String(value || '').trim();

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return n;
};

const round2 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const clampPercentage = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const normalizePhone = (value) => safeString(value).replace(/\s+/g, '');

const buildManualOrderId = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MO-${stamp}-${rand}`;
};

const addDaysISO = (iso, days) => {
  const s = String(iso || '').trim();
  if (!s) return '';
  const dt = new Date(`${s}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setDate(dt.getDate() + days);
  return toISODate(dt) || '';
};

const buildDeliveryFeeSubscriptions = ({ mealItems, addonItems, byoItems, fallbackStartDate }) => {
  const allItems = [...(mealItems || []), ...(addonItems || []), ...(byoItems || [])];
  return allItems
    .map((item) => {
      const startDate = toISODate(item.start_date || fallbackStartDate);
      const days = Math.max(1, Number(item.subscription_days || 1));
      const endDate = startDate ? addDaysISO(startDate, days - 1) : '';
      const deliveryTime = normalizeTime(item.delivery_time) || '12:00';
      if (!startDate || !endDate || !deliveryTime) return null;
      return { start_date: startDate, end_date: endDate, delivery_time: deliveryTime };
    })
    .filter(Boolean);
};

const mapSubscriptionTypeToPlan = (subscriptionType) => {
  const type = safeString(subscriptionType).toLowerCase();
  if (type === 'weekly') return 'weekly';
  if (type === 'monthly') return 'monthly';
  return 'trial';
};

const getDeliverySettings = async () => {
  const settings = await Settings.findOne({}).lean();
  return {
    freeDeliveryRadius:
      settings && typeof settings.freeDeliveryRadius === 'number' ? settings.freeDeliveryRadius : 0,
    extraChargePerKm:
      settings && typeof settings.extraChargePerKm === 'number' ? settings.extraChargePerKm : 0,
    maxDeliveryRadius:
      settings && typeof settings.maxDeliveryRadius === 'number' ? settings.maxDeliveryRadius : 0,
  };
};

const buildAddressSnapshot = ({ customerName, phoneNumber, address }) => {
  return {
    label: 'Manual Order',
    username: customerName,
    contactNumber: phoneNumber,
    addressLine1: address,
    addressLine2: '',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '000000',
    landmark: '',
  };
};

const findOrCreateUser = async ({ customerName, phoneNumber, address }) => {
  const phone = normalizePhone(phoneNumber);
  if (!phone) return null;

  const existing = await User.findOne({ 'addresses.contactNumber': phone });
  if (existing) return existing;

  const base = `manual_${phone || Date.now()}`.toLowerCase();
  let email = `${base}@og-gainz.local`;
  let attempt = 0;
  while (await User.findOne({ email })) {
    attempt += 1;
    email = `${base}_${attempt}@og-gainz.local`;
  }

  const user = await User.create({
    email,
    name: customerName,
    provider: 'email',
    role: 'user',
    addresses: [
      {
        label: 'Manual',
        username: customerName,
        contactNumber: phone,
        addressLine1: address,
        addressLine2: '',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '000000',
        landmark: '',
        isDefault: true,
      },
    ],
  });

  return user;
};

const parseItems = async ({
  rawMeals,
  rawAddons,
  rawByo,
  defaultSubscriptionType,
  defaultDeliveryTime,
  defaultTrialDays,
  defaultStartDate,
}) => {
  const mealSelections = Array.isArray(rawMeals) ? rawMeals : [];
  const addonSelections = Array.isArray(rawAddons) ? rawAddons : [];
  const byoSelections = Array.isArray(rawByo) ? rawByo : [];

  const mealIds = mealSelections.map((m) => safeString(m?.mealId || m?.id)).filter(Boolean);
  const addonIds = addonSelections.map((a) => safeString(a?.addonId || a?.id)).filter(Boolean);
  const byoIds = byoSelections.map((b) => safeString(b?.addonId || b?.byoId || b?.id)).filter(Boolean);

  const [meals, addons, byoItemsList] = await Promise.all([
    mealIds.length
      ? MealPack.find({ _id: { $in: mealIds }, isActive: true, deletedAt: { $exists: false } })
          .select({ name: 1, pricing: 1, proteinPricingMode: 1, proteinPricing: 1, isTrialEligible: 1 })
          .lean()
      : Promise.resolve([]),
    addonIds.length
      ? Addon.find({ _id: { $in: addonIds }, isActive: true, deletedAt: { $exists: false } })
          .select({ name: 1, pricing: 1 })
          .lean()
      : Promise.resolve([]),
    byoIds.length
      ? BuildYourOwnItem.find({ _id: { $in: byoIds }, isActive: true, deletedAt: { $exists: false } })
          .select({ name: 1, pricing: 1 })
          .lean()
      : Promise.resolve([]),
  ]);

  const mealsById = new Map(meals.map((m) => [String(m._id), m]));
  const addonsById = new Map(addons.map((a) => [String(a._id), a]));
  const byoItemsById = new Map(byoItemsList.map((b) => [String(b._id), b]));

  const mealItems = [];
  let mealCost = 0;

  mealSelections.forEach((sel, index) => {
    const mealId = safeString(sel?.mealId || sel?.id);
    if (!mealId) return;
    const meal = mealsById.get(mealId);
    if (!meal) throw new Error(`Invalid mealId: ${mealId}`);

    const subscriptionType = safeString(sel?.subscriptionType || defaultSubscriptionType).toLowerCase();
    if (!['trial', 'weekly', 'monthly'].includes(subscriptionType)) {
      throw new Error(`Invalid subscription type for ${meal.name}`);
    }

    if (subscriptionType === 'trial' && !meal.isTrialEligible) {
      throw new Error(`Meal not available for trial: ${meal.name}`);
    }

    const quantity = Math.max(1, toInt(sel?.quantity, 1));
    const plan = mapSubscriptionTypeToPlan(subscriptionType);
    const unitPrice = getMealUnitPrice({ meal, plan });
    if (!(unitPrice > 0)) throw new Error(`Meal not available for ${plan}: ${meal.name}`);

    const trialDays = toInt(sel?.trialDays, defaultTrialDays);
    const subscriptionDays = normalizeSubscriptionDays({ subscriptionType, trialDays });
    const deliveryTime = normalizeTime(sel?.deliveryTime || defaultDeliveryTime) || '12:00';
    const startDate = toISODate(sel?.startDate) || toISODate(defaultStartDate) || toISODate(new Date());

    const lineTotal = unitPrice * quantity;
    mealCost += lineTotal;
    mealItems.push({
      itemId: `meal-${mealId}-${index}`,
      sourceId: meal._id,
      type: 'meal',
      name: meal.name,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      subscription_type: subscriptionType,
      subscription_days: subscriptionDays,
      delivery_time: deliveryTime,
      start_date: startDate,
    });
  });

  const addonItems = [];
  let addonCost = 0;

  addonSelections.forEach((sel, index) => {
    const addonId = safeString(sel?.addonId || sel?.id);
    if (!addonId) return;
    const addon = addonsById.get(addonId);
    if (!addon) throw new Error(`Invalid addonId: ${addonId}`);

    const subscriptionType = safeString(sel?.subscriptionType || defaultSubscriptionType).toLowerCase();
    if (!['trial', 'weekly', 'monthly'].includes(subscriptionType)) {
      throw new Error(`Invalid subscription type for add-on ${addon.name}`);
    }

    const quantity = Math.max(1, toInt(sel?.quantity, 1));
    const plan = mapSubscriptionTypeToPlan(subscriptionType);
    const unitPrice = getAddonUnitPrice({ addon, plan });
    if (!(unitPrice > 0)) throw new Error(`Add-on not available for ${plan}: ${addon.name}`);

    const trialDays = toInt(sel?.trialDays, defaultTrialDays);
    const subscriptionDays = normalizeSubscriptionDays({ subscriptionType, trialDays });
    const deliveryTime = normalizeTime(sel?.deliveryTime || defaultDeliveryTime) || '12:00';
    const startDate = toISODate(sel?.startDate) || toISODate(defaultStartDate) || toISODate(new Date());

    const lineTotal = unitPrice * quantity;
    addonCost += lineTotal;
    addonItems.push({
      itemId: `addon-${addonId}-${index}`,
      sourceId: addon._id,
      type: 'addon',
      name: addon.name,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      subscription_type: subscriptionType,
      subscription_days: subscriptionDays,
      delivery_time: deliveryTime,
      start_date: startDate,
    });
  });

  const byoItems = [];
  let byoCost = 0;

  byoSelections.forEach((sel, index) => {
    const byoId = safeString(sel?.addonId || sel?.byoId || sel?.id);
    if (!byoId) return;
    const byoItem = byoItemsById.get(byoId);
    if (!byoItem) throw new Error(`Invalid byoId: ${byoId}`);

    const subscriptionType = safeString(sel?.subscriptionType || defaultSubscriptionType).toLowerCase();
    if (!['trial', 'weekly', 'monthly'].includes(subscriptionType)) {
      throw new Error(`Invalid subscription type for BYO item ${byoItem.name}`);
    }

    const quantity = Math.max(1, toInt(sel?.quantity, 1));
    const plan = mapSubscriptionTypeToPlan(subscriptionType);
    const unitPrice = getByoItemUnitPrice({ byoItem, plan });
    if (!(unitPrice > 0)) throw new Error(`BYO item not available for ${plan}: ${byoItem.name}`);

    const trialDays = toInt(sel?.trialDays, defaultTrialDays);
    const subscriptionDays = normalizeSubscriptionDays({ subscriptionType, trialDays });
    const deliveryTime = normalizeTime(sel?.deliveryTime || defaultDeliveryTime) || '12:00';
    const startDate = toISODate(sel?.startDate) || toISODate(defaultStartDate) || toISODate(new Date());

    const lineTotal = unitPrice * quantity;
    byoCost += lineTotal;
    byoItems.push({
      itemId: `byo-${byoId}-${index}`,
      sourceId: byoItem._id,
      type: 'byo',
      name: byoItem.name,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      subscription_type: subscriptionType,
      subscription_days: subscriptionDays,
      delivery_time: deliveryTime,
      start_date: startDate,
    });
  });

  return { mealItems, addonItems, byoItems, mealCost, addonCost, byoCost };
};

const buildAuditEntry = ({ action, adminId, changes }) => ({
  action,
  changedByAdmin: adminId || undefined,
  changedAt: new Date(),
  changes: changes || undefined,
});

const applyManualOrderUpdate = ({ existing, updates, adminId }) => {
  const changes = {};
  Object.keys(updates).forEach((key) => {
    if (existing[key] !== updates[key]) {
      changes[key] = { before: existing[key], after: updates[key] };
    }
  });

  existing.audit_log = Array.isArray(existing.audit_log) ? existing.audit_log : [];
  existing.audit_log.push(buildAuditEntry({ action: 'update', adminId, changes }));

  Object.assign(existing, updates);
};

const findManualOrderById = async (idOrCode) => {
  const raw = safeString(idOrCode);
  if (!raw) return null;
  if (mongoose.isValidObjectId(raw)) {
    const doc = await ManualOrder.findById(raw);
    if (doc) return doc;
  }
  return ManualOrder.findOne({ manual_order_id: raw });
};

const createManualOrder = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const customerName = safeString(req.body?.customerName);
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    const whatsappNumber = normalizePhone(req.body?.whatsappNumber);
    const address = safeString(req.body?.address);
    const notes = safeString(req.body?.notes);

    if (!customerName || !phoneNumber || !address) {
      return res.status(400).json({ status: 'error', message: 'Customer name, phone number, and address are required' });
    }

    const subscriptionType = safeString(req.body?.subscriptionType || 'weekly').toLowerCase();
    if (!['trial', 'weekly', 'monthly'].includes(subscriptionType)) {
      return res.status(400).json({ status: 'error', message: 'Invalid subscriptionType' });
    }

    const trialDays = toInt(req.body?.trialDays, undefined);
    const subscriptionDays = normalizeSubscriptionDays({ subscriptionType, trialDays });
    const startDate = toISODate(req.body?.startDate) || toISODate(new Date());
    const deliveryTime = normalizeTime(req.body?.deliveryTime) || '12:00';
    const deliveriesPerDay = Math.max(1, toInt(req.body?.deliveriesPerDay, 1));
    const distanceKm = Math.max(0, toNumber(req.body?.distanceKm));

    const { mealItems, addonItems, byoItems, mealCost, addonCost, byoCost } = await parseItems({
      rawMeals: req.body?.mealItems,
      rawAddons: req.body?.addonItems,
      rawByo: req.body?.byoItems,
      defaultSubscriptionType: subscriptionType,
      defaultDeliveryTime: deliveryTime,
      defaultTrialDays: trialDays,
      defaultStartDate: startDate,
    });

    if (!mealItems.length && !addonItems.length && !byoItems.length) {
      return res.status(400).json({ status: 'error', message: 'Select at least one meal, add-on, or BYO item' });
    }

    const deliverySettings = await getDeliverySettings();
    if (deliverySettings.maxDeliveryRadius && distanceKm > deliverySettings.maxDeliveryRadius) {
      return res.status(400).json({ status: 'error', message: 'Delivery location is outside service area' });
    }
    const singleDeliveryCost = calculateDeliveryCost(
      distanceKm,
      deliverySettings.freeDeliveryRadius,
      deliverySettings.extraChargePerKm
    );
    const deliveryFeeSubscriptions = buildDeliveryFeeSubscriptions({
      mealItems,
      addonItems,
      byoItems,
      fallbackStartDate: startDate,
    });
    const totalDeliveryFee = calculateDeliveryFee(deliveryFeeSubscriptions, singleDeliveryCost);

    const grossTotal = mealCost + addonCost + byoCost + totalDeliveryFee;
    const discountPercentage = clampPercentage(req.body?.discountPercentage);
    const discountAmount = round2((grossTotal * discountPercentage) / 100);
    const grandTotal = round2(Math.max(0, grossTotal - discountAmount));

    const user = await findOrCreateUser({ customerName, phoneNumber, address });

    const manualOrderId = buildManualOrderId();
    const manualOrder = await ManualOrder.create({
      manual_order_id: manualOrderId,
      user_id: user?._id,
      customer_name: customerName,
      phone_number: phoneNumber,
      whatsapp_number: whatsappNumber,
      address,
      notes,
      distance_km: distanceKm,
      delivery_cost_per_km: deliverySettings.extraChargePerKm,
      single_delivery_cost: singleDeliveryCost,
      deliveries_per_day: deliveriesPerDay,
      delivery_time: deliveryTime,
      subscription_type: subscriptionType,
      subscription_days: subscriptionDays,
      start_date: startDate,
      meal_items: mealItems,
      addon_items: addonItems,
      byo_items: byoItems,
      meal_cost: mealCost,
      addon_cost: addonCost,
      byo_cost: byoCost,
      delivery_cost_total: totalDeliveryFee,
      discount_percentage: discountPercentage,
      discount_amount: discountAmount,
      grand_total: grandTotal,
      payment_status: 'PENDING',
      order_status: 'PENDING_PAYMENT',
      created_by_admin: adminId || undefined,
      audit_log: [buildAuditEntry({ action: 'create', adminId })],
    });

    return res.json({ status: 'success', data: manualOrder.toObject() });
  } catch (err) {
    return next(err);
  }
};

const updateManualOrder = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const manualOrder = await findManualOrderById(req.params?.id);
    if (!manualOrder) return res.status(404).json({ status: 'error', message: 'Manual order not found' });

    if (manualOrder.payment_status !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Manual order cannot be edited after payment' });
    }
    if (manualOrder.order_status === 'CANCELLED') {
      return res.status(400).json({ status: 'error', message: 'Manual order is cancelled' });
    }

    const customerName = safeString(req.body?.customerName || manualOrder.customer_name);
    const phoneNumber = normalizePhone(req.body?.phoneNumber || manualOrder.phone_number);
    const whatsappNumber = normalizePhone(req.body?.whatsappNumber || manualOrder.whatsapp_number);
    const address = safeString(req.body?.address || manualOrder.address);
    const notes = safeString(req.body?.notes || manualOrder.notes);

    const subscriptionType = safeString(req.body?.subscriptionType || manualOrder.subscription_type || 'weekly').toLowerCase();
    if (!['trial', 'weekly', 'monthly'].includes(subscriptionType)) {
      return res.status(400).json({ status: 'error', message: 'Invalid subscriptionType' });
    }

    const trialDays = toInt(req.body?.trialDays, manualOrder.subscription_days);
    const subscriptionDays = normalizeSubscriptionDays({ subscriptionType, trialDays });
    const startDate = toISODate(req.body?.startDate) || manualOrder.start_date || toISODate(new Date());
    const deliveryTime = normalizeTime(req.body?.deliveryTime) || manualOrder.delivery_time || '12:00';
    const deliveriesPerDay = Math.max(1, toInt(req.body?.deliveriesPerDay, manualOrder.deliveries_per_day || 1));
    const distanceKm = Math.max(0, toNumber(req.body?.distanceKm, manualOrder.distance_km || 0));

    const fallbackMeals = Array.isArray(manualOrder.meal_items)
      ? manualOrder.meal_items.map((item) => ({
        mealId: item.sourceId,
        quantity: item.quantity,
        subscriptionType: item.subscription_type,
        deliveryTime: item.delivery_time,
        trialDays: item.subscription_days,
        startDate: item.start_date,
      }))
      : [];
    const fallbackAddons = Array.isArray(manualOrder.addon_items)
      ? manualOrder.addon_items.map((item) => ({
        addonId: item.sourceId,
        quantity: item.quantity,
        subscriptionType: item.subscription_type,
        deliveryTime: item.delivery_time,
        trialDays: item.subscription_days,
        startDate: item.start_date,
      }))
      : [];
    const fallbackByo = Array.isArray(manualOrder.byo_items)
      ? manualOrder.byo_items.map((item) => ({
        byoId: item.sourceId,
        quantity: item.quantity,
        subscriptionType: item.subscription_type,
        deliveryTime: item.delivery_time,
        trialDays: item.subscription_days,
        startDate: item.start_date,
      }))
      : [];

    const { mealItems, addonItems, byoItems, mealCost, addonCost, byoCost } = await parseItems({
      rawMeals: req.body?.mealItems ?? fallbackMeals,
      rawAddons: req.body?.addonItems ?? fallbackAddons,
      rawByo: req.body?.byoItems ?? fallbackByo,
      defaultSubscriptionType: subscriptionType,
      defaultDeliveryTime: deliveryTime,
      defaultTrialDays: trialDays,
      defaultStartDate: startDate,
    });

    if (!mealItems.length && !addonItems.length && !byoItems.length) {
      return res.status(400).json({ status: 'error', message: 'Select at least one meal, add-on, or BYO item' });
    }

    const deliverySettings = await getDeliverySettings();
    if (deliverySettings.maxDeliveryRadius && distanceKm > deliverySettings.maxDeliveryRadius) {
      return res.status(400).json({ status: 'error', message: 'Delivery location is outside service area' });
    }
    const singleDeliveryCost = calculateDeliveryCost(
      distanceKm,
      deliverySettings.freeDeliveryRadius,
      deliverySettings.extraChargePerKm
    );
    const deliveryFeeSubscriptions = buildDeliveryFeeSubscriptions({
      mealItems,
      addonItems,
      byoItems,
      fallbackStartDate: startDate,
    });
    const totalDeliveryFee = calculateDeliveryFee(deliveryFeeSubscriptions, singleDeliveryCost);

    const grossTotal = mealCost + addonCost + byoCost + totalDeliveryFee;
    const fallbackPctFromAmount = grossTotal > 0 ? (toNumber(manualOrder.discount_amount || 0) / grossTotal) * 100 : 0;
    const fallbackPct = Number.isFinite(Number(manualOrder.discount_percentage))
      ? Number(manualOrder.discount_percentage)
      : fallbackPctFromAmount;
    const discountPercentage = clampPercentage(toNumber(req.body?.discountPercentage, fallbackPct));
    const discountAmount = round2((grossTotal * discountPercentage) / 100);
    const grandTotal = round2(Math.max(0, grossTotal - discountAmount));

    const updates = {
      customer_name: customerName,
      phone_number: phoneNumber,
      whatsapp_number: whatsappNumber,
      address,
      notes,
      distance_km: distanceKm,
      delivery_cost_per_km: deliverySettings.extraChargePerKm,
      single_delivery_cost: singleDeliveryCost,
      deliveries_per_day: deliveriesPerDay,
      delivery_time: deliveryTime,
      subscription_type: subscriptionType,
      subscription_days: subscriptionDays,
      start_date: startDate,
      meal_items: mealItems,
      addon_items: addonItems,
      byo_items: byoItems,
      meal_cost: mealCost,
      addon_cost: addonCost,
      byo_cost: byoCost,
      delivery_cost_total: totalDeliveryFee,
      discount_percentage: discountPercentage,
      discount_amount: discountAmount,
      grand_total: grandTotal,
    };

    applyManualOrderUpdate({ existing: manualOrder, updates, adminId });
    await manualOrder.save();

    return res.json({ status: 'success', data: manualOrder.toObject() });
  } catch (err) {
    return next(err);
  }
};

const cancelManualOrder = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const manualOrder = await findManualOrderById(req.params?.id);
    if (!manualOrder) return res.status(404).json({ status: 'error', message: 'Manual order not found' });

    if (manualOrder.payment_status === 'PAID') {
      return res.status(400).json({ status: 'error', message: 'Paid manual order cannot be cancelled' });
    }

    applyManualOrderUpdate({
      existing: manualOrder,
      updates: { payment_status: 'CANCELLED', order_status: 'CANCELLED' },
      adminId,
    });
    await manualOrder.save();

    return res.json({ status: 'success', data: manualOrder.toObject() });
  } catch (err) {
    return next(err);
  }
};

const getManualOrder = async (req, res, next) => {
  try {
    const manualOrder = await findManualOrderById(req.params?.id);
    if (!manualOrder) return res.status(404).json({ status: 'error', message: 'Manual order not found' });
    return res.json({ status: 'success', data: manualOrder.toObject() });
  } catch (err) {
    return next(err);
  }
};

const generateManualOrderBill = async (req, res, next) => {
  try {
    const id = req.body?.manualOrderId || req.body?.id;
    const manualOrder = await findManualOrderById(id);
    if (!manualOrder) return res.status(404).json({ status: 'error', message: 'Manual order not found' });

    const html = buildManualOrderBillHtml({ manualOrder, billId: String(manualOrder._id) });
    manualOrder.bill_html = html;
    manualOrder.bill_generated_at = new Date();
    manualOrder.audit_log = Array.isArray(manualOrder.audit_log) ? manualOrder.audit_log : [];
    manualOrder.audit_log.push(buildAuditEntry({ action: 'generate_bill', adminId: req.user?.id || req.user?._id }));
    await manualOrder.save();

    return res.json({
      status: 'success',
      data: {
        billUrl: `/api/manual-orders/${manualOrder._id}/bill`,
        billGeneratedAt: manualOrder.bill_generated_at,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const getManualOrderBill = async (req, res, next) => {
  try {
    const manualOrder = await findManualOrderById(req.params?.id);
    if (!manualOrder) return res.status(404).json({ status: 'error', message: 'Manual order not found' });

    const html = buildManualOrderBillHtml({ manualOrder, billId: String(manualOrder._id) });
    manualOrder.bill_html = html;
    manualOrder.bill_generated_at = new Date();
    await manualOrder.save();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    return next(err);
  }
};

const buildOrderItemsFromManual = ({ manualOrder }) => {
  const items = [];
  const allItems = [...(manualOrder.meal_items || []), ...(manualOrder.addon_items || []), ...(manualOrder.byo_items || [])];
  allItems.forEach((item) => {
    const subscriptionType = String(item.subscription_type || manualOrder.subscription_type || 'weekly').toLowerCase();
    const plan = mapSubscriptionTypeToPlan(subscriptionType);
    const deliveryTime = normalizeTime(item.delivery_time || manualOrder.delivery_time) || '12:00';
    const deliveryShift = normalizeShift(resolveShiftFromTime(deliveryTime));
    const startDate = item.start_date || manualOrder.start_date;
    const orderDetails = {
      startDate,
      deliveryTime,
      deliveryShift,
      immediateDelivery: false,
    };
    const cartItemId = `manual-${manualOrder.manual_order_id}-${item.itemId}`;
    items.push({
      cartItemId,
      type: item.type,
      plan,
      mealId: item.type === 'meal' ? item.sourceId : undefined,
      addonId: item.type === 'addon' ? item.sourceId : undefined,
      byoSelections: item.type === 'byo' ? [{ itemId: item.sourceId, quantity: item.quantity }] : undefined,
      quantity: item.type === 'byo' ? 1 : item.quantity, // Byo uses root quantity 1 usually, selections hold actual qty. But wait, we can just map it safely keeping quantity.
      pricingSnapshot: {
        title: item.name,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
      },
      orderDetails,
    });
  });
  return items;
};

const buildDailyDeliveryDocs = ({ manualOrder, orderId }) => {
  const address = buildAddressSnapshot({
    customerName: manualOrder.customer_name,
    phoneNumber: manualOrder.phone_number,
    address: manualOrder.address,
  });

  const docs = [];
  const allItems = [...(manualOrder.meal_items || []), ...(manualOrder.addon_items || []), ...(manualOrder.byo_items || [])];
  allItems.forEach((item) => {
    const subscriptionType = String(item.subscription_type || manualOrder.subscription_type || 'weekly').toLowerCase();
    const plan = mapSubscriptionTypeToPlan(subscriptionType);
    const deliveryTime = normalizeTime(item.delivery_time || manualOrder.delivery_time) || '12:00';
    const deliveryShift = normalizeShift(resolveShiftFromTime(deliveryTime));
    const subscriptionDays = Number(item.subscription_days || manualOrder.subscription_days || 1);
    const startDate = item.start_date || manualOrder.start_date;

    const schedule = buildDeliverySchedule({
      startDate,
      subscriptionDays,
      deliveriesPerDay: manualOrder.deliveries_per_day,
      deliveryTime,
    });

    schedule.forEach((slot) => {
      docs.push({
        date: slot.date,
        time: slot.time || deliveryTime,
        deliveryShift: deliveryShift || slot.deliveryShift,
        userId: manualOrder.user_id,
        address,
        items: [
          {
            orderId,
            cartItemId: `manual-${manualOrder.manual_order_id}-${item.itemId}`,
            itemId: `manual-${manualOrder.manual_order_id}-${item.itemId}`,
            name: item.name,
            type: item.type,
            plan,
            title: item.name,
            quantity: item.quantity,
          },
        ],
        sourceOrderId: orderId,
        sourceCartItemId: `manual-${manualOrder.manual_order_id}-${item.itemId}-${slot.date}-${slot.slot}`,
        subscriptionId: `manual-${manualOrder.manual_order_id}-${item.itemId}`,
      });
    });
  });

  return docs;
};

const markManualOrderPaid = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const manualOrder = await findManualOrderById(req.params?.id);
    if (!manualOrder) return res.status(404).json({ status: 'error', message: 'Manual order not found' });

    if (manualOrder.payment_status === 'PAID') {
      return res.json({ status: 'success', data: manualOrder.toObject() });
    }
    if (manualOrder.order_status === 'CANCELLED') {
      return res.status(400).json({ status: 'error', message: 'Manual order is cancelled' });
    }

    if (!manualOrder.user_id) {
      const user = await findOrCreateUser({
        customerName: manualOrder.customer_name,
        phoneNumber: manualOrder.phone_number,
        address: manualOrder.address,
      });
      manualOrder.user_id = user?._id;
    }

    if (!manualOrder.user_id) {
      return res.status(400).json({ status: 'error', message: 'Unable to resolve customer record' });
    }

    const orderItems = buildOrderItemsFromManual({ manualOrder });
    if (!orderItems.length) {
      return res.status(400).json({ status: 'error', message: 'Manual order has no items' });
    }

    const deliveryAddress = buildAddressSnapshot({
      customerName: manualOrder.customer_name,
      phoneNumber: manualOrder.phone_number,
      address: manualOrder.address,
    });

    const orderDoc = await Order.create({
      userId: manualOrder.user_id,
      items: orderItems,
      subtotal: Number(manualOrder.meal_cost || 0) + Number(manualOrder.addon_cost || 0) + Number(manualOrder.byo_cost || 0),
      deliveryFee: Number(manualOrder.delivery_cost_total || 0),
      creditsApplied: 0,
      total: Number(manualOrder.grand_total || 0),
      deliveryDistanceKm: Number(manualOrder.distance_km || 0),
      isServiceable: true,
      deliveryAddress,
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentProvider: 'razorpay',
      payment: {
        provider: 'razorpay',
        orderId: manualOrder.manual_order_id,
        status: 'PAID',
        paidAt: new Date(),
      },
      currentStatus: 'PAID',
      acceptanceStatus: 'CONFIRMED',
      statusHistory: [{ status: 'PAID', changedAt: new Date(), changedBy: 'SYSTEM' }],
      adminNotes: `Manual order ${manualOrder.manual_order_id}`,
      movedToKitchenAt: new Date(),
    });

    const deliveries = buildDailyDeliveryDocs({ manualOrder, orderId: orderDoc._id });
    let deliveriesCreated = 0;
    if (deliveries.length) {
      try {
        const inserted = await DailyDelivery.insertMany(deliveries, { ordered: false });
        deliveriesCreated = Array.isArray(inserted) ? inserted.length : 0;
      } catch (err) {
        if (String(err?.code) !== '11000' && Number(err?.code) !== 11000) throw err;
      }
    }

    applyManualOrderUpdate({
      existing: manualOrder,
      updates: {
        payment_status: 'PAID',
        order_status: 'IN_KITCHEN',
        paid_by_admin: adminId || undefined,
        order_id: orderDoc._id,
        moved_to_kitchen_at: new Date(),
      },
      adminId,
    });
    await manualOrder.save();

    logger.info(
      `Manual order paid: ${manualOrder.manual_order_id} orderId=${String(orderDoc._id)} deliveries=${deliveriesCreated}`
    );

    return res.json({ status: 'success', data: manualOrder.toObject() });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createManualOrder,
  updateManualOrder,
  cancelManualOrder,
  getManualOrder,
  generateManualOrderBill,
  getManualOrderBill,
  markManualOrderPaid,
};
