
const Addon = require('../models/Addon.model');
const CustomMealSubscription = require('../models/CustomMealSubscription.model');
const AddonSubscription = require('../models/AddonSubscription.model');
const AddonPurchase = require('../models/AddonPurchase.model');
const PauseSkipLog = require('../models/PauseSkipLog.model');
const { getEffectiveApprovedPauses, buildPauseKey, isIsoBetween } = require('../utils/pauseSkip.util');

const FREQUENCIES = new Set(['weekly', 'monthly']);
const SUBSCRIPTION_STATUSES = new Set(['active', 'paused']);
const PURCHASE_STATUSES = new Set(['pending', 'confirmed', 'cancelled']);

const SERVINGS = { weekly: 5, monthly: 20 };

const getCanonicalComponents = () => {
	// Phase 4: canonical ingredient list for Build-Your-Own.
	// This is intentionally separate from meal pack subscriptions logic.
	// Later this can be replaced with a Mongo collection + admin tooling.
	return [
		// Protein
		{ id: 'chicken-breast', name: 'Chicken Breast', category: 'protein', proteinGramsPerServing: 23, pricePerServing: 149, caloriesPerServing: 165 },
		{ id: 'tandoori-chicken', name: 'Tandoori Chicken', category: 'protein', proteinGramsPerServing: 22, pricePerServing: 169, caloriesPerServing: 190 },
		{ id: 'grilled-fish', name: 'Grilled Fish Fillet', category: 'protein', proteinGramsPerServing: 24, pricePerServing: 199, caloriesPerServing: 180 },
		{ id: 'paneer', name: 'Paneer', category: 'protein', proteinGramsPerServing: 16, pricePerServing: 129, caloriesPerServing: 265 },
		{ id: 'egg-whites', name: 'Egg Whites', category: 'protein', proteinGramsPerServing: 12, pricePerServing: 99, caloriesPerServing: 70 },

		// Carbs
		{ id: 'brown-rice', name: 'Brown Rice', category: 'carbs', proteinGramsPerServing: 3, pricePerServing: 49, caloriesPerServing: 210 },
		{ id: 'quinoa', name: 'Quinoa', category: 'carbs', proteinGramsPerServing: 4, pricePerServing: 89, caloriesPerServing: 222 },
		{ id: 'sweet-potato', name: 'Sweet Potato', category: 'carbs', proteinGramsPerServing: 2, pricePerServing: 69, caloriesPerServing: 180 },
		{ id: 'chapati', name: 'Chapati (2 pcs)', category: 'carbs', proteinGramsPerServing: 4, pricePerServing: 39, caloriesPerServing: 210 },

		// Sides
		{ id: 'veggies-mix', name: 'Veggies Mix', category: 'sides', proteinGramsPerServing: 2, pricePerServing: 49, caloriesPerServing: 80 },
		{ id: 'salad', name: 'Fresh Salad', category: 'sides', proteinGramsPerServing: 1, pricePerServing: 59, caloriesPerServing: 45 },
		{ id: 'yogurt', name: 'Yogurt', category: 'sides', proteinGramsPerServing: 4, pricePerServing: 49, caloriesPerServing: 80 },
		{ id: 'nuts', name: 'Nuts / Dry Fruits', category: 'sides', proteinGramsPerServing: 6, pricePerServing: 79, caloriesPerServing: 160 },
	];
};

const toClientId = (doc) => {
	if (!doc) return doc;
	const obj = typeof doc.toObject === 'function' ? doc.toObject({ versionKey: false }) : doc;
	return {
		...obj,
		id: String(obj._id),
	};
};

const requireAuthUserId = (req) => {
	const userId = req?.user?.id;
	if (!userId) {
		const err = new Error('Authentication required');
		err.statusCode = 401;
		throw err;
	}
	return userId;
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

const parsePositiveInt = (value, fieldName) => {
	const n = Number(value);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
		const err = new Error(`${fieldName} must be a positive integer`);
		err.statusCode = 400;
		throw err;
	}
	return n;
};

