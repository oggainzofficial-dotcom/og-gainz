import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

import { useToast } from '@/hooks/use-toast';
import { adminKitchenService, type KitchenDelivery, type KitchenDeliveryStatus } from '@/services/adminKitchenService';
import { adminPauseSkipService } from '@/services/adminPauseSkipService';
import { adminOrdersService, type AdminOrder } from '@/services/adminOrdersService';
import { adminMealsService } from '@/services/adminMealsService';
import { adminAddonsService } from '@/services/adminAddonsService';
import { buildYourOwnCatalogService } from '@/services/buildYourOwnCatalogService';
import type { Addon, Meal } from '@/types/catalog';
import type { BuildYourOwnItemEntity } from '@/types/buildYourOwn';
import type { PauseSkipRequest } from '@/types';

import { AlertCircle, Ban, ChefHat, CheckCircle2, ClipboardList, Package, Pause, Truck } from 'lucide-react';

const safeString = (v: unknown) => String(v || '').trim();

const toLocalISODate = (d: Date) => {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
};

const statusBadgeClass = (status: KitchenDeliveryStatus) => {
	switch (status) {
		case 'PENDING':
			return 'bg-slate-100 text-slate-900 border-slate-200';
		case 'COOKING':
			return 'bg-orange-100 text-orange-900 border-orange-200';
		case 'PACKED':
			return 'bg-blue-100 text-blue-900 border-blue-200';
		case 'OUT_FOR_DELIVERY':
			return 'bg-purple-100 text-purple-900 border-purple-200';
		case 'DELIVERED':
			return 'bg-green-100 text-green-900 border-green-200';
		case 'SKIPPED':
			return 'bg-red-100 text-red-900 border-red-200';
		default:
			return 'bg-muted text-muted-foreground border';
	}
};

const statusIcon = (status: KitchenDeliveryStatus) => {
	switch (status) {
		case 'PENDING':
			return <ClipboardList className="h-3.5 w-3.5" />;
		case 'COOKING':
			return <ChefHat className="h-3.5 w-3.5" />;
		case 'PACKED':
			return <Package className="h-3.5 w-3.5" />;
		case 'OUT_FOR_DELIVERY':
			return <Truck className="h-3.5 w-3.5" />;
		case 'DELIVERED':
			return <CheckCircle2 className="h-3.5 w-3.5" />;
		case 'SKIPPED':
			return <Ban className="h-3.5 w-3.5" />;
		default:
			return <AlertCircle className="h-3.5 w-3.5" />;
	}
};

const statusLabel = (status: KitchenDeliveryStatus) => {
	switch (status) {
		case 'PENDING':
			return 'Pending';
		case 'COOKING':
			return 'Cooking';
		case 'PACKED':
			return 'Packed';
		case 'OUT_FOR_DELIVERY':
			return 'Out for delivery';
		case 'DELIVERED':
			return 'Delivered';
		case 'SKIPPED':
			return 'Skipped';
		default:
			return String(status).replaceAll('_', ' ');
	}
};

const KitchenStatusPill = ({ status }: { status: KitchenDeliveryStatus }) => (
	<Badge variant="outline" className={`inline-flex items-center gap-1.5 ${statusBadgeClass(status)}`}>
		{statusIcon(status)}
		<span>{statusLabel(status)}</span>
	</Badge>
);

const isWithinInclusiveISODateRange = (dayISO: string, startISO: string, endISO: string) => {
	if (!dayISO || !startISO || !endISO) return false;
	return dayISO >= startISO && dayISO <= endISO;
};

