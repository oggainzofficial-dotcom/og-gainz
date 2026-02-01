const { ENV } = require('../config/env.config');
const DailyDelivery = require('../models/DailyDelivery.model');
const PauseSkipLog = require('../models/PauseSkipLog.model');
const { getEffectiveApprovedPauses, isIsoBetween, buildPauseKey } = require('../utils/pauseSkip.util');
const {
  validateLatLng,
  haversineDistanceKm,
  applyBufferFactor,
  roundToDecimals,
} = require('../utils/distance.util');

const DEFAULTS = {
  // Phase 4 fixed kitchen coordinates
  kitchenLatitude: 12.89245,
  kitchenLongitude: 80.204236,
  bufferFactor: 1.1,
  roundDecimals: 2,
  freeDeliveryDistanceKm: 5,
  maxDeliveryDistanceKm: 10,
  baseDeliveryFee: 0,
  deliveryFeePerKm: 10,
};

const computeDistanceKm = ({ from, to, bufferFactor, roundDecimals }) => {
  const rawDistanceKm = haversineDistanceKm({ from, to });
  const bufferedKm = applyBufferFactor(rawDistanceKm, bufferFactor);
  const distanceKm = roundToDecimals(bufferedKm, roundDecimals);
  return { rawDistanceKm, distanceKm };
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const getSettings = () => {
  const kitchenLatitude = toFiniteNumber(process.env.KITCHEN_LAT) ?? DEFAULTS.kitchenLatitude;
  const kitchenLongitude = toFiniteNumber(process.env.KITCHEN_LNG) ?? DEFAULTS.kitchenLongitude;
  const bufferFactor = toFiniteNumber(process.env.DELIVERY_DISTANCE_BUFFER_FACTOR) ?? DEFAULTS.bufferFactor;
  const roundDecimals = toFiniteNumber(process.env.DELIVERY_DISTANCE_ROUND_DECIMALS) ?? DEFAULTS.roundDecimals;
  const freeDeliveryDistanceKm =
    toFiniteNumber(process.env.FREE_DELIVERY_DISTANCE_KM) ?? DEFAULTS.freeDeliveryDistanceKm;
  const maxDeliveryDistanceKm = ENV.MAX_DELIVERY_DISTANCE_KM ?? DEFAULTS.maxDeliveryDistanceKm;
  const baseDeliveryFee = ENV.BASE_DELIVERY_FEE ?? DEFAULTS.baseDeliveryFee;
  const deliveryFeePerKm = ENV.DELIVERY_FEE_PER_KM ?? DEFAULTS.deliveryFeePerKm;

  return {
    kitchen: { latitude: kitchenLatitude, longitude: kitchenLongitude },
    bufferFactor,
    roundDecimals,
    freeDeliveryDistanceKm,
    maxDeliveryDistanceKm,
    baseDeliveryFee,
    deliveryFeePerKm,
  };
};

const computeDeliveryFee = ({ distanceKm, freeDeliveryDistanceKm, baseDeliveryFee, deliveryFeePerKm }) => {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  if (distanceKm <= freeDeliveryDistanceKm) return 0;
  const payableKm = Math.max(0, distanceKm - freeDeliveryDistanceKm);
  return Math.ceil(baseDeliveryFee + payableKm * deliveryFeePerKm);
};

const quoteDelivery = async (req, res, next) => {
  try {
    const latitude = toFiniteNumber(req.body?.latitude);
    const longitude = toFiniteNumber(req.body?.longitude);
    const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';

    const settings = getSettings();
    const from = settings.kitchen;
    const to = { latitude, longitude };

    if (!validateLatLng(to)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid latitude/longitude',
      });
    }

    const { rawDistanceKm, distanceKm } = computeDistanceKm({
      from,
      to,
      bufferFactor: settings.bufferFactor,
      roundDecimals: settings.roundDecimals,
    });

    const isServiceable = distanceKm <= settings.maxDeliveryDistanceKm;
    const deliveryFee = isServiceable
      ? computeDeliveryFee({
        distanceKm,
        freeDeliveryDistanceKm: settings.freeDeliveryDistanceKm,
        baseDeliveryFee: settings.baseDeliveryFee,
        deliveryFeePerKm: settings.deliveryFeePerKm,
      })
      : 0;

    return res.json({
      status: 'success',
      data: {
        address,
        kitchen: settings.kitchen,
        latitude,
        longitude,
        rawDistanceKm: roundToDecimals(rawDistanceKm, 3),
        distanceKm,
        isServiceable,
        deliveryFee,
        feeRules: {
          freeDeliveryDistanceKm: settings.freeDeliveryDistanceKm,
          maxDeliveryDistanceKm: settings.maxDeliveryDistanceKm,
          baseDeliveryFee: settings.baseDeliveryFee,
          deliveryFeePerKm: settings.deliveryFeePerKm,
          bufferFactor: settings.bufferFactor,
          roundDecimals: settings.roundDecimals,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

const getFeeForDistance = async (req, res, next) => {
  try {
    const distanceKm = toFiniteNumber(req.query?.distanceKm);
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return res.status(400).json({ status: 'error', message: 'distanceKm must be a non-negative number' });
    }

    const settings = getSettings();
    const isServiceable = distanceKm <= settings.maxDeliveryDistanceKm;
    const deliveryFee = isServiceable
      ? computeDeliveryFee({
        distanceKm,
        freeDeliveryDistanceKm: settings.freeDeliveryDistanceKm,
        baseDeliveryFee: settings.baseDeliveryFee,
        deliveryFeePerKm: settings.deliveryFeePerKm,
      })
      : 0;

    return res.json({
      status: 'success',
      data: {
        distanceKm: roundToDecimals(distanceKm, settings.roundDecimals),
        isServiceable,
        deliveryFee,
        feeRules: {
          freeDeliveryDistanceKm: settings.freeDeliveryDistanceKm,
          maxDeliveryDistanceKm: settings.maxDeliveryDistanceKm,
          baseDeliveryFee: settings.baseDeliveryFee,
          deliveryFeePerKm: settings.deliveryFeePerKm,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

const listMyDailyDeliveries = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Authentication required' });

    const from = typeof req.query?.from === 'string' ? req.query.from.trim() : '';
    const to = typeof req.query?.to === 'string' ? req.query.to.trim() : '';
    if (!from || !to) {
      return res.status(400).json({ status: 'error', message: 'from and to are required (YYYY-MM-DD)' });
    }

    const maxRangeDays = 31;
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Invalid from/to date' });
    }
    const diffDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0 || diffDays >= maxRangeDays) {
      return res.status(400).json({ status: 'error', message: `Range must be less than ${maxRangeDays} days` });
    }

    const deliveries = await DailyDelivery.find({ userId, date: { $gte: from, $lte: to } })
      .sort({ date: 1, time: 1, createdAt: 1 })
      .lean();

    // Phase 7C: During an approved pause window, hide pending deliveries from the user.
    // (Delivered items remain visible as history.)
    const subscriptionIds = Array.from(new Set(deliveries.map((d) => String(d.subscriptionId || '').trim()).filter(Boolean)));
    if (subscriptionIds.length) {
      const pauses = await getEffectiveApprovedPauses({
        PauseSkipLog,
        userIds: [userId],
        subscriptionIds,
        fromISO: from,
        toISO: to,
      });

      if (pauses.length) {
        const byKey = new Map();
        for (const p of pauses) {
          const key = buildPauseKey(p.userId, p.subscriptionId);
          if (!key) continue;
          if (!byKey.has(key)) byKey.set(key, []);
          byKey.get(key).push({ start: p.pauseStartDate, end: p.pauseEndDate });
        }

        for (let i = deliveries.length - 1; i >= 0; i -= 1) {
          const d = deliveries[i];
          if (String(d.status || '') === 'DELIVERED') continue;
          if (String(d.status || '') !== 'PENDING') continue;
          const sid = String(d.subscriptionId || '').trim();
          if (!sid) continue;
          const key = buildPauseKey(userId, sid);
          const ranges = byKey.get(key);
          if (!ranges || !ranges.length) continue;
          const dateIso = String(d.date || '').trim();
          if (!dateIso) continue;
          if (ranges.some((r) => isIsoBetween(dateIso, r.start, r.end))) {
            deliveries.splice(i, 1);
          }
        }
      }
    }

    return res.json({ status: 'success', data: deliveries });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  quoteDelivery,
  getFeeForDistance,
	listMyDailyDeliveries,
};
