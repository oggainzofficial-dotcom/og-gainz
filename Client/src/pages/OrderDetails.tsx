import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CalendarDays, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import type { CartOrderDetails } from '@/types/cartPhase4';

const CUTOFF_HOUR_LOCAL = 19; // 7 PM

const toYyyyMmDd = (d: Date) => {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d: Date, days: number) => {
	const next = new Date(d);
	next.setDate(next.getDate() + days);
	return next;
};

const buildTimeOptions = (min: string, max: string, stepMinutes: number) => {
	const toMinutes = (hhmm: string) => {
		const [hh, mm] = hhmm.split(':').map((x) => Number(x));
		return hh * 60 + mm;
	};
	const toHhMm = (total: number) => {
		const hh = String(Math.floor(total / 60)).padStart(2, '0');
		const mm = String(total % 60).padStart(2, '0');
		return `${hh}:${mm}`;
	};

	const start = toMinutes(min);
	const end = toMinutes(max);
	const step = Math.max(1, stepMinutes);

	const out: string[] = [];
	for (let m = start; m <= end; m += step) out.push(toHhMm(m));
	return out;
};

const DELIVERY_TIME_OPTIONS = buildTimeOptions('06:00', '23:00', 15);

export default function OrderDetails() {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { state, quote, isQuoting, quoteError, setOrderDetails } = useCart();

	useEffect(() => {
		if (!state.items.length) {
			navigate('/cart');
		}
	}, [navigate, state.items.length]);

	const now = useMemo(() => new Date(), []);
	const isAfterCutoff = useMemo(() => now.getHours() >= CUTOFF_HOUR_LOCAL, [now]);
	const minStartDate = useMemo(() => (isAfterCutoff ? toYyyyMmDd(addDays(now, 1)) : toYyyyMmDd(now)), [isAfterCutoff, now]);

	const itemsForUi = useMemo(() => {
		const quoteById = new Map((quote?.items || []).map((i) => [i.cartItemId, i]));
		return state.items.map((i) => ({
			id: i.id,
			type: i.type,
			plan: i.plan,
			title: quoteById.get(i.id)?.title || (i.type === 'byo' ? 'Build Your Own' : 'Cart item'),
		}));
	}, [quote?.items, state.items]);

	const validateDetailsForItem = useCallback((plan: string, details: CartOrderDetails | undefined) => {
		if (!details) return { ok: false, reason: 'Missing order details' };

		const startDate = details.startDate;
		const deliveryTime = details.deliveryTime;
		const immediate = Boolean(details.immediateDelivery);

		if (plan === 'weekly' || plan === 'monthly') {
			if (!startDate || !deliveryTime) return { ok: false, reason: 'Start date and delivery time are required' };
			if (startDate < minStartDate) return { ok: false, reason: `Start date must be ${minStartDate} or later` };
			return { ok: true };
		}

		// trial / single
		if (immediate) {
			if (isAfterCutoff) return { ok: false, reason: 'Immediate delivery is unavailable after cutoff time' };

			const cutoff = new Date(now);
			cutoff.setHours(CUTOFF_HOUR_LOCAL, 0, 0, 0);
			const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
			if (oneHourFromNow > cutoff) {
				return { ok: false, reason: 'Immediate delivery must be within 1 hour and before cutoff time' };
			}
			return { ok: true };
		}

		if (!startDate || !deliveryTime) return { ok: false, reason: 'Choose Immediate Delivery or select date/time' };
		if (startDate < minStartDate) return { ok: false, reason: `Start date must be ${minStartDate} or later` };
		return { ok: true };
	}, [isAfterCutoff, minStartDate, now]);

	const validationByItemId = useMemo(() => {
		const out = new Map<string, { ok: boolean; reason?: string }>();
		for (const item of itemsForUi) {
			const details = state.orderDetailsByItemId?.[item.id];
			out.set(item.id, validateDetailsForItem(item.plan, details));
		}
		return out;
	}, [itemsForUi, state.orderDetailsByItemId, validateDetailsForItem]);

	const canProceed = useMemo(() => {
		if (isQuoting) return false;
		if (quoteError) return false;
		if (!state.items.length) return false;
		for (const item of itemsForUi) {
			const v = validationByItemId.get(item.id);
			if (!v?.ok) return false;
		}
		return true;
	}, [isQuoting, itemsForUi, quoteError, state.items.length, validationByItemId]);

	const setForItem = (itemId: string, patch: Partial<CartOrderDetails>) => {
		const prev = state.orderDetailsByItemId?.[itemId] || {};
		setOrderDetails(itemId, { ...prev, ...patch });
	};

	return (
		<div className="animate-fade-in">
			<div className="bg-oz-neutral/30 border-b border-oz-neutral">
				<div className="container mx-auto px-4 py-4">
					<Link to="/cart" className="inline-flex items-center text-sm text-muted-foreground hover:text-oz-primary transition-colors">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Cart
					</Link>
				</div>
			</div>

			<div className="container mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold text-oz-primary mb-2">Order Details</h1>
				<p className="text-muted-foreground">Set start date and delivery time for each item before payment.</p>

				{isAfterCutoff ? (
					<div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-2">
						<AlertTriangle className="h-4 w-4 mt-0.5" />
						<div>
							<div className="font-semibold">Cutoff time passed</div>
							<div className="text-amber-800">After {CUTOFF_HOUR_LOCAL}:00, earliest start date becomes {minStartDate}.</div>
						</div>
					</div>
				) : null}

				{quoteError ? (
					<div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-oz-primary">
						{quoteError}
					</div>
				) : null}

				<div className="mt-8 space-y-4">
					{itemsForUi.map((item) => {
						const details = state.orderDetailsByItemId?.[item.id] || {};
						const validation = validationByItemId.get(item.id);
						const isSub = item.plan === 'weekly' || item.plan === 'monthly';
						const isSingleOrTrial = item.plan === 'single' || item.plan === 'trial';

						return (
							<Card key={item.id}>
								<CardHeader className="pb-3">
									<CardTitle className="text-oz-primary">{item.title}</CardTitle>
									<div className="text-xs text-muted-foreground capitalize">{item.type} • {item.plan}</div>
								</CardHeader>
								<CardContent className="space-y-4">
									{isSingleOrTrial ? (
										<div className="rounded-lg border bg-oz-neutral/10 p-3">
											<div className="flex items-center justify-between gap-3">
												<div className="flex items-center gap-2">
													<Clock className="h-4 w-4 text-oz-secondary" />
													<div className="text-sm font-medium text-oz-primary">Immediate Delivery (≤ 1 hour)</div>
												</div>
												<Button
													variant={details.immediateDelivery ? 'default' : 'outline'}
													className={details.immediateDelivery ? 'bg-oz-accent hover:bg-oz-accent/90' : ''}
													disabled={isAfterCutoff}
													onClick={() => setForItem(item.id, { immediateDelivery: !details.immediateDelivery })}
												>
													{details.immediateDelivery ? 'Selected' : 'Select'}
												</Button>
											</div>
											<div className="text-xs text-muted-foreground mt-2">
												If you don’t select Immediate Delivery, choose a date and time below.
											</div>
										</div>
									) : null}

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div>
											<div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
												<CalendarDays className="h-4 w-4" /> Start date
											</div>
											<Input
												type="date"
												value={details.startDate || ''}
												min={minStartDate}
												disabled={Boolean(details.immediateDelivery) && isSingleOrTrial}
												onChange={(e) => setForItem(item.id, { startDate: e.target.value })}
											/>
										</div>
										<div>
											<div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
												<Clock className="h-4 w-4" /> Delivery time
											</div>
											<Select
												disabled={Boolean(details.immediateDelivery) && isSingleOrTrial}
												value={details.deliveryTime || ''}
												onValueChange={(v) => setForItem(item.id, { deliveryTime: v })}
											>
												<SelectTrigger className="h-10">
													<SelectValue placeholder="Select time" />
												</SelectTrigger>
												<SelectContent className="max-h-52">
													{DELIVERY_TIME_OPTIONS.map((t) => (
														<SelectItem key={t} value={t}>
															{t}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>

									{isSub ? (
										<div className="text-xs text-muted-foreground">
											Weekly/Monthly subscriptions require a start date and a daily delivery time.
										</div>
									) : null}

									{validation && !validation.ok ? (
										<div className="text-sm text-destructive">{validation.reason}</div>
									) : null}
								</CardContent>
							</Card>
						);
					})}
				</div>

				<Separator className="my-8" />

				<div className="flex justify-end gap-3">
					<Button variant="outline" onClick={() => navigate('/cart')}>Back</Button>
					<Button
						disabled={!canProceed}
						className="bg-oz-accent hover:bg-oz-accent/90"
						onClick={() => {
							if (!canProceed) {
								toast({ title: 'Complete order details', description: 'Please fill all required fields before proceeding.', variant: 'destructive' });
								return;
							}
							navigate('/checkout');
						}}
					>
						Proceed to Payment
					</Button>
				</div>
			</div>
		</div>
	);
}
