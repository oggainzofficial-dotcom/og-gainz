const CustomMealSubscription = require('../models/CustomMealSubscription.model');
const AddonSubscription = require('../models/AddonSubscription.model');
const Order = require('../models/Order.model');
const DailyDelivery = require('../models/DailyDelivery.model');
const PauseSkipLog = require('../models/PauseSkipLog.model');
const { getEffectiveApprovedPauses, buildPauseKey, isIsoBetween } = require('../utils/pauseSkip.util');
const { getScheduleMetaByUserAndSubscription } = require('../utils/subscriptionSchedule.util');

const FREQUENCIES = new Set(['weekly', 'monthly', 'trial']);
const STATUSES = new Set(['active', 'paused']);
const TYPES = new Set(['customMeal', 'addon', 'mealPack', 'all']);

const safeString = (v) => String(v || '').trim();

const addDaysISO = (iso, days) => {
	const s = safeString(iso);
	const d = new Date(`${s}T00:00:00`);
	if (Number.isNaN(d.getTime())) return s;
	d.setDate(d.getDate() + days);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const da = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${da}`;
};

const isWeekdayISO = (iso) => {
	const s = safeString(iso);
	const d = new Date(`${s}T00:00:00`);
	if (Number.isNaN(d.getTime())) return false;
	const day = d.getDay();
	return day >= 1 && day <= 5;
};

const getPeriodDays = (plan) => {
	const p = safeString(plan).toLowerCase();
	if (p === 'monthly') return 28;
	if (p === 'weekly') return 7;
	if (p === 'trial') return 3;
	return 1;
};

const getDefaultTotalServings = (plan) => {
	const p = safeString(plan).toLowerCase();
	if (p === 'monthly') return 20;
	if (p === 'weekly') return 5;
	if (p === 'trial') return 3;
	return 1;
};

const getCurrentCycleStartISO = (baseStartISO, plan, todayISO) => {
	const base = safeString(baseStartISO);
	const today = safeString(todayISO);
	const periodDays = getPeriodDays(plan);

	const baseDate = new Date(`${base}T00:00:00`);
	const todayDate = new Date(`${today}T00:00:00`);
	if (Number.isNaN(baseDate.getTime()) || Number.isNaN(todayDate.getTime())) return base || today;

	const diffDays = Math.floor((todayDate.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000));
	const cycles = diffDays > 0 ? Math.floor(diffDays / periodDays) : 0;
	const start = new Date(baseDate);
	start.setDate(start.getDate() + cycles * periodDays);
	const y = start.getFullYear();
	const m = String(start.getMonth() + 1).padStart(2, '0');
	const da = String(start.getDate()).padStart(2, '0');
	return `${y}-${m}-${da}`;
};

const getExtendedCycleEndISO = ({ baseEndISO, cycleStartISO, skippedDates }) => {
	const baseEnd = safeString(baseEndISO);
	const start = safeString(cycleStartISO);
	if (!baseEnd || !start) return baseEnd || start;
	const dates = Array.isArray(skippedDates) ? skippedDates.filter(Boolean) : [];

	let end = baseEnd;
	for (let i = 0; i < 10; i += 1) {
		const skipped = dates.filter((d) => d >= start && d <= end).length;
		const nextEnd = addDaysISO(baseEnd, skipped);
		if (!nextEnd || nextEnd === end) return end;
		end = nextEnd;
	}
	return end;
};

const normalize = (kind, doc) => {
	if (!doc) return doc;
	const obj = typeof doc.toObject === 'function' ? doc.toObject({ versionKey: false }) : doc;

	const base = {
		kind,
		id: String(obj._id),
		userId: String(obj.userId),
		frequency: obj.frequency,
		status: obj.status,
		startDate: obj.startDate,
		pauseStartDate: obj.pauseStartDate,
		pauseEndDate: obj.pauseEndDate,
		pauseReason: obj.pauseReason,
		pauseRequestId: obj.pauseRequestId,
		createdAt: obj.createdAt,
		updatedAt: obj.updatedAt,
	};

	if (kind === 'customMeal') {
		return {
			...base,
			selections: Array.isArray(obj.selections) ? obj.selections : [],
			totals: obj.totals,
		};
	}

	return {
		...base,
		addonId: obj.addonId != null ? String(obj.addonId) : undefined,
		servings: obj.servings,
		price: obj.price,
	};
};

const normalizeTitleFromOrderItem = (it) => {
	const title = safeString(it?.pricingSnapshot?.title);
	if (title) return title;
	const type = safeString(it?.type);
	if (type === 'meal') return 'Meal Pack';
	if (type === 'byo') return 'Build Your Own';
	return 'Subscription';
};

const buildMealPackSubscriptions = async ({ frequency, limit }) => {
	const paidClause = {
		$or: [{ paymentStatus: 'PAID' }, { status: 'PAID' }, { status: 'paid' }],
	};
	const query = {
		...paidClause,
		...(frequency ? { 'items.plan': frequency } : {}),
	};
	const fetchLimit = Math.min(500, Math.max(50, Number(limit || 200) * 10));
	const orders = await Order.find(query)
		.sort({ createdAt: -1 })
		.limit(fetchLimit)
		.select({ userId: 1, items: 1, createdAt: 1, updatedAt: 1 })
		.lean();

	const out = [];
	for (const o of orders || []) {
		for (const it of o.items || []) {
			const plan = safeString(it?.plan).toLowerCase();
			if (!FREQUENCIES.has(plan)) continue;
			if (frequency && plan !== frequency) continue;
			const type = safeString(it?.type);
			if (type !== 'meal' && type !== 'byo') continue;
			const cartItemId = safeString(it?.cartItemId);
			if (!cartItemId) continue;
			out.push({
				kind: 'mealPack',
				id: cartItemId,
				userId: o.userId != null ? String(o.userId) : '',
				frequency: plan,
				status: 'active',
				startDate: safeString(it?.orderDetails?.startDate),
				title: normalizeTitleFromOrderItem(it),
				orderId: o._id != null ? String(o._id) : undefined,
				createdAt: o.createdAt,
				updatedAt: o.updatedAt,
			});
		}
	}

	// de-dupe by subscription id (cartItemId)
	const map = new Map();
	for (const s of out) {
		if (!safeString(s.id)) continue;
		if (!map.has(s.id)) map.set(s.id, s);
	}
	return Array.from(map.values());
};

const parseLimit = (raw) => {
	const n = Number(raw);
	if (!Number.isFinite(n) || !Number.isInteger(n)) return 100;
	return Math.min(Math.max(n, 1), 200);
};

const parseOptional = (value) => {
	const v = String(value || '').trim();
	return v ? v : undefined;
};

const parseFrequency = (value) => {
	const v = parseOptional(value);
	if (!v || v === 'all') return undefined;
	if (!FREQUENCIES.has(v)) {
		const err = new Error('Invalid frequency');
		err.statusCode = 400;
		throw err;
	}
	return v;
};

const parseStatus = (value) => {
	const v = parseOptional(value);
	if (!v || v === 'all') return undefined;
	if (!STATUSES.has(v)) {
		const err = new Error('Invalid status');
		err.statusCode = 400;
		throw err;
	}
	return v;
};

const parseType = (value) => {
	const v = parseOptional(value) || 'all';
	if (!TYPES.has(v)) {
		const err = new Error('Invalid type');
		err.statusCode = 400;
		throw err;
	}
	return v;
};

const sortByCreatedDesc = (a, b) => {
	const ad = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
	const bd = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
	return bd - ad;
};

const localTodayISO = () => {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
};

const toISODate = (d) => {
	const dt = d instanceof Date ? d : new Date(d);
	if (Number.isNaN(dt.getTime())) return '';
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const da = String(dt.getDate()).padStart(2, '0');
	return `${y}-${m}-${da}`;
};

const adminListSubscriptions = async (req, res, next) => {
	try {
		const today = localTodayISO();
		const horizonISO = toISODate(new Date(`${today}T00:00:00`).getTime() + 366 * 24 * 60 * 60 * 1000);

		const frequency = parseFrequency(req.query?.frequency);
		const status = parseStatus(req.query?.status);
		const type = parseType(req.query?.type);
		const limit = parseLimit(req.query?.limit);

		const baseFilter = {};
		if (frequency) baseFilter.frequency = frequency;
		// Phase 7C: status is derived from effective pauses, so we filter after enrichment.
		const fetchItems = async () => {
			if (type === 'customMeal') {
				const items = await CustomMealSubscription.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean();
				return items.map((d) => normalize('customMeal', d));
			}
			if (type === 'addon') {
				const items = await AddonSubscription.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean();
				return items.map((d) => normalize('addon', d));
			}
			if (type === 'mealPack') {
				return buildMealPackSubscriptions({ frequency, limit });
			}
			const [customMeal, addon] = await Promise.all([
				CustomMealSubscription.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean(),
				AddonSubscription.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean(),
			]);
			const mealPacks = await buildMealPackSubscriptions({ frequency, limit });
			return [...customMeal.map((d) => normalize('customMeal', d)), ...addon.map((d) => normalize('addon', d)), ...mealPacks];
		};

		let merged = (await fetchItems()).sort(sortByCreatedDesc).slice(0, limit);

		// Add per-subscription cycle/progress (delivered/total) based on deliveries.
		const cycleMetaById = new Map();
		let minStart = '';
		let maxEnd = '';
		for (const s of merged) {
			const sid = safeString(s?.id);
			if (!sid) continue;
			const plan = safeString(s?.frequency).toLowerCase();
			const baseStart = safeString(s?.startDate) || today;
			const cycleStartISO = getCurrentCycleStartISO(baseStart, plan, today);
			const baseCycleEndISO = addDaysISO(cycleStartISO, getPeriodDays(plan) - 1);
			const total = s.kind === 'addon' && typeof s.servings === 'number' && s.servings > 0 ? s.servings : getDefaultTotalServings(plan);
			cycleMetaById.set(sid, { cycleStartISO, baseCycleEndISO, cycleEndISO: baseCycleEndISO, total });
			if (!minStart || cycleStartISO < minStart) minStart = cycleStartISO;
			if (!maxEnd || baseCycleEndISO > maxEnd) maxEnd = baseCycleEndISO;
		}

		let deliveredById = new Map();
		let skippedDatesById = new Map();
		const subscriptionIdsForCounts = Array.from(cycleMetaById.keys());
		if (subscriptionIdsForCounts.length && minStart && maxEnd) {
			const lookaheadEnd = addDaysISO(maxEnd, 60) || maxEnd;
			const [delivered, skipped] = await Promise.all([
				DailyDelivery.find({
					subscriptionId: { $in: subscriptionIdsForCounts },
					status: 'DELIVERED',
					date: { $gte: minStart, $lte: lookaheadEnd },
				})
					.select({ subscriptionId: 1, date: 1 })
					.lean(),
				DailyDelivery.find({
					subscriptionId: { $in: subscriptionIdsForCounts },
					status: 'SKIPPED',
					date: { $gte: minStart, $lte: lookaheadEnd },
				})
					.select({ subscriptionId: 1, date: 1 })
					.lean(),
			]);

			skippedDatesById = new Map();
			for (const d of skipped || []) {
				const sid = safeString(d?.subscriptionId);
				const date = safeString(d?.date);
				if (!sid || !date) continue;
				if (!skippedDatesById.has(sid)) skippedDatesById.set(sid, []);
				skippedDatesById.get(sid).push(date);
			}

			for (const sid of subscriptionIdsForCounts) {
				const meta = cycleMetaById.get(sid);
				if (!meta) continue;
				meta.cycleEndISO = getExtendedCycleEndISO({
					baseEndISO: meta.baseCycleEndISO,
					cycleStartISO: meta.cycleStartISO,
					skippedDates: skippedDatesById.get(sid) || [],
				});
			}

			deliveredById = new Map();
			for (const d of delivered || []) {
				const sid = safeString(d?.subscriptionId);
				const date = safeString(d?.date);
				if (!sid || !date) continue;
				const meta = cycleMetaById.get(sid);
				if (!meta) continue;
				if (!isWeekdayISO(date)) continue;
				if (date < meta.cycleStartISO || date > meta.cycleEndISO) continue;
				deliveredById.set(sid, (deliveredById.get(sid) || 0) + 1);
			}
		}

		merged = merged.map((s) => {
			const sid = safeString(s?.id);
			const meta = sid ? cycleMetaById.get(sid) : undefined;
			if (!meta) return s;
			const delivered = Math.max(0, Math.min(meta.total, Number(deliveredById.get(sid) || 0)));
			const remaining = Math.max(0, meta.total - delivered);
			const progress = meta.total > 0 ? (delivered / meta.total) * 100 : 0;
			return {
				...s,
				cycleStartDate: meta.cycleStartISO,
				cycleEndDate: meta.cycleEndISO,
				delivered,
				total: meta.total,
				remaining,
				progress,
			};
		});

		// Add schedule-derived end date + next serving date (source of truth: DailyDelivery).
		const schedulePairs = merged
			.map((s) => ({ userId: safeString(s?.userId), subscriptionId: safeString(s?.id) }))
			.filter((p) => p.userId && p.subscriptionId);
		const scheduleMeta = await getScheduleMetaByUserAndSubscription({ DailyDelivery, pairs: schedulePairs, todayISO: today });
		merged = merged.map((s) => {
			const key = buildPauseKey(s.userId, s.id);
			const sm = key ? scheduleMeta.get(key) : undefined;
			if (!sm) return s;
			return {
				...s,
				scheduleEndDate: sm.scheduleEndDate,
				nextServingDate: sm.nextServingDate,
				scheduledCount: sm.scheduledCount,
				skippedCount: sm.skippedCount,
			};
		});

		// Enrich with effective pause windows (includes scheduled future pauses up to horizon).
		const userIds = Array.from(new Set(merged.map((s) => String(s.userId || '').trim()).filter(Boolean)));
		const subscriptionIds = Array.from(new Set(merged.map((s) => String(s.id || '').trim()).filter(Boolean)));
		if (userIds.length && subscriptionIds.length) {
			const pauses = await getEffectiveApprovedPauses({
				PauseSkipLog,
				userIds,
				subscriptionIds,
				fromISO: today,
				toISO: horizonISO,
			});
			const bestByKey = new Map();
			for (const p of pauses) {
				const key = buildPauseKey(p.userId, p.subscriptionId);
				if (!key) continue;
				const end = String(p.pauseEndDate || '').trim();
				if (!end) continue;
				const prev = bestByKey.get(key);
				const prevEnd = prev ? String(prev.pauseEndDate || '').trim() : '';
				if (!prev || end > prevEnd) bestByKey.set(key, p);
			}

			merged = merged.map((s) => {
				const key = buildPauseKey(s.userId, s.id);
				const pause = key ? bestByKey.get(key) : undefined;
				if (!pause) {
					return {
						...s,
						status: 'active',
						pauseStartDate: undefined,
						pauseEndDate: undefined,
						pauseReason: undefined,
						pauseRequestId: undefined,
					};
				}

				const start = String(pause.pauseStartDate || '').trim();
				const end = String(pause.pauseEndDate || '').trim();
				const pausedNow = start && end && isIsoBetween(today, start, end);
				return {
					...s,
					status: pausedNow ? 'paused' : 'active',
					pauseStartDate: start || undefined,
					pauseEndDate: end || undefined,
					pauseReason: pause.reason || undefined,
					pauseRequestId: pause?._id != null ? String(pause._id) : undefined,
				};
			});
		}

		if (status) {
			merged = merged.filter((s) => String(s.status) === status);
		}

		return res.json({ status: 'success', data: merged });
	} catch (err) {
		return next(err);
	}
};

const adminSetSubscriptionStatus = async (req, res, next) => {
	try {
		const kind = String(req.params?.kind || '').trim();
		const { id } = req.params;
		const status = String(req.body?.status || '').trim();

		if (kind !== 'customMeal' && kind !== 'addon') {
			const err = new Error('Invalid kind');
			err.statusCode = 400;
			throw err;
		}
		if (!STATUSES.has(status)) {
			const err = new Error('Invalid status');
			err.statusCode = 400;
			throw err;
		}

		const Model = kind === 'customMeal' ? CustomMealSubscription : AddonSubscription;
		const updated = await Model.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
		if (!updated) {
			return res.status(404).json({ status: 'error', message: 'Subscription not found' });
		}

		return res.json({ status: 'success', data: normalize(kind, updated) });
	} catch (err) {
		return next(err);
	}
};

module.exports = {
	adminListSubscriptions,
	adminSetSubscriptionStatus,
};
