import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, RefreshCw, RotateCcw, XCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/utils/formatCurrency';
import { ordersService } from '@/services/ordersService';
import type { PublicOrder } from '@/types/ordersPhase5b';
import { normalizeOrderFlags } from '@/types/ordersPhase5b';

const formatDateTime = (dateString: string) => {
	return new Date(dateString).toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

export default function MyOrderDetails() {
	const { orderId } = useParams();
	const [order, setOrder] = useState<PublicOrder | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = async () => {
		setIsLoading(true);
		setError(null);
		try {
			if (!orderId) throw new Error('Missing order id');
			const res = await ordersService.getMyOrderById(orderId, { noCache: true });
			setOrder(res);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load order');
			setOrder(null);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [orderId]);

	const badge = useMemo(() => {
		const flags = normalizeOrderFlags({ status: order?.status, paymentStatus: order?.paymentStatus });
		if (flags.isPaid) return { variant: 'default' as const, label: 'Paid' };
		if (flags.isFailed) return { variant: 'destructive' as const, label: 'Failed' };
		return { variant: 'secondary' as const, label: 'Pending' };
	}, [order?.paymentStatus, order?.status]);

	const timeline = useMemo(() => {
		if (!order) return [] as Array<{ key: string; label: string; at?: string; icon: React.ReactNode }>; 
		const steps: Array<{ key: string; label: string; at?: string; icon: React.ReactNode }> = [];
		steps.push({ key: 'created', label: 'Order created', at: order.createdAt, icon: <Clock className="h-4 w-4" /> });

		// Initial Razorpay order (Phase 4 initiate)
		if (order.razorpayOrderId) {
			steps.push({
				key: 'initial_attempt',
				label: 'Payment attempt created',
				at: order.createdAt,
				icon: <Clock className="h-4 w-4" />,
			});
		}

		// Retry attempts (Phase 5C)
		for (const a of order.paymentAttempts || []) {
			steps.push({
				key: `attempt_${a.attemptId}`,
				label: `Payment attempt ${a.status === 'PAID' ? 'paid' : a.status === 'FAILED' ? 'failed' : 'created'}`,
				at: a.createdAt,
				icon:
					a.status === 'PAID' ? <CheckCircle2 className="h-4 w-4 text-oz-secondary" /> : a.status === 'FAILED' ? <XCircle className="h-4 w-4 text-muted-foreground" /> : <Clock className="h-4 w-4" />,
			});
		}

		if (order.paidAt) {
			steps.push({ key: 'paid', label: 'Payment confirmed', at: order.paidAt, icon: <CheckCircle2 className="h-4 w-4 text-oz-secondary" /> });
		} else if (badge.label === 'Failed') {
			steps.push({ key: 'failed', label: 'Payment failed', at: order.updatedAt, icon: <XCircle className="h-4 w-4 text-muted-foreground" /> });
		}

		return steps;
	}, [badge.label, order]);

	if (isLoading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<Card>
					<CardContent className="py-12 text-center">
						<div className="text-sm text-muted-foreground">Loading order…</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<div className="container mx-auto px-4 py-8">
				<Card>
					<CardContent className="py-12 text-center space-y-3">
						<div className="text-sm text-destructive">{error}</div>
						<Button variant="outline" onClick={() => void load()}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Retry
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!order) {
		return (
			<div className="container mx-auto px-4 py-8">
				<Card>
					<CardContent className="py-12 text-center">
						<div className="text-sm text-muted-foreground">Order not found.</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8 animate-fade-in">
			<div className="flex items-center justify-between gap-3 mb-6">
				<Button asChild variant="ghost">
					<Link to="/my-orders">
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back
					</Link>
				</Button>
				<Button variant="outline" onClick={() => void load()}>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<span>Order #{order.id.slice(-8)}</span>
						<Badge variant={badge.variant} className="text-xs">
							{badge.label}
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="text-sm text-muted-foreground">Placed: {formatDateTime(order.createdAt)}</div>

					{order.deliveryAddressSummary ? (
						<div>
							<div className="text-sm font-medium">Delivery Address</div>
							<div className="text-sm text-muted-foreground">{order.deliveryAddressSummary}</div>
						</div>
					) : null}

					<Separator />

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<div className="text-xs text-muted-foreground">Subtotal</div>
							<div className="font-medium">{formatCurrency(order.subtotal)}</div>
						</div>
						<div>
							<div className="text-xs text-muted-foreground">Delivery Fee</div>
							<div className="font-medium">{formatCurrency(order.deliveryFee)}</div>
						</div>
						<div>
							<div className="text-xs text-muted-foreground">Credits Applied</div>
							<div className="font-medium">-{formatCurrency(order.creditsApplied || 0)}</div>
						</div>
						<div>
							<div className="text-xs text-muted-foreground">Total</div>
							<div className="font-semibold text-oz-primary">{formatCurrency(order.total)}</div>
						</div>
					</div>

					<Separator />

					<div className="space-y-2">
						<div className="text-sm font-medium">Order Timeline</div>
						<div className="space-y-2">
							{timeline.map((t) => (
								<div key={t.key} className="flex items-start gap-3">
									<div className="mt-0.5 text-muted-foreground">{t.icon}</div>
									<div>
										<div className="text-sm">{t.label}</div>
										{t.at ? <div className="text-xs text-muted-foreground">{formatDateTime(t.at)}</div> : null}
									</div>
								</div>
							))}
						</div>
					</div>

					<Separator />

					<div className="space-y-2">
						<div className="flex items-center justify-between gap-3">
							<div className="text-sm font-medium">Payment Attempts</div>
							{normalizeOrderFlags({ status: order.status, paymentStatus: order.paymentStatus }).isFailed ? (
								<Button asChild size="sm">
									<Link to={`/order/failed/${order.id}`}>
										<RotateCcw className="h-4 w-4 mr-2" />
										Retry Payment
									</Link>
								</Button>
							) : null}
						</div>

						<div className="space-y-2">
							{/* Phase 4 initial attempt (shown even if paymentAttempts array is empty) */}
							{order.razorpayOrderId ? (
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="text-sm font-medium">Initial attempt</div>
										<div className="text-xs text-muted-foreground">Razorpay Order: {order.razorpayOrderId}</div>
									</div>
									<div className="text-right text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</div>
								</div>
							) : null}

							{(order.paymentAttempts || []).length ? (
								(order.paymentAttempts || []).map((a) => (
									<div key={a.attemptId} className="flex items-start justify-between gap-3">
										<div>
											<div className="text-sm font-medium">Attempt</div>
											<div className="text-xs text-muted-foreground">Razorpay Order: {a.razorpayOrderId}</div>
											{a.reason ? <div className="text-xs text-muted-foreground">Reason: {a.reason}</div> : null}
										</div>
										<div className="text-right">
											<div className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</div>
											<div className="text-xs">
												{a.status === 'PAID' ? 'Paid' : a.status === 'FAILED' ? 'Failed' : 'Created'}
											</div>
										</div>
									</div>
								))
							) : (
								<div className="text-sm text-muted-foreground">No retry attempts recorded.</div>
							)}
						</div>
					</div>

					<Separator />

					<div className="space-y-2">
						<div className="text-sm font-medium">Items</div>
						{order.items.map((item) => (
							<div key={item.cartItemId} className="flex items-start justify-between gap-3">
								<div>
									<div className="text-sm font-medium">{item.pricingSnapshot?.title || 'Item'}</div>
									<div className="text-xs text-muted-foreground">
										{item.type} • {item.plan} • Qty {item.quantity}
									</div>
									{item.subscriptionSchedule?.nextServingDate || item.subscriptionSchedule?.scheduleEndDate ? (
										<div className="text-xs text-muted-foreground">
											{item.subscriptionSchedule?.nextServingDate ? `Upcoming Serving Date: ${item.subscriptionSchedule.nextServingDate}` : 'Upcoming Serving Date: —'}
											{item.subscriptionSchedule?.scheduleEndDate ? ` · End date: ${item.subscriptionSchedule.scheduleEndDate}` : ' · End date: —'}
										</div>
									) : null}
								</div>
								<div className="text-right">
									<div className="text-sm font-medium">{formatCurrency(item.pricingSnapshot?.lineTotal || 0)}</div>
									<div className="text-xs text-muted-foreground">
										{formatCurrency(item.pricingSnapshot?.unitPrice || 0)} each
									</div>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
