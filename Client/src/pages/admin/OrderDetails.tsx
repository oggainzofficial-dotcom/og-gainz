import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Phone, User as UserIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';

import { useToast } from '@/hooks/use-toast';
import { adminOrdersService, type AdminOrder, type AdminOrderAcceptanceStatus } from '@/services/adminOrdersService';
import { formatCurrency } from '@/utils/formatCurrency';
import { statusBadgeClass as globalStatusBadgeClass, statusLabel } from '@/utils/statusUi';

const safeString = (v: unknown) => String(v || '').trim();

const getRecipientName = (deliveryAddress: unknown) => {
	const a = deliveryAddress as
		| {
				username?: unknown;
				recipientName?: unknown;
				fullName?: unknown;
				name?: unknown;
				recipient?: unknown;
		  }
		| undefined;

	return (
		safeString(a?.username) ||
		safeString(a?.recipientName) ||
		safeString(a?.fullName) ||
		safeString(a?.name) ||
		safeString(a?.recipient)
	);
};

const formatDateTime = (value?: string) => {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleString();
};


const getAcceptance = (order: AdminOrder): AdminOrderAcceptanceStatus => {
	const s = safeString(order.acceptanceStatus).toUpperCase() as AdminOrderAcceptanceStatus;
	if (s === 'CONFIRMED' || s === 'DECLINED' || s === 'PENDING_REVIEW') return s;
	return 'PENDING_REVIEW';
};

const acceptanceBadgeClass = (status: AdminOrderAcceptanceStatus) => {
	switch (status) {
		case 'PENDING_REVIEW':
			return 'bg-slate-50 text-slate-800 border-slate-200';
		case 'CONFIRMED':
			return globalStatusBadgeClass('CONFIRMED');
		case 'DECLINED':
			return globalStatusBadgeClass('DECLINED');
		default:
			return 'bg-muted text-muted-foreground border';
	}
};

