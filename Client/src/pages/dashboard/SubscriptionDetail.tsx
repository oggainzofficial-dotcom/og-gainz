// OG Gainz - Subscription Detail Page (delivery-backed)
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ChevronLeft, Pause } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useToast } from '@/hooks/use-toast';
import { deliveriesService, type MyDelivery } from '@/services/deliveriesService';
import { ordersService } from '@/services/ordersService';
import { pauseSkipService } from '@/services/pauseSkipService';
import type { PauseSkipRequest } from '@/types';

const safeString = (v: unknown) => String(v ?? '').trim();

const toLocalISO = (d: Date) => {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
};

const isWeekdayISO = (iso: string) => {
	const s = safeString(iso);
	if (!s) return false;
	const d = new Date(`${s}T00:00:00`);
	if (Number.isNaN(d.getTime())) return false;
	const dow = d.getDay();
	return dow >= 1 && dow <= 5;
};

const addDaysISO = (iso: string, days: number) => {
	const s = safeString(iso);
	const d = new Date(`${s}T00:00:00`);
	if (Number.isNaN(d.getTime())) return s;
	d.setDate(d.getDate() + days);
	return toLocalISO(d);
};

const isWithinInclusiveISODateRange = (iso: string, start: string, end: string) => {
	const d = safeString(iso);
	const s = safeString(start);
	const e = safeString(end);
	if (!d || !s || !e) return false;
	return d >= s && d <= e;
};

const toDeliveryBadge = (status: MyDelivery['status']) => {
	switch (status) {
		case 'PENDING':
			return { label: 'Pending', cls: 'bg-slate-100 text-slate-900 border-slate-200' };
		case 'COOKING':
			return { label: 'Cooking', cls: 'bg-orange-100 text-orange-900 border-orange-200' };
		case 'PACKED':
			return { label: 'Packed', cls: 'bg-blue-100 text-blue-900 border-blue-200' };
		case 'OUT_FOR_DELIVERY':
			return { label: 'Out for delivery', cls: 'bg-purple-100 text-purple-900 border-purple-200' };
		case 'DELIVERED':
			return { label: 'Delivered', cls: 'bg-green-100 text-green-900 border-green-200' };
		case 'SKIPPED':
			return { label: 'Skipped', cls: 'bg-red-100 text-red-900 border-red-200' };
		default:
			return { label: String(status), cls: 'bg-muted text-muted-foreground border' };
	}
};

const parseTimeToMinutes = (raw: string) => {
	const s = safeString(raw).toUpperCase();
	if (!s) return null;

	// 24-hour: HH:mm
	const m24 = s.match(/^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/);
	if (m24) {
		const hh = Number(m24[1]);
		const mm = Number(m24[2]);
		if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return hh * 60 + mm;
	}

	// 12-hour: h:mm AM/PM or h AM/PM
	const m12 = s.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/);
	if (m12) {
		let hh = Number(m12[1]);
		const mm = Number(m12[2] || '0');
		const ap = m12[3];
		if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
		if (ap === 'AM') {
			if (hh === 12) hh = 0;
		} else {
			if (hh !== 12) hh += 12;
		}
		return hh * 60 + mm;
	}

	return null;
};

const toLocalDateTime = (isoDate: string, rawTime: string) => {
	const d = safeString(isoDate);
	const t = safeString(rawTime);
	if (!d || !t) return null;
	const mins = parseTimeToMinutes(t);
	if (mins == null) return null;
	const hh = Math.floor(mins / 60);
	const mm = mins % 60;
	const dt = new Date(`${d}T00:00:00`);
	if (Number.isNaN(dt.getTime())) return null;
	dt.setHours(hh, mm, 0, 0);
	return dt;
};

