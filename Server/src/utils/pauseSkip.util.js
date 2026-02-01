const mongoose = require('mongoose');

const toISO = (d) => {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const addDaysISO = (iso, days) => {
	const s = String(iso || '').trim();
	const d = Number(days);
	if (!s) return '';
	const base = new Date(`${s}T00:00:00`);
	if (Number.isNaN(base.getTime())) return '';
	base.setDate(base.getDate() + (Number.isFinite(d) ? d : 0));
	return toISO(base);
};

const localTodayISO = () => toISO(new Date());

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

const isWeekdayISO = (iso) => {
	const dt = parseLocalISODate(iso);
	if (!dt) return false;
	const dow = dt.getDay();
	return dow >= 1 && dow <= 5;
};

const isIsoBetween = (iso, start, end) => {
	const d = String(iso || '').trim();
	const s = String(start || '').trim();
	const e = String(end || '').trim();
	if (!d || !s || !e) return false;
	return s <= d && d <= e;
};

const buildPauseKey = (userId, subscriptionId) => {
	const uid = userId != null ? String(userId) : '';
	const sid = String(subscriptionId || '').trim();
	return uid && sid ? `${uid}|${sid}` : '';
};

const getEffectiveApprovedPauses = async ({ PauseSkipLog, userIds, subscriptionIds, fromISO, toISO: toISOParam }) => {
	const uids = (userIds || []).map((u) => String(u)).filter((u) => mongoose.isValidObjectId(u));
	const sids = (subscriptionIds || []).map((s) => String(s || '').trim()).filter(Boolean);
	const from = String(fromISO || '').trim();
	const to = String(toISOParam || '').trim();
	if (!uids.length || !sids.length || !from || !to) return [];

	const pauses = await PauseSkipLog.find({
		requestType: 'PAUSE',
		status: 'APPROVED',
		userId: { $in: uids },
		subscriptionId: { $in: sids },
		pauseEndDate: { $gte: from },
		pauseStartDate: { $lte: to },
	})
		.select({ userId: 1, subscriptionId: 1, pauseStartDate: 1, pauseEndDate: 1 })
		.lean();

	if (!pauses.length) return [];

	const pauseIds = pauses.map((p) => p._id).filter(Boolean);
	const withdrawn = await PauseSkipLog.find({
		requestType: 'WITHDRAW_PAUSE',
		status: 'APPROVED',
		linkedTo: { $in: pauseIds },
	})
		.select({ linkedTo: 1, decidedAt: 1, createdAt: 1 })
		.lean();

	const withdrawnByPauseId = new Map();
	for (const w of withdrawn || []) {
		const pid = w.linkedTo != null ? String(w.linkedTo) : '';
		if (!pid) continue;
		const ts = w.decidedAt || w.createdAt;
		const iso = ts ? toISO(new Date(ts)) : '';
		if (!iso) continue;
		const prev = withdrawnByPauseId.get(pid);
		if (!prev || iso > prev) withdrawnByPauseId.set(pid, iso);
	}

	// If a pause was withdrawn mid-window, it's only effective until the day before the withdrawal decision date.
	// If withdrawn before the pause starts, it is not effective at all.
	const out = [];
	for (const p of pauses) {
		const pid = p._id != null ? String(p._id) : '';
		const withdrawISO = pid ? withdrawnByPauseId.get(pid) : undefined;
		if (!withdrawISO) {
			out.push(p);
			continue;
		}
		const start = String(p.pauseStartDate || '').trim();
		const end = String(p.pauseEndDate || '').trim();
		if (!start || !end) continue;
		const truncatedEnd = addDaysISO(withdrawISO, -1);
		if (!truncatedEnd || truncatedEnd < start) continue;
		out.push({ ...p, pauseEndDate: truncatedEnd < end ? truncatedEnd : end });
	}

	return out;
};

module.exports = {
	localTodayISO,
	parseLocalISODate,
	isWeekdayISO,
	isIsoBetween,
	addDaysISO,
	buildPauseKey,
	getEffectiveApprovedPauses,
};
