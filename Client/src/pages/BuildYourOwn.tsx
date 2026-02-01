import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertCircle,
	ArrowLeft,
	Check,
	Eye,
	Image as ImageIcon,
	Minus,
	Plus,
	Sparkles,
	Trash2,
	ShoppingCart,
	Flame,
	Dumbbell,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildYourOwnCatalogService } from '@/services/buildYourOwnCatalogService';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import type {
	BuildYourOwnConfig,
	BuildYourOwnItemEntity,
	BuildYourOwnItemTypeEntity,
	BuildYourOwnPurchaseMode,
	BuildYourOwnQuote,
} from '@/types/buildYourOwn';
import { formatCurrency } from '@/utils/formatCurrency';

const MODE_STORAGE_KEY = 'og.byob.mode';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const formatQtyUnit = (value: number, unit: string) => `${value}${unit}`;

const getRemainingToMinimum = (quote: BuildYourOwnQuote | null) => {
	if (!quote) return 0;
	return Math.max(0, (quote.minimumRequired || 0) - (quote.total || 0));
};

function useAnimatedNumber(value: number, opts?: { durationMs?: number }) {
	const durationMs = opts?.durationMs ?? 350;
	const [display, setDisplay] = useState(value);
	const rafRef = useRef<number | null>(null);
	const startRef = useRef<number | null>(null);
	const fromRef = useRef(value);
	const toRef = useRef(value);

	useEffect(() => {
		fromRef.current = display;
		toRef.current = value;
		startRef.current = null;
		if (rafRef.current) cancelAnimationFrame(rafRef.current);

		const step = (t: number) => {
			if (startRef.current == null) startRef.current = t;
			const elapsed = t - startRef.current;
			const p = clamp(elapsed / durationMs, 0, 1);
			// easeOutCubic
			const eased = 1 - Math.pow(1 - p, 3);
			const next = fromRef.current + (toRef.current - fromRef.current) * eased;
			setDisplay(next);
			if (p < 1) rafRef.current = requestAnimationFrame(step);
		};

		rafRef.current = requestAnimationFrame(step);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value]);

	return display;
}

function QuantityStepper({
	value,
	onChange,
	disabled,
	label,
}: {
	value: number;
	onChange: (next: number) => void;
	disabled?: boolean;
	label: string;
}) {
	const [shake, setShake] = useState(false);
	const holdRef = useRef<number | null>(null);
	const holdStartRef = useRef<number | null>(null);

	const stopHold = () => {
		if (holdRef.current) window.clearInterval(holdRef.current);
		holdRef.current = null;
		holdStartRef.current = null;
	};

	const bumpShake = () => {
		setShake(true);
		window.setTimeout(() => setShake(false), 250);
	};

	const change = (delta: number) => {
		if (disabled) return;
		const next = Math.max(0, value + delta);
		if (next === value && delta < 0) bumpShake();
		onChange(next);
	};

	const startHold = (delta: number) => {
		if (disabled) return;
		change(delta);
		if (holdRef.current) stopHold();
		holdStartRef.current = Date.now();
		holdRef.current = window.setInterval(() => {
			const elapsed = Date.now() - (holdStartRef.current || Date.now());
			// speed up slightly over time
			const stepDelta = delta;
			if (elapsed > 1200) {
				change(stepDelta);
				change(stepDelta);
				return;
			}
			change(stepDelta);
		}, 140);
	};

	useEffect(() => () => stopHold(), []);

	return (
		<div className="flex items-center gap-2">
			<div className={shake ? 'animate-[shake_250ms_ease-in-out]' : ''}>
				<Button
					variant="outline"
					size="icon"
					className="h-11 w-11 sm:h-9 sm:w-9"
					disabled={disabled || value === 0}
					onMouseDown={() => startHold(-1)}
					onMouseUp={stopHold}
					onMouseLeave={stopHold}
					onTouchStart={() => startHold(-1)}
					onTouchEnd={stopHold}
					aria-label={`${label}: decrease`}
				>
					<Minus className="h-4 w-4" />
				</Button>
			</div>
			<div className="w-10 text-center font-semibold text-oz-primary" aria-label={`${label}: quantity`}>
				{value}
			</div>
			<Button
				variant="outline"
				size="icon"
				className="h-11 w-11 sm:h-9 sm:w-9"
				disabled={disabled}
				onMouseDown={() => startHold(1)}
				onMouseUp={stopHold}
				onMouseLeave={stopHold}
				onTouchStart={() => startHold(1)}
				onTouchEnd={stopHold}
				aria-label={`${label}: increase`}
			>
				<Plus className="h-4 w-4" />
			</Button>
		</div>
	);
}