const computeTotalsFromSelections = (selections) => {
	const components = getCanonicalComponents();
	const byId = new Map(components.map((c) => [c.id, c]));

	let proteinGrams = 0;
	let calories = 0;
	let pricePerServing = 0;

	for (const sel of selections) {
		const componentId = String(sel?.componentId || '').trim();
		const quantity = Number(sel?.quantity);

		if (!componentId) {
			const err = new Error('Selections must include componentId');
			err.statusCode = 400;
			throw err;
		}
		if (!Number.isFinite(quantity) || quantity <= 0) {
			const err = new Error('Selections must include a quantity > 0');
			err.statusCode = 400;
			throw err;
		}

		const component = byId.get(componentId);
		if (!component) {
			const err = new Error(`Unknown componentId: ${componentId}`);
			err.statusCode = 400;
			throw err;
		}

		proteinGrams += component.proteinGramsPerServing * quantity;
		pricePerServing += component.pricePerServing * quantity;
		if (typeof component.caloriesPerServing === 'number') {
			calories += component.caloriesPerServing * quantity;
		}
	}

	const weeklyPrice = pricePerServing * SERVINGS.weekly;
	const monthlyPrice = pricePerServing * SERVINGS.monthly;

	return {
		proteinGrams,
		calories,
		pricePerServing,
		weeklyPrice,
		monthlyPrice,
	};
};

const listCustomMealComponents = async (req, res) => {
	const components = getCanonicalComponents();

	return res.status(200).json({
		status: 'success',
		data: components,
	});
};

