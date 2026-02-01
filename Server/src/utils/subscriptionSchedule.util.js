const mongoose = require('mongoose');

const safeString = (v) => String(v || '').trim();

const localTodayISO = () => {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
};

/**
 * Computes schedule-derived meta for delivery-backed subscription items.
 *
 * - scheduleEndDate: max scheduled YYYY-MM-DD (includes SKIPPED/DELIVERED/etc)
 * - nextServingDate: next date with a serving-bearing status (excludes SKIPPED/DELIVERED)
 * - deliveredCount: count of DELIVERED
 * - skippedCount: count of SKIPPED
 * - scheduledCount: total count of deliveries in schedule
 *
 * Keys are returned as `${userId}|${subscriptionId}`.
 */
const getScheduleMetaByUserAndSubscription = async ({ DailyDelivery, pairs, todayISO }) => {
	const today = safeString(todayISO) || localTodayISO();
	const list = Array.isArray(pairs) ? pairs : [];
	if (!list.length) return new Map();

	const subscriptionIds = Array.from(new Set(list.map((p) => safeString(p?.subscriptionId)).filter(Boolean)));
	const userIds = Array.from(new Set(list.map((p) => safeString(p?.userId)).filter((u) => mongoose.isValidObjectId(u))));
	if (!subscriptionIds.length || !userIds.length) return new Map();

	const ACTIVE_STATUSES = ['PENDING', 'COOKING', 'PACKED', 'OUT_FOR_DELIVERY'];
	const SENTINEL = '9999-12-31';

	const rows = await DailyDelivery.aggregate([
		{
			$match: {
				userId: { $in: userIds.map((u) => new mongoose.Types.ObjectId(u)) },
				subscriptionId: { $in: subscriptionIds },
			},
		},
		{
			$group: {
				_id: { userId: '$userId', subscriptionId: '$subscriptionId' },
				scheduleEndDate: { $max: '$date' },
				nextServingDate: {
					$min: {
						$cond: [
							{
								$and: [
									{ $gte: ['$date', today] },
									{ $in: ['$status', ACTIVE_STATUSES] },
								],
							},
							'$date',
							SENTINEL,
						],
					},
				},
				deliveredCount: {
					$sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
				},
				skippedCount: {
					$sum: { $cond: [{ $eq: ['$status', 'SKIPPED'] }, 1, 0] },
				},
				scheduledCount: { $sum: 1 },
			},
		},
	]);

	const map = new Map();
	for (const r of rows || []) {
		const uid = r?._id?.userId != null ? String(r._id.userId) : '';
		const sid = safeString(r?._id?.subscriptionId);
		if (!uid || !sid) continue;
		const key = `${uid}|${sid}`;
		map.set(key, {
			userId: uid,
			subscriptionId: sid,
			scheduleEndDate: safeString(r.scheduleEndDate) || undefined,
			nextServingDate: safeString(r.nextServingDate) && safeString(r.nextServingDate) !== SENTINEL ? safeString(r.nextServingDate) : undefined,
			deliveredCount: Number(r.deliveredCount || 0),
			skippedCount: Number(r.skippedCount || 0),
			scheduledCount: Number(r.scheduledCount || 0),
		});
	}

	return map;
};

module.exports = {
	localTodayISO,
	getScheduleMetaByUserAndSubscription,
};