function TrayPreview({
	itemTypes,
	items,
	selections,
}: {
	itemTypes: BuildYourOwnItemTypeEntity[];
	items: BuildYourOwnItemEntity[];
	selections: Record<string, number>;
}) {
	const [isTrayOpen, setIsTrayOpen] = useState(false);
	const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
	const typesById = useMemo(() => new Map(itemTypes.map((t) => [t.id, t])), [itemTypes]);

	const groupedSelected = useMemo(() => {
		const groups = new Map<string, Array<{ item: BuildYourOwnItemEntity; qty: number }>>();
		for (const [itemId, qty] of Object.entries(selections)) {
			if (!qty) continue;
			const item = itemById.get(itemId);
			if (!item) continue;
			const typeId = item.itemTypeId;
			const arr = groups.get(typeId) || [];
			arr.push({ item, qty });
			groups.set(typeId, arr);
		}
		for (const [k, arr] of groups.entries()) {
			arr.sort((a, b) => (a.item.displayOrder ?? 0) - (b.item.displayOrder ?? 0));
			groups.set(k, arr);
		}
		return groups;
	}, [selections, itemById]);

	const hasAny = useMemo(() => Object.values(selections).some((q) => q > 0), [selections]);

	return (
		<>
			<Card className="border-oz-neutral/40 bg-gradient-to-br from-white to-oz-neutral/5 shadow-lg">
			<CardHeader className="pb-4 border-b border-oz-neutral/30">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-xl bg-gradient-to-br from-oz-primary to-oz-primary/80 flex items-center justify-center shadow-md">
							<Sparkles className="h-5 w-5 text-white" />
						</div>
						<div>
							<CardTitle className="text-oz-primary">Your Meal Tray</CardTitle>
							<div className="text-xs text-muted-foreground mt-0.5">Visual preview of your custom meal</div>
						</div>
					</div>
					{hasAny && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsTrayOpen(true)}
							className="flex items-center gap-2 text-oz-primary hover:bg-oz-primary hover:text-white transition-colors"
						>
							<Eye className="h-4 w-4" />
							View Tray
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent className="pt-5">
				<div className="relative overflow-hidden rounded-2xl border-2 border-oz-neutral/40 bg-gradient-to-br from-white via-oz-neutral/5 to-oz-neutral/10 p-5 sm:p-6 shadow-inner">
					<div className="absolute top-0 right-0 w-32 h-32 bg-oz-accent/5 rounded-full blur-3xl" />
					<div className="absolute bottom-0 left-0 w-32 h-32 bg-oz-primary/5 rounded-full blur-3xl" />
					<div className="relative">
						{!hasAny ? (
							<div className="text-center py-8">
								<div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-oz-accent/20 to-oz-primary/20 flex items-center justify-center border-2 border-dashed border-oz-neutral/40 mb-4">
									<Sparkles className="h-8 w-8 text-oz-primary/60" />
								</div>
								<div className="font-bold text-oz-primary text-lg">Start Building Your Meal</div>
								<div className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
									Select ingredients below and watch your custom meal come to life here
								</div>
							</div>
						) : (
							<div className="space-y-5">
								{[...groupedSelected.entries()]
									.sort((a, b) => (typesById.get(a[0])?.displayOrder ?? 0) - (typesById.get(b[0])?.displayOrder ?? 0))
									.map(([typeId, entries]) => {
										const t = typesById.get(typeId);
										return (
											<div key={typeId} className="animate-in fade-in slide-in-from-top-2 duration-300">
												<div className="flex items-center gap-2 mb-3">
													<div className="h-1 w-1 rounded-full bg-oz-accent" />
													<div className="text-xs font-bold text-oz-primary uppercase tracking-wider">
														{t?.name || 'Ingredients'}
													</div>
													<div className="h-px flex-1 bg-gradient-to-r from-oz-neutral/30 to-transparent" />
													<div className="text-xs font-semibold text-oz-accent bg-oz-accent/10 px-2 py-0.5 rounded-full">
														{entries.length} {entries.length === 1 ? 'item' : 'items'}
													</div>
												</div>
												<div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
													{entries.map(({ item, qty }) => (
														<div
															key={`${item.id}-${qty}`}
															className="group/tray relative animate-in fade-in zoom-in-95 duration-300"
															title={`${item.name} ×${qty}`}
														>
															<div className="aspect-square rounded-2xl border-2 border-oz-neutral/50 bg-white shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 hover:border-oz-accent/50 hover:-translate-y-1">
																{item.image?.url ? (
																	<img 
																		src={item.image.url} 
																		alt={item.image.alt || item.name} 
																		className="h-full w-full object-cover transition-transform duration-500 group-hover/tray:scale-110" 
																		loading="lazy" 
																	/>
																) : (
																	<div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20">
																		<ImageIcon className="h-6 w-6 text-muted-foreground" />
																	</div>
																)}
															</div>
															<div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-gradient-to-br from-oz-accent to-amber-500 text-white text-xs font-bold flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-oz-accent/20">
																{qty}
															</div>
															<div className="mt-1.5 text-center">
																<div className="text-[10px] font-semibold text-oz-primary truncate px-1">
																	{item.name}
																</div>
															</div>
														</div>
													))}
												</div>
											</div>
										);
									})}
							</div>
						)}
					</div>
				</div>
			</CardContent>
			</Card>

			<Drawer open={isTrayOpen} onOpenChange={setIsTrayOpen}>
				<DrawerContent className="max-h-[85vh]">
					<DrawerHeader className="pb-3 border-b border-oz-neutral/30">
						<DrawerTitle className="text-oz-primary flex items-center gap-2">
							<div className="h-9 w-9 rounded-xl bg-gradient-to-br from-oz-primary to-oz-primary/80 flex items-center justify-center">
								<Sparkles className="h-5 w-5 text-white" />
							</div>
							<span className="text-lg font-bold">Your Meal Tray</span>
						</DrawerTitle>
					</DrawerHeader>
					<div className="px-4 py-3 overflow-y-auto">
						{hasAny ? (
							<div className="space-y-4">
								{[...groupedSelected.entries()]
									.sort((a, b) => (typesById.get(a[0])?.displayOrder ?? 0) - (typesById.get(b[0])?.displayOrder ?? 0))
									.map(([typeId, entries]) => {
										const t = typesById.get(typeId);
										return (
											<div key={typeId}>
												<div className="flex items-center gap-2 mb-2">
													<div className="h-1 w-1 rounded-full bg-oz-accent" />
													<div className="text-xs font-bold text-oz-primary uppercase tracking-wider">
														{t?.name || 'Ingredients'}
													</div>
													<div className="h-px flex-1 bg-gradient-to-r from-oz-neutral/30 to-transparent" />
													<div className="text-xs font-semibold text-oz-accent bg-oz-accent/10 px-2 py-0.5 rounded-full">
														{entries.length} {entries.length === 1 ? 'item' : 'items'}
													</div>
												</div>
												<div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
													{entries.map(({ item, qty }) => (
														<div key={`drawer-${item.id}-${qty}`} className="relative group">
															<div className="aspect-[4/3] rounded-xl border-2 border-oz-neutral/40 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-oz-accent/50">
																{item.image?.url ? (
																	<img 
																		src={item.image.url} 
																		alt={item.image.alt || item.name} 
																		className="h-full w-full object-cover transition-transform group-hover:scale-105" 
																		loading="lazy" 
																	/>
																) : (
																	<div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20">
																		<ImageIcon className="h-6 w-6 text-muted-foreground" />
																	</div>
																)}
															</div>
															<div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-gradient-to-br from-oz-accent to-amber-500 text-white text-xs font-bold flex items-center justify-center shadow-md border-2 border-white">
																{qty}
															</div>
															<div className="mt-1 text-center">
																<div className="text-[10px] font-semibold text-oz-primary truncate px-0.5">
																	{item.name}
																</div>
															</div>
														</div>
													))}
												</div>
											</div>
										);
									})}
							</div>
						) : (
							<div className="text-center py-8">
								<div className="text-muted-foreground">No items in your tray yet</div>
							</div>
						)}
					</div>
					<DrawerFooter className="pt-3 pb-4 border-t border-oz-neutral/30">
						<DrawerClose asChild>
							<Button 
								className="w-full bg-oz-primary hover:bg-oz-primary/90 text-white font-semibold shadow-md"
							>
								Close
							</Button>
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</>
	);
}

