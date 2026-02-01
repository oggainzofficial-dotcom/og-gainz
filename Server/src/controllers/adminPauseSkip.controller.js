const mongoose = require('mongoose');

const PauseSkipLog = require('../models/PauseSkipLog.model');
const DailyDelivery = require('../models/DailyDelivery.model');
const CustomMealSubscription = require('../models/CustomMealSubscription.model');
const AddonSubscription = require('../models/AddonSubscription.model');
const User = require('../models/User.model');

const { isWeekdayISO, getEffectiveApprovedPauses, buildPauseKey, isIsoBetween, addDaysISO } = require('../utils/pauseSkip.util');

const localTodayISO = () => {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
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

const removeDeliveriesInPauseWindow = async ({ userId, subscriptionId, from, to }) => {
	const uid = String(userId || '').trim();
	const sid = String(subscriptionId || '').trim();
	const start = String(from || '').trim();
	const end = String(to || '').trim();
	if (!mongoose.isValidObjectId(uid) || !sid || !start || !end) return 0;

	const result = await DailyDelivery.deleteMany({
		userId: uid,
		subscriptionId: sid,
		date: { $gte: start, $lte: end },
		status: 'PENDING',
	});
	return Number(result?.deletedCount || 0);
};

const toLocalISODate = (d) => {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const normalizeHHmm = (value) => {
	const s = String(value || '').trim();
	if (!s) return undefined;
	const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(s);
	if (!m) return undefined;
	const hh = Number(m[1]);
	const mm = Number(m[2]);
	if (!Number.isFinite(hh) || !Number.isFinite(mm)) return undefined;
	if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
	return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const parseISODateToStartOfDay = (iso) => {
	const s = String(iso || '').trim();
	const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
	if (!m) return undefined;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const da = Number(m[3]);
	if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return undefined;
	const dt = new Date(y, mo - 1, da);
	if (Number.isNaN(dt.getTime())) return undefined;
	dt.setHours(0, 0, 0, 0);
	return dt;
};

const shiftFutureDeliveriesIntoWindow = async ({ userId, subscriptionId, fromISO, toISO, decidedISO }) => {
	const uid = String(userId || '').trim();
	const sid = String(subscriptionId || '').trim();
	const from = String(fromISO || '').trim();
	const to = String(toISO || '').trim();
	if (!mongoose.isValidObjectId(uid) || !sid || !from || !to) return { shifted: 0 };

	// Find which weekday dates are missing deliveries in the window we are resuming.
	const existing = await DailyDelivery.find({ userId: uid, subscriptionId: sid, date: { $gte: from, $lte: to } })
		.select({ date: 1 })
		.lean();
	const existingDates = new Set((existing || []).map((d) => String(d.date || '').trim()).filter(Boolean));

	const missing = [];
	for (let cursor = from; cursor && cursor <= to; cursor = addDaysISO(cursor, 1)) {
		if (!isWeekdayISO(cursor)) continue;
		if (!existingDates.has(cursor)) missing.push(cursor);
	}
	if (!missing.length) return { shifted: 0 };

	// Pull donor deliveries from after the pause window (these are the "extended" tail deliveries).
	const donors = await DailyDelivery.find({ userId: uid, subscriptionId: sid, status: 'PENDING', date: { $gt: to } })
		.sort({ date: -1, createdAt: -1 })
		.limit(missing.length + 10)
		.lean();
	if (!donors || !donors.length) return { shifted: 0 };

	let shifted = 0;
	let donorIdx = 0;
	for (const targetDate of missing) {
		let donor = null;
		while (donorIdx < donors.length) {
			const cand = donors[donorIdx++];
			if (!cand?._id) continue;
			donor = cand;
			break;
		}
		if (!donor) break;

		const deliveryTime = String(donor.deliveryTime || normalizeHHmm(donor.time) || '').trim();
		const timeKey = deliveryTime || String(donor.time || '').trim() || '12:00';
		const groupKey = [uid, String(targetDate || '').trim(), String(timeKey || '').trim()].filter(Boolean).join('|');

		try {
			await DailyDelivery.updateOne(
				{ _id: donor._id, status: 'PENDING' },
				{
					$set: {
						date: targetDate,
						deliveryDate: parseISODateToStartOfDay(targetDate),
						// Preserve legacy time and canonical time, but fix groupKey for the new date.
						deliveryTime: deliveryTime || donor.deliveryTime,
						groupKey,
					},
				}
			);
			shifted += 1;
		} catch (err) {
			// If a duplicate key race occurs, skip this target date.
			if (String(err?.code) !== '11000' && Number(err?.code) !== 11000) throw err;
		}
	}

	return { shifted };
};

const ensureUpcomingDeliveries = async ({ userId, subscriptionId, days = 14 }) => {
	const uid = String(userId || '').trim();
	const sid = String(subscriptionId || '').trim();
	if (!mongoose.isValidObjectId(uid) || !sid) return 0;

	const template = await DailyDelivery.findOne({ userId: uid, subscriptionId: sid }).sort({ date: -1 }).lean();
	if (!template) return 0;

	const today = toLocalISODate(new Date());
	const deliveriesToInsert = [];
	for (let i = 0; i < days; i += 1) {
		const dt = new Date();
		dt.setDate(dt.getDate() + i);
		const iso = toLocalISODate(dt);
		if (iso < today) continue;
		if (!isWeekdayISO(iso)) continue;

		deliveriesToInsert.push({
			date: iso,
			time: template.time,
			userId: template.userId,
			orderId: template.orderId,
			subscriptionId: template.subscriptionId,
			groupKey: [String(template.userId || ''), String(iso || '').trim(), String(template.deliveryTime || template.time || '').trim()].filter(Boolean).join('|'),
			address: template.address,
			items: template.items,
			status: 'PENDING',
			statusHistory: [{ status: 'PENDING', changedAt: new Date(), changedBy: 'SYSTEM' }],
			sourceOrderId: template.sourceOrderId,
			sourceCartItemId: template.sourceCartItemId,
		});
	}

	if (!deliveriesToInsert.length) return 0;
	try {
		const inserted = await DailyDelivery.insertMany(deliveriesToInsert, { ordered: false });
		return Array.isArray(inserted) ? inserted.length : 0;
	} catch (err) {
		if (String(err?.code) !== '11000' && Number(err?.code) !== 11000) throw err;
		return 0;
	}
};

const extendDeliveryBackedSubscription = async ({ userId, subscriptionId, servingsToAdd }) => {
	const uid = String(userId || '').trim();
	const sid = String(subscriptionId || '').trim();
	const count = Number(servingsToAdd || 0);
	if (!mongoose.isValidObjectId(uid) || !sid) return 0;
	if (!Number.isFinite(count) || count <= 0) return 0;

	const last = await DailyDelivery.findOne({ userId: uid, subscriptionId: sid }).sort({ date: -1 }).lean();
	if (!last) return 0;
	const lastDate = String(last.date || '').trim();
	if (!lastDate) return 0;

	const LOOKAHEAD_DAYS = 366;
	const fromISO = addDaysISO(lastDate, 1);
	const toISO = addDaysISO(lastDate, LOOKAHEAD_DAYS);
	let ranges = [];
	try {
		const pauses = await getEffectiveApprovedPauses({
			PauseSkipLog,
			userIds: [uid],
			subscriptionIds: [sid],
			fromISO,
			toISO,
		});
		const key = buildPauseKey(uid, sid);
		for (const p of pauses || []) {
			if (key !== buildPauseKey(p.userId, p.subscriptionId)) continue;
			ranges.push({ start: p.pauseStartDate, end: p.pauseEndDate });
		}
	} catch (e) {
		ranges = [];
	}

	let created = 0;
	for (let offset = 1; offset <= LOOKAHEAD_DAYS && created < count; offset += 1) {
		const date = addDaysISO(lastDate, offset);
		if (!date) continue;
		if (!isWeekdayISO(date)) continue;
		if (ranges.length && ranges.some((r) => isIsoBetween(date, r.start, r.end))) continue;

		const doc = {
			date,
			time: String(last.time || '').trim() || '12:00',
			userId: last.userId,
			orderId: last.orderId || last.sourceOrderId,
			subscriptionId: last.subscriptionId,
			groupKey: [String(last.userId || ''), String(date || '').trim(), String(last.deliveryTime || last.time || '').trim()].filter(Boolean).join('|'),
			address: last.address,
			items: last.items,
			status: 'PENDING',
			statusHistory: [{ status: 'PENDING', changedAt: new Date(), changedBy: 'SYSTEM' }],
			sourceOrderId: last.sourceOrderId,
			sourceCartItemId: last.sourceCartItemId,
		};

		try {
			await DailyDelivery.create(doc);
			created += 1;
		} catch (err) {
			if (String(err?.code) !== '11000' && Number(err?.code) !== 11000) throw err;
		}
	}

	return created;
};

const adminListPauseSkipRequests = async (req, res, next) => {
	try {
		const status = String(req.query?.status || 'PENDING').trim().toUpperCase();
		const requestType = String(req.query?.requestType || '').trim().toUpperCase();
		const kind = String(req.query?.kind || '').trim();
		const userId = String(req.query?.userId || '').trim();
		const limitRaw = Number(req.query?.limit);
		const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 200;

		const filter = {};
		if (status) filter.status = status;
		if (requestType) filter.requestType = requestType;
		if (kind) filter.kind = kind;
		if (userId) {
			if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ status: 'error', message: 'Invalid userId' });
			filter.userId = userId;
		}

		const items = await PauseSkipLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

		const userIds = Array.from(new Set(items.map((i) => (i.userId != null ? String(i.userId) : '')).filter(Boolean)));
		let usersById = new Map();
		if (userIds.length) {
			const users = await User.find({ _id: { $in: userIds } })
				.select({ name: 1, email: 1, addresses: 1 })
				.lean();
			usersById = new Map(
				users.map((u) => {
					const addresses = Array.isArray(u.addresses) ? u.addresses : [];
					const def = addresses.find((a) => a && a.isDefault) || addresses[0] || {};
					return [
						String(u._id),
						{
							id: String(u._id),
							name: u.name || '—',
							email: u.email || '',
							contactNumber: def.contactNumber || '',
							addressLine1: def.addressLine1 || '',
							addressLine2: def.addressLine2 || '',
							pincode: def.pincode || '',
						},
					];
				})
			);
		}

		const enriched = items.map((i) => {
			const uid = i.userId != null ? String(i.userId) : '';
			return {
				...normalizeLog(i),
				user: uid ? usersById.get(uid) : undefined,
			};
		});

		return res.json({ status: 'success', data: enriched });
	} catch (err) {
		return next(err);
	}
};

const applyApprovedPauseToSubscription = async (log, adminId) => {
	const subscriptionId = String(log.subscriptionId || '').trim();
	if (!subscriptionId) return;
	const userId = String(log.userId || '').trim();
	const pauseStartDate = String(log.pauseStartDate || '').trim();
	const pauseEndDate = String(log.pauseEndDate || '').trim();

	// Always apply pause to delivery schedule (DailyDelivery is the operational source of truth).
	const removed = await removeDeliveriesInPauseWindow({ userId, subscriptionId, from: pauseStartDate, to: pauseEndDate });
	// Golden rule: paused days must not reduce servings.
	// If we removed N pending deliveries, extend schedule by N serving days.
	if (removed > 0) {
		await extendDeliveryBackedSubscription({ userId, subscriptionId, servingsToAdd: removed });
	}

	const kind = String(log.kind || '').trim();
	if (kind !== 'customMeal' && kind !== 'addon') return;

	const Model = kind === 'customMeal' ? CustomMealSubscription : AddonSubscription;

	const update = {
		pauseStartDate: log.pauseStartDate,
		pauseEndDate: log.pauseEndDate,
		pauseReason: log.reason,
		pauseRequestId: String(log._id),
	};

	// If pause is already in effect, mark paused now.
	const today = localTodayISO();
	const shouldPauseNow = log.pauseStartDate && log.pauseEndDate && log.pauseStartDate <= today && today <= log.pauseEndDate;
	if (shouldPauseNow) update.status = 'paused';

	await Model.findByIdAndUpdate(subscriptionId, { $set: update }, { new: false, runValidators: true });
};

const applyApprovedWithdrawPause = async (log, adminId) => {
	const linkedTo = log.linkedTo;
	if (!linkedTo) return;

	const pause = await PauseSkipLog.findById(linkedTo);
	if (!pause) return;
	if (String(pause.requestType || '').trim().toUpperCase() !== 'PAUSE') return;
	if (String(pause.status || '').trim().toUpperCase() !== 'APPROVED') return;

	const kind = String(pause.kind || '').trim();
	const subscriptionId = String(pause.subscriptionId || '').trim();
	const userId = String(pause.userId || '').trim();
	const pauseStartDate = String(pause.pauseStartDate || '').trim();
	const pauseEndDate = String(pause.pauseEndDate || '').trim();
	const decidedISO = toLocalISODate(new Date(log.decidedAt || log.createdAt || Date.now()));
	const resumeFromISO = decidedISO && pauseStartDate ? (decidedISO > pauseStartDate ? decidedISO : pauseStartDate) : decidedISO || pauseStartDate;

	// If the pause hasn't started yet, withdrawal cancels it fully.
	// If it is mid-pause, we resume from the withdrawal decision date onward.
	if (subscriptionId && resumeFromISO && pauseEndDate && resumeFromISO <= pauseEndDate) {
		await shiftFutureDeliveriesIntoWindow({
			userId,
			subscriptionId,
			fromISO: resumeFromISO,
			toISO: pauseEndDate,
			decidedISO,
		});
	}

	// DB-backed subscriptions: clear pause fields.
	if (subscriptionId && mongoose.isValidObjectId(subscriptionId) && (kind === 'customMeal' || kind === 'addon')) {
		const Model = kind === 'customMeal' ? CustomMealSubscription : AddonSubscription;
		await Model.findOneAndUpdate(
			{ _id: subscriptionId, userId },
			{ $set: { status: 'active' }, $unset: { pauseStartDate: '', pauseEndDate: '', pauseReason: '', pauseRequestId: '' } },
			{ new: false, runValidators: true }
		);
	}

	// Best-effort: ensure near-term deliveries exist after schedule shift.
	if (subscriptionId) await ensureUpcomingDeliveries({ userId, subscriptionId, days: 14 });
};

const applyApprovedSkipToDelivery = async (log, adminId) => {
	const deliveryId = String(log.deliveryId || '').trim();
	if (!mongoose.isValidObjectId(deliveryId)) return;

	const delivery = await DailyDelivery.findById(deliveryId);
	if (!delivery) return;

	const current = String(delivery.status || '').trim();
	if (current !== 'PENDING') return;

	delivery.status = 'SKIPPED';
	delivery.statusHistory = Array.isArray(delivery.statusHistory) ? delivery.statusHistory : [];
	delivery.statusHistory.push({ status: 'SKIPPED', changedAt: new Date(), changedBy: 'ADMIN' });
	await delivery.save();

	// Phase 7D: Extend the subscription item by 1 serving day per approved SKIP.
	// We do this by creating one replacement delivery after the last scheduled delivery for the same item.
	const subscriptionId = String(delivery.subscriptionId || '').trim();
	const userId = delivery.userId != null ? String(delivery.userId) : '';
	const sourceOrderId = delivery.sourceOrderId;
	const sourceCartItemId = String(delivery.sourceCartItemId || '').trim();
	if (!subscriptionId || !mongoose.isValidObjectId(userId)) return;
	if (!sourceOrderId || !mongoose.isValidObjectId(String(sourceOrderId))) return;
	if (!sourceCartItemId || sourceCartItemId === '__ORDER__') return;

	const last = await DailyDelivery.findOne({
		userId,
		subscriptionId,
		sourceOrderId,
		sourceCartItemId,
	})
		.sort({ date: -1 })
		.lean();

	if (!last) return;
	const lastDate = String(last.date || '').trim();
	if (!lastDate) return;

	const LOOKAHEAD_DAYS = 120;
	const fromISO = addDaysISO(lastDate, 1);
	const toISO = addDaysISO(lastDate, LOOKAHEAD_DAYS);
	let ranges = [];
	try {
		const pauses = await getEffectiveApprovedPauses({
			PauseSkipLog,
			userIds: [userId],
			subscriptionIds: [subscriptionId],
			fromISO,
			toISO,
		});
		const key = buildPauseKey(userId, subscriptionId);
		for (const p of pauses || []) {
			if (key !== buildPauseKey(p.userId, p.subscriptionId)) continue;
			ranges.push({ start: p.pauseStartDate, end: p.pauseEndDate });
		}
	} catch (e) {
		// If pause lookup fails, still extend to next weekday.
		ranges = [];
	}

	let nextDate = '';
	for (let i = 1; i <= LOOKAHEAD_DAYS; i += 1) {
		const candidate = addDaysISO(lastDate, i);
		if (!candidate) continue;
		if (!isWeekdayISO(candidate)) continue;
		if (ranges.length && ranges.some((r) => isIsoBetween(candidate, r.start, r.end))) continue;
		nextDate = candidate;
		break;
	}

	if (!nextDate) return;

	const doc = {
		date: nextDate,
		time: String(last.time || delivery.time || '').trim() || '12:00',
		userId: last.userId,
		orderId: last.orderId || last.sourceOrderId,
		subscriptionId: last.subscriptionId,
		address: last.address,
		items: last.items,
		status: 'PENDING',
		statusHistory: [{ status: 'PENDING', changedAt: new Date(), changedBy: 'SYSTEM' }],
		sourceOrderId: last.sourceOrderId,
		sourceCartItemId: last.sourceCartItemId,
	};

	try {
		await DailyDelivery.create(doc);
	} catch (err) {
		// Ignore duplicate insert (e.g. if extension already created).
		if (String(err?.code) !== '11000' && Number(err?.code) !== 11000) throw err;
	}
};

const adminDecidePauseSkipRequest = async (req, res, next) => {
	try {
		const adminId = String(req.user?.id || req.user?._id || '').trim() || 'unknown';
		const requestId = String(req.params?.requestId || '').trim();
		if (!mongoose.isValidObjectId(requestId)) {
			return res.status(404).json({ status: 'error', message: 'Request not found' });
		}

		const nextStatus = String(req.body?.status || '').trim().toUpperCase();
		const adminNote = String(req.body?.adminNote || '').trim() || undefined;
		if (nextStatus !== 'APPROVED' && nextStatus !== 'DECLINED') {
			return res.status(400).json({ status: 'error', message: 'status must be APPROVED or DECLINED' });
		}

		const log = await PauseSkipLog.findById(requestId);
		if (!log) return res.status(404).json({ status: 'error', message: 'Request not found' });
		if (String(log.status || '').trim().toUpperCase() !== 'PENDING') {
			return res.status(400).json({ status: 'error', message: 'Only pending requests can be decided' });
		}

		log.status = nextStatus;
		log.decidedBy = mongoose.isValidObjectId(adminId) ? adminId : undefined;
		log.decidedAt = new Date();
		log.adminNote = adminNote;
		await log.save();

		if (nextStatus === 'APPROVED') {
			if (String(log.requestType) === 'PAUSE') {
				await applyApprovedPauseToSubscription(log, adminId);
			} else if (String(log.requestType) === 'SKIP') {
				await applyApprovedSkipToDelivery(log, adminId);
			} else if (String(log.requestType) === 'WITHDRAW_PAUSE') {
				await applyApprovedWithdrawPause(log, adminId);
			}
		}

		return res.json({ status: 'success', data: normalizeLog(log) });
	} catch (err) {
		return next(err);
	}
};

module.exports = {
	adminListPauseSkipRequests,
	adminDecidePauseSkipRequest,
};
