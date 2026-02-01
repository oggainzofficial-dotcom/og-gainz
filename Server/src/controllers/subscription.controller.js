const mongoose = require('mongoose');

const { ENV } = require('../config/env.config');

const PauseSkipLog = require('../models/PauseSkipLog.model');
const DailyDelivery = require('../models/DailyDelivery.model');
const CustomMealSubscription = require('../models/CustomMealSubscription.model');
const AddonSubscription = require('../models/AddonSubscription.model');
const { getEffectiveApprovedPauses } = require('../utils/pauseSkip.util');

const requireAuthUserId = (req) => {
  const userId = req?.user?.id || req?.user?._id;
  if (!userId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  return String(userId);
};

const parseISODate = (value, fieldName) => {
  const s = String(value || '').trim();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
  if (!m) {
    const err = new Error(`${fieldName} must be YYYY-MM-DD`);
    err.statusCode = 400;
    throw err;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) {
    const err = new Error(`${fieldName} must be a valid date`);
    err.statusCode = 400;
    throw err;
  }
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const localTodayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseHHmm = (value) => {
  const s = String(value || '').trim();
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(s);
  if (!m) return undefined;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return undefined;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
  return { hh, mm };
};

const isBeforeLocalCutoff = (hhmm) => {
  const parsed = parseHHmm(hhmm);
  if (!parsed) return true;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(parsed.hh, parsed.mm, 0, 0);
  return now.getTime() < cutoff.getTime();
};

const SKIP_REQUEST_CUTOFF_MINUTES = 120;

const parseLocalISODate = (value) => {
  const s = String(value || '').trim();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return undefined;
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt;
};

const parseTimeToHHmm = (value) => {
  const s = String(value || '').trim();
  if (!s) return undefined;

  // 24h HH:mm
  let m = /^([0-9]{1,2}):([0-9]{2})$/.exec(s);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
    return { hh, mm };
  }

  // 12h h:mm AM/PM
  m = /^([0-9]{1,2}):([0-9]{2})\s*(AM|PM)$/i.exec(s);
  if (m) {
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    const mer = String(m[3] || '').toUpperCase();
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return undefined;
    if (mer === 'AM') hh = hh === 12 ? 0 : hh;
    if (mer === 'PM') hh = hh === 12 ? 12 : hh + 12;
    return { hh, mm };
  }

  return undefined;
};

const getLocalScheduledDateTime = (dateISO, timeStr) => {
  const date = parseLocalISODate(dateISO);
  const tm = parseTimeToHHmm(timeStr);
  if (!date || !tm) return undefined;
  const dt = new Date(date);
  dt.setHours(tm.hh, tm.mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt;
};

const formatCutoff = (minutes) => {
  const m = Math.max(1, Math.floor(Number(minutes) || 0));
  if (m % 60 === 0) {
    const h = m / 60;
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  return `${m} minute${m === 1 ? '' : 's'}`;
};

const normalizeLog = (doc) => {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject({ versionKey: false }) : doc;
  return {
    id: String(obj._id),
    requestType: obj.requestType,
    status: obj.status,
    kind: obj.kind,
    subscriptionId: obj.subscriptionId,
    deliveryId: obj.deliveryId,
    linkedTo: obj.linkedTo != null ? String(obj.linkedTo) : undefined,
    userId: obj.userId != null ? String(obj.userId) : undefined,
    reason: obj.reason,
    pauseStartDate: obj.pauseStartDate,
    pauseEndDate: obj.pauseEndDate,
    skipDate: obj.skipDate,
    decidedAt: obj.decidedAt,
    adminNote: obj.adminNote,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// Phase 7C: Withdraw Pause requires admin approval.
// Creates a WITHDRAW_PAUSE request linked to an existing APPROVED PAUSE request.
const requestWithdrawPause = async (req, res, next) => {
  try {
    const userId = requireAuthUserId(req);
    const pauseRequestId = String(req.body?.pauseRequestId || '').trim();
    if (!mongoose.isValidObjectId(pauseRequestId)) {
      return res.status(400).json({ status: 'error', message: 'pauseRequestId is required' });
    }

    const pause = await PauseSkipLog.findOne({ _id: pauseRequestId, userId });
    if (!pause) return res.status(404).json({ status: 'error', message: 'Pause request not found' });
    if (String(pause.requestType || '').trim().toUpperCase() !== 'PAUSE') {
      return res.status(400).json({ status: 'error', message: 'pauseRequestId must reference a PAUSE request' });
    }
    if (String(pause.status || '').trim().toUpperCase() !== 'APPROVED') {
      return res.status(400).json({ status: 'error', message: 'Only approved pauses can be withdrawn' });
    }

    const already = await PauseSkipLog.findOne({ requestType: 'WITHDRAW_PAUSE', linkedTo: pauseRequestId, status: 'PENDING' }).lean();
    if (already) {
      return res.status(400).json({ status: 'error', message: 'A withdraw request is already pending' });
    }

    const created = await PauseSkipLog.create({
      requestType: 'WITHDRAW_PAUSE',
      status: 'PENDING',
      kind: pause.kind,
      subscriptionId: pause.subscriptionId,
      deliveryId: pause.deliveryId,
      userId,
      linkedTo: pause._id,
      reason: undefined,
      pauseStartDate: pause.pauseStartDate,
      pauseEndDate: pause.pauseEndDate,
    });

    return res.status(201).json({ status: 'success', data: normalizeLog(created) });
  } catch (err) {
    return next(err);
  }
};

const listMyPauseSkipRequests = async (req, res, next) => {
  try {
    const userId = requireAuthUserId(req);
    const status = String(req.query?.status || '').trim();
    const requestType = String(req.query?.requestType || '').trim();

    const filter = { userId };
    if (status) filter.status = status.toUpperCase();
    if (requestType) filter.requestType = requestType.toUpperCase();

    const items = await PauseSkipLog.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ status: 'success', data: items.map(normalizeLog) });
  } catch (err) {
    return next(err);
  }
};

const requestPause = async (req, res, next) => {
  try {
    const userId = requireAuthUserId(req);
    const kind = String(req.body?.kind || '').trim();
    const subscriptionId = String(req.body?.subscriptionId || '').trim();
    const reason = String(req.body?.reason || '').trim() || undefined;
    const pauseStartDate = parseISODate(req.body?.pauseStartDate, 'pauseStartDate');
    const pauseEndDate = parseISODate(req.body?.pauseEndDate, 'pauseEndDate');

    if (!subscriptionId) {
      return res.status(400).json({ status: 'error', message: 'subscriptionId is required' });
    }
    if (kind !== 'customMeal' && kind !== 'addon' && kind !== 'mealPack') {
      return res.status(400).json({ status: 'error', message: 'Invalid kind' });
    }
    if (pauseEndDate < pauseStartDate) {
      return res.status(400).json({ status: 'error', message: 'pauseEndDate must be on/after pauseStartDate' });
    }

    const today = localTodayISO();
    if (pauseStartDate < today) {
      return res.status(400).json({ status: 'error', message: 'pauseStartDate must be today or later' });
    }

    // Only active DB-backed subscriptions can be paused.
    if ((kind === 'customMeal' || kind === 'addon') && mongoose.isValidObjectId(subscriptionId)) {
      const Model = kind === 'customMeal' ? CustomMealSubscription : AddonSubscription;
      const sub = await Model.findOne({ _id: subscriptionId, userId }).select({ status: 1 }).lean();
      if (!sub) return res.status(404).json({ status: 'error', message: 'Subscription not found' });
      if (String(sub.status || '').trim().toLowerCase() !== 'active') {
        return res.status(400).json({ status: 'error', message: 'Pause is available only for active subscriptions' });
      }
    }

    // Cutoff: at least N minutes before the next scheduled delivery.
    const pauseCutoffMinutes =
      typeof ENV.PAUSE_REQUEST_CUTOFF_MINUTES === 'number' && ENV.PAUSE_REQUEST_CUTOFF_MINUTES > 0
        ? Math.floor(ENV.PAUSE_REQUEST_CUTOFF_MINUTES)
        : (typeof ENV.PAUSE_REQUEST_CUTOFF_HOURS === 'number' && ENV.PAUSE_REQUEST_CUTOFF_HOURS > 0
          ? Math.floor(ENV.PAUSE_REQUEST_CUTOFF_HOURS * 60)
          : 120);

    const nextDelivery = await DailyDelivery.findOne({
      userId,
      subscriptionId,
      status: 'PENDING',
      date: { $gte: today },
    })
      .sort({ date: 1, time: 1 })
      .lean();

    if (nextDelivery) {
      const scheduled = getLocalScheduledDateTime(nextDelivery.date, nextDelivery.time);
      if (scheduled) {
        const cutoff = new Date(scheduled);
        cutoff.setMinutes(cutoff.getMinutes() - pauseCutoffMinutes);
        if (new Date().getTime() >= cutoff.getTime()) {
          return res.status(400).json({ status: 'error', message: `Pause requests must be submitted at least ${formatCutoff(pauseCutoffMinutes)} before delivery.` });
        }
      }
    }

    const created = await PauseSkipLog.create({
      requestType: 'PAUSE',
      status: 'PENDING',
      kind,
      subscriptionId,
      userId,
      reason,
      pauseStartDate,
      pauseEndDate,
    });

    return res.status(201).json({ status: 'success', data: normalizeLog(created) });
  } catch (err) {
    return next(err);
  }
};

const withdrawPauseSkipRequest = async (req, res, next) => {
  try {
    const userId = requireAuthUserId(req);
    const requestId = String(req.params?.requestId || '').trim();
    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const existing = await PauseSkipLog.findOne({ _id: requestId, userId });
    if (!existing) return res.status(404).json({ status: 'error', message: 'Request not found' });

    const currentStatus = String(existing.status || '').trim().toUpperCase();
    // Phase 7C: Users can withdraw only PENDING requests directly.
    // Approved PAUSE withdrawals must go through WITHDRAW_PAUSE request + admin decision.
    if (currentStatus !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Only pending requests can be withdrawn' });
    }

    existing.status = 'WITHDRAWN';
    existing.decidedAt = new Date();
    await existing.save();

    return res.json({ status: 'success', data: normalizeLog(existing) });
  } catch (err) {
    return next(err);
  }
};

const requestSkipDelivery = async (req, res, next) => {
  try {
    const userId = requireAuthUserId(req);
    const deliveryId = String(req.body?.deliveryId || '').trim();
    const reason = String(req.body?.reason || '').trim() || undefined;

    if (!mongoose.isValidObjectId(deliveryId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid deliveryId' });
    }

    const delivery = await DailyDelivery.findOne({ _id: deliveryId, userId }).lean();
    if (!delivery) {
      return res.status(404).json({ status: 'error', message: 'Delivery not found' });
    }
    const deliveryDate = String(delivery.date || '').trim();
    const today = localTodayISO();
    if (deliveryDate !== today) {
      return res.status(400).json({ status: 'error', message: "Skip is available only for today's delivery" });
    }
    const current = String(delivery.status || '').trim();
    if (current !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Only pending deliveries can be skipped' });
    }

    // Skip not allowed during an approved pause window.
    const sid = String(delivery.subscriptionId || '').trim();
    if (sid) {
      const pauses = await getEffectiveApprovedPauses({
        PauseSkipLog,
        userIds: [userId],
        subscriptionIds: [sid],
        fromISO: deliveryDate,
        toISO: deliveryDate,
      });
      if (pauses.length) {
        return res.status(400).json({ status: 'error', message: 'Skip is not available for paused subscriptions' });
      }
    }

    const now = new Date();
    const scheduled = getLocalScheduledDateTime(deliveryDate, delivery.time);
    if (!scheduled) {
      return res.status(400).json({ status: 'error', message: 'Delivery scheduled time is unavailable for this delivery' });
    }
    const skipCutoffMinutes = typeof ENV.SKIP_REQUEST_CUTOFF_MINUTES === 'number' && ENV.SKIP_REQUEST_CUTOFF_MINUTES > 0
      ? Math.floor(ENV.SKIP_REQUEST_CUTOFF_MINUTES)
      : 120;
    const cutoff = new Date(scheduled);
    cutoff.setMinutes(cutoff.getMinutes() - skipCutoffMinutes);
    if (now.getTime() >= cutoff.getTime()) {
      return res.status(400).json({ status: 'error', message: `Skip requests must be made at least ${formatCutoff(skipCutoffMinutes)} before delivery.` });
    }

    // Deduplicate: one pending skip request per delivery.
    const already = await PauseSkipLog.findOne({ requestType: 'SKIP', deliveryId, status: { $in: ['PENDING', 'APPROVED'] } }).lean();
    if (already) {
      return res.status(400).json({ status: 'error', message: 'A skip request is already pending for this delivery' });
    }

    const created = await PauseSkipLog.create({
      requestType: 'SKIP',
      status: 'PENDING',
      kind: 'delivery',
      deliveryId,
      userId,
      reason,
      skipDate: deliveryDate,
    });

    return res.status(201).json({ status: 'success', data: normalizeLog(created) });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listMyPauseSkipRequests,
  requestPause,
  requestWithdrawPause,
  requestSkipDelivery,
  withdrawPauseSkipRequest,
};