const listCustomMealSubscriptions = async (req, res, next) => {
	try {
		const userId = requireAuthUserId(req);
		const today = localTodayISO();
		const horizonISO = toISODate(new Date(`${today}T00:00:00`).getTime() + 366 * 24 * 60 * 60 * 1000);

		const items = await CustomMealSubscription.find({ userId }).sort({ createdAt: -1 }).lean();
		const subscriptionIds = items.map((d) => String(d._id));
		let bestByKey = new Map();
		if (subscriptionIds.length) {
			const pauses = await getEffectiveApprovedPauses({
				PauseSkipLog,
				userIds: [userId],
				subscriptionIds,
				fromISO: today,
				toISO: horizonISO,
			});
			for (const p of pauses) {
				const key = buildPauseKey(p.userId, p.subscriptionId);
				if (!key) continue;
				const end = String(p.pauseEndDate || '').trim();
				if (!end) continue;
				const prev = bestByKey.get(key);
				const prevEnd = prev ? String(prev.pauseEndDate || '').trim() : '';
				if (!prev || end > prevEnd) bestByKey.set(key, p);
			}
		}

		return res.json({
			status: 'success',
			data: items.map((d) => ({
				...(() => {
					const id = String(d._id);
					const key = buildPauseKey(userId, id);
					const pause = key ? bestByKey.get(key) : undefined;
					if (!pause) {
						return {
							...d,
							id,
							userId: String(d.userId),
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
						...d,
						id,
						userId: String(d.userId),
						status: pausedNow ? 'paused' : d.status,
						pauseStartDate: start || undefined,
						pauseEndDate: end || undefined,
						pauseReason: pause.reason || undefined,
						pauseRequestId: pause?._id != null ? String(pause._id) : undefined,
					};
				})(),
			})),
		});
	} catch (err) {
		return next(err);
	}
};

const createCustomMealSubscription = async (req, res, next) => {
	try {
		const userId = requireAuthUserId(req);
		const frequency = String(req.body?.frequency || '').trim();
		const startDate = String(req.body?.startDate || '').trim();
		const selections = Array.isArray(req.body?.selections) ? req.body.selections : [];

		if (!FREQUENCIES.has(frequency)) {
			const err = new Error('Invalid frequency');
			err.statusCode = 400;
			throw err;
		}
		if (!startDate) {
			const err = new Error('startDate is required');
			err.statusCode = 400;
			throw err;
		}
		if (!selections.length) {
			const err = new Error('At least one selection is required');
			err.statusCode = 400;
			throw err;
		}

		const totals = computeTotalsFromSelections(selections);

		const created = await CustomMealSubscription.create({
			userId,
			frequency,
			startDate,
			selections: selections.map((s) => ({
				componentId: String(s.componentId || '').trim(),
				quantity: Number(s.quantity),
			})),
			totals,
			status: 'active',
		});

		const obj = toClientId(created);
		return res.status(201).json({
			status: 'success',
			data: {
				...obj,
				userId: String(obj.userId),
			},
		});
	} catch (err) {
		return next(err);
	}
};

const setCustomMealSubscriptionStatus = async (req, res, next) => {
	try {
		const userId = requireAuthUserId(req);
		const { id } = req.params;
		const status = String(req.body?.status || '').trim();
		if (!SUBSCRIPTION_STATUSES.has(status)) {
			const err = new Error('Invalid status');
			err.statusCode = 400;
			throw err;
		}

		const updated = await CustomMealSubscription.findOneAndUpdate(
			{ _id: id, userId },
			{ status },
			{ new: true, runValidators: true }
		);
		if (!updated) {
			return res.status(404).json({ status: 'error', message: 'Custom meal subscription not found' });
		}
		const obj = toClientId(updated);
		return res.json({
			status: 'success',
			data: {
				...obj,
				userId: String(obj.userId),
			},
		});
	} catch (err) {
		return next(err);
	}
};

const listAddonSubscriptions = async (req, res, next) => {
	try {
		const userId = requireAuthUserId(req);
		const today = localTodayISO();
		const horizonISO = toISODate(new Date(`${today}T00:00:00`).getTime() + 366 * 24 * 60 * 60 * 1000);

		const items = await AddonSubscription.find({ userId }).sort({ createdAt: -1 }).lean();
		const subscriptionIds = items.map((d) => String(d._id));
		let bestByKey = new Map();
		if (subscriptionIds.length) {
			const pauses = await getEffectiveApprovedPauses({
				PauseSkipLog,
				userIds: [userId],
				subscriptionIds,
				fromISO: today,
				toISO: horizonISO,
			});
			for (const p of pauses) {
				const key = buildPauseKey(p.userId, p.subscriptionId);
				if (!key) continue;
				const end = String(p.pauseEndDate || '').trim();
				if (!end) continue;
				const prev = bestByKey.get(key);
				const prevEnd = prev ? String(prev.pauseEndDate || '').trim() : '';
				if (!prev || end > prevEnd) bestByKey.set(key, p);
			}
		}

		return res.json({
			status: 'success',
			data: items.map((d) => ({
				...(() => {
					const id = String(d._id);
					const key = buildPauseKey(userId, id);
					const pause = key ? bestByKey.get(key) : undefined;
					if (!pause) {
						return {
							...d,
							id,
							userId: String(d.userId),
							addonId: String(d.addonId),
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
						...d,
						id,
						userId: String(d.userId),
						addonId: String(d.addonId),
						status: pausedNow ? 'paused' : d.status,
						pauseStartDate: start || undefined,
						pauseEndDate: end || undefined,
						pauseReason: pause.reason || undefined,
						pauseRequestId: pause?._id != null ? String(pause._id) : undefined,
					};
				})(),
			})),
		});
	} catch (err) {
		return next(err);
	}
};

const createAddonSubscription = async (req, res, next) => {
	try {
		const userId = requireAuthUserId(req);
		const addonId = String(req.body?.addonId || '').trim();
		const frequency = String(req.body?.frequency || '').trim();
		const startDate = String(req.body?.startDate || '').trim();
		const servings = parsePositiveInt(req.body?.servings, 'servings');

		if (!addonId) {
			const err = new Error('addonId is required');
			err.statusCode = 400;
			throw err;
		}
		if (!FREQUENCIES.has(frequency)) {
			const err = new Error('Invalid frequency');
			err.statusCode = 400;
			throw err;
		}
		if (!startDate) {
			const err = new Error('startDate is required');
			err.statusCode = 400;
			throw err;
		}

		const addon = await Addon.findOne({ _id: addonId, isActive: true }).lean();
		if (!addon) {
			return res.status(404).json({ status: 'error', message: 'Add-on not found' });
		}

		let price = 0;
		// Admin enters TOTAL prices for weekly/monthly plans (no auto-multiplication).
		// Fallback to legacy behavior (single * servings) only when plan price is not configured.
		if (frequency === 'weekly' && addon?.pricing?.weekly != null) {
			price = Number(addon.pricing.weekly);
		} else if (frequency === 'monthly' && addon?.pricing?.monthly != null) {
			price = Number(addon.pricing.monthly);
		} else {
			price = Number(addon?.pricing?.single || 0) * servings;
		}

		const created = await AddonSubscription.create({
			userId,
			addonId,
			frequency,
			servings,
			price,
			startDate,
			status: 'active',
		});

		const obj = toClientId(created);
		return res.status(201).json({
			status: 'success',
			data: {
				...obj,
				userId: String(obj.userId),
				addonId: String(obj.addonId),
			},
		});
	} catch (err) {
		return next(err);
	}
};

const setAddonSubscriptionStatus = async (req, res, next) => {
	try {
		const userId = requireAuthUserId(req);
		const { id } = req.params;
		const status = String(req.body?.status || '').trim();
		if (!SUBSCRIPTION_STATUSES.has(status)) {
			const err = new Error('Invalid status');
			err.statusCode = 400;
			throw err;
		}

		const updated = await AddonSubscription.findOneAndUpdate(
			{ _id: id, userId },
			{ status },
			{ new: true, runValidators: true }
		);
		if (!updated) {
			return res.status(404).json({ status: 'error', message: 'Add-on subscription not found' });
		}
		const obj = toClientId(updated);
		return res.json({
			status: 'success',
			data: {
				...obj,
				userId: String(obj.userId),
				addonId: String(obj.addonId),
			},
		});
	} catch (err) {
		return next(err);
	}
};

const listAddonPurchases = async (req, res, next) => {
	try {
		const userId = requireAuthUserId(req);
		const items = await AddonPurchase.find({ userId })
			.sort({ createdAt: -1 })
			.lean();
		return res.json({
			status: 'success',
			data: items.map((d) => ({
				...d,
				id: String(d._id),
				userId: String(d.userId),
				addonId: String(d.addonId),
			})),
		});
	} catch (err) {
		return next(err);
	}
};

const createAddonPurchase = async (req, res, next) => {
	try {
		const userId = requireAuthUserId(req);
		const addonId = String(req.body?.addonId || '').trim();
		const quantity = parsePositiveInt(req.body?.quantity, 'quantity');

		if (!addonId) {
			const err = new Error('addonId is required');
			err.statusCode = 400;
			throw err;
		}

		const addon = await Addon.findOne({ _id: addonId, isActive: true }).lean();
		if (!addon) {
			return res.status(404).json({ status: 'error', message: 'Add-on not found' });
		}

		const price = Number(addon?.pricing?.single || 0) * quantity;
		const created = await AddonPurchase.create({
			userId,
			addonId,
			quantity,
			price,
			status: 'pending',
		});
		const obj = toClientId(created);
		return res.status(201).json({
			status: 'success',
			data: {
				...obj,
				userId: String(obj.userId),
				addonId: String(obj.addonId),
			},
		});
	} catch (err) {
		return next(err);
	}
};

module.exports = {
	listCustomMealComponents,
	listCustomMealSubscriptions,
	createCustomMealSubscription,
	setCustomMealSubscriptionStatus,
	listAddonSubscriptions,
	createAddonSubscription,
	setAddonSubscriptionStatus,
	listAddonPurchases,
	createAddonPurchase,
};
