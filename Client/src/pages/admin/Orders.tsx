import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import { adminOrdersService, type AdminOrder, type AdminOrderLifecycleStatus, type AdminOrderAcceptanceStatus } from '@/services/adminOrdersService';
import { formatCurrency } from '@/utils/formatCurrency';
import { statusBadgeClass as globalStatusBadgeClass, statusLabel } from '@/utils/statusUi';

const LIFECYCLE_STATUSES: AdminOrderLifecycleStatus[] = ['PAID', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

const safeString = (v: unknown) => String(v || '').trim();

const formatDateTime = (value?: string) => {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleString();
};

const getEffectiveCurrentStatus = (order: AdminOrder): AdminOrderLifecycleStatus | 'UNKNOWN' => {
	const s = safeString(order.currentStatus) as AdminOrderLifecycleStatus;
	if (LIFECYCLE_STATUSES.includes(s)) return s;
	// Backward compat for older paid orders
	if (safeString(order.paymentStatus).toUpperCase() === 'PAID' || safeString(order.status).toUpperCase() === 'PAID') return 'PAID';
	return 'UNKNOWN';
};

const statusBadgeClass = (status: string) => globalStatusBadgeClass(status);

const getAcceptance = (order: AdminOrder): AdminOrderAcceptanceStatus => {
	const s = safeString(order.acceptanceStatus).toUpperCase() as AdminOrderAcceptanceStatus;
	if (s === 'CONFIRMED' || s === 'DECLINED' || s === 'PENDING_REVIEW') return s;
	return 'PENDING_REVIEW';
};

const acceptanceBadgeClass = (status: AdminOrderAcceptanceStatus) => {
	switch (status) {
		case 'PENDING_REVIEW':
			return 'bg-yellow-100 text-yellow-900 border-yellow-200';
		case 'CONFIRMED':
			return 'bg-green-100 text-green-900 border-green-200';
		case 'DECLINED':
			return 'bg-red-100 text-red-900 border-red-200';
		default:
			return 'bg-muted text-muted-foreground border';
	}
};

export default function Orders() {
	const navigate = useNavigate();
	const { toast } = useToast();

	const [orders, setOrders] = useState<AdminOrder[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit] = useState(20);
	const [total, setTotal] = useState(0);
	const [statusFilter, setStatusFilter] = useState<'all' | AdminOrderLifecycleStatus>('all');
	const [search, setSearch] = useState('');
	const [decisionSavingId, setDecisionSavingId] = useState<string | null>(null);

	const onDecision = async (orderId: string, acceptanceStatus: Exclude<AdminOrderAcceptanceStatus, 'PENDING_REVIEW'>) => {
		if (!orderId) return;
		setDecisionSavingId(orderId);
		try {
			const updated = await adminOrdersService.updateAcceptance(orderId, acceptanceStatus);
			setOrders((prev) => prev.map((o) => (safeString(o._id || o.id) === orderId ? { ...o, acceptanceStatus: updated.acceptanceStatus } : o)));
			toast({ title: `Order ${acceptanceStatus.toLowerCase()}` });
		} catch (e: unknown) {
			toast({ title: 'Failed to update acceptance', description: safeString((e as { message?: unknown })?.message || e), variant: 'destructive' });
		} finally {
			setDecisionSavingId(null);
		}
	};

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		adminOrdersService
			.list({
				page,
				limit,
				currentStatus: statusFilter === 'all' ? undefined : statusFilter,
				signal: controller.signal,
			})
			.then((res) => {
				setOrders(res.orders || []);
				setTotal(res.total || 0);
			})
			.catch((e: unknown) => {
				const msg = safeString((e as { message?: unknown })?.message || e) || 'Failed to load orders';
				if (msg.toLowerCase().includes('authentication required') || msg.toLowerCase().includes('unauthorized')) {
					navigate('/login', { replace: true, state: { from: '/admin/orders' } });
					return;
				}
				setError(msg);
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [page, limit, statusFilter, navigate]);

	const filteredOrders = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return orders;
		return orders.filter((o) => {
			const id = safeString(o._id || o.id);
			const label = safeString(o.deliveryAddress?.label);
			const phone = safeString((o.deliveryAddress as { contactNumber?: string } | undefined)?.contactNumber);
			const userId = safeString(o.userId);
			return (
				id.toLowerCase().includes(q) ||
				label.toLowerCase().includes(q) ||
				phone.toLowerCase().includes(q) ||
				userId.toLowerCase().includes(q)
			);
		});
	}, [orders, search]);

	const totalPages = Math.max(1, Math.ceil(total / limit));
	const hasPrev = page > 1;
	const hasNext = page < totalPages;

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div className="w-full sm:w-56">
						<Select
							value={statusFilter}
							onValueChange={(v) => {
								setPage(1);
								setStatusFilter(v as typeof statusFilter);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Filter status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								{LIFECYCLE_STATUSES.map((s) => (
									<SelectItem key={s} value={s}>
										{s}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="relative w-full sm:w-72">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search order/customer"
							className="pl-9"
						/>
					</div>
				</div>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Failed to load orders</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<Card className="border-oz-neutral/40">
				<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle className="text-lg">Orders</CardTitle>
					<div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="space-y-3">
							{Array.from({ length: 8 }).map((_, i) => (
								<div key={i} className="flex items-center gap-3">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-4 w-28" />
								</div>
							))}
						</div>
					) : filteredOrders.length === 0 ? (
						<div className="py-10 text-center">
							<div className="text-sm text-muted-foreground">No orders found.</div>
						</div>
					) : (
						<>
							{/* Desktop table */}
							<div className="hidden md:block">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Order</TableHead>
											<TableHead>Customer</TableHead>
											<TableHead className="text-right">Total</TableHead>
											<TableHead>Lifecycle</TableHead>
											<TableHead>Decision</TableHead>
											<TableHead>Payment</TableHead>
											<TableHead>Created</TableHead>
											<TableHead className="text-right">Action</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredOrders.map((o) => {
											const id = safeString(o._id || o.id);
											const customerLabel = safeString(o.deliveryAddress?.label) || shortId(safeString(o.userId)) || '—';
											const customerPhone = safeString((o.deliveryAddress as { contactNumber?: string } | undefined)?.contactNumber) || '—';
											const lifecycle = getEffectiveCurrentStatus(o);
											const acceptance = getAcceptance(o);
											const isNew = !safeString(o.adminSeenAt);
											const isLocked = Boolean(o.movedToKitchenAt);
											const payment = safeString(o.paymentStatus || '').toUpperCase() || (safeString(o.status).toUpperCase() === 'PAYMENT_FAILED' ? 'FAILED' : '—');
											return (
												<TableRow
													key={id}
													className={
														(isNew ? 'bg-amber-50/40' : '') +
														' transition-colors hover:bg-muted/30'
													}
												>
													<TableCell className="font-medium">
														<div className="flex items-center gap-2">
															{isNew ? <span className="h-4 w-1 rounded-full bg-amber-300" aria-hidden /> : <span className="h-4 w-1" aria-hidden />}
															<div className="font-mono text-xs text-muted-foreground">{shortId(id)}</div>
															{isNew ? <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 text-xs">New</Badge> : null}
														</div>
													</TableCell>
													<TableCell>
														<div className="text-sm">{customerLabel}</div>
														<div className="text-xs text-muted-foreground">{customerPhone}</div>
													</TableCell>
													<TableCell className="text-right">{formatCurrency(o.total || 0)}</TableCell>
													<TableCell>
														<Badge variant="outline" className={`${statusBadgeClass(String(lifecycle))} text-xs`}>
															{statusLabel(String(lifecycle))}
														</Badge>
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<Badge variant="outline" className={`${acceptanceBadgeClass(acceptance)} text-xs`}>{statusLabel(acceptance)}</Badge>
															<Button size="sm" variant={acceptance === 'CONFIRMED' ? 'default' : 'outline'} disabled={isLocked || decisionSavingId === id} onClick={() => onDecision(id, 'CONFIRMED')}>Confirm</Button>
															<Button size="sm" variant={acceptance === 'DECLINED' ? 'destructive' : 'outline'} disabled={isLocked || decisionSavingId === id} onClick={() => onDecision(id, 'DECLINED')}>Decline</Button>
														</div>
														{isLocked ? <div className="text-xs text-muted-foreground mt-1">Locked (in kitchen)</div> : null}
													</TableCell>
													<TableCell>
														<Badge variant="secondary" className="text-xs">{payment || '—'}</Badge>
													</TableCell>
													<TableCell className="text-sm text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
													<TableCell className="text-right">
														<Button asChild size="sm" variant="outline">
															<Link to={`/admin/orders/${encodeURIComponent(id)}`}>View</Link>
														</Button>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>

							{/* Mobile cards */}
							<div className="md:hidden space-y-3">
								{filteredOrders.map((o) => {
									const id = safeString(o._id || o.id);
									const lifecycle = getEffectiveCurrentStatus(o);
									const acceptance = getAcceptance(o);
									const isNew = !safeString(o.adminSeenAt);
									const isLocked = Boolean(o.movedToKitchenAt);
									return (
										<Card key={id} className={(isNew ? 'border-amber-200 bg-amber-50/40 ' : 'border-oz-neutral/40 ') + 'transition-shadow hover:shadow-sm'}>
											<CardContent className="p-4 space-y-2">
												<div className="flex items-start justify-between gap-3">
													<div>
														<div className="font-mono text-xs text-muted-foreground">{shortId(id)}</div>
														<div className="text-sm font-medium">{safeString(o.deliveryAddress?.label) || shortId(safeString(o.userId)) || '—'}</div>
														<div className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</div>
													</div>
													<div className="flex items-center gap-2">
														{isNew ? <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 text-xs">New</Badge> : null}
														<Badge variant="outline" className={`${statusBadgeClass(String(lifecycle))} text-xs`}>{statusLabel(String(lifecycle))}</Badge>
													</div>
												</div>
												<div className="flex items-center gap-2 flex-wrap">
													<Badge variant="outline" className={`${acceptanceBadgeClass(acceptance)} text-xs`}>{statusLabel(acceptance)}</Badge>
													<Button size="sm" variant={acceptance === 'CONFIRMED' ? 'default' : 'outline'} disabled={isLocked || decisionSavingId === id} onClick={() => onDecision(id, 'CONFIRMED')}>Confirm</Button>
													<Button size="sm" variant={acceptance === 'DECLINED' ? 'destructive' : 'outline'} disabled={isLocked || decisionSavingId === id} onClick={() => onDecision(id, 'DECLINED')}>Decline</Button>
												</div>
												<div className="flex items-center justify-between text-sm">
													<div className="text-muted-foreground">Total</div>
													<div className="font-medium">{formatCurrency(o.total || 0)}</div>
												</div>
												<div className="flex items-center justify-between">
													<Badge variant="secondary">{safeString(o.paymentStatus || '').toUpperCase() || '—'}</Badge>
													<Button asChild size="sm" variant="outline">
														<Link to={`/admin/orders/${encodeURIComponent(id)}`}>View</Link>
													</Button>
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						</>
					)}

					<div className="mt-6 flex items-center justify-between">
						<Button variant="outline" disabled={!hasPrev || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
							Previous
						</Button>
						<div className="text-sm text-muted-foreground">{total ? `${total} total` : ''}</div>
						<Button variant="outline" disabled={!hasNext || loading} onClick={() => setPage((p) => p + 1)}>
							Next
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