export default function OrderDetails() {
	const { orderId } = useParams();
	const navigate = useNavigate();
	const { toast } = useToast();

	const [order, setOrder] = useState<AdminOrder | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [acceptanceSaving, setAcceptanceSaving] = useState(false);
	const [acceptanceError, setAcceptanceError] = useState<string | null>(null);
	const [moveSaving, setMoveSaving] = useState(false);
	const [moveError, setMoveError] = useState<string | null>(null);

	const [notesDraft, setNotesDraft] = useState('');
	const [notesSaving, setNotesSaving] = useState(false);
	const [notesError, setNotesError] = useState<string | null>(null);

	useEffect(() => {
		const id = safeString(orderId);
		if (!id) return;
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		adminOrdersService
			.get(id, { signal: controller.signal })
			.then((o) => {
				setOrder(o);
				setNotesDraft(safeString(o.adminNotes));
			})
			.catch((e: unknown) => {
				const msg = safeString((e as { message?: unknown })?.message || e) || 'Failed to load order';
				if (msg.toLowerCase().includes('authentication required') || msg.toLowerCase().includes('unauthorized')) {
					navigate('/login', { replace: true, state: { from: `/admin/orders/${id}` } });
					return;
				}
				setError(msg);
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [orderId, navigate]);

	const timeline = useMemo(() => {
		const raw = Array.isArray(order?.statusHistory) ? order!.statusHistory : [];
		return [...raw].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
	}, [order]);

	const onSetAcceptance = async (acceptanceStatus: Exclude<AdminOrderAcceptanceStatus, 'PENDING_REVIEW'>) => {
		if (!order) return;
		const id = safeString(order._id || order.id || orderId);
		if (!id) return;

		setAcceptanceSaving(true);
		setAcceptanceError(null);

		try {
			const updated = await adminOrdersService.updateAcceptance(id, acceptanceStatus);
			setOrder(updated);
			toast({ title: `Order ${acceptanceStatus.toLowerCase()}` });
		} catch (e: unknown) {
			setAcceptanceError(safeString((e as { message?: unknown })?.message || e) || 'Failed to update acceptance');
		} finally {
			setAcceptanceSaving(false);
		}
	};

	const onSaveNotes = async () => {
		if (!order) return;
		const id = safeString(order._id || order.id || orderId);
		if (!id) return;

		setNotesSaving(true);
		setNotesError(null);

		try {
			const updated = await adminOrdersService.updateNotes(id, notesDraft);
			setOrder(updated);
			toast({ title: 'Notes saved' });
		} catch (e: unknown) {
			setNotesError(safeString((e as { message?: unknown })?.message || e) || 'Failed to save notes');
		} finally {
			setNotesSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-52" />
					<Skeleton className="h-9 w-28" />
				</div>
				<div className="grid gap-4 lg:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Card key={i}>
							<CardHeader>
								<Skeleton className="h-4 w-24" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-20 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		const notFound = error.toLowerCase().includes('not found');
		const forbidden = error.toLowerCase().includes('admin role required') || error.toLowerCase().includes('access');
		return (
			<div className="space-y-4">
				<Alert variant="destructive">
					<AlertTitle>{notFound ? 'Order not found' : forbidden ? 'Access denied' : 'Error'}</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
				<Button asChild variant="outline">
					<Link to="/admin/orders">Back to Orders</Link>
				</Button>
			</div>
		);
	}

	if (!order) {
		return null;
	}

	const id = safeString(order._id || order.id || orderId);
	const paymentId = safeString(order.payment?.paymentId || order.razorpayPaymentId);
	const paymentProvider = safeString(order.payment?.provider || order.paymentProvider || 'razorpay');
	const acceptance = getAcceptance(order);
	const isKitchenLocked = Boolean(order.movedToKitchenAt);
	const canDecide = !isKitchenLocked;
	const seenAt = safeString(order.adminSeenAt);
	const canMoveToKitchen = acceptance === 'CONFIRMED' && !isKitchenLocked;
	const showKitchenSection = acceptance === 'CONFIRMED' || isKitchenLocked;

	const onMoveToKitchen = async () => {
		if (!order) return;
		const oid = safeString(order._id || order.id || orderId);
		if (!oid) return;
		setMoveSaving(true);
		setMoveError(null);
		try {
			const res = await adminOrdersService.moveToKitchen(oid);
			setOrder(res.order);
			toast({ title: 'Moved to kitchen', description: `${res.deliveriesCreated} deliveries generated` });
		} catch (e: unknown) {
			setMoveError(safeString((e as { message?: unknown })?.message || e) || 'Failed to move to kitchen');
		} finally {
			setMoveSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="text-2xl font-semibold text-oz-primary">Order {id ? id.slice(-6) : ''}</div>
					<div className="text-sm text-muted-foreground">Full ID: <span className="font-mono">{id}</span></div>
				</div>
				<Button asChild variant="outline">
					<Link to="/admin/orders">Back</Link>
				</Button>
			</div>

			<div className="grid gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader className="flex flex-row items-start justify-between gap-3">
						<CardTitle>Order Summary</CardTitle>
						<div className="flex items-center gap-2">
							<Badge variant="outline" className={`${acceptanceBadgeClass(acceptance)} text-xs`}>{statusLabel(acceptance)}</Badge>
						</div>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<div className="flex items-center justify-between gap-3">
							<span className="text-xs font-semibold text-muted-foreground">Total</span>
							<span className="font-medium text-foreground">{formatCurrency(order.total || 0)}</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-xs font-semibold text-muted-foreground">Delivery fee</span>
							<span className="text-foreground">{formatCurrency(order.deliveryFee || 0)}</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-xs font-semibold text-muted-foreground">Delivery distance</span>
							<span className="text-foreground">{typeof order.deliveryDistanceKm === 'number' ? `${order.deliveryDistanceKm.toFixed(1)} km` : '—'}</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-xs font-semibold text-muted-foreground">Created</span>
							<span className="text-foreground">{formatDateTime(order.createdAt)}</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-xs font-semibold text-muted-foreground">Seen</span>
							<span className="text-foreground">{seenAt ? formatDateTime(seenAt) : '—'}</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-xs font-semibold text-muted-foreground">Payment</span>
							<span className="text-foreground">{paymentProvider.toUpperCase()} {paymentId ? `• ${paymentId}` : ''}</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Update Status</CardTitle>
					</CardHeader>
					<CardContent className="space-y-5">
						{isKitchenLocked ? (
							<div className="rounded-md border border-oz-neutral/30 bg-muted/30 p-3 text-sm">
								<div className="font-medium">Decision locked</div>
								<div className="text-muted-foreground">Moved to kitchen at {formatDateTime(order.movedToKitchenAt)}</div>
							</div>
						) : null}

						<div className="space-y-2">
							<div className="text-sm font-medium">Decision</div>
							<div className="flex items-center gap-2">
								<Button size="sm" disabled={!canDecide || acceptanceSaving} variant={acceptance === 'CONFIRMED' ? 'default' : 'outline'} onClick={() => onSetAcceptance('CONFIRMED')}>
									Confirm
								</Button>
								<Button size="sm" disabled={!canDecide || acceptanceSaving} variant={acceptance === 'DECLINED' ? 'destructive' : 'outline'} onClick={() => onSetAcceptance('DECLINED')}>
									Decline
								</Button>
								<Badge variant="outline" className={`${acceptanceBadgeClass(acceptance)} text-xs`}>{statusLabel(acceptance)}</Badge>
							</div>
							{acceptanceError ? <div className="text-sm text-red-600">{acceptanceError}</div> : null}
						</div>

						{showKitchenSection ? (
							<div className="space-y-2 pt-2 border-t border-oz-neutral/30">
								<div className="text-sm font-medium">Kitchen</div>
								<Button className="w-full" disabled={!canMoveToKitchen || moveSaving} onClick={onMoveToKitchen}>
									{moveSaving ? 'Moving…' : 'Move to Kitchen'}
								</Button>
								{moveError ? <div className="text-sm text-red-600">{moveError}</div> : null}
								{isKitchenLocked ? <div className="text-xs text-muted-foreground">Already moved to kitchen.</div> : null}
							</div>
						) : null}
					</CardContent>
				</Card>
			</div>

			<Card className="border-oz-neutral/40">
				<CardHeader>
					<CardTitle>Items</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{(order.items || []).length === 0 ? (
						<div className="text-sm text-muted-foreground">No items.</div>
					) : (
						<div className="space-y-2">
							{(order.items || []).map((it) => (
								<div key={it.cartItemId} className="flex flex-col gap-1 border-b border-oz-neutral/40 pb-2 last:border-b-0 last:pb-0">
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="font-medium">{it.pricingSnapshot?.title || it.type}</div>
											<div className="text-xs text-muted-foreground">{it.type.toUpperCase()} • {it.plan} • Qty {it.quantity}</div>
											{it.orderDetails?.startDate || it.orderDetails?.deliveryTime ? (
												<div className="text-xs text-muted-foreground">Schedule: {it.orderDetails?.startDate || '—'} at {it.orderDetails?.deliveryTime || '—'}</div>
											) : null}
											{it.subscriptionProgress ? (
												<div className="text-xs text-muted-foreground">
													Cycle: {it.subscriptionProgress.cycleStartDate || it.orderDetails?.startDate || '—'} → {it.subscriptionProgress.scheduleEndDate || it.subscriptionProgress.cycleEndDate || '—'}
													{it.subscriptionProgress.nextServingDate ? ` · Upcoming Serving Date: ${it.subscriptionProgress.nextServingDate}` : ''}
													{' '}· Servings: {(typeof it.subscriptionProgress.delivered === 'number' ? it.subscriptionProgress.delivered : 0)}/{(typeof it.subscriptionProgress.total === 'number' ? it.subscriptionProgress.total : 0)}
												</div>
											) : null}
										</div>
										<div className="text-right">
											<div className="text-sm font-medium">{formatCurrency(it.pricingSnapshot?.lineTotal || 0)}</div>
											<div className="text-xs text-muted-foreground">{formatCurrency(it.pricingSnapshot?.unitPrice || 0)} each</div>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Delivery Address</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						<div className="rounded-xl border bg-muted/20 p-3">
							<div className="flex items-start gap-3">
								<UserIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
								<div className="min-w-0">
									<div className="text-xs text-muted-foreground">Recipient</div>
										<div className="font-medium leading-5 break-words">{getRecipientName(order.deliveryAddress) || '—'}</div>
									{safeString(order.user?.email) ? (
										<div className="text-xs text-muted-foreground">Account: {safeString(order.user?.email)}</div>
									) : null}
								</div>
							</div>
							<div className="mt-3 flex items-start gap-3">
								<Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
								<div className="min-w-0">
									<div className="text-xs text-muted-foreground">Contact</div>
									<div className="font-medium leading-5 break-words">{safeString((order.deliveryAddress as { contactNumber?: string } | undefined)?.contactNumber) || '—'}</div>
								</div>
							</div>
						</div>

						<div className="space-y-1">
							<div className="font-medium text-oz-primary">{safeString(order.deliveryAddress?.label) || '—'}</div>
							<div className="text-muted-foreground">{[order.deliveryAddress?.addressLine1, order.deliveryAddress?.addressLine2].filter(Boolean).join(', ') || '—'}</div>
							<div className="text-muted-foreground">
								{[order.deliveryAddress?.city, order.deliveryAddress?.state].filter(Boolean).join(', ') || '—'}
								{order.deliveryAddress?.pincode ? ` – ${order.deliveryAddress.pincode}` : ''}
							</div>
							{order.deliveryAddress?.landmark ? <div className="text-muted-foreground">Landmark: {order.deliveryAddress.landmark}</div> : null}
							<div className="text-xs text-muted-foreground">Lat/Lng: {typeof order.deliveryAddress?.latitude === 'number' ? order.deliveryAddress.latitude : '—'} / {typeof order.deliveryAddress?.longitude === 'number' ? order.deliveryAddress.longitude : '—'}</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Admin Notes</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Internal notes (not visible to customers)" rows={6} />
						{notesError ? <div className="text-sm text-red-600">{notesError}</div> : null}
						<Button variant="outline" className="w-full" disabled={notesSaving} onClick={onSaveNotes}>
							{notesSaving ? 'Saving…' : 'Save Notes'}
						</Button>
					</CardContent>
				</Card>
			</div>

			<Card className="border-oz-neutral/40">
				<CardHeader>
					<CardTitle>Lifecycle Timeline</CardTitle>
				</CardHeader>
				<CardContent>
					{timeline.length === 0 ? (
						<div className="text-sm text-muted-foreground">No lifecycle history yet.</div>
					) : (
						<div className="relative">
							<div className="absolute left-[8px] top-0 bottom-0 w-px bg-oz-neutral/40" />
							<div className="space-y-5">
								{timeline.map((h, idx) => (
									<div key={`${h.status}_${h.changedAt}_${idx}`} className="relative grid grid-cols-[16px_1fr] gap-3 sm:gap-4 py-2">
										<div className="flex justify-center">
											<div className="mt-1 h-3.5 w-3.5 rounded-full border border-oz-neutral/40 bg-oz-primary/90" />
										</div>
										<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
											<div className="min-w-0 font-semibold leading-5 break-words">{statusLabel(String(h.status))}</div>
											<div className="text-xs text-muted-foreground sm:whitespace-nowrap break-words">{formatDateTime(h.changedAt)} • {statusLabel(String(h.changedBy))}</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