const formatLeadTime = (minutes: number) => {
	const m = Math.max(0, Math.floor(Number(minutes) || 0));
	if (m === 1) return '1 minute';
	if (m < 60) return `${m} minutes`;
	const h = Math.floor(m / 60);
	const rem = m % 60;
	const hLabel = h === 1 ? '1 hour' : `${h} hours`;
	if (rem === 0) return hLabel;
	const rLabel = rem === 1 ? '1 minute' : `${rem} minutes`;
	return `${hLabel} ${rLabel}`;
};

export default function SubscriptionDetailPage() {
	const { toast } = useToast();
	const { id } = useParams<{ id: string }>();
	const subscriptionId = safeString(id);

	const [loading, setLoading] = useState(true);
	const [deliveries, setDeliveries] = useState<MyDelivery[]>([]);
	const [requests, setRequests] = useState<PauseSkipRequest[]>([]);
	const [subscriptionSchedule, setSubscriptionSchedule] = useState<{ scheduleEndDate?: string; nextServingDate?: string } | null>(null);

	const [pauseRequestOpen, setPauseRequestOpen] = useState(false);
	const [pauseStart, setPauseStart] = useState('');
	const [pauseEnd, setPauseEnd] = useState('');
	const [pauseReason, setPauseReason] = useState('');
	const [pauseSaving, setPauseSaving] = useState(false);
	const [withdrawingRequestId, setWithdrawingRequestId] = useState<string | null>(null);
	const [skipSavingId, setSkipSavingId] = useState<string | null>(null);

	const pauseCutoffMinutes = useMemo(() => {
		const raw = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_PAUSE_REQUEST_CUTOFF_MINUTES;
		const n = Number(raw ?? 120);
		return Number.isFinite(n) && n > 0 ? n : 120;
	}, []);
	const skipCutoffMinutes = useMemo(() => {
		const raw = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_SKIP_REQUEST_CUTOFF_MINUTES;
		const n = Number(raw ?? 120);
		return Number.isFinite(n) && n > 0 ? n : 120;
	}, []);

	useEffect(() => {
		if (!subscriptionId) return;
		const controller = new AbortController();
		setLoading(true);
		// Server caps /deliveries/my to <31 days, so fetch history+future in two calls.
		const historyFrom = (() => {
			const d = new Date();
			d.setDate(d.getDate() - 30);
			return toLocalISO(d);
		})();
		const todayISO = toLocalISO(new Date());
		const windowTo = (() => {
			const d = new Date();
			d.setDate(d.getDate() + 30);
			return toLocalISO(d);
		})();

		Promise.all([
			Promise.all([
				deliveriesService.listMy({ from: historyFrom, to: todayISO, signal: controller.signal }).catch(() => []),
				deliveriesService.listMy({ from: todayISO, to: windowTo, signal: controller.signal }).catch(() => []),
			]).then(([history, future]) => [...(history || []), ...(future || [])]),
			pauseSkipService.listMyRequests({ signal: controller.signal }),
			ordersService.listMyOrders({ page: 1, limit: 100, signal: controller.signal }).then((r) => r.items).catch(() => []),
		])
			.then(([d, r, o]) => {
				setDeliveries(d || []);
				setRequests(r || []);
				const orders = Array.isArray(o) ? o : [];
				const schedule = (() => {
					for (const order of orders) {
						for (const it of order.items || []) {
							if (safeString(it.cartItemId) !== subscriptionId) continue;
							return {
								scheduleEndDate: safeString(it.subscriptionSchedule?.scheduleEndDate) || undefined,
								nextServingDate: safeString(it.subscriptionSchedule?.nextServingDate) || undefined,
							};
						}
					}
					return null;
				})();
				setSubscriptionSchedule(schedule);
			})
			.catch((e: unknown) => {
				toast({
					title: 'Failed to load subscription',
					description: String((e as { message?: unknown })?.message || e),
					variant: 'destructive',
				});
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [subscriptionId, toast]);

	const subscriptionDeliveries = useMemo(() => {
		return deliveries
			.filter((d) => safeString(d.subscriptionId) === subscriptionId)
			.slice()
			.sort((a, b) => `${safeString(a.date)} ${safeString(a.time)}`.localeCompare(`${safeString(b.date)} ${safeString(b.time)}`));
	}, [deliveries, subscriptionId]);

	const title = useMemo(() => {
		const first = subscriptionDeliveries[0];
		return safeString(first?.items?.[0]?.title) || 'Meal Pack';
	}, [subscriptionDeliveries]);

	const plan = useMemo(() => {
		const first = subscriptionDeliveries[0];
		return safeString(first?.items?.[0]?.plan).toLowerCase() || 'weekly';
	}, [subscriptionDeliveries]);

	const servingsTotal = useMemo(() => (plan === 'monthly' ? 20 : 5), [plan]);

	const deliveredCount = useMemo(() => {
		return subscriptionDeliveries.filter((d) => d.status === 'DELIVERED').length;
	}, [subscriptionDeliveries]);

	const servingsRemaining = useMemo(() => Math.max(0, servingsTotal - deliveredCount), [servingsTotal, deliveredCount]);

	const upcomingServingItems = useMemo(() => {
		if (servingsRemaining <= 0) return [] as Array<{ kind: 'real' | 'planned'; d: MyDelivery }>;

		const todayISO = toLocalISO(new Date());
		const earliestDate = subscriptionDeliveries.map((d) => safeString(d.date)).filter(Boolean).sort()[0];
		const startISO = earliestDate && earliestDate > todayISO ? earliestDate : todayISO;
		const timeFallback = safeString(subscriptionDeliveries.find((d) => safeString(d.time))?.time) || '';

		const deliveriesByDate = new Map<string, MyDelivery>();
		for (const d of subscriptionDeliveries) {
			const date = safeString(d.date);
			if (!date) continue;
			const existing = deliveriesByDate.get(date);
			if (!existing) {
				deliveriesByDate.set(date, d);
				continue;
			}
			if (existing.status === 'DELIVERED' && d.status !== 'DELIVERED') deliveriesByDate.set(date, d);
		}

		const plannedDates: string[] = [];
		let cursor = startISO;
		for (let i = 0; i < 366 && plannedDates.length < servingsRemaining; i += 1) {
			if (
				isWeekdayISO(cursor) &&
				!effectiveApprovedPauseRanges.some((r) => isWithinInclusiveISODateRange(cursor, r.start, r.end))
			) {
				plannedDates.push(cursor);
			}
			cursor = addDaysISO(cursor, 1);
		}

		return plannedDates.map((dateISO) => {
			const real = deliveriesByDate.get(dateISO);
			if (real && real.status !== 'DELIVERED') return { kind: 'real' as const, d: real };
			return {
				kind: 'planned' as const,
				d: {
					date: dateISO,
					time: timeFallback,
					status: 'PENDING',
					items: [],
					id: `planned_${subscriptionId}_${dateISO}`,
				} as unknown as MyDelivery,
			};
		});
	}, [effectiveApprovedPauseRanges, servingsRemaining, subscriptionDeliveries, subscriptionId]);

	const orderId = useMemo(() => {
		const first = subscriptionDeliveries[0];
		return safeString(first?.items?.[0]?.orderId) || '';
	}, [subscriptionDeliveries]);

	const withdrawnApprovedPauseIds = useMemo(() => {
		const set = new Set<string>();
		for (const r of requests) {
			if (r.requestType !== 'WITHDRAW_PAUSE') continue;
			if (r.status !== 'APPROVED') continue;
			const linked = safeString(r.linkedTo);
			if (linked) set.add(linked);
		}
		return set;
	}, [requests]);

	const effectiveApprovedPauseRanges = useMemo(() => {
		const ranges: Array<{ start: string; end: string }> = [];
		for (const r of requests) {
			if (r.requestType !== 'PAUSE') continue;
			if (r.status !== 'APPROVED') continue;
			if (withdrawnApprovedPauseIds.has(r.id)) continue;
			if (safeString(r.subscriptionId) !== subscriptionId) continue;
			const start = safeString(r.pauseStartDate);
			const end = safeString(r.pauseEndDate);
			if (!start || !end) continue;
			ranges.push({ start, end });
		}
		ranges.sort((a, b) => `${a.start}|${a.end}`.localeCompare(`${b.start}|${b.end}`));
		return ranges;
	}, [requests, subscriptionId, withdrawnApprovedPauseIds]);

	const pendingPauseRequest = useMemo(() => {
		let best: PauseSkipRequest | undefined;
		for (const r of requests) {
			if (r.requestType !== 'PAUSE') continue;
			if (r.status !== 'PENDING') continue;
			if (safeString(r.subscriptionId) !== subscriptionId) continue;
			if (!best) best = r;
			else {
				const a = best.createdAt ? new Date(best.createdAt).getTime() : 0;
				const b = r.createdAt ? new Date(r.createdAt).getTime() : 0;
				if (b > a) best = r;
			}
		}
		return best;
	}, [requests, subscriptionId]);

	const approvedEffectivePauseRequest = useMemo(() => {
		let best: PauseSkipRequest | undefined;
		for (const r of requests) {
			if (r.requestType !== 'PAUSE') continue;
			if (r.status !== 'APPROVED') continue;
			if (withdrawnApprovedPauseIds.has(r.id)) continue;
			if (safeString(r.subscriptionId) !== subscriptionId) continue;
			const end = safeString(r.pauseEndDate);
			if (!end) continue;
			const prevEnd = best ? safeString(best.pauseEndDate) : '';
			if (!best || end > prevEnd) best = r;
		}
		return best;
	}, [requests, subscriptionId, withdrawnApprovedPauseIds]);

	const pendingWithdrawByPauseId = useMemo(() => {
		const map = new Map<string, PauseSkipRequest>();
		for (const r of requests) {
			if (r.requestType !== 'WITHDRAW_PAUSE') continue;
			if (r.status !== 'PENDING') continue;
			const linked = safeString(r.linkedTo);
			if (linked) map.set(linked, r);
		}
		return map;
	}, [requests]);

	const pauseState = useMemo(() => {
		const today = toLocalISO(new Date());
		if (pendingPauseRequest) return { state: 'pending' as const, request: pendingPauseRequest, withdrawPending: false };
		const approved = approvedEffectivePauseRequest;
		if (!approved) return { state: 'none' as const, request: undefined, withdrawPending: false };
		const start = safeString(approved.pauseStartDate);
		const end = safeString(approved.pauseEndDate);
		const withdrawPending = pendingWithdrawByPauseId.has(approved.id);
		if (end && today > end) return { state: 'none' as const, request: undefined, withdrawPending: false };
		if (start && end) {
			if (today >= start && today <= end) return { state: 'paused' as const, request: approved, withdrawPending };
			if (today < start) return { state: 'scheduled' as const, request: approved, withdrawPending };
		}
		return { state: 'scheduled' as const, request: approved, withdrawPending };
	}, [pendingPauseRequest, approvedEffectivePauseRequest, pendingWithdrawByPauseId]);

	const withdrawPendingRequest = async (requestId: string) => {
		setWithdrawingRequestId(requestId);
		try {
			await pauseSkipService.withdrawRequest(requestId);
			setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'WITHDRAWN' } : r)));
			toast({ title: 'Request withdrawn' });
		} catch (e: unknown) {
			toast({
				title: 'Failed to withdraw',
				description: String((e as { message?: unknown })?.message || e),
				variant: 'destructive',
			});
		} finally {
			setWithdrawingRequestId(null);
		}
	};

	const requestWithdrawPause = async (pauseRequestId: string) => {
		setWithdrawingRequestId(pauseRequestId);
		try {
			const created = await pauseSkipService.requestWithdrawPause(pauseRequestId);
			setRequests((prev) => [created, ...prev]);
			toast({ title: 'Withdraw Pause requested', description: 'An admin will review your request shortly.' });
		} catch (e: unknown) {
			toast({
				title: 'Failed to request withdraw',
				description: String((e as { message?: unknown })?.message || e),
				variant: 'destructive',
			});
		} finally {
			setWithdrawingRequestId(null);
		}
	};

	const pendingSkipByDeliveryId = useMemo(() => {
		const set = new Set<string>();
		for (const r of requests) {
			if (r.requestType !== 'SKIP') continue;
			if (r.status !== 'PENDING') continue;
			const did = safeString(r.deliveryId);
			if (did) set.add(did);
		}
		return set;
	}, [requests]);

	const today = toLocalISO(new Date());
	const todayDelivery = subscriptionDeliveries.find((d) => safeString(d.date) === today);
	const todayDeliveryId = safeString(todayDelivery?._id || todayDelivery?.id);

	const isSkipCutoffExceeded = useMemo(() => {
		if (!todayDelivery) return false;
		if (safeString(todayDelivery.date) !== today) return false;
		const dt = toLocalDateTime(safeString(todayDelivery.date), safeString(todayDelivery.time));
		if (!dt) return false;
		return dt.getTime() - Date.now() < skipCutoffMinutes * 60_000;
	}, [skipCutoffMinutes, today, todayDelivery]);

	const canRequestSkipToday = Boolean(
		todayDeliveryId && todayDelivery?.status === 'PENDING' && !pendingSkipByDeliveryId.has(todayDeliveryId) && !isSkipCutoffExceeded
	);

	const nextActiveDelivery = useMemo(() => {
		const now = Date.now();
		return subscriptionDeliveries
			.filter((d) => d.status !== 'DELIVERED' && d.status !== 'SKIPPED')
			.map((d) => ({ d, dt: toLocalDateTime(safeString(d.date), safeString(d.time)) }))
			.filter((x) => x.dt && x.dt.getTime() >= now)
			.sort((a, b) => a.dt!.getTime() - b.dt!.getTime())[0]?.d;
	}, [subscriptionDeliveries]);

	const isPauseCutoffExceeded = useMemo(() => {
		if (!nextActiveDelivery) return false;
		const dt = toLocalDateTime(safeString(nextActiveDelivery.date), safeString(nextActiveDelivery.time));
		if (!dt) return false;
		return dt.getTime() - Date.now() < pauseCutoffMinutes * 60_000;
	}, [nextActiveDelivery, pauseCutoffMinutes]);

	const openPause = () => {
		const t = (() => {
			const d = new Date();
			d.setDate(d.getDate() + 1);
			return toLocalISO(d);
		})();
		setPauseStart(t);
		setPauseEnd(t);
		setPauseReason('');
		setPauseRequestOpen(true);
	};

	const submitPause = async () => {
		setPauseSaving(true);
		try {
			await pauseSkipService.requestPause({
				kind: 'mealPack',
				subscriptionId,
				pauseStartDate: pauseStart,
				pauseEndDate: pauseEnd,
				reason: pauseReason || undefined,
			});
			const next = await pauseSkipService.listMyRequests({});
			setRequests(next);
			toast({ title: 'Pause Requested', description: 'An admin will review your request shortly.' });
			setPauseRequestOpen(false);
		} catch (e: unknown) {
			toast({
				title: 'Failed to request pause',
				description: String((e as { message?: unknown })?.message || e),
				variant: 'destructive',
			});
		} finally {
			setPauseSaving(false);
		}
	};

	const requestSkip = async () => {
		if (!todayDeliveryId) return;
		setSkipSavingId(todayDeliveryId);
		try {
			await pauseSkipService.requestSkipDelivery({ deliveryId: todayDeliveryId });
			const next = await pauseSkipService.listMyRequests({});
			setRequests(next);
			toast({ title: 'Skip Requested', description: 'An admin will review your request shortly.' });
		} catch (e: unknown) {
			toast({
				title: 'Failed to request skip',
				description: String((e as { message?: unknown })?.message || e),
				variant: 'destructive',
			});
		} finally {
			setSkipSavingId(null);
		}
	};

	if (!subscriptionId) {
		return (
			<div className="space-y-4">
				<div className="text-sm text-muted-foreground">Missing subscription id.</div>
				<Link to="/dashboard/subscriptions">
					<Button variant="outline">Back to Subscriptions</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Dialog open={pauseRequestOpen} onOpenChange={setPauseRequestOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Request a Pause</DialogTitle>
						<DialogDescription>Pick a date range. Your request will be reviewed by an admin.</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div className="space-y-1">
								<div className="text-sm font-medium">Start date</div>
								<Input type="date" value={pauseStart} onChange={(e) => setPauseStart(e.target.value)} />
							</div>
							<div className="space-y-1">
								<div className="text-sm font-medium">End date</div>
								<Input type="date" value={pauseEnd} onChange={(e) => setPauseEnd(e.target.value)} />
							</div>
						</div>
						<div className="space-y-1">
							<div className="text-sm font-medium">Reason (optional)</div>
							<Textarea value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} placeholder="Tell us why you need a pause…" />
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setPauseRequestOpen(false)} disabled={pauseSaving}>
								Cancel
							</Button>
							<Button onClick={submitPause} disabled={pauseSaving || !pauseStart || !pauseEnd}>
								Submit Request
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<div className="flex items-center justify-between gap-3">
				<Link
					to="/dashboard/subscriptions"
					className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
				>
					<ChevronLeft className="h-4 w-4" />
					Back to Subscriptions
				</Link>
				<Link to="/dashboard/deliveries">
					<Button variant="outline" size="sm">Open Deliveries</Button>
				</Link>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex flex-col gap-1">
						<span className="text-xl">{title}</span>
						<span className="text-sm text-muted-foreground capitalize">{plan} plan</span>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{orderId ? <div className="text-sm text-muted-foreground">Order: {orderId.slice(0, 12)}…</div> : null}
					<div className="text-sm text-muted-foreground">Subscription ID: {subscriptionId.slice(0, 12)}…</div>

					<div className="flex flex-wrap items-center gap-2">
						{pauseState.state === 'pending' ? (
							<Badge variant="outline" className="bg-yellow-100 text-yellow-900 border-yellow-200">Pause Requested</Badge>
						) : pauseState.state === 'paused' ? (
							<Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200">
								Paused {safeString(pauseState.request?.pauseStartDate)} → {safeString(pauseState.request?.pauseEndDate)}
							</Badge>
						) : pauseState.state === 'scheduled' ? (
							<Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200">
								Pause scheduled {safeString(pauseState.request?.pauseStartDate)} → {safeString(pauseState.request?.pauseEndDate)}
							</Badge>
						) : (
							<Badge variant="outline" className="bg-white">Active</Badge>
						)}

						{(() => {
							const disabledByState = pauseState.state !== 'none';
							const disabledByCutoff = pauseState.state === 'none' && isPauseCutoffExceeded;
							const btn = (
								<Button variant="outline" size="sm" onClick={openPause} disabled={disabledByState || disabledByCutoff}>
									<Pause className="mr-2 h-4 w-4" />
									{pauseState.state === 'pending' ? 'Pause Requested' : 'Request Pause'}
								</Button>
							);
							if (!disabledByCutoff) return btn;
							return (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex">{btn}</span>
										</TooltipTrigger>
										<TooltipContent>
											Pause requests must be submitted at least {formatLeadTime(pauseCutoffMinutes)} before delivery.
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							);
						})()}

						{pauseState.request ? (
							pauseState.request.status === 'PENDING' ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() => withdrawPendingRequest(pauseState.request!.id)}
									disabled={withdrawingRequestId === pauseState.request!.id}
								>
									Withdraw Request
								</Button>
							) : (
								<Button
									variant="outline"
									size="sm"
									onClick={() => requestWithdrawPause(pauseState.request!.id)}
									disabled={pauseState.withdrawPending || withdrawingRequestId === pauseState.request!.id}
								>
									{pauseState.withdrawPending ? 'Withdraw Requested' : 'Withdraw Pause'}
								</Button>
							)
						) : null}

						{(() => {
							const disabled = !canRequestSkipToday || skipSavingId === todayDeliveryId;
							const btn = (
								<Button variant="outline" size="sm" onClick={requestSkip} disabled={disabled}>
									{todayDeliveryId && pendingSkipByDeliveryId.has(todayDeliveryId) ? 'Skip Requested' : 'Request Skip (Today)'}
								</Button>
							);
							if (!disabled) return btn;
							const tooltip = isSkipCutoffExceeded
								? `Skip is available only for today before the cutoff time (at least ${formatLeadTime(skipCutoffMinutes)} before delivery).`
								: 'Skip is available only for today before the cutoff time.';
							return (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex">{btn}</span>
										</TooltipTrigger>
										<TooltipContent>{tooltip}</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							);
						})()}
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="rounded-md border p-3">
							<div className="text-xs text-muted-foreground">Upcoming Serving Date</div>
							<div className="text-sm font-medium">{subscriptionSchedule?.nextServingDate || '—'}</div>
						</div>
						<div className="rounded-md border p-3">
							<div className="text-xs text-muted-foreground">End date</div>
							<div className="text-sm font-medium">{subscriptionSchedule?.scheduleEndDate || '—'}</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Upcoming deliveries (next {servingsRemaining} servings)</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="text-sm text-muted-foreground">Loading…</div>
					) : servingsRemaining === 0 ? (
						<div className="text-sm text-muted-foreground">All servings have been delivered for this subscription.</div>
					) : (
						<div className="space-y-2">
							{upcomingServingItems.map((x) => {
								const d = x.d;
								const deliveryId = safeString(d._id || d.id);
								const badge =
									x.kind === 'planned'
										? { label: 'Scheduled', cls: 'bg-slate-50 text-slate-900 border-slate-200' }
										: toDeliveryBadge(d.status);
								return (
									<div key={deliveryId} className="rounded-md border p-3">
										<div className="flex items-center justify-between gap-2">
											<div className="font-medium">{safeString(d.date)} · {safeString(d.time)}</div>
											<Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
										</div>
										<div className="mt-2 space-y-1 text-sm">
											{(d.items || []).map((it) => (
												<div key={safeString(it.cartItemId)} className="flex items-center justify-between gap-2">
													<div className="truncate">{safeString(it.title) || 'Item'}</div>
													<div className="text-muted-foreground">Qty {it.quantity}</div>
												</div>
											))}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Pause / Skip requests</CardTitle>
				</CardHeader>
				<CardContent>
					{requests.filter(
						(r) =>
							safeString(r.subscriptionId) === subscriptionId ||
							subscriptionDeliveries.some((d) => safeString(d._id || d.id) === safeString(r.deliveryId))
					).length === 0 ? (
						<div className="text-sm text-muted-foreground">No requests found for this subscription.</div>
					) : (
						<div className="space-y-2">
							{requests
								.filter(
									(r) =>
										safeString(r.subscriptionId) === subscriptionId ||
										subscriptionDeliveries.some((d) => safeString(d._id || d.id) === safeString(r.deliveryId))
								)
								.slice(0, 20)
								.map((r) => (
									<div key={r.id} className="rounded-md border p-3">
										<div className="flex items-center justify-between gap-2">
											<div className="font-medium">{r.requestType}</div>
											<Badge variant="outline" className="bg-white">{r.status}</Badge>
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{r.requestType === 'PAUSE'
												? `${r.pauseStartDate || '?'} → ${r.pauseEndDate || '?'}`
												: `Delivery ${safeString(r.deliveryId).slice(0, 8)}… (${r.skipDate || '?'})`}
										</div>
										{r.reason ? <div className="mt-1 text-xs text-muted-foreground">Reason: {r.reason}</div> : null}
									</div>
								))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

