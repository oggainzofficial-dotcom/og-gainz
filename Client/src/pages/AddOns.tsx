import { useEffect, useMemo, useState, useTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CupSoda, Dumbbell, Leaf, Sparkles, Wheat, Minus, Plus, ShoppingCart, Check } from 'lucide-react';
import { addonsCatalogService } from '@/services/addonsCatalogService';
import type { Addon, AddonImage } from '@/types/catalog';
import { formatCurrency } from '@/utils/formatCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/context/CartContext';


const categoryMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
	protein: { label: 'Protein', icon: Dumbbell },
	carbs: { label: 'Carbs', icon: Wheat },
	salad: { label: 'Salads', icon: Leaf },
	shake: { label: 'Shakes', icon: CupSoda },
	custom: { label: 'Custom', icon: Sparkles },
};

const DEFAULT_SERVINGS = {
	weekly: 5,
	monthly: 20,
} as const;

const titleCaseFromSlug = (slug: string) => {
	const s = (slug || '').replace(/[-_]+/g, ' ').trim();
	if (!s) return 'Other';
	return s
		.split(' ')
		.filter(Boolean)
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join(' ');
};

const getAddonImages = (addon: Addon): AddonImage[] => {
	const imgs = addon.images && addon.images.length > 0 ? addon.images : [];
	if (imgs.length > 0) return imgs;
	return addon.image?.url ? [addon.image] : [];
};

const getCategoryKey = (addon: Addon) => addon.categoryRef?.slug || addon.category || 'other';
const getCategoryLabel = (addon: Addon) => addon.categoryRef?.name || titleCaseFromSlug(getCategoryKey(addon));