const nextStatusFrom = (status: KitchenDeliveryStatus): KitchenDeliveryStatus | undefined => {
	const flow: KitchenDeliveryStatus[] = ['PENDING', 'COOKING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
	const idx = flow.indexOf(status);
	if (idx < 0) return undefined;
	return flow[idx + 1];
};

const getDeliveryTimeLabel = (d: KitchenDelivery) => safeString(d.deliveryTime) || safeString(d.time) || '—';
const getDeliveryDateLabel = (d: KitchenDelivery) => safeString(d.date) || safeString(d.deliveryDate) || '';
const getGroupKey = (d: KitchenDelivery) => {
	const key = safeString(d.groupKey);
	if (key) return key;
	const userId = safeString(d.userId || d.user?.id);
	const date = getDeliveryDateLabel(d);
	const time = getDeliveryTimeLabel(d);
	return [userId, date, time].filter(Boolean).join('|');
};

const isImmediateDelivery = (d: KitchenDelivery) =>
	(d.items || []).some((it) => ['single', 'trial'].includes(safeString(it.plan).toLowerCase()));

const formatPlanLabel = (planRaw: string) => {
	const p = safeString(planRaw).toLowerCase();
	if (p === 'weekly') return 'Weekly';
	if (p === 'monthly') return 'Monthly';
	if (p === 'trial') return 'Trial';
	if (p === 'single' || p === 'buy-once' || p === 'buyonce') return 'Buy-once';
	return safeString(planRaw) || '—';
};

const proteinOptionFromTitle = (titleRaw: string) => {
	const t = safeString(titleRaw).toLowerCase();
	if (!t) return '—';
	if (t.includes('without protein')) return 'Without protein';
	if (t.includes('with protein')) return 'With protein';
	return '—';
};

const formatQty = (n: number) => {
	if (!Number.isFinite(n)) return '0';
	if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
	return String(Number(n.toFixed(2)));
};

const byoGroupLabel = (raw: string) => {
	const k = safeString(raw).toLowerCase();
	if (!k) return 'Other';
	if (k.includes('protein')) return 'Protein';
	if (k.includes('carb')) return 'Carbs';
	if (k.includes('vegg')) return 'Veggies';
	if (k.includes('salad')) return 'Salads';
	if (k.includes('shake')) return 'Shakes';
	return safeString(raw) || 'Other';
};

const toId = (v: unknown) => {
	if (!v) return '';
	if (typeof v === 'string') return v;
	if (typeof v === 'number') return String(v);
	if (typeof v === 'object') {
		const anyV = v as { _id?: unknown; id?: unknown };
		if (anyV._id != null) return String(anyV._id);
		if (anyV.id != null) return String(anyV.id);
	}
	return String(v);
};

export default function Kitchen() {
	const navigate = useNavigate();
	const { toast } = useToast();

	const [date, setDate] = useState(() => toLocalISODate(new Date()));
	const [statusFilter, setStatusFilter] = useState<'all' | KitchenDeliveryStatus>('all');
	const [deliveries, setDeliveries] = useState<KitchenDelivery[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [savingId, setSavingId] = useState<string | null>(null);
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
	const [skipReasonByDeliveryId, setSkipReasonByDeliveryId] = useState<Record<string, string>>({});

	const [viewDelivery, setViewDelivery] = useState<KitchenDelivery | null>(null);
	const [viewOrder, setViewOrder] = useState<AdminOrder | null>(null);
	const [viewLoading, setViewLoading] = useState(false);
	const [viewError, setViewError] = useState<string | null>(null);
	const [mealCache, setMealCache] = useState<Record<string, Meal>>({});
	const [addonCache, setAddonCache] = useState<Record<string, Addon>>({});
	const [byoCatalog, setByoCatalog] = useState<BuildYourOwnItemEntity[] | null>(null);
	const [pauseWindowsBySubscriptionId, setPauseWindowsBySubscriptionId] = useState<Record<string, Array<{ start: string; end: string }>>>({});

	const todayStr = useMemo(() => toLocalISODate(new Date()), []);
	const isFutureDate = useMemo(() => Boolean(date) && date > todayStr, [date, todayStr]);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		adminKitchenService
			.list({ date, status: statusFilter === 'all' ? undefined : statusFilter, signal: controller.signal })
			.then((res) => setDeliveries(res || []))
			.catch((e: unknown) => {
				const msg = safeString((e as { message?: unknown })?.message || e) || 'Failed to load deliveries';
				if (msg.toLowerCase().includes('authentication required') || msg.toLowerCase().includes('unauthorized')) {
					navigate('/login', { replace: true, state: { from: '/admin/kitchen' } });
					return;
				}
				setError(msg);
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [date, statusFilter, navigate]);

	const summary = useMemo(() => {
		const counts: Record<KitchenDeliveryStatus, number> = {
			PENDING: 0,
			COOKING: 0,
			PACKED: 0,
			OUT_FOR_DELIVERY: 0,
			DELIVERED: 0,
			SKIPPED: 0,
		};
		for (const d of deliveries) {
			const s = d.status;
			if (s in counts) counts[s] += 1;
		}
		return counts;
	}, [deliveries]);

	useEffect(() => {
		const skippedIds = Array.from(
			new Set(
				deliveries
					.filter((d) => d.status === 'SKIPPED')
					.map((d) => safeString(d._id || d.id))
					.filter(Boolean)
			)
		);
		if (!skippedIds.length) {
			setSkipReasonByDeliveryId({});
			return;
		}

		const controller = new AbortController();
		adminPauseSkipService
			.listRequests({ status: 'APPROVED', requestType: 'SKIP', limit: 500, signal: controller.signal })
			.then((logs) => {
				const map: Record<string, string> = {};
				for (const r of logs || []) {
					const did = safeString(r.deliveryId);
					if (!did) continue;
					if (!skippedIds.includes(did)) continue;
					const reason = safeString(r.reason);
					if (reason) map[did] = reason;
				}
				setSkipReasonByDeliveryId(map);
			})
			.catch(() => {
				// ignore
			});

		return () => controller.abort();
	}, [deliveries]);

	useEffect(() => {
		const subscriptionIds = Array.from(
			new Set(
				deliveries
					.map((d) => safeString(d.subscriptionId))
					.filter(Boolean)
			)
		);
		if (!subscriptionIds.length) {
			setPauseWindowsBySubscriptionId({});
			return;
		}

		const controller = new AbortController();
		adminPauseSkipService
			.listRequests({ status: 'APPROVED', requestType: 'PAUSE', limit: 500, signal: controller.signal })
			.then((logs: PauseSkipRequest[]) => {
				const map: Record<string, Array<{ start: string; end: string }>> = {};
				for (const r of logs || []) {
					const sid = safeString(r.subscriptionId);
					if (!sid) continue;
					if (!subscriptionIds.includes(sid)) continue;
					const start = safeString(r.pauseStartDate);
					const end = safeString(r.pauseEndDate);
					if (!start || !end) continue;
					if (!map[sid]) map[sid] = [];
					map[sid].push({ start, end });
				}
				setPauseWindowsBySubscriptionId(map);
			})
			.catch(() => {
				// ignore
			});

		return () => controller.abort();
	}, [deliveries]);

	const timeline = useMemo(() => {
		const byTime = new Map<string, KitchenDelivery[]>();
		for (const d of deliveries) {
			const t = getDeliveryTimeLabel(d);
			if (!byTime.has(t)) byTime.set(t, []);
			byTime.get(t)!.push(d);
		}
		const sortedTimes = Array.from(byTime.keys()).sort((a, b) => a.localeCompare(b));
		return sortedTimes.map((t) => {
			const list = byTime.get(t) || [];
			const byGroup = new Map<string, KitchenDelivery[]>();
			for (const d of list) {
				const key = getGroupKey(d);
				if (!byGroup.has(key)) byGroup.set(key, []);
				byGroup.get(key)!.push(d);
			}
			const groups = Array.from(byGroup.entries())
				.map(([key, arr]) => {
					arr.sort((a, b) => safeString(a._id || a.id).localeCompare(safeString(b._id || b.id)));
					const userName = safeString(arr?.[0]?.user?.name) || 'Customer';
					const immediate = arr.some(isImmediateDelivery);
					return { key, deliveries: arr, userName, immediate };
				})
				.sort((a, b) => Number(b.immediate) - Number(a.immediate) || a.userName.localeCompare(b.userName));
			return { time: t, groups };
		});
	}, [deliveries]);

	const onAdvance = async (delivery: KitchenDelivery) => {
		if (isFutureDate) return;
		const id = safeString(delivery._id || delivery.id);
		if (!id) return;
		const next = nextStatusFrom(delivery.status);
		if (!next) return;

		setSavingId(id);
		try {
			const updated = await adminKitchenService.updateStatus(id, next);
			setDeliveries((prev) => prev.map((d) => (safeString(d._id || d.id) === id ? updated : d)));
			toast({ title: `Delivery moved to ${statusLabel(next)}` });
		} catch (e: unknown) {
			toast({ title: 'Failed to update status', description: safeString((e as { message?: unknown })?.message || e), variant: 'destructive' });
		} finally {
			setSavingId(null);
		}
	};

	const toggleGroup = (key: string) => {
		setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const openViewMeal = (delivery: KitchenDelivery) => {
		setViewDelivery(delivery);
	};

	useEffect(() => {
		const delivery = viewDelivery;
		const oid = safeString(delivery?.orderId || delivery?.items?.[0]?.orderId);
		if (!delivery || !oid) {
			setViewOrder(null);
			setViewError(null);
			setViewLoading(false);
			return;
		}

		const controller = new AbortController();
		setViewLoading(true);
		setViewError(null);

		adminOrdersService
			.get(oid, { signal: controller.signal })
			.then(async (o) => {
				setViewOrder(o);

				const orderItems = Array.isArray(o.items) ? o.items : [];
				const deliveryItems = Array.isArray(delivery.items) ? delivery.items : [];
				const relevantOrderItems = deliveryItems
					.map((it) => orderItems.find((oi) => oi.cartItemId === it.cartItemId))
					.filter(Boolean) as NonNullable<AdminOrder['items']>[number][];

				const mealIds = Array.from(new Set(relevantOrderItems.map((it) => toId(it.mealId)).filter(Boolean)));
				const addonIds = Array.from(new Set(relevantOrderItems.map((it) => toId(it.addonId)).filter(Boolean)));

				await Promise.all([
					...mealIds
						.filter((mid) => !mealCache[mid])
						.map(async (mid) => {
							try {
								const res = await adminMealsService.get(mid, { signal: controller.signal });
								if (res.status === 'success' && res.data) setMealCache((prev) => ({ ...prev, [mid]: res.data }));
							} catch {
								// ignore
							}
						}),
					...addonIds
						.filter((aid) => !addonCache[aid])
						.map(async (aid) => {
							try {
								const res = await adminAddonsService.get(aid, { signal: controller.signal });
								if (res.status === 'success' && res.data) setAddonCache((prev) => ({ ...prev, [aid]: res.data }));
							} catch {
								// ignore
							}
						}),
				]);

				const needsByo = relevantOrderItems.some((it) => safeString(it.type).toLowerCase() === 'byo');
				if (needsByo && !byoCatalog) {
					try {
						const res = await buildYourOwnCatalogService.listItems({ signal: controller.signal });
						if (res.status === 'success' && Array.isArray(res.data)) setByoCatalog(res.data);
					} catch {
						// ignore
					}
				}
			})
			.catch((e: unknown) => {
				setViewOrder(null);
				setViewError(safeString((e as { message?: unknown })?.message || e) || 'Failed to load order details');
			})
			.finally(() => setViewLoading(false));

		return () => controller.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewDelivery]);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					{isFutureDate ? (
						<p className="text-xs text-muted-foreground mt-1">Status updates are disabled for future dates.</p>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<div className="w-44">
						<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
					</div>
					<div className="w-52">
						<Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | KitchenDeliveryStatus)}>
							<SelectTrigger>
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="PENDING">Pending</SelectItem>
								<SelectItem value="COOKING">Cooking</SelectItem>
								<SelectItem value="PACKED">Packed</SelectItem>
								<SelectItem value="OUT_FOR_DELIVERY">Out for delivery</SelectItem>
								<SelectItem value="DELIVERED">Delivered</SelectItem>
								<SelectItem value="SKIPPED">Skipped</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Failed to load deliveries</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<div className="grid gap-3 sm:grid-cols-6">
				{(['PENDING', 'COOKING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SKIPPED'] as KitchenDeliveryStatus[]).map((s) => (
					<Card key={s}>
						<CardHeader className="py-4">
							<CardTitle className="text-sm flex items-center justify-between">
								<span>{statusLabel(s)}</span>
								<Badge variant="outline" className={`inline-flex items-center gap-1.5 ${statusBadgeClass(s)}`}>
									{statusIcon(s)}
									<span>{summary[s]}</span>
								</Badge>
							</CardTitle>
						</CardHeader>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle className="text-lg">Deliveries for {date}</CardTitle>
					<div className="text-sm text-muted-foreground">{deliveries.length} total</div>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="space-y-3">
							{Array.from({ length: 6 }).map((_, i) => (
								<div key={i} className="flex items-center gap-3">
									<Skeleton className="h-4 w-28" />
									<Skeleton className="h-4 w-44" />
									<Skeleton className="h-4 w-24" />
								</div>
							))}
						</div>
					) : deliveries.length === 0 ? (
						<div className="py-10 text-center text-sm text-muted-foreground">No deliveries scheduled for this day.</div>
					) : (
						<div className="space-y-3">
							{timeline.map((slot) => (
								<div key={slot.time} className="space-y-2">
									<div className="text-sm font-semibold text-oz-primary">{slot.time}</div>
									<div className="space-y-3">
										{slot.groups.map((g) => {
											const first = g.deliveries[0];
											const expanded = Boolean(expandedGroups[g.key]);
											const userName = safeString(first?.user?.name) || 'Customer';
											const phone = safeString(first?.user?.contactNumber);
											const addressLabel = safeString(first?.address?.label) || '—';
											const addr = [first?.address?.addressLine1, first?.address?.city, first?.address?.pincode]
												.filter(Boolean)
												.join(', ');
											const deliveriesCount = g.deliveries.length;

											return (
												<Card key={g.key} className="border-oz-neutral/40">
													<CardContent className="p-4 space-y-3">
														<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
															<div className="min-w-0">
																<div className="flex items-center gap-2">
																	<div className="text-sm font-semibold truncate">{userName}</div>
																	{phone ? <div className="text-xs text-muted-foreground">{phone}</div> : null}
																	{g.immediate ? (
																		<Badge
																			variant="outline"
																			className="bg-emerald-50 text-emerald-900 border-emerald-200"
																		>
																			Immediate
																		</Badge>
																	) : null}
																</div>
																<div className="text-sm">{addressLabel}</div>
																<div className="text-xs text-muted-foreground">{addr || '—'}</div>
															</div>
															<div className="flex items-center gap-2">
																{deliveriesCount > 1 ? (
																	<Button size="sm" variant="outline" onClick={() => toggleGroup(g.key)}>
																		{expanded ? 'Collapse' : `View ${deliveriesCount} deliveries`}
																	</Button>
																) : null}
															</div>
														</div>

														<div className="space-y-2">
															{(expanded ? g.deliveries : [first]).map((d) => {
																const id = safeString(d._id || d.id);
																const next = nextStatusFrom(d.status);
																const orderId = safeString(d.orderId || d.items?.[0]?.orderId);
																const disabledAdvance = Boolean(isFutureDate) || savingId === id;
																const skipReason = d.status === 'SKIPPED' ? safeString(skipReasonByDeliveryId[id]) : '';
																const deliveryDate = getDeliveryDateLabel(d);
																const pauseWindows = safeString(d.subscriptionId) ? pauseWindowsBySubscriptionId[safeString(d.subscriptionId)] || [] : [];
																const activePause = deliveryDate
																	? pauseWindows.find((w) => isWithinInclusiveISODateRange(deliveryDate, w.start, w.end))
																	: undefined;
																return (
																	<div key={id} className="rounded-md border border-oz-neutral/30 p-3">
																		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
																			<div className="flex flex-wrap items-center gap-2">
																				{d.status === 'SKIPPED' ? (
																					<TooltipProvider>
																						<Tooltip>
																							<TooltipTrigger asChild>
																								<span>
																									<KitchenStatusPill status={d.status} />
																									</span>
																							</TooltipTrigger>
																							<TooltipContent>
																								This delivery was skipped after admin approval.
																								{skipReason ? ` Reason: ${skipReason}` : ''}
																							</TooltipContent>
																						</Tooltip>
																					</TooltipProvider>
																				) : (
																					<KitchenStatusPill status={d.status} />
																				)}
																				{activePause && d.status === 'PENDING' ? (
																					<TooltipProvider>
																						<Tooltip>
																							<TooltipTrigger asChild>
																								<span>
																									<Badge variant="outline" className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-900 border-yellow-200">
																										<Pause className="h-3.5 w-3.5" />
																										Paused
																									</Badge>
																								</span>
																							</TooltipTrigger>
																							<TooltipContent>
																								This delivery is paused between {activePause.start} and {activePause.end}.
																							</TooltipContent>
																						</Tooltip>
																					</TooltipProvider>
																				) : null}
																				{d.subscriptionId ? <Badge variant="outline">Subscription</Badge> : null}
																				{isImmediateDelivery(d) ? (
																					<Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">Immediate</Badge>
																				) : null}
																			</div>
																			<div className="flex flex-wrap items-center gap-2">
																				{next ? (
																					isFutureDate ? (
																						<TooltipProvider>
																							<Tooltip>
																								<TooltipTrigger asChild>
																										<span>
																											<Button size="sm" disabled>
																								Advance to {statusLabel(next)}
																												</Button>
																										</span>
																								</TooltipTrigger>
																								<TooltipContent>Status can only be updated on the delivery date.</TooltipContent>
																							</Tooltip>
																						</TooltipProvider>
																					) : (
																						<Button size="sm" disabled={disabledAdvance} onClick={() => onAdvance(d)}>
																							{savingId === id ? 'Saving…' : `Advance to ${statusLabel(next)}`}
																						</Button>
																					)
																				) : d.status === 'SKIPPED' ? (
																					<TooltipProvider>
																						<Tooltip>
																							<TooltipTrigger asChild>
																								<span>
																									<Button size="sm" disabled variant="outline">Skipped</Button>
																								</span>
																							</TooltipTrigger>
																							<TooltipContent>Skipped deliveries cannot be advanced.</TooltipContent>
																						</Tooltip>
																					</TooltipProvider>
																				) : (
																					<Button size="sm" disabled variant="outline">Delivered</Button>
																				)}
																				<Button size="sm" variant="outline" onClick={() => openViewMeal(d)}>
																					View Meal
																				</Button>
																				{orderId ? (
																					<Button asChild size="sm" variant="outline">
																							<Link to={`/admin/orders/${encodeURIComponent(orderId)}`}>Order</Link>
																					</Button>
																				) : (
																					<Button size="sm" variant="outline" disabled>
																						Order
																					</Button>
																				)}
																			</div>
																		</div>

																		<div className="mt-2 space-y-1 text-sm">
																			{(d.items || []).map((it) => (
																				<div key={it.cartItemId} className="flex items-center justify-between">
																					<div className="min-w-0 flex items-center gap-2">
																						<div className="truncate font-semibold text-oz-primary">{it.title}</div>
																						{safeString(it.plan) ? (
																							<span className="text-xs text-muted-foreground capitalize">
																								{formatPlanLabel(safeString(it.plan))}
																							</span>
																						) : null}
																					</div>
																					<div className="text-muted-foreground">Qty {it.quantity}</div>
																				</div>
																			))}
																		</div>
																	</div>
																);
															})}
														</div>
													</CardContent>
												</Card>
											);
										})}
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Sheet
				open={Boolean(viewDelivery)}
				onOpenChange={(open) => {
					if (!open) {
						setViewDelivery(null);
						setViewOrder(null);
						setViewError(null);
						setViewLoading(false);
					}
				}}
			>
				<SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
					<SheetHeader>
						<SheetTitle>View Meal</SheetTitle>
						<SheetDescription>Read-only delivery item details.</SheetDescription>
					</SheetHeader>

					<div className="mt-4 space-y-4">
						{viewError ? (
							<Alert variant="destructive">
								<AlertTitle>Failed to load details</AlertTitle>
								<AlertDescription>{viewError}</AlertDescription>
							</Alert>
						) : null}

						{viewLoading ? (
							<div className="space-y-3">
								<Skeleton className="h-5 w-56" />
								<Skeleton className="h-24 w-full" />
								<Skeleton className="h-24 w-full" />
							</div>
						) : null}

						{!viewLoading && viewDelivery ? (
							<Card>
								<CardHeader className="py-4">
									<CardTitle className="text-base flex items-center justify-between gap-2">
										<span>Delivery</span>
										<div className="flex items-center gap-2">
											<KitchenStatusPill status={viewDelivery.status} />
											{viewDelivery.subscriptionId ? <Badge variant="outline">Subscription</Badge> : null}
											{isImmediateDelivery(viewDelivery) ? (
												<Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">Immediate</Badge>
											) : null}
										</div>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-1 text-sm">
									<div className="flex items-center justify-between"><span className="text-muted-foreground">Date</span><span>{getDeliveryDateLabel(viewDelivery) || '—'}</span></div>
									<div className="flex items-center justify-between"><span className="text-muted-foreground">Time</span><span>{getDeliveryTimeLabel(viewDelivery) || '—'}</span></div>
									<div className="flex items-center justify-between"><span className="text-muted-foreground">Customer</span><span>{safeString(viewDelivery.user?.name) || '—'}</span></div>
								</CardContent>
							</Card>
						) : null}

						{!viewLoading && viewDelivery ? (
							<div className="space-y-3">
								{(viewDelivery.items || []).map((di) => {
									const orderItem = (viewOrder?.items || []).find((oi) => oi.cartItemId === di.cartItemId);
									const type = safeString(orderItem?.type || di.type).toLowerCase();
									const planLabel = formatPlanLabel(safeString(orderItem?.plan || di.plan));
									const title = safeString(orderItem?.pricingSnapshot?.title || di.title || di.name || di.type) || 'Item';
									const mealId = toId(orderItem?.mealId);
									const addonId = toId(orderItem?.addonId);
									const meal = mealId ? mealCache[mealId] : undefined;
									const addon = addonId ? addonCache[addonId] : undefined;
									const quantity = Number(di.quantity ?? orderItem?.quantity ?? 0);

									const displayName =
										type === 'meal'
											? safeString(meal?.name) || title
											: type === 'addon'
												? safeString(addon?.name) || title
												: title;

									return (
										<Card key={di.cartItemId} className="border-oz-neutral/40">
											<CardHeader className="py-4">
													<CardTitle className="text-base text-oz-primary font-semibold">{displayName}</CardTitle>
											</CardHeader>
											<CardContent className="space-y-2 text-sm">
												<div className="flex flex-wrap items-center gap-2">
													<Badge variant="outline">{type.toUpperCase()}</Badge>
															<span className="text-xs text-muted-foreground capitalize">{planLabel}</span>
													<Badge variant="outline">Qty {Number.isFinite(quantity) ? quantity : 0}</Badge>
												</div>

												{type === 'meal' ? (
													<div className="space-y-2">
														<div className="text-sm font-medium">Meal Pack / Trial</div>
														<div className="grid gap-1">
															<div className="flex items-center justify-between"><span className="text-muted-foreground">Meal name</span><span className="text-right">{safeString(meal?.name) || title}</span></div>
															<div className="flex items-center justify-between"><span className="text-muted-foreground">Meal category</span><span>{safeString((meal as unknown as { mealTypeRef?: { name?: string } })?.mealTypeRef?.name || (meal as unknown as { mealType?: string })?.mealType) || '—'}</span></div>
															<div className="flex items-center justify-between"><span className="text-muted-foreground">Protein option</span><span>{proteinOptionFromTitle(title)}</span></div>
															<div className="flex items-center justify-between"><span className="text-muted-foreground">Subscription type</span><span>{planLabel}</span></div>
														</div>

													<div className="pt-2 border-t border-oz-neutral/30">
														<div className="text-sm font-medium">Ingredients</div>
														{(meal as unknown as { includedItemAssignments?: Array<{ itemId?: string; quantity?: number; unit?: string; item?: { name?: string } }> })?.includedItemAssignments?.length ? (
															<div className="mt-2 space-y-1">
																{(meal as unknown as { includedItemAssignments: Array<{ itemId?: string; quantity?: number; unit?: string; item?: { name?: string } }> }).includedItemAssignments.map((a) => (
																	<div key={`${a.itemId}_${a.quantity}_${a.unit}`} className="flex items-center justify-between gap-3">
																		<div className="truncate">{safeString(a.item?.name) || '—'}</div>
																		<div className="text-muted-foreground whitespace-nowrap">{a.quantity} {a.unit}</div>
																	</div>
																))}
															</div>
														) : (
															<div className="text-sm text-muted-foreground mt-1">Ingredients unavailable for this meal.</div>
														)}
													</div>
												</div>
											) : type === 'addon' ? (
													<div className="space-y-2">
														<div className="text-sm font-medium">Add-on</div>
														<div className="grid gap-1">
															<div className="flex items-center justify-between"><span className="text-muted-foreground">Add-on name</span><span className="text-right">{safeString((addon as unknown as { name?: string })?.name) || title}</span></div>
															<div className="flex items-center justify-between"><span className="text-muted-foreground">Add-on category</span><span>{safeString((addon as unknown as { categoryRef?: { name?: string } })?.categoryRef?.name || (addon as unknown as { category?: string })?.category) || '—'}</span></div>
															<div className="flex items-center justify-between"><span className="text-muted-foreground">Quantity ordered</span><span>{Number.isFinite(quantity) ? quantity : 0}</span></div>
														</div>
													</div>
												) : type === 'byo' ? (
													<div className="space-y-2">
														<div className="text-sm font-medium">Build Your Own</div>
														{Array.isArray(orderItem?.byoSelections) && orderItem.byoSelections.length ? (
															(() => {
																const selections = orderItem.byoSelections || [];
																const itemsById = new Map((byoCatalog || []).map((bi) => [bi.id, bi]));
																const byType = new Map<
																	string,
																	Array<{ name: string; units: number; amount: number; unit?: string; unitValue?: number; category: string }>
																>();
																let totalUnits = 0;
																let totalAmount = 0;
																const unitSet = new Set<string>();
																for (const sel of selections) {
																	const ent = itemsById.get(toId(sel.itemId));
																	const rawType =
																		safeString((ent as unknown as { itemTypeRef?: { name?: string; slug?: string } })?.itemTypeRef?.name) ||
																		safeString((ent as unknown as { itemTypeRef?: { slug?: string } })?.itemTypeRef?.slug);
																	const group = byoGroupLabel(rawType);
																	if (!byType.has(group)) byType.set(group, []);
																	const units = Number(sel.quantity) || 0;
																	totalUnits += units;
																	const unitValue = Number((ent as unknown as { quantityValue?: number })?.quantityValue ?? NaN);
																	const unit = safeString((ent as unknown as { quantityUnit?: string })?.quantityUnit);
																	const amount = Number.isFinite(unitValue) ? units * unitValue : units;
																	if (unit) unitSet.add(unit);
																	if (Number.isFinite(unitValue)) totalAmount += amount;
																	byType.get(group)!.push({
																		name: safeString((ent as unknown as { name?: string })?.name) || toId(sel.itemId),
																		units,
																		amount,
																		unit: unit || undefined,
																		unitValue: Number.isFinite(unitValue) ? unitValue : undefined,
																		category: group,
																	});
																}

																const groupOrder = ['Protein', 'Carbs', 'Veggies', 'Salads', 'Shakes', 'Other'];
																const groups = Array.from(byType.entries()).sort(
																	(a, b) => groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0])
																);

																return (
																	<div className="space-y-3">
																		<div className="rounded-md border border-oz-neutral/30 p-3 text-sm">
																			<div className="flex items-center justify-between">
																				<div className="font-medium">Summary</div>
																					<div className="text-muted-foreground">
																						{selections.length} items • {formatQty(totalUnits)} units
																						{unitSet.size === 1 && totalAmount > 0 ? ` • Total ${formatQty(totalAmount)} ${Array.from(unitSet)[0]}` : ''}
																					</div>
																			</div>
																			<div className="text-xs text-muted-foreground mt-1">Subscription type: {planLabel}</div>
																		</div>

																		{groups.map(([group, list]) => (
																			<div key={group} className="rounded-md border border-oz-neutral/30 p-3">
																				<div className="font-medium">{group}</div>
																				<div className="mt-2 space-y-1">
																					{list.map((li, idx) => (
																						<div key={`${li.name}_${idx}`} className="flex items-center justify-between gap-3">
																							<div className="min-w-0">
																								<div className="truncate">{li.name}</div>
																									<div className="text-xs text-muted-foreground">
																										{li.unitValue != null ? `${formatQty(li.units)} × ${formatQty(li.unitValue)} ${li.unit ?? ''}`.trim() : `${formatQty(li.units)} units`}
																								</div>
																							</div>
																								<div className="text-muted-foreground whitespace-nowrap">{formatQty(li.amount)}{li.unit ? ` ${li.unit}` : ''}</div>
																						</div>
																					))}
																				</div>
																			</div>
																		))}
																	</div>
																);
															})()
														) : (
															<div className="text-sm text-muted-foreground">No BYO selections found for this item.</div>
														)}
													</div>
												) : (
													<div className="text-sm text-muted-foreground">Item details unavailable.</div>
												)}
											</CardContent>
										</Card>
									);
								})}
							</div>
						) : null}
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
