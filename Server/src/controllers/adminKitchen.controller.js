const mongoose = require('mongoose');

const DailyDelivery = require('../models/DailyDelivery.model');
const PauseSkipLog = require('../models/PauseSkipLog.model');
const User = require('../models/User.model');
const logger = require('../utils/logger.util');
const { getEffectiveApprovedPauses, buildPauseKey } = require('../utils/pauseSkip.util');

const DELIVERY_STATUSES = ['PENDING', 'COOKING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SKIPPED'];

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
	dt.setHours(0, 0, 0, 0);
	return dt;
};

const nextStatusFrom = (current) => {
	const idx = DELIVERY_STATUSES.indexOf(String(current || '').trim());
	if (idx < 0) return undefined;
	const next = DELIVERY_STATUSES[idx + 1];
	if (next === 'SKIPPED') return undefined;
	return next;
};

const adminKitchenListDeliveries = async (req, res, next) => {
	try {
		const dateStr = String(req.query?.date || '').trim() || toLocalISODate(new Date());
		const dayStart = parseLocalISODate(dateStr);
		if (!dayStart) return res.status(400).json({ status: 'error', message: 'Invalid date (expected YYYY-MM-DD)' });

		const dayEnd = new Date(dayStart);
		dayEnd.setDate(dayEnd.getDate() + 1);

		const status = String(req.query?.status || '').trim();
		if (status && !DELIVERY_STATUSES.includes(status)) {
			return res.status(400).json({ status: 'error', message: 'Invalid status' });
		}

		const userId = String(req.query?.userId || '').trim();
		if (userId && !mongoose.isValidObjectId(userId)) {
			return res.status(400).json({ status: 'error', message: 'Invalid userId' });
		}

		const filter = {
			...(status ? { status } : {}),
			...(userId ? { userId } : {}),
			$or: [
				{ deliveryDate: { $gte: dayStart, $lt: dayEnd } },
				// Backward-compat: older records only have ISO date string
				{ date: dateStr },
			],
		};

		const deliveries = await DailyDelivery.find(filter)
			.sort({ deliveryTime: 1, time: 1, createdAt: 1 })
			.lean();

		// Phase 7: Filter out deliveries during an approved pause window.
		// Meal-pack deliveries are linked via `subscriptionId` = cartItemId.
		const deliveryPairs = deliveries
			.map((d) => {
				const uid = d.userId != null ? String(d.userId) : '';
				const sid = String(d.subscriptionId || '').trim();
				return uid && sid ? { uid, sid } : undefined;
			})
			.filter(Boolean);

		if (deliveryPairs.length) {
			const userIdsForPause = Array.from(new Set(deliveryPairs.map((p) => p.uid)));
			const subIdsForPause = Array.from(new Set(deliveryPairs.map((p) => p.sid)));

			const pauses = await getEffectiveApprovedPauses({
				PauseSkipLog,
				userIds: userIdsForPause,
				subscriptionIds: subIdsForPause,
				fromISO: dateStr,
				toISO: dateStr,
			});

			if (pauses.length) {
				const pausedKey = new Set(
					pauses
						.map((p) => {
							const key = buildPauseKey(p.userId, p.subscriptionId);
							return key || undefined;
						})
						.filter(Boolean)
				);

				if (pausedKey.size) {
					for (let i = deliveries.length - 1; i >= 0; i -= 1) {
						const uid = deliveries[i].userId != null ? String(deliveries[i].userId) : '';
						const sid = String(deliveries[i].subscriptionId || '').trim();
						if (uid && sid && pausedKey.has(`${uid}|${sid}`)) {
							deliveries.splice(i, 1);
						}
					}
				}
			}
		}

		const userIds = Array.from(
			new Set(
				deliveries
					.map((d) => (d.userId != null ? String(d.userId) : ''))
					.filter(Boolean)
			)
		);

		let usersById = new Map();
		if (userIds.length) {
			const users = await User.find({ _id: { $in: userIds } })
				.select({ name: 1, addresses: 1 })
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
							contactNumber: def.contactNumber || '',
						},
					];
				})
			);
		}

		const enriched = deliveries.map((d) => {
			const uid = d.userId != null ? String(d.userId) : '';
			return {
				...d,
				user: uid ? usersById.get(uid) : undefined,
			};
		});

		return res.json({ status: 'success', data: enriched });
	} catch (err) {
		return next(err);
	}
};

const adminKitchenUpdateDeliveryStatus = async (req, res, next) => {
	try {
		const actor = String(req.user?.id || req.user?._id || '').trim() || 'unknown';
		const todayISO = toLocalISODate(new Date());
		const deliveryId = String(req.params.deliveryId || '').trim();
		if (!mongoose.isValidObjectId(deliveryId)) {
			return res.status(404).json({ status: 'error', message: 'Delivery not found' });
		}

		const status = String(req.body?.status || '').trim();
		if (!status) return res.status(400).json({ status: 'error', message: 'status is required' });
		if (!DELIVERY_STATUSES.includes(status)) {
			return res.status(400).json({ status: 'error', message: 'Invalid status' });
		}

		const delivery = await DailyDelivery.findById(deliveryId);
		if (!delivery) return res.status(404).json({ status: 'error', message: 'Delivery not found' });

		const effectiveDate = String(delivery.date || '').trim() || (delivery.deliveryDate ? toLocalISODate(new Date(delivery.deliveryDate)) : '');
		if (effectiveDate && effectiveDate !== todayISO) {
			return res.status(400).json({ status: 'error', message: 'Only today\'s deliveries can be updated by kitchen' });
		}

		const current = String(delivery.status || '').trim();
		if (current === 'DELIVERED' || current === 'SKIPPED') {
			return res.status(400).json({ status: 'error', message: 'Delivered deliveries are final' });
		}

		const next = nextStatusFrom(current);
		if (status !== current && status !== next) {
			return res.status(400).json({ status: 'error', message: `Invalid transition from ${current} to ${status}` });
		}

		if (status === current) {
			return res.json({ status: 'success', data: delivery.toObject() });
		}

		delivery.status = status;
		delivery.statusHistory = Array.isArray(delivery.statusHistory) ? delivery.statusHistory : [];
		delivery.statusHistory.push({ status, changedAt: new Date(), changedBy: 'KITCHEN' });
		await delivery.save();

		logger.info(`Kitchen delivery status changed: ${String(delivery._id)} ${current} -> ${status} by KITCHEN:${actor}`);

		return res.json({ status: 'success', data: delivery.toObject() });
	} catch (err) {
		return next(err);
	}
};

module.exports = {
	adminKitchenListDeliveries,
	adminKitchenUpdateDeliveryStatus,
};