const AddOnCard = ({
	addon,
	onBuyOnce,
	onSubscribe,
	inCartSingle,
	inCartSubscription,
}: {
	addon: Addon;
	onBuyOnce: (addon: Addon) => void;
	onSubscribe: (addon: Addon) => void;
	inCartSingle: boolean;
	inCartSubscription: boolean;
}) => {
	const single = addon.pricing?.single ?? addon.price ?? 0;
	const weekly = addon.pricing?.weekly;
	const monthly = addon.pricing?.monthly;
	const categoryKey = getCategoryKey(addon);
	const categoryLabel = getCategoryLabel(addon);
	const Icon = categoryMeta[categoryKey]?.icon ?? Sparkles;
	const subtitle = addon.description || 'Add-on';
	const quantityText = addon.servingSizeText || undefined;

	const images = useMemo(() => getAddonImages(addon), [addon]);
	const slides = useMemo(() => (images.length > 1 ? [...images, images[0]] : images), [images]);
	const [activeIndex, setActiveIndex] = useState(0);
	const [transitionOn, setTransitionOn] = useState(true);

	useEffect(() => {
		setActiveIndex(0);
		setTransitionOn(true);
	}, [addon.id, images.length]);

	useEffect(() => {
		if (images.length <= 1) return;
		const id = window.setInterval(() => setActiveIndex((i) => i + 1), 2500);
		return () => window.clearInterval(id);
	}, [images.length]);

	const handleSlideTransitionEnd = () => {
		if (images.length <= 1) return;
		if (activeIndex === images.length) {
			setTransitionOn(false);
			setActiveIndex(0);
			window.requestAnimationFrame(() => setTransitionOn(true));
		}
	};

	// Category badge color
	const categoryColors: Record<string, string> = {
		protein: 'bg-oz-secondary text-white',
		carbs: 'bg-yellow-200 text-yellow-900',
		salad: 'bg-green-100 text-green-800',
		shake: 'bg-blue-100 text-blue-800',
		custom: 'bg-gray-200 text-gray-700',
	};

	const weeklyAvailable = typeof weekly === 'number';
	const monthlyAvailable = typeof monthly === 'number';

	return (
		<Card
			className={
				'group relative flex flex-col overflow-hidden rounded-2xl border border-oz-neutral/40 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-oz-secondary/30 min-h-[330px]'
			}
		>
			{/* Image/Icon area */}
			<div className="relative aspect-[4/3] w-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-oz-primary/10 via-oz-secondary/10 to-oz-accent/10">
				{images.length > 0 ? (
					<div className="h-full w-full" onTransitionEnd={handleSlideTransitionEnd}>
						<div
							className="flex h-full w-full"
							style={{
								width: `${slides.length * 100}%`,
								transform: `translateX(-${activeIndex * (100 / slides.length)}%)`,
								transition: transitionOn ? 'transform 600ms ease' : 'none',
							}}
						>
							{slides.map((img, idx) => (
								<div key={`${img.publicId}-${idx}`} className="h-full" style={{ width: `${100 / slides.length}%` }}>
									<img
										src={img.url}
										alt={img.alt || addon.name}
										loading="lazy"
										className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
									/>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center w-full h-full text-oz-primary/70">
						<Icon className="h-10 w-10" />
						<div className="mt-2 text-xs text-muted-foreground">Image coming soon</div>
					</div>
				)}
				{/* subtle bottom gradient */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
				{/* Category badge */}
				<span
					className={`absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur ${categoryColors[categoryKey] || 'bg-gray-200 text-gray-700'}`}
				>
					{categoryLabel}
				</span>
				{inCartSingle ? (
					<span className="absolute top-3 right-3 rounded-full bg-oz-primary text-white text-xs px-3 py-1 font-semibold shadow-sm inline-flex items-center gap-1">
						<Check className="h-3.5 w-3.5" /> Added
					</span>
				) : inCartSubscription ? (
					<span className="absolute top-3 right-3 rounded-full bg-oz-accent text-white text-xs px-3 py-1 font-semibold shadow-sm inline-flex items-center gap-1">
						<Check className="h-3.5 w-3.5" /> Subscribed
					</span>
				) : null}
			</div>
			<CardContent className="flex-1 flex flex-col justify-between p-4">
				<div>
					<div className="font-semibold text-oz-primary leading-snug text-base mb-0.5 line-clamp-1">{addon.name}</div>
					<div className="text-xs text-muted-foreground mb-2 line-clamp-2">{subtitle}</div>
					<div className="flex flex-wrap items-center gap-2">
						{quantityText ? (
							<span className="inline-flex items-center rounded-full border border-oz-neutral/60 bg-white px-2.5 py-1 text-[11px] font-medium text-oz-primary">
								{quantityText}
							</span>
						) : null}
						{typeof addon.proteinGrams === 'number' ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-oz-secondary/10 text-oz-primary px-2.5 py-1 text-[11px] font-medium">
								<Dumbbell className="h-3.5 w-3.5 text-oz-secondary" />
								{addon.proteinGrams}g Protein
							</span>
						) : null}
					</div>
				</div>
				<div className="mt-auto pt-4">
					<div className="grid grid-cols-3 gap-2">
						<div className="rounded-xl border border-oz-neutral/60 bg-oz-neutral/20 px-3 py-2">
							<div className="text-[11px] text-muted-foreground">Buy once</div>
							<div className="text-sm font-semibold text-oz-primary">{formatCurrency(single)}</div>
						</div>
						<div className={weeklyAvailable ? 'rounded-xl border border-oz-neutral/60 bg-white px-3 py-2' : 'rounded-xl border border-oz-neutral/60 bg-white px-3 py-2 opacity-60'}>
							<div className="text-[11px] text-muted-foreground">Weekly</div>
							<div className="text-sm font-semibold text-oz-secondary">{weeklyAvailable ? `${formatCurrency(weekly as number)} / week` : '—'}</div>
						</div>
						<div className={monthlyAvailable ? 'rounded-xl border border-oz-neutral/60 bg-white px-3 py-2' : 'rounded-xl border border-oz-neutral/60 bg-white px-3 py-2 opacity-60'}>
							<div className="text-[11px] text-muted-foreground">Monthly</div>
							<div className="text-sm font-semibold text-oz-accent">{monthlyAvailable ? `${formatCurrency(monthly as number)} / month` : '—'}</div>
						</div>
					</div>

					<div className="mt-3 grid grid-cols-2 gap-2">
						<Button variant="outline" onClick={() => onBuyOnce(addon)} disabled={inCartSingle}>
							{inCartSingle ? 'Added' : 'Buy once'}
						</Button>
						<Button
							className="bg-oz-accent hover:bg-oz-accent/90"
							onClick={() => onSubscribe(addon)}
							disabled={inCartSubscription || (!weeklyAvailable && !monthlyAvailable)}
						>
							{inCartSubscription ? 'Subscribed' : 'Subscribe'}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

// ...existing code...

const AddOns = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { addItem, state, itemCount } = useCart();
	const [isTabPending, startTabTransition] = useTransition();

	const [addons, setAddons] = useState<Addon[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [buyOnceOpen, setBuyOnceOpen] = useState(false);
	const [subscribeOpen, setSubscribeOpen] = useState(false);
	const [activeAddon, setActiveAddon] = useState<Addon | null>(null);

	const [buyQuantity, setBuyQuantity] = useState(1);
	const [subFrequency, setSubFrequency] = useState<'weekly' | 'monthly'>('weekly');
	const [subServings, setSubServings] = useState<number>(DEFAULT_SERVINGS.weekly);
	const [activeCategory, setActiveCategory] = useState<string>('');

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setError(null);

		addonsCatalogService
			.listAddons({ page: 1, limit: 200 }, { signal: controller.signal })
			.then((result) => setAddons(result.data))
			.catch((err) => {
				if ((err as { name?: string } | undefined)?.name === 'CanceledError') return;
				setError(err instanceof Error ? err.message : 'Failed to load add-ons');
			})
			.finally(() => setIsLoading(false));

		return () => controller.abort();
	}, []);

	const grouped = useMemo(() => {
		const groups = new Map<
			string,
			{ key: string; label: string; icon: React.ComponentType<{ className?: string }>; displayOrder: number; items: Addon[] }
		>();

		for (const addon of addons) {
			// Keep this page backend-driven: only show active add-ons and active categories when provided.
			if (addon.isActive === false) continue;
			if (addon.categoryRef?.isActive === false) continue;
			const key = getCategoryKey(addon);
			const label = getCategoryLabel(addon);
			const icon = categoryMeta[key]?.icon ?? Sparkles;
			const displayOrder = typeof addon.categoryRef?.displayOrder === 'number' ? addon.categoryRef.displayOrder : 9999;

			const existing = groups.get(key);
			if (existing) {
				existing.items.push(addon);
				existing.displayOrder = Math.min(existing.displayOrder, displayOrder);
			} else {
				groups.set(key, { key, label, icon, displayOrder, items: [addon] });
			}
		}

		return Array.from(groups.values()).sort((a, b) => {
			if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
			return a.label.localeCompare(b.label);
		});
	}, [addons]);

	useEffect(() => {
		if (isLoading) return;
		const first = grouped[0]?.key;
		if (!first) {
			setActiveCategory('');
			return;
		}
		if (!activeCategory || !grouped.some((g) => g.key === activeCategory)) {
			setActiveCategory(first);
		}
	}, [grouped, isLoading, activeCategory]);

	const openBuyOnce = (addon: Addon) => {
		setActiveAddon(addon);
		setBuyQuantity(1);
		setBuyOnceOpen(true);
	};

	const openSubscribe = (addon: Addon) => {
		setActiveAddon(addon);
		const weeklyAvailable = typeof addon.pricing?.weekly === 'number';
		const monthlyAvailable = typeof addon.pricing?.monthly === 'number';
		const initialFrequency: 'weekly' | 'monthly' = weeklyAvailable ? 'weekly' : monthlyAvailable ? 'monthly' : 'weekly';
		setSubFrequency(initialFrequency);
		setSubServings(
			initialFrequency === 'weekly'
				? (addon.servings?.weekly ?? DEFAULT_SERVINGS.weekly)
				: (addon.servings?.monthly ?? DEFAULT_SERVINGS.monthly)
		);
		setSubscribeOpen(true);
	};

	const activeSingle = activeAddon?.pricing?.single ?? activeAddon?.price ?? 0;
	const activeWeekly = activeAddon?.pricing?.weekly;
	const activeMonthly = activeAddon?.pricing?.monthly;
	const activeSubscriptionPrice = subFrequency === 'weekly' ? activeWeekly : activeMonthly;
	const canSubscribeWithSelectedPlan = typeof activeSubscriptionPrice === 'number';

	const handleConfirmBuyOnce = () => {
		if (!activeAddon) return;
		if (buyQuantity <= 0) return;

		addItem({ type: 'addon', addonId: activeAddon.id, plan: 'single', quantity: buyQuantity });
		toast({ title: 'Added to cart', description: `${activeAddon.name} added to cart.` });
		setBuyOnceOpen(false);
		navigate('/cart');
	};

	const handleConfirmSubscribe = () => {
		if (!activeAddon) return;
		if (!canSubscribeWithSelectedPlan) return;
		if (subServings <= 0) return;

		// Subscriptions are always quantity=1 (no price multiplication by servings).
		// Keep servings as informational only.
		addItem({
			type: 'addon',
			addonId: activeAddon.id,
			plan: subFrequency,
			quantity: 1,
			meta: { subscriptionServings: subServings },
		});
		toast({ title: 'Added to cart', description: `${activeAddon.name} (${subFrequency}) added to cart.` });
		setSubscribeOpen(false);
		navigate('/cart');
	};

	return (
		<div className="animate-fade-in">
			<section 
				className="relative bg-oz-primary text-white py-12 md:py-16 overflow-hidden"
				style={{
					backgroundImage: 'url(/home/add-ons-banner.png)',
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					backgroundRepeat: 'no-repeat'
				}}
			>
				{/* Overlay */}
				<div className="absolute inset-0 bg-oz-primary/70"></div>
				
				{/* Content */}
				<div className="container mx-auto px-4 relative z-10">
					<Link to="/meal-packs" className="inline-flex items-center text-white/90 hover:text-white text-sm font-medium transition-colors">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Meals
					</Link>
					<div className="max-w-3xl mx-auto text-center mt-6">
						<h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">Add-ons</h1>
						<p className="text-lg text-white/90 max-w-2xl mx-auto mb-0">
							Optional extras, grouped by category. Buy once or subscribe — separate from meal subscriptions.
						</p>
					</div>
				</div>
			</section>

			<section className="py-8 md:py-12 bg-oz-neutral/30">
				<div className="container mx-auto px-4">
					{error ? (
						<div className="bg-white border border-oz-neutral rounded-lg p-6">
							<div className="font-semibold text-oz-primary">Couldn’t load add-ons</div>
							<div className="text-sm text-muted-foreground mt-1">{error}</div>
						</div>
					) : (
						<div className="space-y-6">
							{/* Category Tabs */}
							{grouped.length === 0 && !isLoading ? (
								<div className="bg-white border border-oz-neutral rounded-lg p-6">
									<div className="font-semibold text-oz-primary">No add-ons available</div>
									<div className="text-sm text-muted-foreground mt-1">Ask an admin to publish add-ons and categories.</div>
								</div>
							) : (
								<Tabs
									value={activeCategory}
									onValueChange={(v) => {
										startTabTransition(() => setActiveCategory(v));
									}}
									className="w-full"
								>
									<div className="bg-white rounded-2xl border border-oz-neutral/40 shadow-sm overflow-hidden">
										<div className="p-5 border-b border-oz-neutral/30 bg-gradient-to-r from-oz-primary/5 via-white to-oz-accent/5">
											<div className="flex items-center justify-between gap-4">
												<div>
													<h2 className="text-lg font-bold text-oz-primary">Browse Add-ons</h2>
													<p className="text-xs text-muted-foreground mt-0.5">
														{isLoading ? 'Loading…' : `${grouped.length} categories available`}
													</p>
												</div>
												{itemCount > 0 ? (
													<Link
														to="/cart"
														className="hidden sm:inline-flex items-center gap-2 rounded-full bg-oz-accent hover:bg-oz-accent/90 text-white px-4 py-2 text-sm font-semibold transition-all shadow-md hover:shadow-lg"
													>
														<ShoppingCart className="h-4 w-4" />
														Cart ({itemCount})
													</Link>
												) : null}
											</div>
										</div>
										<div className="p-5 bg-oz-neutral/10">
											<div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
												<TabsList className="w-max min-w-full justify-start bg-white border border-oz-neutral/30 p-2 rounded-xl gap-2 shadow-sm">
													{isLoading
														? Array.from({ length: 4 }).map((_, i) => (
															<div key={i} className="h-11 w-32 rounded-lg bg-oz-neutral/20 animate-pulse" />
														))
														: grouped.map((group) => {
															const Icon = group.icon;
															return (
																<TabsTrigger
																	key={group.key}
																	value={group.key}
																	className="relative rounded-lg px-5 py-2.5 text-sm font-bold text-gray-600 transition-all hover:text-oz-primary hover:bg-oz-neutral/20 data-[state=active]:bg-gradient-to-br data-[state=active]:from-oz-primary data-[state=active]:to-oz-primary/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-[1.02]"
																>
																	<Icon className="mr-2 h-5 w-5" />
																	{group.label}
																</TabsTrigger>
															);
														})}
												</TabsList>
											</div>
										</div>
									</div>

									{grouped.map((group) => {
										const items = [...group.items].sort((a, b) => {
											const ao = typeof a.displayOrder === 'number' ? a.displayOrder : 9999;
											const bo = typeof b.displayOrder === 'number' ? b.displayOrder : 9999;
											if (ao !== bo) return ao - bo;
											return a.name.localeCompare(b.name);
										});

										return (
											<TabsContent key={group.key} value={group.key} className="mt-6">
												<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
													{isLoading || isTabPending
														? Array.from({ length: 8 }).map((_, idx) => (
															<div key={idx} className="rounded-2xl overflow-hidden bg-white border border-oz-neutral/60 shadow-sm flex flex-col min-h-[330px] animate-pulse">
																<div className="aspect-[4/3] w-full bg-oz-neutral/30" />
																<div className="p-4 space-y-3 flex-1">
																	<div className="h-4 w-3/4 bg-oz-neutral/30 rounded" />
																	<div className="h-3 w-full bg-oz-neutral/20 rounded" />
																	<div className="h-3 w-5/6 bg-oz-neutral/20 rounded" />
																	<div className="h-8 w-full bg-oz-neutral/20 rounded-xl" />
																	<div className="h-10 w-full bg-oz-neutral/30 rounded-xl" />
																</div>
															</div>
														))
														: items.map((addon) => {
															const inCartSingle = state.items.some(
																(it) => it.type === 'addon' && it.addonId === addon.id && it.plan === 'single'
															);
															const inCartSubscription = state.items.some(
																(it) => it.type === 'addon' && it.addonId === addon.id && (it.plan === 'weekly' || it.plan === 'monthly')
															);
															return (
																<AddOnCard
																	key={addon.id}
																	addon={addon}
																	onBuyOnce={openBuyOnce}
																	onSubscribe={openSubscribe}
																	inCartSingle={inCartSingle}
																	inCartSubscription={inCartSubscription}
																/>
															);
														})}
												</div>
											</TabsContent>
										);
									})}
								</Tabs>
							)}
						</div>
					)}
				</div>
			</section>

			{/* Sticky cart indicator (mobile + desktop) */}
			{itemCount > 0 ? (
				<Link
					to="/cart"
					className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-oz-primary text-white px-4 py-2 shadow-lg hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
					aria-label="View cart"
				>
					<ShoppingCart className="h-4 w-4" />
					<span className="text-sm font-semibold">Cart</span>
					<span className="text-xs text-white/80">({itemCount})</span>
				</Link>
			) : null}

			<Dialog open={buyOnceOpen} onOpenChange={setBuyOnceOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add to cart (single)</DialogTitle>
						<DialogDescription>
							{activeAddon ? `Add ${activeAddon.name} to your cart.` : 'Select an add-on.'}
						</DialogDescription>
					</DialogHeader>

					{activeAddon ? (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="text-sm text-muted-foreground">Price</div>
								<div className="font-semibold text-oz-primary">{formatCurrency(activeSingle)}</div>
							</div>
							<div className="flex items-center justify-between gap-3">
								<div className="text-sm font-semibold text-oz-primary">Quantity</div>
								<div className="flex items-center gap-1">
									<Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setBuyQuantity((q) => Math.max(1, q - 1))}>
										<Minus className="h-4 w-4" />
									</Button>
									<Input
										type="number"
										min={1}
										value={buyQuantity}
										onChange={(e) => setBuyQuantity(Math.max(1, Number(e.target.value) || 1))}
										className="w-24"
									/>
									<Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setBuyQuantity((q) => q + 1)}>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
							</div>
							<div className="text-xs text-muted-foreground">Totals are calculated by the server in your cart / checkout.</div>
						</div>
					) : null}

					<DialogFooter>
						<Button variant="outline" onClick={() => setBuyOnceOpen(false)}>Cancel</Button>
						<Button className="bg-oz-accent hover:bg-oz-accent/90" onClick={handleConfirmBuyOnce} disabled={!activeAddon}>
							Add to cart
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add to cart (subscription)</DialogTitle>
						<DialogDescription>
							{activeAddon ? `Add ${activeAddon.name} as a subscription line item to your cart.` : 'Select an add-on.'}
						</DialogDescription>
					</DialogHeader>

					{activeAddon ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<div className="text-sm font-semibold text-oz-primary">Plan</div>
								<div className="grid grid-cols-2 gap-2">
									<Button
										variant={subFrequency === 'weekly' ? 'default' : 'outline'}
										className={subFrequency === 'weekly' ? 'bg-oz-accent hover:bg-oz-accent/90' : ''}
										disabled={typeof activeWeekly !== 'number'}
										onClick={() => {
											setSubFrequency('weekly');
											setSubServings(activeAddon.servings?.weekly ?? DEFAULT_SERVINGS.weekly);
										}}
									>
										Weekly{typeof activeWeekly === 'number' ? ` (${formatCurrency(activeWeekly)})` : ''}
									</Button>
									<Button
										variant={subFrequency === 'monthly' ? 'default' : 'outline'}
										className={subFrequency === 'monthly' ? 'bg-oz-accent hover:bg-oz-accent/90' : ''}
										disabled={typeof activeMonthly !== 'number'}
										onClick={() => {
											setSubFrequency('monthly');
											setSubServings(activeAddon.servings?.monthly ?? DEFAULT_SERVINGS.monthly);
										}}
									>
										Monthly{typeof activeMonthly === 'number' ? ` (${formatCurrency(activeMonthly)})` : ''}
									</Button>
								</div>
							</div>

							<div className="rounded-lg border border-oz-neutral/50 bg-white px-3 py-2">
								<div className="text-[11px] text-muted-foreground">Selected subscription price</div>
								{typeof activeSubscriptionPrice === 'number' ? (
									<div className="text-sm font-semibold text-oz-primary">
										{formatCurrency(activeSubscriptionPrice)}
										<span className="text-xs font-normal text-muted-foreground">/{subFrequency === 'weekly' ? 'week' : 'month'}</span>
									</div>
								) : (
									<div className="text-sm text-muted-foreground">Not available</div>
								)}
							</div>

							<div className="space-y-2">
								<div className="text-sm font-semibold text-oz-primary">Servings</div>
								<div className="text-xs text-muted-foreground">
									{subFrequency === 'weekly' && typeof activeWeekly === 'number'
										? `Weekly default servings: ${(activeAddon.servings?.weekly ?? DEFAULT_SERVINGS.weekly)}.`
										: subFrequency === 'monthly' && typeof activeMonthly === 'number'
											? `Monthly default servings: ${(activeAddon.servings?.monthly ?? DEFAULT_SERVINGS.monthly)}.`
											: 'Set how many servings you want for this period.'}
								</div>
								<Input
									type="number"
									min={1}
									value={subServings}
									onChange={(e) => setSubServings(Math.max(1, Number(e.target.value) || 1))}
								/>
							</div>

							<div className="text-xs text-muted-foreground">Totals are calculated by the server in your cart / checkout.</div>
						</div>
					) : null}

					<DialogFooter>
						<Button variant="outline" onClick={() => setSubscribeOpen(false)}>Cancel</Button>
							<Button
								className="bg-oz-accent hover:bg-oz-accent/90"
								onClick={handleConfirmSubscribe}
								disabled={!activeAddon || !canSubscribeWithSelectedPlan}
							>
							Add to cart
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default AddOns;
