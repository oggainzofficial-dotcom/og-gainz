const mongoose = require('mongoose');

const Order = require('../models/Order.model');
const DailyDelivery = require('../models/DailyDelivery.model');
const User = require('../models/User.model');
const PauseSkipLog = require('../models/PauseSkipLog.model');
const logger = require('../utils/logger.util');
const { validateOrderStatusTransition, ORDER_LIFECYCLE_STATUSES } = require('../utils/validateOrderStatusTransition');
const { getEffectiveApprovedPauses, buildPauseKey, isIsoBetween } = require('../utils/pauseSkip.util');
const { getScheduleMetaByUserAndSubscription } = require('../utils/subscriptionSchedule.util');

const ORDER_ACCEPTANCE_STATUSES = ['PENDING_REVIEW', 'CONFIRMED', 'DECLINED'];

const toLocalISODate = (d) => {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const parseLocalISODate = (value) => {
	const s = String(value || '').trim();
	if (!s) return undefined;
	const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
	if (!m) return undefined;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const da = Number(m[3]);
	if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return undefined;
	const dt = new Date(y, mo - 1, da);
	if (Number.isNaN(dt.getTime())) return undefined;
	return dt;
};

const parseISODateToStartOfDay = (iso) => {
	const dt = parseLocalISODate(iso);
	if (!dt) return undefined;
	dt.setHours(0, 0, 0, 0);
	return dt;
};

const isWeekday = (d) => {
	if (!d || Number.isNaN(new Date(d).getTime())) return false;
	const dow = new Date(d).getDay();
	return dow >= 1 && dow <= 5;
};

const normalizeHHmm = (value) => {
	const s = String(value || '').trim();
	const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(s);
	if (!m) return undefined;
	const hh = Number(m[1]);
	const mm = Number(m[2]);
	if (!Number.isFinite(hh) || !Number.isFinite(mm)) return undefined;
	if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
	return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const safeString = (v) => String(v || '').trim();

const addDaysISO = (iso, days) => {
	const s = safeString(iso);
	const d = new Date(`${s}T00:00:00`);
	if (Number.isNaN(d.getTime())) return s;
	d.setDate(d.getDate() + days);
	return toLocalISODate(d);
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
	return toLocalISODate(start);
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

const localTodayISO = () => toLocalISODate(new Date());

const enrichOrderForAdmin = async (order) => {
	if (!order) return order;
	const uid = order.userId != null ? String(order.userId) : '';
	const todayISO = localTodayISO();

	const user = uid && mongoose.isValidObjectId(uid)
		? await User.findById(uid).select({ _id: 1, name: 1, email: 1 }).lean()
		: null;

	const items = Array.isArray(order.items) ? order.items : [];
	const metaBySubId = new Map();
	let minStart = '';
	let maxEnd = '';
	for (const it of items) {
		const subscriptionId = safeString(it?.cartItemId);
		if (!subscriptionId) continue;
		const plan = safeString(it?.plan).toLowerCase();
		const baseStart = safeString(it?.orderDetails?.startDate) || (order.createdAt ? toLocalISODate(new Date(order.createdAt)) : todayISO);
		const cycleStartISO = getCurrentCycleStartISO(baseStart, plan, todayISO);
		const baseCycleEndISO = addDaysISO(cycleStartISO, getPeriodDays(plan) - 1);
		const total = getDefaultTotalServings(plan);
		metaBySubId.set(subscriptionId, { cycleStartISO, baseCycleEndISO, cycleEndISO: baseCycleEndISO, total });
		if (!minStart || cycleStartISO < minStart) minStart = cycleStartISO;
		if (!maxEnd || baseCycleEndISO > maxEnd) maxEnd = baseCycleEndISO;
	}

	let deliveredById = new Map();
	const subscriptionIds = Array.from(metaBySubId.keys());
	let skippedDatesById = new Map();
	let maxEndWithSkips = maxEnd;
	if (uid && subscriptionIds.length && minStart && maxEnd) {
		const lookaheadEnd = addDaysISO(maxEnd, 60);
		maxEndWithSkips = lookaheadEnd || maxEnd;

		const [delivered, skipped] = await Promise.all([
			DailyDelivery.find({
				userId: uid,
				subscriptionId: { $in: subscriptionIds },
				status: 'DELIVERED',
				date: { $gte: minStart, $lte: maxEndWithSkips },
			})
				.select({ subscriptionId: 1, date: 1 })
				.lean(),
			DailyDelivery.find({
				userId: uid,
				subscriptionId: { $in: subscriptionIds },
				status: 'SKIPPED',
				date: { $gte: minStart, $lte: maxEndWithSkips },
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

		// Compute extended end date per subscription, then count delivered within that extended window.
		for (const sid of subscriptionIds) {
			const meta = metaBySubId.get(sid);
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
			const meta = metaBySubId.get(sid);
			if (!meta) continue;
			if (!isWeekdayISO(date)) continue;
			if (date < meta.cycleStartISO || date > meta.cycleEndISO) continue;
			deliveredById.set(sid, (deliveredById.get(sid) || 0) + 1);
		}
	}

	const enrichedItems = items.map((it) => {
		const sid = safeString(it?.cartItemId);
		const meta = sid ? metaBySubId.get(sid) : undefined;
		if (!meta) return it;
		const delivered = Math.max(0, Math.min(meta.total, Number(deliveredById.get(sid) || 0)));
		const remaining = Math.max(0, meta.total - delivered);
		const progress = meta.total > 0 ? (delivered / meta.total) * 100 : 0;
		return {
			...it,
			subscriptionProgress: {
				cycleStartDate: meta.cycleStartISO,
				cycleEndDate: meta.cycleEndISO,
				delivered,
				total: meta.total,
				remaining,
				progress,
			},
		};
	});

	// Attach schedule-derived end date + next serving date (source of truth: DailyDelivery).
	if (uid && mongoose.isValidObjectId(uid) && subscriptionIds.length) {
		const schedulePairs = subscriptionIds.map((subscriptionId) => ({ userId: uid, subscriptionId }));
		const scheduleMeta = await getScheduleMetaByUserAndSubscription({ DailyDelivery, pairs: schedulePairs, todayISO });
		for (const it of enrichedItems) {
			const sid = safeString(it?.cartItemId);
			if (!sid) continue;
			const key = buildPauseKey(uid, sid);
			const sm = key ? scheduleMeta.get(key) : undefined;
			if (!sm) continue;
			it.subscriptionProgress = {
				...(it.subscriptionProgress || {}),
				scheduleEndDate: sm.scheduleEndDate,
				nextServingDate: sm.nextServingDate,
				scheduledCount: sm.scheduledCount,
				skippedCount: sm.skippedCount,
			};
		}
	}

	return {
		...order,
		user: user
			? {
				id: user._id != null ? String(user._id) : uid,
				name: safeString(user.name),
				email: safeString(user.email),
			}
			: uid
				? { id: uid }
				: undefined,
		items: enrichedItems,
	};
};

const buildDailyDeliveryDoc = ({
	date,
	time,
	userId,
	address,
	items,
	sourceOrderId,
	sourceCartItemId,
	subscriptionId,
}) => ({
	date,
	time,
	// Phase 6D canonical fields (in addition to legacy date/time)
	deliveryDate: parseISODateToStartOfDay(date),
	deliveryTime: normalizeHHmm(time),
	userId,
	orderId: sourceOrderId,
	subscriptionId: subscriptionId || undefined,
	groupKey: [String(userId || ''), String(date || '').trim(), normalizeHHmm(time) || String(time || '').trim()].filter(Boolean).join('|'),
	address,
	items,
	status: 'PENDING',
	statusHistory: [{ status: 'PENDING', changedAt: new Date(), changedBy: 'SYSTEM' }],
	sourceOrderId,
	sourceCartItemId,
});

const isPaidOrder = (order) => {
	const paymentStatus = String(order?.paymentStatus || '').toUpperCase();
	const legacyStatus = String(order?.status || '').toUpperCase();
	return paymentStatus === 'PAID' || legacyStatus === 'PAID';
};

const parsePagination = (req) => {
	const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
	const limitRaw = Number.parseInt(String(req.query.limit || '20'), 10) || 20;
	const limit = Math.min(100, Math.max(1, limitRaw));
	const skip = (page - 1) * limit;
	return { page, limit, skip };
};

const adminListOrders = async (req, res, next) => {
	try {
		const { page, limit, skip } = parsePagination(req);
		const filterStatus = String(req.query.currentStatus || '').trim();

		const paidClause = {
			$or: [{ paymentStatus: 'PAID' }, { status: 'PAID' }],
		};

		const query = {
			...paidClause,
			...(filterStatus
				? {
					$and: [
						{
							$or: [
								{ currentStatus: filterStatus },
								// Backward-compat: older paid orders may not have currentStatus yet
								...(filterStatus === 'PAID' ? [{ currentStatus: { $exists: false } }] : []),
							],
						},
						paidClause,
					],
				}
				: {}),
		};

		if (filterStatus && !ORDER_LIFECYCLE_STATUSES.includes(filterStatus)) {
			return res.status(400).json({ status: 'error', message: 'Invalid currentStatus' });
		}

		const [orders, total] = await Promise.all([
			Order.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),
			Order.countDocuments(query),
		]);

		return res.json({
			status: 'success',
			data: {
				page,
				limit,
				total,
				orders,
			},
		});
	} catch (err) {
		return next(err);
	}
};

const adminGetOrderDetails = async (req, res, next) => {
	try {
		const orderId = String(req.params.orderId || '').trim();
		if (!mongoose.isValidObjectId(orderId)) {
			return res.status(404).json({ status: 'error', message: 'Order not found' });
		}

		// Phase 6C: mark as seen when any admin opens the order details page.
		const seenNow = new Date();
		const updated = await Order.findOneAndUpdate(
			{ _id: orderId, $or: [{ adminSeenAt: { $exists: false } }, { adminSeenAt: null }] },
			{ $set: { adminSeenAt: seenNow } },
			{ new: true }
		).lean();

		if (updated) {
			const enriched = await enrichOrderForAdmin(updated);
			return res.json({ status: 'success', data: enriched });
		}

		const order = await Order.findById(orderId).lean();
		if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
		const enriched = await enrichOrderForAdmin(order);
		return res.json({ status: 'success', data: enriched });
	} catch (err) {
		return next(err);
	}
};

const adminUpdateOrderAcceptance = async (req, res, next) => {
	try {
		const adminId = String(req.user?.id || req.user?._id || '').trim() || 'unknown';
		const orderId = String(req.params.orderId || '').trim();
		if (!mongoose.isValidObjectId(orderId)) {
			return res.status(404).json({ status: 'error', message: 'Order not found' });
		}

		const acceptanceStatus = String(req.body?.acceptanceStatus || '').trim();
		if (!acceptanceStatus) {
			return res.status(400).json({ status: 'error', message: 'acceptanceStatus is required' });
		}
		if (!ORDER_ACCEPTANCE_STATUSES.includes(acceptanceStatus)) {
			return res.status(400).json({ status: 'error', message: 'Invalid acceptanceStatus' });
		}
		if (acceptanceStatus === 'PENDING_REVIEW') {
			return res.status(400).json({ status: 'error', message: 'Cannot set PENDING_REVIEW manually' });
		}

		const order = await Order.findById(orderId);
		if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
		if (!isPaidOrder(order)) {
			return res.status(400).json({ status: 'error', message: 'Acceptance updates are only allowed for paid orders' });
		}
		if (order.movedToKitchenAt) {
			return res.status(400).json({ status: 'error', message: 'Order has already been moved to kitchen' });
		}

		order.acceptanceStatus = acceptanceStatus;
		await order.save();

		logger.info(`Order acceptance changed: ${String(order._id)} -> ${acceptanceStatus} by ADMIN:${adminId}`);

		return res.json({ status: 'success', data: order.toObject() });
	} catch (err) {
		return next(err);
	}
};

const adminMoveOrderToKitchen = async (req, res, next) => {
	try {
		const adminId = String(req.user?.id || req.user?._id || '').trim() || 'unknown';
		const orderId = String(req.params.orderId || '').trim();
		if (!mongoose.isValidObjectId(orderId)) {
			return res.status(404).json({ status: 'error', message: 'Order not found' });
		}

		const order = await Order.findById(orderId);
		if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
		if (!isPaidOrder(order)) {
			return res.status(400).json({ status: 'error', message: 'Kitchen move is only allowed for paid orders' });
		}
		if (order.movedToKitchenAt) {
			return res.json({ status: 'success', data: { order: order.toObject(), deliveriesCreated: 0 } });
		}

		const acceptance = String(order.acceptanceStatus || 'PENDING_REVIEW').toUpperCase();
		if (acceptance !== 'CONFIRMED') {
			return res.status(400).json({ status: 'error', message: 'Order must be CONFIRMED before moving to kitchen' });
		}

		const now = new Date();

		const address = order.deliveryAddress;
		const userId = order.userId;
		const sourceOrderId = order._id;

		const items = Array.isArray(order.items) ? order.items : [];
		const isSingleOrTrialOnly = items.every((it) => ['single', 'trial'].includes(String(it.plan || '').toLowerCase()));

		const deliveriesToInsert = [];

		if (isSingleOrTrialOnly) {
			// Single / trial: one delivery total (all items together)
			const first = items[0];
			const immediate = Boolean(first?.orderDetails?.immediateDelivery);
			const startDate = immediate ? new Date() : parseLocalISODate(first?.orderDetails?.startDate) || new Date();
			const date = toLocalISODate(startDate);
			const time = String(first?.orderDetails?.deliveryTime || '');
			const normalizedTime = time.trim() || '12:00';

			deliveriesToInsert.push(
				buildDailyDeliveryDoc({
					date,
					time: normalizedTime,
					userId,
					address,
					items: items.map((it) => ({
						orderId: sourceOrderId,
						cartItemId: it.cartItemId,
						itemId: it.cartItemId,
						type: it.type,
						plan: it.plan,
						title: it.pricingSnapshot?.title || it.type,
						name: it.pricingSnapshot?.title || it.type,
						quantity: it.quantity,
					})),
					sourceOrderId,
					sourceCartItemId: '__ORDER__',
					subscriptionId: undefined,
				})
			);
		} else {
			const MAX_LOOKAHEAD_DAYS = 366;

			// Phase 7C: Do not generate deliveries during an effective approved pause window.
			// (A PAUSE is ignored if a linked WITHDRAW_PAUSE has been APPROVED.)
			const recurringItems = items.filter((it) => ['weekly', 'monthly'].includes(String(it.plan || '').toLowerCase()));
			const recurringSubscriptionIds = Array.from(
				new Set(recurringItems.map((it) => String(it.cartItemId || '').trim()).filter(Boolean))
			);
			const pauseRangesByKey = new Map();
			if (recurringSubscriptionIds.length) {
				let minStart;
				let maxEnd;
				for (const it of recurringItems) {
					const immediate = Boolean(it?.orderDetails?.immediateDelivery);
					const startDate = immediate ? new Date() : parseLocalISODate(it?.orderDetails?.startDate) || new Date();
					const start = new Date(startDate);
					start.setHours(0, 0, 0, 0);
					const end = new Date(start);
					end.setDate(end.getDate() + MAX_LOOKAHEAD_DAYS);
					if (!minStart || start.getTime() < minStart.getTime()) minStart = start;
					if (!maxEnd || end.getTime() > maxEnd.getTime()) maxEnd = end;
				}

				const fromISO = minStart ? toLocalISODate(minStart) : toLocalISODate(new Date());
				const toISO = maxEnd ? toLocalISODate(maxEnd) : toLocalISODate(new Date());
				const pauses = await getEffectiveApprovedPauses({
					PauseSkipLog,
					userIds: [userId],
					subscriptionIds: recurringSubscriptionIds,
					fromISO,
					toISO,
				});
				for (const p of pauses) {
					const key = buildPauseKey(p.userId, p.subscriptionId);
					if (!key) continue;
					if (!pauseRangesByKey.has(key)) pauseRangesByKey.set(key, []);
					pauseRangesByKey.get(key).push({ start: p.pauseStartDate, end: p.pauseEndDate });
				}
			}

			// Weekly / monthly: one delivery per weekday per subscription item (full servings upfront)
			for (const it of items) {
				const plan = String(it.plan || '').toLowerCase();
				if (!['weekly', 'monthly'].includes(plan)) continue;
				const targetServings = getDefaultTotalServings(plan);

				const immediate = Boolean(it?.orderDetails?.immediateDelivery);
				const startDate = immediate ? new Date() : parseLocalISODate(it?.orderDetails?.startDate) || new Date();
				const time = String(it?.orderDetails?.deliveryTime || '').trim() || '12:00';

				const sid = String(it.cartItemId || '').trim();
				const pauseKey = sid ? buildPauseKey(userId, sid) : undefined;
				const ranges = pauseKey ? pauseRangesByKey.get(pauseKey) : undefined;

				let createdForItem = 0;
				for (let offset = 0; offset < MAX_LOOKAHEAD_DAYS && createdForItem < targetServings; offset += 1) {
					const day = new Date(startDate);
					day.setDate(day.getDate() + offset);
					if (!isWeekday(day)) continue;
					const date = toLocalISODate(day);
					if (ranges && ranges.length && ranges.some((r) => isIsoBetween(date, r.start, r.end))) continue;

					deliveriesToInsert.push(
						buildDailyDeliveryDoc({
							date,
							time,
							userId,
							address,
							items: [
								{
									orderId: sourceOrderId,
									cartItemId: it.cartItemId,
									itemId: it.cartItemId,
									type: it.type,
									plan: it.plan,
									title: it.pricingSnapshot?.title || it.type,
									name: it.pricingSnapshot?.title || it.type,
									quantity: it.quantity,
								},
							],
							sourceOrderId,
							sourceCartItemId: it.cartItemId,
							subscriptionId: it.cartItemId,
						})
					);
					createdForItem += 1;
				}
			}
		}

		let deliveriesCreated = 0;
		if (deliveriesToInsert.length) {
			try {
				const inserted = await DailyDelivery.insertMany(deliveriesToInsert, { ordered: false });
				deliveriesCreated = Array.isArray(inserted) ? inserted.length : 0;
			} catch (err) {
				if (String(err?.code) !== '11000' && Number(err?.code) !== 11000) throw err;
			}
		}

		// Mark order as moved only after delivery insertion succeeded (or was deduped).
		order.movedToKitchenAt = now;
		await order.save();

		logger.info(`Order moved to kitchen: ${String(order._id)} deliveriesCreated=${deliveriesCreated} by ADMIN:${adminId}`);

		return res.json({ status: 'success', data: { order: order.toObject(), deliveriesCreated } });
	} catch (err) {
		return next(err);
	}
};

const ensurePaidLifecycleInitialized = async (order, { changedAt }) => {
	if (!isPaidOrder(order)) {
		const err = new Error('Lifecycle updates are only allowed for paid orders');
		err.statusCode = 400;
		throw err;
	}

	if (order.currentStatus) return order;

	// Backward-compat: initialize lifecycle for older paid orders.
	const updated = await Order.findOneAndUpdate(
		{ _id: order._id, currentStatus: { $exists: false } },
		{
			$set: { currentStatus: 'PAID' },
			$push: { statusHistory: { status: 'PAID', changedAt: changedAt || new Date(), changedBy: 'SYSTEM' } },
		},
		{ new: true }
	);

	return updated || order;
};

const adminUpdateOrderStatus = async (req, res, next) => {
	try {
		const adminId = String(req.user?.id || req.user?._id || '').trim() || 'unknown';
		const orderId = String(req.params.orderId || '').trim();
		if (!mongoose.isValidObjectId(orderId)) {
			return res.status(404).json({ status: 'error', message: 'Order not found' });
		}

		const nextStatus = String(req.body?.status || '').trim();
		if (!nextStatus) return res.status(400).json({ status: 'error', message: 'status is required' });
		if (!ORDER_LIFECYCLE_STATUSES.includes(nextStatus)) {
			return res.status(400).json({ status: 'error', message: 'Invalid status' });
		}
		if (nextStatus === 'PAID') {
			return res.status(400).json({ status: 'error', message: 'Admins cannot set PAID manually' });
		}

		const order = await Order.findById(orderId);
		if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

		const paidAt = order.payment?.paidAt || order.updatedAt || order.createdAt || new Date();
		const initialized = await ensurePaidLifecycleInitialized(order, { changedAt: paidAt });
		const fromStatus = String(initialized.currentStatus || 'PAID').trim();

		const verdict = validateOrderStatusTransition({ fromStatus, toStatus: nextStatus });
		if (verdict.noop) {
			return res.json({ status: 'success', data: initialized.toObject ? initialized.toObject() : initialized });
		}

		const updated = await Order.findOneAndUpdate(
			{ _id: orderId, currentStatus: fromStatus },
			{
				$set: { currentStatus: nextStatus },
				$push: { statusHistory: { status: nextStatus, changedAt: new Date(), changedBy: 'ADMIN' } },
			},
			{ new: true }
		);

		if (!updated) {
			return res.status(409).json({ status: 'error', message: 'Order status changed concurrently. Please retry.' });
		}

		logger.info(`Order lifecycle status changed: ${String(updated._id)} ${fromStatus} -> ${nextStatus} by ADMIN:${adminId}`);

		return res.json({ status: 'success', data: updated.toObject() });
	} catch (err) {
		return next(err);
	}
};

const adminUpdateOrderNotes = async (req, res, next) => {
	try {
		const orderId = String(req.params.orderId || '').trim();
		if (!mongoose.isValidObjectId(orderId)) {
			return res.status(404).json({ status: 'error', message: 'Order not found' });
		}

		const notes = typeof req.body?.adminNotes === 'string' ? req.body.adminNotes : '';

		const order = await Order.findById(orderId);
		if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
		if (!isPaidOrder(order)) {
			return res.status(400).json({ status: 'error', message: 'Lifecycle updates are only allowed for paid orders' });
		}

		order.adminNotes = notes;
		await order.save();

		return res.json({ status: 'success', data: order.toObject() });
	} catch (err) {
		return next(err);
	}
};

module.exports = {
	adminListOrders,
	adminGetOrderDetails,
	adminUpdateOrderAcceptance,
	adminMoveOrderToKitchen,
	adminUpdateOrderStatus,
	adminUpdateOrderNotes,
};