export default function BuildYourOwn() {
	const { addItem } = useCart();
	const { toast } = useToast();
	const [itemTypes, setItemTypes] = useState<BuildYourOwnItemTypeEntity[]>([]);
	const [items, setItems] = useState<BuildYourOwnItemEntity[]>([]);
	const [config, setConfig] = useState<BuildYourOwnConfig | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [activeTab, setActiveTab] = useState<string>('');
	const [mode, setMode] = useState<BuildYourOwnPurchaseMode>(() => {
		// Persist within the SPA session only; do not restore after a full page reload.
		const saved = window.sessionStorage.getItem(MODE_STORAGE_KEY);
		return saved === 'single' || saved === 'weekly' || saved === 'monthly' ? saved : 'weekly';
	});
	const [selections, setSelections] = useState<Record<string, number>>({});
	const [justAdded, setJustAdded] = useState(false);

	const [quote, setQuote] = useState<BuildYourOwnQuote | null>(null);
	const [quoteLoading, setQuoteLoading] = useState(false);
	const quoteDebounceRef = useRef<number | null>(null);

	useEffect(() => {
		window.sessionStorage.setItem(MODE_STORAGE_KEY, mode);
	}, [mode]);

	useEffect(() => {
		// Clear mode on full reload/refresh to match UX requirement.
		const clear = () => window.sessionStorage.removeItem(MODE_STORAGE_KEY);
		window.addEventListener('beforeunload', clear);
		window.addEventListener('pagehide', clear);
		return () => {
			window.removeEventListener('beforeunload', clear);
			window.removeEventListener('pagehide', clear);
		};
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		Promise.all([
			buildYourOwnCatalogService.listItemTypes({ signal: controller.signal }),
			buildYourOwnCatalogService.listItems({ signal: controller.signal }),
			buildYourOwnCatalogService.getConfig({ signal: controller.signal }),
		])
			.then(([typesRes, itemsRes, cfgRes]) => {
				setItemTypes(typesRes.data);
				setItems(itemsRes.data);
				setConfig(cfgRes.data);
				const activeTypes = typesRes.data.filter((t) => t.isActive !== false && !t.deletedAt);
				if (!activeTab && activeTypes.length > 0) setActiveTab(activeTypes[0].id);
			})
			.catch((e) => setError(e instanceof Error ? e.message : 'Failed to load Build-your-own catalog'))
			.finally(() => setLoading(false));

		return () => controller.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const activeItemTypes = useMemo(() => {
		return [...itemTypes]
			.filter((t) => t.isActive !== false && !t.deletedAt)
			.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
	}, [itemTypes]);

	const activeItems = useMemo(() => {
		return items.filter((i) => i.isActive !== false && !i.deletedAt && i.itemTypeRef?.isActive !== false);
	}, [items]);

	const byType = useMemo(() => {
		const groups = new Map<string, BuildYourOwnItemEntity[]>();
		for (const t of activeItemTypes) groups.set(t.id, []);
		for (const item of activeItems) {
			const arr = groups.get(item.itemTypeId) || [];
			arr.push(item);
			groups.set(item.itemTypeId, arr);
		}
		for (const [k, arr] of groups.entries()) {
			arr.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
			groups.set(k, arr);
		}
		return groups;
	}, [activeItems, activeItemTypes]);

	const selectionList = useMemo(() => {
		return Object.entries(selections)
			.filter(([, q]) => q > 0)
			.map(([itemId, quantity]) => ({ itemId, quantity }));
	}, [selections]);

	useEffect(() => {
		const controller = new AbortController();
		if (quoteDebounceRef.current) window.clearTimeout(quoteDebounceRef.current);
		setQuoteLoading(true);
		quoteDebounceRef.current = window.setTimeout(() => {
			buildYourOwnCatalogService
				.quote({ mode, selections: selectionList }, { signal: controller.signal })
				.then((res) => setQuote(res.data))
				.catch((e) => {
					if (e?.name === 'CanceledError') return;
				})
				.finally(() => setQuoteLoading(false));
		}, 250);

		return () => {
			controller.abort();
			if (quoteDebounceRef.current) window.clearTimeout(quoteDebounceRef.current);
		};
	}, [mode, selectionList]);

	const hasSelections = useMemo(() => Object.values(selections).some((q) => q > 0), [selections]);
	const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

	const selectedDetails = useMemo(() => {
		const lines = quote?.lineItems || [];
		return lines
			.map((l) => {
				const item = itemById.get(l.itemId);
				if (!item) return null;
				return { itemId: l.itemId, name: item.name, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal };
			})
			.filter((x): x is NonNullable<typeof x> => Boolean(x));
	}, [quote?.lineItems, itemById]);

	const updateQty = (itemId: string, delta: number) => {
		setSelections((prev) => {
			const current = prev[itemId] || 0;
			const nextQty = Math.max(0, current + delta);
			if (nextQty === 0) {
				const { [itemId]: _, ...rest } = prev;
				return rest;
			}
			return { ...prev, [itemId]: nextQty };
		});
	};

	const totalAnimated = useAnimatedNumber(quote?.total || 0);
	const proteinAnimated = useAnimatedNumber(quote?.proteinGrams || 0);
	const caloriesAnimated = useAnimatedNumber(typeof quote?.calories === 'number' ? quote.calories : 0);

	const Summary = (
		<Card className="border-oz-neutral/40 bg-white/95 backdrop-blur">
			<CardHeader className="pb-3">
				<CardTitle className="text-oz-primary">Live Summary</CardTitle>
				<div className="text-xs text-muted-foreground">Totals and minimums are computed by the server.</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-2xl border bg-oz-neutral/5 p-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<div className="text-xs text-muted-foreground">Mode</div>
							<div className="mt-1 font-semibold text-oz-primary">
								{mode === 'single' ? 'Single order' : mode === 'weekly' ? 'Weekly subscription' : 'Monthly subscription'}
							</div>
							<div className="text-[11px] text-muted-foreground mt-1">
								{mode === 'single' ? 'One-time purchase.' : 'Per-period subscription total. Servings shown in cart/checkout.'}
							</div>
							{quoteLoading ? <div className="text-[11px] text-muted-foreground mt-1">Updating…</div> : null}
						</div>
						<div className="text-right">
							<div className="text-xs text-muted-foreground">Total</div>
							<div className="mt-1 text-lg font-bold text-oz-primary">{formatCurrency(Math.round(totalAnimated))}</div>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-3 gap-3">
					<div className="rounded-2xl border bg-oz-neutral/10 p-3">
						<div className="flex items-center gap-1 text-[11px] text-muted-foreground">
							<Dumbbell className="h-3.5 w-3.5" /> Protein
						</div>
						<div className="mt-1 font-semibold text-oz-primary">{Math.round(proteinAnimated)}g</div>
					</div>
					<div className="rounded-2xl border bg-oz-neutral/10 p-3">
						<div className="flex items-center gap-1 text-[11px] text-muted-foreground">
							<Flame className="h-3.5 w-3.5" /> Calories
						</div>
						<div className="mt-1 font-semibold text-oz-primary">{quote?.calories == null ? '—' : Math.round(caloriesAnimated)}</div>
					</div>
					<div className="rounded-2xl border bg-oz-neutral/10 p-3">
						<div className="text-[11px] text-muted-foreground">Ingredients</div>
						<div className="mt-1 font-semibold text-oz-primary">{selectedDetails.length}</div>
					</div>
				</div>

				<Separator />

				{/* Minimum progress */}
				{(mode === 'weekly' || mode === 'monthly') && quote ? (
					(() => {
						const remaining = getRemainingToMinimum(quote);
						const progress = quote.minimumRequired > 0 ? clamp(quote.total / quote.minimumRequired, 0, 1) : 0;
						const met = quote.meetsMinimum;
						return (
							<div className={met ? 'rounded-2xl border border-green-200 bg-green-50 p-4' : 'rounded-2xl border border-amber-200 bg-amber-50 p-4'}>
								<div className="flex items-start gap-3">
									<div className={met ? 'mt-0.5 rounded-full bg-green-100 p-1' : 'mt-0.5 rounded-full bg-amber-100 p-1'}>
										{met ? <Check className="h-4 w-4 text-green-700" /> : <AlertCircle className="h-4 w-4 text-amber-700" />}
									</div>
									<div className="min-w-0 flex-1">
										<div className={met ? 'text-sm font-semibold text-green-900' : 'text-sm font-semibold text-amber-900'}>
											{met ? 'Minimum unlocked' : `₹${Math.round(remaining)} more to unlock ${mode} subscription`}
										</div>
										<div className={met ? 'text-xs text-green-800/80 mt-0.5' : 'text-xs text-amber-800/80 mt-0.5'}>
											Minimum: {formatCurrency(quote.minimumRequired)} • Current: {formatCurrency(quote.total)}
										</div>
										<div className="mt-3 h-2 w-full rounded-full bg-white/70 border border-white/60 overflow-hidden">
											<div
												className={met ? 'h-full bg-green-500 transition-all duration-500' : 'h-full bg-amber-500 transition-all duration-500'}
												style={{ width: `${Math.round(progress * 100)}%` }}
											/>
										</div>
									</div>
								</div>
							</div>
						);
					})()
				) : null}

				<div className="space-y-2">
					<div className="text-sm font-semibold text-oz-primary">Purchase mode</div>
					<div className="grid grid-cols-3 gap-2">
						<Button
							variant={mode === 'single' ? 'default' : 'outline'}
							className={mode === 'single' ? 'bg-oz-accent hover:bg-oz-accent/90' : ''}
							onClick={() => setMode('single')}
						>
							Single
						</Button>
						<Button
							variant={mode === 'weekly' ? 'default' : 'outline'}
							className={mode === 'weekly' ? 'bg-oz-accent hover:bg-oz-accent/90 relative' : 'relative'}
							onClick={() => setMode('weekly')}
						>
							Weekly
						</Button>
						<Button
							variant={mode === 'monthly' ? 'default' : 'outline'}
							className={mode === 'monthly' ? 'bg-oz-accent hover:bg-oz-accent/90' : ''}
							onClick={() => setMode('monthly')}
						>
							Monthly
						</Button>
					</div>
				</div>

				<div className="rounded-2xl border bg-white p-3">
					<div className="flex items-center justify-between">
						<div className="text-sm font-semibold text-oz-primary">Selected ingredients</div>
						<div className="text-xs text-muted-foreground">{selectedDetails.length} items</div>
					</div>
					{selectedDetails.length === 0 ? (
						<div className="text-sm text-muted-foreground mt-2">No ingredients selected yet.</div>
					) : (
						<div className="mt-3 space-y-2">
							{selectedDetails.map((item) => (
								<div key={item.itemId} className="flex items-center justify-between gap-3 rounded-xl border bg-oz-neutral/5 p-2">
									<div className="min-w-0">
										<div className="text-sm font-medium text-oz-primary truncate">{item.name}</div>
										<div className="text-[11px] text-muted-foreground">
											{item.quantity}× · {formatCurrency(item.unitPrice)} each · {formatCurrency(item.lineTotal)}
										</div>
									</div>
									<div className="flex items-center gap-1">
										<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.itemId, -1)} aria-label={`Decrease ${item.name}`}>
											<Minus className="h-4 w-4" />
										</Button>
										<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.itemId, 1)} aria-label={`Increase ${item.name}`}>
											<Plus className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={() =>
												setSelections((prev) => {
													const { [item.itemId]: _, ...rest } = prev;
													return rest;
												})
											}
											title="Remove"
											aria-label={`Remove ${item.name}`}
										>
											<Trash2 className="h-4 w-4 text-muted-foreground" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="relative">
					<Button
						className={justAdded ? 'w-full bg-green-600 hover:bg-green-600/90 transition-all' : 'w-full bg-oz-secondary hover:bg-oz-secondary/90 transition-all'}
						disabled={
							!hasSelections ||
							quoteLoading ||
							!quote ||
							((mode === 'weekly' || mode === 'monthly') && !quote.meetsMinimum)
						}
						onClick={() => {
						if (!hasSelections) {
							toast({ title: 'Select ingredients', description: 'Choose at least one ingredient before adding to cart.', variant: 'destructive' });
							return;
						}
						if (!quote) {
							toast({ title: 'Please wait', description: 'Computing BYO totals…', variant: 'destructive' });
							return;
						}
						if ((mode === 'weekly' || mode === 'monthly') && !quote.meetsMinimum) {
							toast({
								title: 'Minimum not met',
								description: `Minimum ${mode} order is ${formatCurrency(quote.minimumRequired)}.`,
								variant: 'destructive',
							});
							return;
						}

						addItem({
							type: 'byo',
							plan: mode,
							selections: selectionList,
							quantity: 1,
							byoSnapshot: {
								plan: mode,
								total: quote.total,
								proteinGrams: quote.proteinGrams,
								calories: quote.calories,
								minimumRequired: quote.minimumRequired,
								meetsMinimum: quote.meetsMinimum,
								lineItems: quote.lineItems,
								ingredients: selectedDetails,
							},
						} as Parameters<typeof addItem>[0]);

							toast({ title: 'Added to cart', description: `Build Your Own (${mode}) added to cart.` });
							setJustAdded(true);
							window.setTimeout(() => setJustAdded(false), 1400);
					}}
				>
						{justAdded ? (
							<span className="inline-flex items-center gap-2">
								<Check className="h-4 w-4" /> Added
							</span>
						) : (
							<span className="inline-flex items-center gap-2">
								<ShoppingCart className="h-4 w-4" /> Add to Cart
							</span>
						)}
				</Button>
					{justAdded ? (
						<div className="absolute -top-12 left-0 right-0 mx-auto w-full">
							<div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 shadow-sm flex items-center justify-between gap-2">
								<span className="font-medium">Added to cart</span>
								<Link to="/cart" className="text-sm font-semibold text-oz-primary hover:underline">View cart</Link>
							</div>
						</div>
					) : null}
				</div>
			</CardContent>
		</Card>
	);

	return (
		<div className="animate-fade-in">
			<section 
				className="relative bg-oz-primary text-white py-12 md:py-16 overflow-hidden"
				style={{
					backgroundImage: 'url(/home/build-own-banner.png)',
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					backgroundRepeat: 'no-repeat'
				}}
			>
				{/* Overlay */}
				<div className="absolute inset-0 bg-oz-primary/70"></div>
				
				{/* Content */}
				<div className="container mx-auto px-4 relative z-10">
					<Link to="/" className="inline-flex items-center text-white/90 hover:text-white text-sm font-medium transition-colors">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back
					</Link>
					<div className="max-w-3xl mx-auto text-center mt-6">
						<h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">Build Your Own Meal</h1>
						<p className="text-lg text-white/90 max-w-2xl mx-auto mb-0">
							Customize ingredients. Live protein & pricing. Add your build to cart to checkout.
						</p>
					</div>
				</div>
			</section>

			<section className="py-8 md:py-10 bg-oz-neutral/30">
				<div className="container mx-auto px-4">
					{error ? (
						<div className="rounded-2xl border bg-white p-6">
							<div className="font-semibold text-oz-primary">Couldn’t load ingredients</div>
							<div className="text-sm text-muted-foreground mt-1">{error}</div>
						</div>
					) : (
						<div className="grid grid-cols-1 xl:grid-cols-[340px_1fr_380px] gap-6">
							{/* Left Column - Dynamic Tray */}
							<div className="order-2 xl:order-1">
								{loading ? (
									<Card className="border-oz-neutral/40 bg-white">
										<CardHeader className="pb-3">
											<CardTitle className="text-oz-primary">Your Meal Tray</CardTitle>
											<div className="text-sm text-muted-foreground">Loading preview…</div>
										</CardHeader>
										<CardContent>
											<div className="h-24 rounded-2xl bg-oz-neutral/20 animate-pulse" />
										</CardContent>
									</Card>
								) : (
									<div className="xl:sticky xl:top-24">
										<TrayPreview itemTypes={activeItemTypes} items={activeItems} selections={selections} />
									</div>
								)}
							</div>

							{/* Center Column - Ingredients Selection */}
							<div className="order-1 xl:order-2 space-y-5">
								<Card className="border-oz-neutral/40 bg-gradient-to-br from-white to-oz-neutral/5 shadow-lg">
									<CardHeader className="pb-4 border-b border-oz-neutral/30">
										<div className="flex items-center gap-3">
											<div className="h-10 w-10 rounded-xl bg-gradient-to-br from-oz-accent to-amber-500 flex items-center justify-center shadow-md">
												<Sparkles className="h-5 w-5 text-white" />
											</div>
											<div>
												<CardTitle className="text-oz-primary">Select Ingredients</CardTitle>
												<div className="text-xs text-muted-foreground mt-0.5">Pick quantities per serving. Summary updates instantly.</div>
											</div>
										</div>
									</CardHeader>
									<CardContent className="pt-5">
										{loading ? (
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												{Array.from({ length: 6 }).map((_, i) => (
													<div key={i} className="rounded-2xl border border-oz-neutral/50 bg-white overflow-hidden shadow-sm">
														<div className="aspect-[4/3] w-full bg-oz-neutral/20 animate-pulse" />
														<div className="p-4 space-y-3">
															<div className="h-4 w-2/3 bg-oz-neutral/20 rounded animate-pulse" />
															<div className="h-3 w-full bg-oz-neutral/10 rounded animate-pulse" />
															<div className="h-9 w-full bg-oz-neutral/20 rounded-xl animate-pulse" />
														</div>
													</div>
												))}
											</div>
										) : activeItemTypes.length === 0 ? (
											<div className="text-sm text-muted-foreground">No Build-your-own categories available yet.</div>
										) : (
											<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
												<div className="bg-gradient-to-r from-oz-neutral/20 via-oz-neutral/10 to-oz-neutral/20 rounded-xl p-3 mb-5">
													<TabsList className="flex w-full flex-wrap justify-start gap-2 bg-transparent p-0">
														{activeItemTypes.map((t) => (
															<TabsTrigger 
																key={t.id} 
																value={t.id}
																className="relative rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:text-oz-primary hover:bg-white/60 data-[state=active]:bg-gradient-to-br data-[state=active]:from-oz-primary data-[state=active]:to-oz-primary/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-[1.02]"
															>
																{t.name}
															</TabsTrigger>
														))}
													</TabsList>
												</div>

												{activeItemTypes.map((t) => (
													<TabsContent key={t.id} value={t.id} className="mt-4">
														{(byType.get(t.id) || []).length === 0 ? (
															<div className="text-sm text-muted-foreground">No items in this category yet.</div>
														) : (
															<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
																{(byType.get(t.id) || []).map((item) => {
																	const qty = selections[item.id] || 0;
																	const unitPrice = item.pricing?.[mode] ?? 0;
																	const disabled = item.isActive === false;
																	const highProtein = typeof item.proteinGrams === 'number' && item.proteinGrams >= 20;
																	return (
																		<Card
																			key={item.id}
																			className={
																				(
																					disabled
																						? 'opacity-60 border-oz-neutral/50'
																						: qty > 0
																							? 'border-oz-neutral/70 shadow-md'
																							: 'border-oz-neutral/50 shadow-sm'
																				) + ' transition-all duration-200 will-change-transform hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01]'
																			}
																		>
																				<CardContent className="relative p-0 overflow-hidden rounded-2xl group">
																				<div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-oz-primary/10 via-oz-secondary/10 to-oz-accent/10">
																					{item.image?.url ? (
																						<img
																							src={item.image.url}
																								alt={item.image.alt || item.name}
																								className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
																								loading="lazy"
																							/>
																					) : (
																						<div className="h-full w-full flex items-center justify-center">
																							<ImageIcon className="h-6 w-6 text-muted-foreground" />
																						</div>
																					)}
																					<div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
																					{highProtein ? (
																						<span className="absolute top-3 right-3 rounded-full bg-oz-secondary text-white px-3 py-1 text-xs font-semibold shadow">High Protein</span>
																					) : null}
																					{disabled ? (
																						<span className="absolute top-3 left-3 rounded-full bg-black/60 text-white px-3 py-1 text-xs font-semibold">Unavailable</span>
																					) : null}
																				</div>

																				<div className="p-4">
																					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
																						<div className="min-w-0">
																							<div className="font-semibold text-oz-primary truncate">{item.name}</div>
																							<div className="mt-1 flex flex-wrap items-center gap-2">
																								<span className="inline-flex items-center rounded-full border border-oz-neutral/60 bg-white px-2.5 py-1 text-[11px] font-medium text-oz-primary">
																								{formatQtyUnit(item.quantityValue, item.quantityUnit)}
																								</span>
																								{typeof item.proteinGrams === 'number' ? (
																									<span className="inline-flex items-center gap-1 rounded-full bg-oz-secondary/10 text-oz-primary px-2.5 py-1 text-[11px] font-medium">
																										<Dumbbell className="h-3.5 w-3.5 text-oz-secondary" /> +{item.proteinGrams}g
																									</span>
																								) : null}
																								{typeof item.calories === 'number' ? (
																									<span className="inline-flex items-center gap-1 rounded-full bg-oz-neutral/30 text-oz-primary px-2.5 py-1 text-[11px] font-medium">
																										<Flame className="h-3.5 w-3.5 text-oz-accent" /> {item.calories} kcal
																									</span>
																								) : null}
																							</div>
																							<div className="mt-2 text-xs text-muted-foreground">
																								{formatCurrency(unitPrice)} <span className="text-muted-foreground/70">({mode})</span>
																							</div>
																						</div>
																						<div className={qty > 0 ? 'transition-transform duration-200 w-full sm:w-auto' : 'transition-transform duration-200 w-full sm:w-auto'}>
																							<QuantityStepper
																									value={qty}
																									onChange={(next) => setSelections((prev) => ({ ...prev, [item.id]: next }))}
																									disabled={disabled}
																									label={item.name}
																								/>
																							<div className="mt-2 flex flex-wrap gap-1 justify-start sm:justify-end">
																									<Button
																									variant="ghost"
																									size="sm"
																									className="h-9 px-3"
																									onClick={() => setSelections((prev) => ({ ...prev, [item.id]: Math.max(prev[item.id] || 0, 1) }))}
																									disabled={disabled}
																								>
																									1×
																								</Button>
																									<Button
																									variant="ghost"
																									size="sm"
																									className="h-9 px-3"
																									onClick={() => setSelections((prev) => ({ ...prev, [item.id]: Math.max(prev[item.id] || 0, 2) }))}
																									disabled={disabled}
																								>
																									2×
																								</Button>
																									<Button
																									variant="ghost"
																									size="sm"
																									className="h-9 px-3"
																									onClick={() => setSelections((prev) => ({ ...prev, [item.id]: Math.max(prev[item.id] || 0, 3) }))}
																									disabled={disabled}
																								>
																									3×
																								</Button>
																								</div>
																						</div>
																					</div>

																					</div>
																			</CardContent>
																		</Card>
																);
															})}
															</div>
														)}
													</TabsContent>
												))}
											</Tabs>
										)}
									</CardContent>
								</Card>

								<div className="rounded-2xl border border-oz-neutral/50 bg-white p-5 shadow-sm">
									<div className="flex items-start gap-3">
										<div className="mt-0.5 h-9 w-9 rounded-xl bg-oz-secondary/10 flex items-center justify-center">
											<Sparkles className="h-5 w-5 text-oz-secondary" />
										</div>
										<div>
											<div className="font-semibold text-oz-primary">Minimum order rules</div>
											<div className="text-sm text-muted-foreground mt-1">
												Weekly minimum: {formatCurrency(config?.minimumWeeklyOrderAmount || 0)} · Monthly minimum: {formatCurrency(config?.minimumMonthlyOrderAmount || 0)}
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Right Column - Live Summary */}
							<div className="order-3 xl:order-3">
								<div className="xl:sticky xl:top-24">{Summary}</div>
							</div>
						</div>
					)}
				</div>
			</section>

			<div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
				<div className="container mx-auto px-4 flex items-center justify-between gap-3">
					<div className="min-w-0">
						<div className="text-xs text-muted-foreground">Build-your-own</div>
						<div className="font-semibold text-oz-primary truncate">
							{formatCurrency(quote?.total || 0)} · {quote?.proteinGrams || 0}g protein
						</div>
						{(mode === 'weekly' || mode === 'monthly') && quote ? (
							<div className={quote.meetsMinimum ? 'mt-1 text-xs text-green-700' : 'mt-1 text-xs text-amber-700'}>
								{quote.meetsMinimum ? 'Minimum met' : `${formatCurrency(getRemainingToMinimum(quote))} to minimum`}
							</div>
						) : null}
					</div>
					<Drawer>
						<DrawerTrigger asChild>
							<Button variant="outline" className="h-11">View summary</Button>
						</DrawerTrigger>
						<DrawerContent>
							<DrawerHeader>
								<div className="flex items-center justify-between gap-3">
									<DrawerTitle>Summary</DrawerTitle>
									<DrawerClose asChild>
										<Button variant="ghost" className="h-9 px-3">Back to ingredients</Button>
									</DrawerClose>
								</div>
							</DrawerHeader>
							<div className="p-4 max-h-[75vh] overflow-auto">{Summary}</div>
							<DrawerFooter>
								<DrawerClose asChild>
									<Button variant="outline" className="h-11">Back to ingredients</Button>
								</DrawerClose>
							</DrawerFooter>
						</DrawerContent>
					</Drawer>
				</div>
			</div>
		</div>
	);
}
