import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/components/ui/tabs';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

import { useToast } from '@/hooks/use-toast';
import {
	adminSubscriptionsService,
	type AdminSubscription,
	type AdminSubscriptionKind,
	type AdminSubscriptionStatus,
} from '@/services/adminSubscriptionsService';
import { adminPauseSkipService } from '@/services/adminPauseSkipService';
import { adminDeliveriesService, type AdminDailyDelivery, type AdminDeliveryStatus } from '@/services/adminDeliveriesService';
import type { PauseSkipRequest } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';

const safeString = (v: unknown) => String(v || '').trim();

const formatDate = (value?: string) => {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return value;
	return d.toLocaleDateString();
};

const kindBadgeClass = (kind: AdminSubscriptionKind) => {
	switch (kind) {
		case 'customMeal':
			return 'bg-blue-100 text-blue-900 border-blue-200';
		case 'addon':
			return 'bg-purple-100 text-purple-900 border-purple-200';
		case 'mealPack':
			return 'bg-slate-100 text-slate-900 border-slate-200';
		default:
			return 'bg-muted text-muted-foreground border';
	}
};

const statusBadgeClass = (status: AdminSubscriptionStatus) => {
	switch (status) {
		case 'active':
			return 'bg-green-100 text-green-900 border-green-200';
		case 'paused':
			return 'bg-yellow-100 text-yellow-900 border-yellow-200';
		default:
			return 'bg-muted text-muted-foreground border';
	}
};

