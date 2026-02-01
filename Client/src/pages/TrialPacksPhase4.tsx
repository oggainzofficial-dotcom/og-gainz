import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { mealsCatalogService } from '@/services/mealsCatalogService';
import type { Meal } from '@/types/catalog';
import { MealCard } from '@/components/shared/MealCard';

export default function TrialPacksPhase4() {
	const [meals, setMeals] = useState<Meal[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setError(null);

		mealsCatalogService
			.listMeals({ page: 1, limit: 50, trialEligible: true }, { signal: controller.signal })
			.then((res) => setMeals(res.data))
			.catch((err) => {
				if ((err as { name?: string } | undefined)?.name === 'CanceledError') return;
				setError(err instanceof Error ? err.message : 'Failed to load trial packs');
			})
			.finally(() => setIsLoading(false));

		return () => controller.abort();
	}, []);

	return (
		<div className="animate-fade-in">
			<section 
				className="relative bg-oz-primary text-white py-12 md:py-16 overflow-hidden"
				style={{
					backgroundImage: 'url(/home/trials-pack-banner.png)',
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
						<h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">Trial Packs</h1>
						<p className="text-lg text-white/90 max-w-2xl mx-auto mb-0">
							Try a meal pack before subscribing. Add a trial pack to your cart — totals are computed server-side.
						</p>
					</div>
				</div>
			</section>

			<div className="container mx-auto px-4 py-8">

				{error ? (
					<div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-oz-primary">
						{error}
					</div>
				) : null}

				<div className="mt-8 mx-auto max-w-6xl">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{isLoading
						? Array.from({ length: 6 }).map((_, i) => (
								<Card key={i} className="rounded-2xl overflow-hidden border-oz-neutral/60 shadow-sm flex flex-col min-h-[420px]">
									<div className="aspect-[4/3] w-full">
										<Skeleton className="h-full w-full" />
									</div>
									<CardHeader>
										<Skeleton className="h-6 w-2/3" />
									</CardHeader>
									<CardContent className="space-y-3 flex-1 flex flex-col">
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-5/6" />
										<div className="mt-auto">
											<Skeleton className="h-10 w-full" />
										</div>
									</CardContent>
								</Card>
							))
						: meals.map((meal) => <MealCard key={meal.id} meal={meal} priceTier="trial" />)}
					</div>
				</div>
			</div>
		</div>
	);
}
