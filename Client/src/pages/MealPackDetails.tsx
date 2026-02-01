import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Check, Leaf, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mealsCatalogService } from '@/services/mealsCatalogService';
import { formatCurrency } from '@/utils/formatCurrency';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import type { Meal } from '@/types/catalog';

const MealPackDetails = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { addItem, state } = useCart();
	const { id } = useParams<{ id: string }>();
	const slug = id || '';

	const [meal, setMeal] = useState<Meal | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
	const [proteinChoice, setProteinChoice] = useState<'with' | 'without'>('with');
	const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'trial'>('weekly');
	const [didJustAdd, setDidJustAdd] = useState(false);

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setError(null);
		setMeal(null);

		if (!slug) {
			setIsLoading(false);
			setError('Meal not found');
			return;
		}

		mealsCatalogService
			.getMealBySlug(slug, { signal: controller.signal })
			.then((result) => setMeal(result.data))
			.catch((err) => {
				if ((err as { name?: string } | undefined)?.name === 'CanceledError') return;
				setError(err instanceof Error ? err.message : 'Failed to load meal');
			})
			.finally(() => setIsLoading(false));

		return () => controller.abort();
	}, [slug]);

	const tags = useMemo(() => meal?.tags?.filter(Boolean) ?? [], [meal]);
	const shortDescription = useMemo(() => {
		return meal?.shortDescription || '';
	}, [meal]);
	const detailedDescription = useMemo(() => {
		return (
			meal?.detailedDescription ||
			meal?.description ||
			meal?.shortDescription ||
			''
		);
	}, [meal]);
	const included = useMemo(() => {
		const items = meal?.includedItems;
		if (!items) return [] as Array<{ key: string; label: string }>;
		const map: Array<{ key: keyof NonNullable<Meal['includedItems']>; label: string }> = [
			{ key: 'rice', label: 'Rice' },
			{ key: 'chapati', label: 'Chapati' },
			{ key: 'sweetPotato', label: 'Sweet Potato' },
			{ key: 'egg', label: 'Egg (1 pc)' },
			{ key: 'veggies', label: 'Veggies' },
			{ key: 'chicken', label: 'Chicken' },
			{ key: 'paneer', label: 'Paneer' },
			{ key: 'yogurt', label: 'Yogurt' },
			{ key: 'proteinCurd', label: 'Protein Curd' },
			{ key: 'fruitSalad', label: 'Fruit Salad' },
			{ key: 'boiledLegumesSprouts', label: 'Boiled Legumes / Sprouts' },
			{ key: 'nutsDryFruits', label: 'Nuts & Dry Fruits' },
		];
		return map.filter((m) => Boolean(items[m.key])).map((m) => ({ key: String(m.key), label: m.label }));
	}, [meal]);

	const proteinMode = meal?.proteinPricingMode || 'default';
	const fixedProteinChoice =
		proteinMode === 'with-only'
			? 'with'
			: proteinMode === 'without-only'
				? 'without'
				: null;
	const showProteinChoice =
		proteinMode === 'both' ||
		(proteinMode === 'default' && Boolean(meal?.hasWithProteinOption) && Boolean(meal?.hasWithoutProteinOption));

	useEffect(() => {
		if (!meal) return;
		if (fixedProteinChoice) {
			setProteinChoice(fixedProteinChoice);
			return;
		}
		// Default preference when both are available
		setProteinChoice(meal.hasWithProteinOption ? 'with' : 'without');
	}, [meal, fixedProteinChoice]);

	useEffect(() => {
		// Default tab: weekly, unless trial is the only available option.
		if (!meal) return;
		setSelectedPlan('weekly');
	}, [meal]);

	const isAlreadyInCart = useMemo(() => {
		if (!meal) return false;
		return state.items.some((i) => i.type === 'meal' && i.mealId === meal.id && i.plan === selectedPlan);
	}, [meal, selectedPlan, state.items]);

	useEffect(() => {
		if (isAlreadyInCart) setDidJustAdd(true);
	}, [isAlreadyInCart]);

	const effectiveProteinChoice = fixedProteinChoice || proteinChoice;

	const effectiveProteinPerMeal = useMemo(() => {
		if (!meal) return null as number | null;
		if (proteinMode === 'default') return meal.proteinPerMeal;
		if (proteinMode === 'with-only') return meal.proteinPerMealWith ?? meal.proteinPerMeal;
		if (proteinMode === 'without-only') return meal.proteinPerMealWithout ?? meal.proteinPerMeal;
		// both
		return effectiveProteinChoice === 'with'
			? (meal.proteinPerMealWith ?? meal.proteinPerMeal)
			: (meal.proteinPerMealWithout ?? meal.proteinPerMeal);
	}, [meal, proteinMode, effectiveProteinChoice]);

	const effectivePricing = useMemo(() => {
		if (!meal) return undefined;
		if (proteinMode === 'default') return meal.pricing;
		if (proteinMode === 'with-only') return meal.proteinPricing?.withProtein;
		if (proteinMode === 'without-only') return meal.proteinPricing?.withoutProtein;
		// both
		return effectiveProteinChoice === 'with' ? meal.proteinPricing?.withProtein : meal.proteinPricing?.withoutProtein;
	}, [meal, proteinMode, effectiveProteinChoice]);

	const pricingUnavailable = useMemo(() => {
		if (!meal) return false;
		if (proteinMode === 'default') return false;
		return !effectivePricing;
	}, [meal, proteinMode, effectivePricing]);

	const dynamicIncluded = useMemo(() => {
		const list = meal?.includedItemAssignments;
		if (!Array.isArray(list) || !list.length) return [] as NonNullable<Meal['includedItemAssignments']>;

		type IncludedItemVisibility = NonNullable<NonNullable<Meal['includedItemAssignments']>[number]['visibility']>;
		const allowed =
			effectiveProteinChoice === 'with'
				? (new Set<IncludedItemVisibility>(['both', 'with-protein']))
				: (new Set<IncludedItemVisibility>(['both', 'without-protein']));

		return list
			.filter((a) => a && a.isActive !== false && a.visibility && allowed.has(a.visibility))
			.slice()
			.sort((a, b) => {
				const ao = (a.displayOrder ?? a.item?.displayOrder ?? 0) - (b.displayOrder ?? b.item?.displayOrder ?? 0);
				if (ao !== 0) return ao;
				return String(a.item?.name ?? a.itemId).localeCompare(String(b.item?.name ?? b.itemId));
			});
	}, [meal, effectiveProteinChoice]);

	const images = useMemo(() => {
		if (!meal) return [] as NonNullable<Meal['images']>;
		if (Array.isArray(meal.images) && meal.images.length) return meal.images;
		return meal.image ? [meal.image] : [];
	}, [meal]);

	useEffect(() => {
		if (!carouselApi) return;
		if (images.length < 2) return;

		const intervalId = window.setInterval(() => {
			carouselApi.scrollNext();
		}, 3500);

		return () => window.clearInterval(intervalId);
	}, [carouselApi, images.length]);

	if (!isLoading && (error || !meal)) {
		return (
			<div className="container mx-auto px-4 py-16">
				<div className="max-w-xl mx-auto text-center">
					<h1 className="text-2xl font-bold text-oz-primary">Meal Not Found</h1>
					<p className="text-muted-foreground mt-3">{error || 'The meal you are looking for does not exist.'}</p>
					<div className="mt-6">
						<Link to="/meal-packs">
							<Button className="bg-oz-secondary hover:bg-oz-secondary/90">
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back to Meals
							</Button>
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="animate-fade-in">
			<div className="bg-oz-neutral/30 border-b border-oz-neutral">
				<div className="container mx-auto px-4 py-3">
					<Link
						to="/meal-packs"
						className="inline-flex items-center text-sm text-muted-foreground hover:text-oz-primary transition-colors"
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Meals
					</Link>
				</div>
			</div>

				<div className="container mx-auto px-4 py-8">
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
						<div className="lg:col-span-2 space-y-6">
							<div className="relative overflow-hidden rounded-2xl border-2 border-oz-primary/20 bg-white shadow-2xl">
								<div className="relative h-64 sm:h-72 lg:h-80">
									{isLoading ? (
										<Skeleton className="absolute inset-0 h-full w-full" />
									) : images.length ? (
										<Carousel
											opts={{ loop: true }}
											setApi={(api) => setCarouselApi(api)}
											className="absolute inset-0 h-full w-full [&>div]:h-full"
										>
											<CarouselContent className="ml-0 h-full">
												{images.map((img, idx) => (
													<CarouselItem
														key={`${img.publicId || img.url}-${idx}`}
														className="pl-0 h-full"
													>
														<div className="relative h-full w-full">
															<img
																src={img.url}
																alt={img.alt || meal?.name || 'Meal image'}
																loading={idx === 0 ? 'eager' : 'lazy'}
																className="absolute inset-0 h-full w-full object-cover"
															/>
														</div>
													</CarouselItem>
												))}
											</CarouselContent>
										</Carousel>
									) : (
										<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-oz-primary/10 via-oz-secondary/10 to-oz-accent/10">
											<div className="text-sm text-muted-foreground">Image coming soon</div>
										</div>
									)}
									<div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
								</div>
							</div>

						<div>
							{isLoading ? (
								<div className="space-y-3">
									<Skeleton className="h-9 w-2/3" />
									<Skeleton className="h-5 w-1/2" />
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-5/6" />
								</div>
							) : (
								<>
									<h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-oz-primary to-oz-secondary bg-clip-text text-transparent">{meal?.name}</h1>
									{shortDescription ? (
										<p className="mt-4 text-muted-foreground leading-relaxed">{shortDescription}</p>
									) : null}
									{tags.length > 0 && (
										<div className="mt-5 flex flex-wrap gap-2">
											{tags.map((t) => (
												<span key={t} className="text-xs px-4 py-1.5 rounded-full bg-gradient-to-r from-oz-primary/10 to-oz-accent/10 text-oz-primary font-semibold border border-oz-primary/20 shadow-sm">{t}</span>

											))}
										</div>
									)}
								</>
							)}
						</div>

						<Separator />

					<Card className="border-2 border-oz-primary/10 shadow-lg hover:shadow-xl transition-shadow duration-300">
						<CardHeader className="bg-gradient-to-r from-oz-primary/5 to-oz-accent/5">
						<CardTitle className="text-oz-primary">
								Detailed Description
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-6">
								{isLoading ? (
									<div className="space-y-2">
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-5/6" />
										<Skeleton className="h-4 w-4/6" />
									</div>
								) : (
									<p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
										{detailedDescription || 'No detailed description provided yet.'}
									</p>
								)}
							</CardContent>
						</Card>

					<Card className="border-2 border-oz-primary/10 shadow-lg hover:shadow-xl transition-shadow duration-300">
						<CardHeader className="bg-gradient-to-r from-oz-primary/5 to-oz-accent/5">
						<CardTitle className="text-oz-primary">
								Highlights
							</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
							<div className="rounded-xl bg-gradient-to-br from-oz-primary/10 to-oz-secondary/10 p-5 border border-oz-primary/20 shadow-sm hover:shadow-md transition-all duration-300">
								<div className="text-xs text-muted-foreground font-medium mb-2">Protein per meal</div>
								<div className="font-bold text-oz-primary inline-flex items-center gap-2 text-xl">
									<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-oz-secondary to-oz-secondary/80 flex items-center justify-center shadow-md">
										<Zap className="h-5 w-5 text-white" />
									</div>
										{isLoading ? '—' : `${effectiveProteinPerMeal ?? meal?.proteinPerMeal ?? 0}g`}
									</div>
								</div>
							<div className="rounded-xl bg-gradient-to-br from-oz-accent/10 to-orange-500/10 p-5 border border-oz-accent/20 shadow-sm hover:shadow-md transition-all duration-300">
								<div className="text-xs text-muted-foreground font-medium mb-2">Calories</div>
								<div className="font-bold text-oz-primary inline-flex items-center gap-2 text-xl">
									<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-oz-accent to-orange-500 flex items-center justify-center shadow-md">
										<Leaf className="h-5 w-5 text-white" />
									</div>
									{isLoading ? '—' : meal?.caloriesRange || 'Balanced'}
									</div>
								</div>
							<div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-600/10 p-5 border border-green-500/20 shadow-sm hover:shadow-md transition-all duration-300">
								<div className="text-xs text-muted-foreground font-medium mb-2">Servings</div>
								<div className="font-bold text-oz-primary inline-flex items-center gap-2 text-xl">
									<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
										<BadgeCheck className="h-5 w-5 text-white" />
									</div>
										{isLoading ? '—' : meal?.servings}
									</div>
								</div>
							</CardContent>
						</Card>

								{!isLoading && (dynamicIncluded.length > 0 || included.length > 0) && (
								<Card className="border-2 border-oz-primary/10 shadow-lg hover:shadow-xl transition-shadow duration-300">
									<CardHeader className="bg-gradient-to-r from-oz-primary/5 to-oz-accent/5">
									<CardTitle className="text-oz-primary">
											Included Items
										</CardTitle>
									</CardHeader>
									<CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6">
											{(dynamicIncluded.length > 0
												? dynamicIncluded.map((a, idx) => ({
													key: `${a.itemId}-${idx}`,
													label: `${a.item?.name ?? 'Item'}${a.quantity ? ` — ${a.quantity}${a.unit}` : ''}`,
												}))
												: included
											).map((it) => (
												<div key={it.key} className="flex items-center gap-3 text-sm text-oz-primary p-2 rounded-lg bg-gradient-to-r from-oz-primary/5 to-transparent hover:from-oz-primary/10 transition-colors duration-200">
													<div className="h-7 w-7 rounded-full bg-gradient-to-br from-oz-secondary to-oz-secondary/80 flex items-center justify-center shadow-sm">
														<Check className="h-4 w-4 text-white" />
													</div>
													<span className="font-medium">{it.label}</span>
												</div>
											))}
										</CardContent>
									</Card>
								)}
					</div>

					<div className="lg:col-span-1">
						<div className="sticky top-24">
						<Card className="border-2 border-oz-secondary/30 shadow-2xl">
							<CardHeader className="bg-gradient-to-r from-oz-secondary/10 to-oz-accent/10 border-b border-oz-secondary/20">
							<CardTitle className="text-oz-primary">
									Pricing
								</CardTitle>
								</CardHeader>
								<CardContent className="pt-6 space-y-4">
									{isLoading ? (
										<div className="space-y-3">
											<Skeleton className="h-5 w-24" />
											<Skeleton className="h-10 w-full" />
											<Skeleton className="h-10 w-full" />
										</div>
									) : (
										<>
											{showProteinChoice ? (
											<div className="flex items-center justify-between gap-3 rounded-lg border p-3">
												<div className="text-sm font-medium text-oz-primary">Protein option</div>
												<div className="flex gap-2">
													<Button
														variant={proteinChoice === 'with' ? 'default' : 'outline'}
														size="sm"
														className={proteinChoice === 'with' ? 'bg-oz-secondary hover:bg-oz-secondary/90' : ''}
														onClick={() => setProteinChoice('with')}
													>
														With protein
													</Button>
													<Button
														variant={proteinChoice === 'without' ? 'default' : 'outline'}
														size="sm"
														className={proteinChoice === 'without' ? 'bg-oz-secondary hover:bg-oz-secondary/90' : ''}
														onClick={() => setProteinChoice('without')}
													>
														Without protein
													</Button>
												</div>
											</div>
										) : null}

											{pricingUnavailable ? (
												<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-oz-primary">
													Pricing is temporarily unavailable for this meal.
												</div>
											) : null}

										<Tabs value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as typeof selectedPlan)} className="w-full">
											<TabsList className="grid w-full grid-cols-3">
												<TabsTrigger value="monthly">Monthly</TabsTrigger>
												<TabsTrigger value="weekly">Weekly</TabsTrigger>
													<TabsTrigger value="trial" disabled={!effectivePricing?.trial || !meal?.isTrialEligible}>
													Trial
												</TabsTrigger>
											</TabsList>

											<TabsContent value="weekly" className="pt-4">
												<div className="text-xs text-muted-foreground">Starting at</div>
												<div className="text-2xl font-semibold text-oz-primary">
													{pricingUnavailable ? '—' : formatCurrency(effectivePricing?.weekly?.price || 0)}
													<span className="text-sm font-normal text-muted-foreground"> / week</span>
												</div>
												<div className="text-xs text-muted-foreground mt-1">
													{pricingUnavailable ? '—' : (effectivePricing?.weekly?.servings || 0)} servings
												</div>
											</TabsContent>

											<TabsContent value="monthly" className="pt-4">
												<div className="text-xs text-muted-foreground">Starting at</div>
												<div className="text-2xl font-semibold text-oz-primary">
													{pricingUnavailable ? '—' : formatCurrency(effectivePricing?.monthly?.price || 0)}
													<span className="text-sm font-normal text-muted-foreground"> / month</span>
												</div>
												<div className="text-xs text-muted-foreground mt-1">
													{pricingUnavailable ? '—' : (effectivePricing?.monthly?.servings || 0)} servings
												</div>
											</TabsContent>

											<TabsContent value="trial" className="pt-4">
												<div className="inline-flex items-center gap-2">
													<div className="rounded-full bg-oz-accent text-white text-xs px-3 py-1 font-medium">
														{meal?.trialBadgeText || '1-Day Trial'}
													</div>
												</div>
												<div className="mt-2 text-2xl font-semibold text-oz-primary">
													{pricingUnavailable ? '—' : formatCurrency(effectivePricing?.trial?.price || 0)}
												</div>
												<div className="text-xs text-muted-foreground mt-1">1 serving</div>
											</TabsContent>
										</Tabs>
										</>
									)}

									<Separator />

											<Button
							className="w-full bg-gradient-to-r from-oz-secondary to-oz-secondary/90 hover:from-oz-secondary/90 hover:to-oz-secondary h-12 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
								disabled={
									isLoading ||
									!meal ||
									pricingUnavailable ||
									(selectedPlan === 'trial' && !meal.isTrialEligible) ||
									didJustAdd ||
									isAlreadyInCart
								}
								onClick={() => {
									if (!meal) return;
									if (selectedPlan === 'trial' && !meal.isTrialEligible) return;
									if (isAlreadyInCart) {
										toast({ title: 'Already in cart', description: `${meal.name} (${selectedPlan}) is already in your cart.` });
										return;
									}
									addItem({ type: 'meal', mealId: meal.id, plan: selectedPlan, quantity: 1 });
									setDidJustAdd(true);
									toast({ title: 'Added to cart', description: `${meal.name} (${selectedPlan}) added to cart.` });
									window.setTimeout(() => navigate('/addons'), 2000);
								}}
							>
								{didJustAdd || isAlreadyInCart ? 'Added to Cart' : 'Add to Cart'}
											</Button>

											<Link to="/addons" className="block mt-3">
									<Button className="w-full bg-gradient-to-r from-oz-accent to-orange-500 hover:from-oz-accent/90 hover:to-orange-500/90 h-12 font-semibold shadow-lg hover:shadow-xl transition-all duration-300" disabled={isLoading}>
											Browse Add-ons
										</Button>
									</Link>
									<div className="text-xs text-muted-foreground">
										Add-ons are displayed separately in Phase 3. Selection and checkout happens in Phase 4.
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default MealPackDetails;