const deliveryStatusBadgeClass = (status: AdminDeliveryStatus) => {
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

const deliveryStatusLabel = (status: AdminDeliveryStatus) => {
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

const summarize = (s: AdminSubscription) => {
	if (s.kind === 'mealPack') {
		const title = safeString(s.title) || 'Subscription';
		const servings = typeof s.delivered === 'number' && typeof s.total === 'number' ? `${s.delivered}/${s.total}` : '-';
		return `${title} · ${servings}`;
	}
	if (s.kind === 'customMeal') {
		const selectionsCount = Array.isArray(s.selections) ? s.selections.length : 0;
		const price = s.frequency === 'weekly' ? s.totals?.weeklyPrice : s.totals?.monthlyPrice;
		const priceText = typeof price === 'number' ? formatCurrency(price) : '-';
		return `${selectionsCount} items · ${priceText}`;
	}
	const servingsText = typeof s.servings === 'number' ? `${s.servings} servings` : '-';
	const priceText = typeof s.price === 'number' ? formatCurrency(s.price) : '-';
	const base = `${servingsText} · ${priceText}`;
	if (s.pauseStartDate && s.pauseEndDate) return `${base} · Pause ${s.pauseStartDate} → ${s.pauseEndDate}`;
	return base;
};

export default function Subscriptions() {
	const { toast } = useToast();
	const navigate = useNavigate();

	const [requestsLoading, setRequestsLoading] = useState(true);
	const [requests, setRequests] = useState<PauseSkipRequest[]>([]);
	const [requestsError, setRequestsError] = useState<string | null>(null);
	const [decidingRequestId, setDecidingRequestId] = useState<string | null>(null);
	const [deliveryById, setDeliveryById] = useState<Record<string, AdminDailyDelivery>>({});

	const [tab, setTab] = useState<'weekly' | 'monthly'>('weekly');
	const [statusFilter, setStatusFilter] = useState<'all' | AdminSubscriptionStatus>('all');
	const [typeFilter, setTypeFilter] = useState<'all' | AdminSubscriptionKind>('all');
	const [loading, setLoading] = useState(true);
	const [items, setItems] = useState<AdminSubscription[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [savingId, setSavingId] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		adminSubscriptionsService
			.list({
				frequency: tab,
				status: statusFilter,
				type: typeFilter,
				limit: 200,
				signal: controller.signal,
			})
			.then((data) => setItems(data))
			.catch((e: unknown) => {
				if ((e as { name?: unknown })?.name === 'AbortError') return;
				setError(safeString((e as { message?: unknown })?.message || e) || 'Failed to load subscriptions');
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [tab, statusFilter, typeFilter]);

	useEffect(() => {
		const controller = new AbortController();
		setRequestsLoading(true);
		setRequestsError(null);
		adminPauseSkipService
			.listRequests({ status: 'PENDING', limit: 200, signal: controller.signal })
			.then((data) => setRequests(data))
			.catch((e: unknown) => {
				if ((e as { name?: unknown })?.name === 'AbortError') return;
				setRequestsError(safeString((e as { message?: unknown })?.message || e) || 'Failed to load requests');
			})
			.finally(() => setRequestsLoading(false));
		return () => controller.abort();
	}, []);

	useEffect(() => {
		const deliveryIds = Array.from(
			new Set(
				requests
					.filter((r) => r.requestType === 'SKIP')
					.map((r) => safeString(r.deliveryId))
					.filter(Boolean)
			)
		);
		const missing = deliveryIds.filter((id) => !deliveryById[id]);
		if (!missing.length) return;

		const controller = new AbortController();
		Promise.all(
			missing.map(async (id) => {
				try {
					const d = await adminDeliveriesService.get(id, { signal: controller.signal });
					return [id, d] as const;
				} catch {
					return undefined;
				}
			})
		).then((pairs) => {
			const next: Record<string, AdminDailyDelivery> = {};
			for (const p of pairs) {
				if (!p) continue;
				next[p[0]] = p[1];
			}
			if (Object.keys(next).length) setDeliveryById((prev) => ({ ...prev, ...next }));
		});

		return () => controller.abort();
	}, [requests, deliveryById]);

	const onDecideRequest = async (r: PauseSkipRequest, status: 'APPROVED' | 'DECLINED') => {
		setDecidingRequestId(r.id);
		try {
			await adminPauseSkipService.decideRequest(r.id, { status });
			setRequests((prev) => prev.filter((p) => p.id !== r.id));
			toast({ title: status === 'APPROVED' ? 'Request approved' : 'Request declined' });
		} catch (e: unknown) {
			toast({
				title: 'Failed to update request',
				description: safeString((e as { message?: unknown })?.message || e),
				variant: 'destructive',
			});
		} finally {
			setDecidingRequestId(null);
		}
	};

	const onToggle = async (s: AdminSubscription) => {
		if (s.kind === 'mealPack') return;
		const nextStatus: AdminSubscriptionStatus = s.status === 'active' ? 'paused' : 'active';
		setSavingId(s.id);
		try {
			const updated = await adminSubscriptionsService.setStatus(s.kind, s.id, nextStatus);
			setItems((prev) => prev.map((p) => (p.id === s.id && p.kind === s.kind ? updated : p)));
			toast({ title: `Subscription ${nextStatus === 'paused' ? 'paused' : 'resumed'}` });
		} catch (e: unknown) {
			toast({
				title: 'Failed to update subscription',
				description: safeString((e as { message?: unknown })?.message || e),
				variant: 'destructive',
			});
		} finally {
			setSavingId(null);
		}
	};

	const totals = useMemo(() => {
		const active = items.filter((i) => i.status === 'active').length;
		const paused = items.filter((i) => i.status === 'paused').length;
		return { active, paused, total: items.length };
	}, [items]);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="outline" className="bg-white">Total: {totals.total}</Badge>
					<Badge variant="outline" className="bg-white">Active: {totals.active}</Badge>
					<Badge variant="outline" className="bg-white">Paused: {totals.paused}</Badge>
				</div>
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle>Pause / Skip Requests</CardTitle>
				</CardHeader>
				<CardContent>
					{requestsLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : requestsError ? (
						<div className="text-sm text-destructive">{requestsError}</div>
					) : requests.length === 0 ? (
						<div className="text-sm text-muted-foreground">No pending requests.</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>User</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Details</TableHead>
									<TableHead>Reason</TableHead>
									<TableHead className="text-right">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{requests.map((r) => {
									const isDeciding = decidingRequestId === r.id;
									const userLabel = r.user?.name ? `${r.user.name}${r.user.email ? ` (${r.user.email})` : ''}` : safeString(r.userId).slice(0, 12) + '…';
									const deliveryId = safeString(r.deliveryId);
									const delivery = deliveryId ? deliveryById[deliveryId] : undefined;
									const canApproveSkip = r.requestType !== 'SKIP' || !delivery || delivery.status === 'PENDING';
									const details =
										r.requestType === 'PAUSE'
											? `${r.kind} · ${r.pauseStartDate || '?'} → ${r.pauseEndDate || '?'}`
											: r.requestType === 'WITHDRAW_PAUSE'
												? `withdraw · ${r.kind} · ${r.pauseStartDate || '?'} → ${r.pauseEndDate || '?'}`
												: delivery
													? `delivery · ${delivery.date} ${delivery.time}`
													: `delivery · ${r.skipDate || '?'} · ${deliveryId ? `${deliveryId.slice(0, 8)}…` : '?'}`;
									return (
										<TableRow key={r.id}>
											<TableCell className="text-sm">{userLabel}</TableCell>
											<TableCell>
												<Badge variant="outline" className="bg-white">
													{r.requestType}
												</Badge>
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												<div className="flex flex-wrap items-center gap-2">
													<span>{details}</span>
													{r.requestType === 'SKIP' && delivery ? (
														<Badge variant="outline" className={deliveryStatusBadgeClass(delivery.status)}>
															{deliveryStatusLabel(delivery.status)}
														</Badge>
													) : null}
												</div>
											</TableCell>
											<TableCell className="text-sm">{r.reason || '—'}</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													{canApproveSkip ? (
														<Button size="sm" disabled={isDeciding} onClick={() => onDecideRequest(r, 'APPROVED')}>
															Approve
														</Button>
													) : (
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<span>
																		<Button size="sm" disabled>
																			Approve
																		</Button>
																	</span>
																</TooltipTrigger>
																<TooltipContent>
																	This delivery has already started and can no longer be skipped.
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													)}
													<Button size="sm" variant="destructive" disabled={isDeciding} onClick={() => onDecideRequest(r, 'DECLINED')}>
														Decline
													</Button>
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle>Filters</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<Tabs value={tab} onValueChange={(v) => setTab(v as 'weekly' | 'monthly')} className="w-full sm:w-auto">
						<TabsList>
							<TabsTrigger value="weekly">Weekly</TabsTrigger>
							<TabsTrigger value="monthly">Monthly</TabsTrigger>
						</TabsList>
						<TabsContent value={tab} />
					</Tabs>

					<div className="flex flex-wrap items-center gap-2">
						<Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | AdminSubscriptionStatus)}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="paused">Inactive (Paused)</SelectItem>
							</SelectContent>
						</Select>

						<Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | AdminSubscriptionKind)}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All types</SelectItem>
								<SelectItem value="customMeal">Meals (BYO)</SelectItem>
								<SelectItem value="addon">Add-ons</SelectItem>
								<SelectItem value="mealPack">Meal packs</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle>{tab === 'weekly' ? 'Weekly' : 'Monthly'} Subscriptions</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="space-y-2">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : error ? (
						<div className="text-sm text-destructive">{error}</div>
					) : items.length === 0 ? (
						<div className="text-sm text-muted-foreground">No subscriptions match these filters.</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>User</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Start</TableHead>
									<TableHead>End</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Servings</TableHead>
									<TableHead>Summary</TableHead>
									<TableHead className="text-right">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{items.map((s) => {
									const isSaving = savingId === s.id;
									const nextStatus: AdminSubscriptionStatus = s.status === 'active' ? 'paused' : 'active';
									const servingsText = typeof s.delivered === 'number' && typeof s.total === 'number' ? `${s.delivered}/${s.total}` : '-';
									const endDate = s.scheduleEndDate || s.cycleEndDate;
									return (
										<TableRow key={`${s.kind}:${s.id}`}>
											<TableCell className="font-mono text-xs">{safeString(s.userId).slice(0, 12)}…</TableCell>
											<TableCell>
												<Badge variant="outline" className={kindBadgeClass(s.kind)}>
													{s.kind === 'customMeal' ? 'Meals' : s.kind === 'addon' ? 'Add-ons' : 'Meal pack'}
												</Badge>
											</TableCell>
											<TableCell>{formatDate(s.startDate)}</TableCell>
											<TableCell>{formatDate(endDate)}</TableCell>
											<TableCell>
												<div className="space-y-1">
													<Badge variant="outline" className={statusBadgeClass(s.status)}>
														{s.status}
													</Badge>
													{s.nextServingDate ? (
														<div className="text-xs text-muted-foreground">Upcoming Serving Date: {s.nextServingDate}</div>
													) : null}
													{s.pauseStartDate && s.pauseEndDate ? (
														<div className="text-xs text-muted-foreground">Pause: {s.pauseStartDate} → {s.pauseEndDate}</div>
													) : null}
												</div>
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">{servingsText}</TableCell>
											<TableCell className="text-sm text-muted-foreground">{summarize(s)}</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													{s.orderId ? (
														<Button size="sm" variant="outline" onClick={() => navigate(`/admin/orders/${encodeURIComponent(s.orderId!)}`)}>
															View Order
														</Button>
													) : null}
													{s.kind !== 'mealPack' ? (
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button size="sm" variant={nextStatus === 'paused' ? 'destructive' : 'secondary'} disabled={isSaving}>
																	{nextStatus === 'paused' ? 'Pause' : 'Resume'}
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		{nextStatus === 'paused' ? 'Pause subscription?' : 'Resume subscription?'}
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		This changes operational status only. It does not refund past orders.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
																	<AlertDialogAction onClick={() => onToggle(s)} disabled={isSaving}>
																		Confirm
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													) : null}
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
