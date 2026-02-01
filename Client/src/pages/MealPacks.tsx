import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MealCard } from '@/components/shared/MealCard';
import { mealsCatalogService } from '@/services/mealsCatalogService';
import type { Meal } from '@/types/catalog';

const MealPacks = () => {
	const [meals, setMeals] = useState<Meal[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		setIsLoading(true);
		setError(null);

		mealsCatalogService
			.listMeals({ page: 1, limit: 12 }, { signal: controller.signal })
			.then((result) => setMeals(result.data))
			.catch((err) => {
				if ((err as { name?: string } | undefined)?.name === 'CanceledError') return;
				setError(err instanceof Error ? err.message : 'Failed to load meals');
			})
			.finally(() => setIsLoading(false));

		return () => controller.abort();
	}, []);

	const grid = useMemo(() => meals, [meals]);

	return (
	  <div className="animate-fade-in">
	    {/* Header Section */}
	    <section 
	      className="relative bg-oz-primary text-white py-12 md:py-16 overflow-hidden"
	      style={{
	        backgroundImage: 'url(/home/meals-pack-banner.png)',
	        backgroundSize: 'cover',
	        backgroundPosition: 'center',
	        backgroundRepeat: 'no-repeat'
	      }}
	    >
	      {/* Overlay for better text readability */}
	      <div className="absolute inset-0 bg-oz-primary/70" />
	      
	      <div className="container relative z-10 mx-auto px-4">
	        <div className="max-w-3xl mx-auto text-center">
	          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">Meals</h1>
	          <p className="text-lg text-white/90 max-w-2xl mx-auto mb-0">
	            Fresh, macro-balanced meals designed for performance. Browse plans, compare protein targets, and view details.
	          </p>
	        </div>
	      </div>
	    </section>

	    {/* Grid Section */}
	    <section className="py-10 md:py-14 bg-oz-neutral/30">
	      <div className="container mx-auto px-4">
	        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-8">
	          <div className="text-sm text-muted-foreground text-center md:text-left">
	            {isLoading ? 'Loading meals…' : `${grid.length} meals found`}
	          </div>
	          <Link to="/addons" className="mx-auto md:mx-0">
	            <Button variant="outline" className="border-oz-neutral hover:bg-white">
	              Browse Add-ons
	              <ArrowRight className="ml-2 h-4 w-4" />
	            </Button>
	          </Link>
	        </div>

	        {error ? (
	          <div className="bg-white border border-oz-neutral rounded-lg p-6 flex items-start gap-3 max-w-xl mx-auto">
	            <AlertTriangle className="h-5 w-5 text-oz-accent mt-0.5" />
	            <div>
	              <div className="font-semibold text-oz-primary">Couldn’t load meals</div>
	              <div className="text-sm text-muted-foreground mt-1">{error}</div>
	            </div>
	          </div>
	        ) : (
	          <div className="mx-auto max-w-6xl">
	            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
	              {isLoading
	                ? Array.from({ length: 8 }).map((_, idx) => (
	                    <div key={idx} className="rounded-2xl overflow-hidden bg-white border border-oz-neutral/60 shadow-sm flex flex-col min-h-[400px]">
	                      <Skeleton className="aspect-[4/3] w-full rounded-t-2xl" />
	                      <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-end">
	                        <Skeleton className="h-5 w-2/3" />
	                        <Skeleton className="h-4 w-full" />
	                        <Skeleton className="h-4 w-5/6" />
	                        <div className="flex gap-2 pt-2">
	                          <Skeleton className="h-7 w-28 rounded-full" />
	                          <Skeleton className="h-7 w-32 rounded-full" />
	                        </div>
	                        <Skeleton className="h-10 w-full mt-2 rounded-lg" />
	                      </div>
	                    </div>
	                  ))
	                : grid.map((meal) => <MealCard key={meal.id} meal={meal} />)}
	            </div>
	          </div>
	        )}
	      </div>
	    </section>
	  </div>
	);
};

export default MealPacks;
