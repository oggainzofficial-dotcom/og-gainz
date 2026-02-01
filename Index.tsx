import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Dumbbell,
  Leaf,
  LineChart,
  PackageCheck,
  PauseCircle,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Star,
  Truck,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { mealsCatalogService } from "@/services/mealsCatalogService";
import type { Meal } from "@/types/catalog";

type ValueCard = {
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
};

type PlanCard = {
  title: string;
  badge: string;
  badgeTone: "default" | "secondary" | "destructive" | "outline";
  imageSrc: string;
  protein: string;
  calories: string;
  weekly: string;
  monthly: string;
  href: string;
};

type Testimonial = {
  name: string;
  role: string;
  quote: string;
  rating: number;
};

const valueCards: ValueCard[] = [
  {
    title: "Built for Real Goals",
    description: "Meals engineered for fat loss, muscle gain, or recomposition — not generic dieting.",
    Icon: ClipboardList,
  },
  {
    title: "Protein-Forward by Design",
    description: "35–50g protein per meal so your nutrition actually supports training.",
    Icon: Dumbbell,
  },
  {
    title: "Zero Missed Days",
    description: "Fresh meals delivered daily, so consistency is never optional.",
    Icon: Truck,
  },
  {
    title: "You Stay in Control",
    description: "Pause, skip, or extend anytime — without breaking progress.",
    Icon: CalendarDays,
  },
  {
    title: "Progress You Can Track",
    description: "Macro-aware plans that make results measurable, not guesswork.",
    Icon: LineChart,
  },
];

const featuredPlans: PlanCard[] = [
  {
    title: "Weight Loss Pack",
    badge: "Popular",
    badgeTone: "secondary",
    imageSrc: "/home/meal-weight-loss.svg",
    protein: "35–45g protein/meal",
    calories: "~450–650 kcal",
    weekly: "₹1,499 / week",
    monthly: "₹5,499 / month",
    href: "/meal-packs",
  },
  {
    title: "Muscle Gain Pack",
    badge: "Best Seller",
    badgeTone: "default",
    imageSrc: "/home/meal-muscle-gain.svg",
    protein: "45–60g protein/meal",
    calories: "~650–850 kcal",
    weekly: "₹1,799 / week",
    monthly: "₹6,499 / month",
    href: "/meal-packs",
  },
  {
    title: "Balanced Fitness Pack",
    badge: "Performance",
    badgeTone: "outline",
    imageSrc: "/home/meal-balanced.svg",
    protein: "35–55g protein/meal",
    calories: "~550–750 kcal",
    weekly: "₹1,599 / week",
    monthly: "₹5,899 / month",
    href: "/meal-packs",
  },
  {
    title: "Trial Packs",
    badge: "Trial",
    badgeTone: "destructive",
    imageSrc: "/home/meal-trial.svg",
    protein: "Try 3 days",
    calories: "Pick your goal",
    weekly: "From ₹499",
    monthly: "No commitment",
    href: "/trial",
  },
];

const testimonials: Testimonial[] = [
  {
    name: "Rohan",
    role: "Gym-goer",
    quote: "I finally stopped guessing my macros. OG Gainz made my cut consistent — and effortless.",
    rating: 5,
  },
  {
    name: "Ayesha",
    role: "Working Professional",
    quote: "The subscription controls are a game-changer. I can pause and skip without losing my plan.",
    rating: 5,
  },
  {
    name: "Karan",
    role: "Athlete",
    quote: "Protein targets, delivery reliability, clean taste. It feels like a nutrition system — not a food app.",
    rating: 5,
  },
];

const desktopHeroBanners = ["/home/banner1.png", "/home/banner2.png", "/home/banner3.png", "/home/banner4.png"] as const;
const mobileOnlyHeroBanners = ["/home/mobile-banner1.png", "/home/mobile-banner2.png", "/home/mobile-banner3.png"] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <Star
          key={idx}
          className={`h-4 w-4 ${idx < rating ? "text-oz-accent" : "text-muted-foreground/30"}`}
          fill={idx < rating ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

// Testimonial Carousel with Auto-Slide
function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Auto-slide every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [testimonials.length]);

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.9,
    }),
  };

  return (
    <div className="mx-auto mt-12 max-w-5xl">
      <div className="relative overflow-hidden px-4">
        {/* Testimonial Cards */}
        <div className="relative h-[280px] md:h-[240px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.3 },
                scale: { duration: 0.3 },
              }}
              className="absolute inset-0"
            >
              <div className="grid h-full gap-6 md:grid-cols-2">
                {[
                  testimonials[currentIndex],
                  testimonials[(currentIndex + 1) % testimonials.length],
                ].map((testimonial, idx) => (
                  <motion.div
                    key={`${currentIndex}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.5 }}
                  >
                    <Card className="group relative h-full overflow-hidden border-2 border-oz-primary/30 bg-gradient-to-br from-white via-oz-neutral/5 to-oz-primary/5 shadow-lg transition-all duration-500 hover:scale-[1.02] hover:border-oz-primary/50 hover:shadow-xl">
                      {/* Decorative quote icon */}
                      <div className="absolute right-4 top-4 opacity-5 transition-opacity duration-300 group-hover:opacity-10">
                        <Quote className="h-20 w-20 text-oz-primary" />
                      </div>
                      
                      {/* Glow effect */}
                      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-oz-accent/5 blur-2xl transition-all duration-500 group-hover:bg-oz-accent/10" />
                      
                      <CardHeader className="relative space-y-2 pb-3">
                        <div className="flex items-center justify-between">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="inline-flex"
                          >
                            <Stars rating={testimonial.rating} />
                          </motion.div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oz-primary text-lg font-bold text-white shadow-md ring-2 ring-oz-primary/20 transition-transform duration-300 group-hover:scale-110">
                            {testimonial.name[0]}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-lg font-bold text-oz-primary">
                              {testimonial.name}
                            </CardTitle>
                            <CardDescription className="text-xs font-medium text-muted-foreground">
                              {testimonial.role}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="relative pb-5 pt-1">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          "{testimonial.quote}"
                        </p>
                        
                        {/* Bottom accent line */}
                        <div className="mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-oz-accent to-oz-primary transition-all duration-300 group-hover:w-20" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Controls */}
        <div className="mt-8 flex items-center justify-center gap-6">
          <motion.button
            onClick={handlePrev}
            whileHover={{ scale: 1.1, x: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-oz-primary/30 bg-white text-oz-primary shadow-lg transition-all duration-300 hover:border-oz-primary hover:bg-oz-primary hover:text-white"
          >
            <ArrowRight className="h-5 w-5 rotate-180" />
          </motion.button>

          {/* Dot indicators */}
          <div className="flex gap-2">
            {testimonials.map((_, idx) => (
              <motion.button
                key={idx}
                onClick={() => {
                  setDirection(idx > currentIndex ? 1 : -1);
                  setCurrentIndex(idx);
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? "w-8 bg-oz-primary shadow-md"
                    : "w-2.5 bg-oz-primary/30 hover:bg-oz-primary/50"
                }`}
              />
            ))}
          </div>

          <motion.button
            onClick={handleNext}
            whileHover={{ scale: 1.1, x: 2 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-oz-primary/30 bg-white text-oz-primary shadow-lg transition-all duration-300 hover:border-oz-primary hover:bg-oz-primary hover:text-white"
          >
            <ArrowRight className="h-5 w-5" />
          </motion.button>
        </div>

        {/* Progress bar */}
        <motion.div
          className="mx-auto mt-6 h-1 w-full max-w-md overflow-hidden rounded-full bg-oz-accent/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            key={currentIndex}
            className="h-full bg-gradient-to-r from-oz-accent to-oz-accent"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 5, ease: "linear" }}
          />
        </motion.div>
      </div>
    </div>
  );
}

// How It Works Section with Parallax Animations
function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Background parallax (desktop only)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });
  
  const backgroundY = useTransform(scrollYProgress, [0, 1], isMobile ? [0, 0] : ["0%", "15%"]);

  const steps = [
    {
      n: 1,
      title: "Choose a Meal Plan",
      desc: "Select Weight Loss, Muscle Gain, Balanced Fitness, or Trial.",
      Icon: ChefHat,
    },
    {
      n: 2,
      title: "Customize Protein & Add-ons",
      desc: "Tailor macros and extras to match your training week.",
      Icon: Leaf,
    },
    {
      n: 3,
      title: "Subscribe or Buy Once",
      desc: "Lock in consistency or test the system with a trial.",
      Icon: PackageCheck,
    },
    {
      n: 4,
      title: "Get Daily Fresh Delivery",
      desc: "A reliable kitchen-to-door timeline you can count on.",
      Icon: Truck,
    },
  ];

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-b from-white via-oz-neutral/10 to-white py-20 md:py-24">
      {/* Parallax Background Layer */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-oz-primary/5 via-transparent to-oz-accent/5"
        style={{ y: backgroundY }}
      />
      
      {/* Decorative Elements */}
      <div className="absolute -right-20 top-20 h-64 w-64 rounded-full bg-oz-accent/10 blur-3xl" />
      <div className="absolute -left-20 bottom-20 h-64 w-64 rounded-full bg-oz-primary/10 blur-3xl" />
      
      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-oz-primary/20 bg-oz-primary/5 px-4 py-1.5 text-sm font-medium text-oz-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-oz-primary" />
              Simple Process
            </div>
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">How It Works</h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">A clean flow from goal → plan → delivery — without friction.</p>
          </motion.div>
        </div>

        <div className="relative mt-16">
          <div className="grid gap-6 lg:grid-cols-4 lg:gap-8">
            {steps.map(({ n, title, desc, Icon }, index) => (
              <StepCard 
                key={n} 
                n={n} 
                title={title} 
                desc={desc} 
                Icon={Icon} 
                index={index}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Individual Step Card with Scroll Reveal
function StepCard({ n, title, desc, Icon, index }: { 
  n: number; 
  title: string; 
  desc: string; 
  Icon: React.ComponentType<{ className?: string }>; 
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true, amount: 0.3 });
  
  // Number parallax (micro-movement)
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"]
  });
  const numberY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group"
    >
      <Card className="relative h-full overflow-hidden border-oz-neutral/40 bg-white shadow-lg transition-all duration-300 hover:border-oz-primary/40 hover:shadow-2xl">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-oz-primary/0 via-oz-primary/0 to-oz-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
        
        <CardHeader className="relative space-y-4 p-6">
          <div className="flex items-center justify-between">
            {/* Enhanced Icon with green background and white icon */}
            <motion.div
              animate={isInView ? {
                y: [0, -3, 0],
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.2
              }}
              className="relative inline-flex h-14 w-14 items-center justify-center rounded-xl bg-oz-primary shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
            >
              <Icon className="relative h-6 w-6 text-white transition-transform duration-300 group-hover:scale-110" />
            </motion.div>
            
            {/* Enhanced Number badge */}
            <motion.div
              style={{ y: numberY }}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-oz-primary/20 bg-gradient-to-br from-white to-oz-neutral/20 text-base font-bold text-oz-primary shadow-sm transition-all duration-300 group-hover:border-oz-primary/50 group-hover:shadow-md"
            >
              {String(n).padStart(2, "0")}
            </motion.div>
          </div>
          
          <div className="space-y-2 pt-2">
            <CardTitle className="text-lg font-bold text-oz-primary transition-colors duration-300 group-hover:text-oz-accent md:text-xl">
              {title}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground md:text-base">
              {desc}
            </CardDescription>
          </div>
        </CardHeader>
        
        {/* Bottom accent line - orange on hover */}
        <div className="h-1 w-0 bg-oz-accent transition-all duration-500 group-hover:w-full" />
      </Card>
    </motion.div>
  );
}

const FeaturedMealCard = ({ meal }: { meal: Meal }) => {
  // Handle image - it could be a string or an object with url property
  const imageUrl = typeof meal.image === 'string' 
    ? meal.image 
    : meal.image?.url || (meal.images?.[0] as any)?.url || '/placeholder-meal.png';

  // Calculate minimum weekly price based on protein pricing mode
  const getMinimumWeeklyPrice = () => {
    const mode = meal.proteinPricingMode || 'default';
    
    if (mode === 'default') {
      return meal.pricing?.weekly?.price || 0;
    }
    
    if (mode === 'with-only') {
      return meal.proteinPricing?.withProtein?.weekly?.price || 0;
    }
    
    if (mode === 'without-only') {
      return meal.proteinPricing?.withoutProtein?.weekly?.price || 0;
    }
    
    if (mode === 'both') {
      const withPrice = meal.proteinPricing?.withProtein?.weekly?.price || Infinity;
      const withoutPrice = meal.proteinPricing?.withoutProtein?.weekly?.price || Infinity;
      const minPrice = Math.min(withPrice, withoutPrice);
      return minPrice === Infinity ? 0 : minPrice;
    }
    
    return meal.pricing?.weekly?.price || 0;
  };

  const startingPrice = getMinimumWeeklyPrice();

  return (
    <Link to={`/meal-packs/${meal.slug || meal.id}`} className="group block">
      <Card className="h-full border-2 border-oz-primary/10 bg-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:border-oz-accent overflow-hidden">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-oz-primary/5 to-oz-accent/5">
          <img 
            src={imageUrl} 
            alt={meal.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.src = '/placeholder-meal.png';
            }}
          />
          {meal.isFeatured && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-oz-accent text-white font-semibold shadow-lg">
                <Star className="h-3 w-3 mr-1 fill-current" />
                Featured
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-5">
          <h3 className="text-lg font-bold text-oz-primary mb-2 group-hover:text-oz-accent transition-colors">
            {meal.name}
          </h3>
          <p className="text-xs text-oz-primary/60 mb-4 line-clamp-2">
            {meal.shortDescription || meal.description}
          </p>
          
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 text-oz-accent font-semibold">
                <Dumbbell className="h-4 w-4" />
                <span>{meal.proteinPerMeal}g</span>
              </div>
              <span className="text-oz-primary/40">•</span>
              <span className="text-oz-primary/70 text-xs">{meal.caloriesRange}</span>
            </div>
          </div>
          
          <div className="pt-3 border-t border-oz-primary/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-oz-primary/50">Starting from</p>
                <p className="text-xl font-bold text-oz-primary">₹{startingPrice}</p>
                <p className="text-xs text-oz-primary/50">Weekly • 5 Servings</p>
              </div>
              <ArrowRight className="h-5 w-5 text-oz-accent group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

function PlanCardView({ plan }: { plan: PlanCard }) {
  return (
    <Card className="group overflow-hidden border-oz-neutral/60 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative">
        <img
          src={plan.imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full object-cover"
        />
        <div className="absolute left-4 top-4">
          <Badge variant={plan.badgeTone} className="shadow-sm">
            {plan.badge}
          </Badge>
        </div>
      </div>
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl text-oz-primary">{plan.title}</CardTitle>
        <CardDescription className="text-sm">{plan.protein} • {plan.calories}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-oz-neutral/20 p-3">
          <div>
            <div className="text-xs text-muted-foreground">Weekly</div>
            <div className="font-semibold text-oz-primary">{plan.weekly}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Monthly</div>
            <div className="font-semibold text-oz-primary">{plan.monthly}</div>
          </div>
        </div>
        <Link to={plan.href} className="block">
          <Button className="w-full bg-oz-primary text-white hover:bg-oz-primary/90">
            View Plan <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

const Index = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [heroBannerIndex, setHeroBannerIndex] = useState(0);
  const [whyCarouselApi, setWhyCarouselApi] = useState<any>(null);
  const [featuredMeals, setFeaturedMeals] = useState<Meal[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  const heroBanners = useMemo<string[]>(() => {
    return isMobile ? [...mobileOnlyHeroBanners] : [...desktopHeroBanners];
  }, [isMobile]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = () => {
      setIsMobile(mediaQuery.matches);
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    setHeroBannerIndex(0);
  }, [isMobile]);

  useEffect(() => {
    if (heroBanners.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setHeroBannerIndex((current) => (current + 1) % heroBanners.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [heroBanners.length]);

  // Auto-play for mobile Why OG Gainz carousel
  useEffect(() => {
    if (!whyCarouselApi || !isMobile) return;

    const intervalId = setInterval(() => {
      whyCarouselApi.scrollNext();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [whyCarouselApi, isMobile]);

  // Fetch featured meals
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const response = await mealsCatalogService.listMeals({ isFeatured: true, limit: 4 });
        console.log('Featured Meals API Response:', response.data);
        response.data.forEach(meal => {
          console.log(`Meal: ${meal.name}`, {
            pricing: meal.pricing,
            weeklyPrice: meal.pricing?.weekly?.price,
            image: meal.image,
          });
        });
        setFeaturedMeals(response.data);
      } catch (error) {
        console.error('Failed to fetch featured meals:', error);
      } finally {
        setLoadingFeatured(false);
      }
    };
    fetchFeatured();
  }, []);

  // Smart sticky CTA visibility based on scroll
  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector('[data-hero-section]');
      const footer = document.querySelector('footer');
      
      if (heroSection && footer) {
        const heroBottom = heroSection.getBoundingClientRect().bottom;
        const footerTop = footer.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        
        // Show sticky CTA when hero is out of view but footer is not visible
        setShowStickyCTA(heroBottom < 0 && footerTop > windowHeight);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // GSAP ScrollTrigger animations
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const isMobileDevice = window.innerWidth < 768;

    // Hero background parallax (desktop only)
    if (!isMobileDevice) {
      const heroSection = document.querySelector('[data-hero-section]');
      if (heroSection) {
        gsap.to(heroSection, {
          backgroundPositionY: '20%',
          ease: 'none',
          scrollTrigger: {
            trigger: heroSection,
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
          },
        });
      }
    }

    // Animate section headers
    const sectionHeaders = gsap.utils.toArray('.gsap-section-header');
    sectionHeaders.forEach((header: any) => {
      gsap.from(header, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: header,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });
    });

    // Animate cards with fade-in and upward motion
    const cards = gsap.utils.toArray('.gsap-card');
    cards.forEach((card: any, index: number) => {
      gsap.from(card, {
        opacity: 0,
        y: 40,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
        delay: (index % 4) * 0.1, // Stagger within groups of 4
      });
    });

    // Stagger animations for step-based sections
    const stepCards = gsap.utils.toArray('.gsap-step-card');
    if (stepCards.length > 0) {
      gsap.from(stepCards, {
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: 'power2.out',
        stagger: 0.15,
        scrollTrigger: {
          trigger: stepCards[0],
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });
    }

    // Micro-parallax for decorative elements (desktop only)
    if (!isMobileDevice) {
      const decorativeElements = gsap.utils.toArray('.gsap-parallax-decoration');
      decorativeElements.forEach((element: any) => {
        gsap.to(element, {
          y: -50,
          ease: 'none',
          scrollTrigger: {
            trigger: element,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 2,
          },
        });
      });
    }

    // Feature boxes animation
    const featureBoxes = gsap.utils.toArray('.gsap-feature-box');
    featureBoxes.forEach((box: any, index: number) => {
      gsap.from(box, {
        opacity: 0,
        scale: 0.95,
        y: 30,
        duration: 0.6,
        ease: 'back.out(1.2)',
        scrollTrigger: {
          trigger: box,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
        delay: index * 0.1,
      });
    });

    // Cleanup
    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return (
    <div className="animate-fade-in">
      {/* 1️⃣ Hero Section (Above the Fold) */}
      <section
        className="relative isolate overflow-hidden h-[50vh] md:min-h-[520px]"
        data-hero-section
        style={{
          backgroundImage:
            "linear-gradient(135deg, #052d23 0%, #063b2d 40%, #0b5d44 100%)",
        }}
      >
        {/* Background images */}
        {heroBanners.map((src, idx) => (
          <div
            key={src}
            className="pointer-events-none absolute inset-0 -z-10 bg-no-repeat transition-opacity duration-1000 will-change-[opacity] bg-cover bg-center"
            style={{
              backgroundImage: `url('${src}')`,
              opacity: idx === heroBannerIndex ? 0.5 : 0,
            }}
          />
        ))}
        {/* Green fitness overlay */}
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'linear-gradient(to bottom, rgba(6, 78, 59, 0.55), rgba(6, 78, 59, 0.75))' }} />
        
        <div className="container mx-auto px-4 py-6 flex items-center h-[50vh] md:min-h-[520px] md:py-18">
          <div className="w-full max-w-lg mx-auto text-center md:mx-0 md:text-left md:max-w-2xl">
            
            {/* Badge / Eyebrow */}
            <div className="flex justify-center md:justify-start">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-xs sm:text-sm font-medium text-white backdrop-blur-sm">
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-oz-accent" />
                <span>Performance Nutrition System</span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="mt-4 text-3xl md:text-5xl font-extrabold leading-tight text-white tracking-tight text-center md:text-left">
              Nutrition Built for Performance.
            </h1>

            {/* Sub-headline */}
            <p className="mt-3 text-sm md:text-base text-white/90 font-medium text-center md:text-left leading-relaxed">
              High-protein meals, cooked fresh and delivered daily — designed to help you train better and stay consistent.
            </p>

            {/* Process line */}
            <div className="mt-3 text-xs md:text-sm text-white/70 font-medium text-center md:text-left">
              Choose → We Cook → We Deliver → You Perform
            </div>

            {/* Dual CTAs */}
            <div className="mt-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link to="/consultation">
                  <Button size="sm" className="w-full sm:w-auto bg-oz-accent hover:bg-oz-accent/90 text-white font-semibold px-6 py-2.5 text-sm shadow-lg transition-all hover:scale-105 active:scale-[0.98]">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/meal-packs">
                  <Button size="sm" variant="outline" className="w-full sm:w-auto border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-2.5 text-sm backdrop-blur-sm transition-all hover:scale-105 active:scale-[0.98]">
                    View Plans
                  </Button>
                </Link>
              </div>
              
              {/* Trust Line */}
              <div className="text-center md:text-left text-xs text-white/60">
                Takes under 60 seconds • Pause or cancel anytime
              </div>
            </div>

          </div>
        </div>

        {/* Smart sticky CTA - Only shows after hero scrolls out */}
        <div className="hidden">
          <div className="container mx-auto px-4 py-3">
            <Link to="/trial" className="block">
              <Button className="w-full bg-oz-accent hover:bg-oz-accent/90 text-white font-semibold py-3">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2️⃣ Why OG Gainz? (Value Proposition) */}
      <section className="bg-white py-8 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-3xl text-center gsap-section-header">
            <h2 className="text-2xl font-bold tracking-tight text-oz-primary md:text-4xl">Why OG Gainz Works</h2>
            <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-oz-primary to-oz-accent hidden sm:block" />
            <p className="mt-2 text-xs font-medium text-oz-primary/80 md:mt-6 md:text-base whitespace-nowrap">
              Because results come from systems — not motivation.
            </p>
          </div>

          {/* Desktop: 3-column grid */}
          <div className="mt-16 hidden grid-cols-1 gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
            {valueCards.map(({ title, description, Icon }) => (
              <Card
                key={title}
                className="group gsap-card h-full border-2 border-oz-primary/20 bg-white shadow-md transition-all hover:-translate-y-2 hover:border-oz-accent hover:shadow-lg"
                style={{ borderRadius: '16px', minHeight: '180px' }}
              >
                <CardHeader className="flex flex-col justify-between h-full space-y-3 p-6">
                  <div className="flex flex-col space-y-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-oz-primary">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg font-bold text-oz-primary">{title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed text-oz-primary/70">{description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
            
            {/* CTA Card */}
            <Card
              className="group h-full border-2 border-oz-primary/20 bg-white shadow-md transition-all hover:-translate-y-2 hover:border-oz-accent hover:shadow-lg"
              style={{ borderRadius: '16px', minHeight: '180px' }}
            >
              <CardHeader className="flex flex-col justify-between h-full space-y-3 p-6">
                <div className="flex flex-col space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-oz-primary">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg font-bold text-oz-primary">This Is a System</CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-oz-primary/70">
                    Not a diet. Not motivation. A repeatable performance framework.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Mobile: automatic infinite slider */}
          <div className="mt-6 md:hidden">
            <Carousel 
              opts={{ align: "start", loop: true }}
              setApi={setWhyCarouselApi}
              className="w-full"
            >
              <CarouselContent className="-ml-2">
                {[...valueCards, {
                  title: "This Is a System",
                  description: "Not a diet. Not motivation. A repeatable performance framework.",
                  Icon: Sparkles,
                  isCTA: true
                }].map(({ title, description, Icon, isCTA }) => (
                  <CarouselItem key={title} className="pl-2 basis-1/2">
                    <Card
                      className="h-full border-2 border-oz-primary/20 bg-white shadow-md"
                      style={{ borderRadius: '12px' }}
                    >
                      <CardHeader className="space-y-2 p-3">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-oz-primary">
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <CardTitle className="text-sm font-bold text-oz-primary leading-tight">{title}</CardTitle>
                        <CardDescription className="text-xs leading-snug text-oz-primary/70">
                          {description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </div>
      </section>

      {/* 3️⃣ Featured Meal Plans */}
      <section className="relative bg-gradient-to-b from-oz-neutral/5 via-white to-oz-neutral/5 py-16 md:py-24">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-10 w-72 h-72 bg-oz-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-oz-primary/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-oz-accent/10 border border-oz-accent/20 mb-4">
              <Sparkles className="h-4 w-4 text-oz-accent" />
              <span className="text-sm font-semibold text-oz-primary">Handpicked For You</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-oz-primary tracking-tight">
              Featured Meal Plans
            </h2>
            <p className="mt-4 text-base md:text-lg text-oz-primary/70 font-medium">
              Curated nutrition solutions engineered for peak performance and results.
            </p>
          </div>

          {loadingFeatured ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oz-accent"></div>
            </div>
          ) : featuredMeals.length > 0 ? (
            <>
              {/* Mobile: swipe */}
              <div className="md:hidden">
                <Carousel opts={{ align: "start", loop: true }} className="w-full">
                  <CarouselContent className="-ml-4">
                    {featuredMeals.map((meal) => (
                      <CarouselItem key={meal.id} className="pl-4 basis-[90%]">
                        <FeaturedMealCard meal={meal} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <CarouselPrevious className="static h-10 w-10 border-2 border-oz-primary/20 hover:border-oz-accent" />
                    <CarouselNext className="static h-10 w-10 border-2 border-oz-primary/20 hover:border-oz-accent" />
                  </div>
                </Carousel>
              </div>

              {/* Desktop: grid */}
              <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredMeals.map((meal) => (
                  <FeaturedMealCard key={meal.id} meal={meal} />
                ))}
              </div>
              
              <div className="mt-12 text-center">
                <Link to="/meal-packs">
                  <Button size="lg" className="bg-oz-accent hover:bg-oz-accent/90 text-white font-semibold px-8 py-6 text-base shadow-lg hover:shadow-xl transition-all hover:scale-105">
                    Explore All Meal Plans
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No featured meals available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* 4️⃣ How It Works (Process Flow) */}
      <HowItWorksSection />

      {/* 5️⃣ Build-Your-Own Meal (Feature Highlight) */}
      <section className="bg-oz-primary py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                <BadgeCheck className="h-4 w-4 text-oz-accent" />
                <span>Build-your-own control</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold md:text-4xl">Build meals your way.</h2>
              <p className="mt-3 text-white/80">
                Build meals your way — choose ingredients, portions, and nutrition.
              </p>
              <div className="mt-6">
                <Link to="/build-your-own">
                  <Button size="lg" className="bg-oz-accent text-white hover:bg-oz-accent/90">
                    Build Your Meal <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            <Card className="border-white/10 bg-white/5 text-white shadow-lg backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Ingredient grid (preview)</CardTitle>
                <CardDescription className="text-white/70">Visual mockup — sliders are non-functional.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {["Chicken", "Paneer", "Rice", "Veggies", "Eggs", "Sauce"].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm"
                    >
                      <div className="font-semibold">{item}</div>
                      <div className="mt-1 text-xs text-white/70">Portion preset</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-white/75">
                      <span>Protein</span>
                      <span>45g</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                      <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-oz-accent to-oz-accent/80 transition-all duration-300" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-white/75">
                      <span>Carbs</span>
                      <span>55g</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                      <div className="h-full w-[60%] rounded-full bg-gradient-to-r from-oz-accent to-oz-accent/80 transition-all duration-300" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-white/75">
                      <span>Fats</span>
                      <span>18g</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                      <div className="h-full w-[35%] rounded-full bg-gradient-to-r from-oz-accent to-oz-accent/80 transition-all duration-300" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 6️⃣ Subscription Power Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-oz-neutral/5 via-white to-oz-neutral/5 py-20 md:py-24">
        {/* Decorative Elements */}
        <div className="gsap-parallax-decoration absolute -left-20 top-20 h-72 w-72 rounded-full bg-oz-primary/5 blur-3xl" />
        <div className="gsap-parallax-decoration absolute -right-20 bottom-20 h-72 w-72 rounded-full bg-oz-accent/5 blur-3xl" />
        
        <div className="container relative z-10 mx-auto px-4">
          <motion.div 
            className="gsap-section-header mx-auto max-w-3xl text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-oz-primary/20 bg-oz-primary/5 px-4 py-1.5 text-sm font-medium text-oz-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-oz-primary" />
              Flexible Control
            </div>
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">Subscription Power</h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              A system that adapts to real life — while protecting your long-term results.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="group h-full overflow-hidden border-oz-neutral/40 bg-white shadow-lg transition-all duration-300 hover:border-oz-primary/40 hover:shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-oz-primary/0 to-oz-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
                <CardHeader className="relative">
                  <CardTitle className="text-lg font-bold text-oz-primary md:text-xl">Controls that keep you consistent</CardTitle>
                  <CardDescription className="text-base">Pause, skip, auto-extend, and view delivery schedules transparently.</CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <motion.div 
                      className="gsap-feature-box group/item rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-5 transition-all duration-300 hover:scale-105 hover:border-oz-primary/30 hover:shadow-md"
                      whileHover={{ y: -4 }}
                    >
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-oz-primary text-white transition-transform duration-300 group-hover/item:scale-110">
                        <PauseCircle className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-oz-primary">Pause anytime</div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Take breaks without resetting your plan.</p>
                    </motion.div>
                    
                    <motion.div 
                      className="gsap-feature-box group/item rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-5 transition-all duration-300 hover:scale-105 hover:border-oz-primary/30 hover:shadow-md"
                      whileHover={{ y: -4 }}
                    >
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-oz-primary text-white transition-transform duration-300 group-hover/item:scale-110">
                        <SkipForward className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-oz-primary">Skip today's meal</div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Busy day? Skip without losing control.</p>
                    </motion.div>
                    
                    <motion.div 
                      className="gsap-feature-box group/item rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-5 transition-all duration-300 hover:scale-105 hover:border-oz-primary/30 hover:shadow-md"
                      whileHover={{ y: -4 }}
                    >
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-oz-primary text-white transition-transform duration-300 group-hover/item:scale-110">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-oz-primary">Auto-extend end date</div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Skipped days extend your schedule automatically.</p>
                    </motion.div>
                    
                    <motion.div 
                      className="gsap-feature-box group/item rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-5 transition-all duration-300 hover:scale-105 hover:border-oz-primary/30 hover:shadow-md"
                      whileHover={{ y: -4 }}
                    >
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-oz-primary text-white transition-transform duration-300 group-hover/item:scale-110">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-oz-primary">Admin-verified schedules</div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Operational clarity with verified delivery plans.</p>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="group h-full overflow-hidden border-oz-neutral/40 bg-white shadow-lg transition-all duration-300 hover:border-oz-primary/40 hover:shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-oz-primary/0 to-oz-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
                <CardHeader className="relative">
                  <CardTitle className="text-lg font-bold text-oz-primary md:text-xl">Calendar preview</CardTitle>
                  <CardDescription className="text-base">Display-only preview of statuses and schedule clarity.</CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <div className="rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-oz-primary text-white hover:bg-oz-primary/90 shadow-sm">Active</Badge>
                      <Badge variant="secondary" className="shadow-sm">Paused</Badge>
                      <Badge variant="outline" className="shadow-sm">Skipped</Badge>
                    </div>
                    <Separator className="my-5" />
                    <div className="grid grid-cols-7 gap-2 text-center text-xs">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d) => (
                        <div key={d} className="font-semibold text-oz-primary/70">{d}</div>
                      ))}
                    {Array.from({ length: 28 }).map((_, idx) => {
                        const day = idx + 1;
                          const tone =
                            day === 7 || day === 14
                              ? "border-2 border-oz-primary bg-oz-primary/10 text-oz-primary font-bold shadow-sm hover:scale-110 transition-transform cursor-pointer"
                            : day === 10
                              ? "bg-oz-neutral/60 text-oz-primary font-semibold hover:scale-110 transition-transform cursor-pointer"
                            : day === 18
                              ? "border-2 border-dashed border-oz-primary/30 text-muted-foreground hover:scale-110 transition-transform cursor-pointer"
                            : "text-muted-foreground hover:bg-oz-neutral/20 hover:scale-110 transition-all cursor-pointer";
                          return (
                            <div key={day} className={`rounded-lg px-2 py-2.5 ${tone}`}>{day}</div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 7️⃣ Daily Delivery Timeline Preview */}
      <section className="relative overflow-hidden bg-gradient-to-b from-oz-neutral/10 via-white to-oz-neutral/10 py-20 md:py-24">
        {/* Decorative Elements */}
        <div className="absolute -right-32 top-16 h-80 w-80 rounded-full bg-oz-accent/5 blur-3xl" />
        <div className="absolute -left-32 bottom-16 h-80 w-80 rounded-full bg-oz-primary/5 blur-3xl" />
        
        <div className="container relative z-10 mx-auto px-4">
          <motion.div 
            className="mx-auto max-w-3xl text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-oz-primary/20 bg-oz-primary/5 px-4 py-1.5 text-sm font-medium text-oz-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-oz-primary" />
              Real-Time Tracking
            </div>
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">Daily Delivery Timeline</h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">Enterprise-grade clarity from kitchen to doorstep.</p>
          </motion.div>

          <motion.div 
            className="mx-auto mt-16 max-w-5xl"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="group overflow-hidden border-oz-neutral/40 bg-white shadow-2xl transition-all duration-300 hover:shadow-3xl">
              <div className="absolute inset-0 bg-gradient-to-br from-oz-primary/0 via-transparent to-oz-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
              <CardContent className="relative p-8 md:p-10">
                <div className="grid gap-8 md:grid-cols-4">
                  {[
                    { title: "Cooking", status: "Active", tone: "bg-oz-primary text-white", progress: 100, icon: "🍳" },
                    { title: "Packed", status: "Active", tone: "bg-oz-primary text-white", progress: 100, icon: "📦" },
                    { title: "Out for Delivery", status: "Active", tone: "bg-oz-primary text-white", progress: 75, icon: "🚚" },
                    { title: "Delivered", status: "Scheduled", tone: "bg-oz-neutral/60 text-oz-primary", progress: 0, icon: "✓" },
                  ].map((step, index) => (
                    <motion.div 
                      key={step.title} 
                      className="group/step relative"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 + 0.3 }}
                      whileHover={{ y: -4 }}
                    >
                      {/* Background glow effect */}
                      <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-oz-primary/5 to-oz-accent/5 opacity-0 blur-xl transition-opacity duration-300 group-hover/step:opacity-100" />
                      
                      <div className="relative">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <motion.div
                              className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-oz-primary/10 to-oz-accent/10 shadow-md transition-all duration-300 group-hover/step:scale-110 group-hover/step:shadow-lg"
                              whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                              transition={{ duration: 0.5 }}
                            >
                              <span className="text-2xl">{step.icon}</span>
                            </motion.div>
                            <div>
                              <div className="text-sm font-bold text-oz-primary">{step.title}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">In Progress</div>
                            </div>
                          </div>
                          <span className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-md transition-all duration-300 group-hover/step:scale-110 ${step.tone}`}>
                            {step.status}
                          </span>
                        </div>
                        
                        <div className="relative h-4 overflow-hidden rounded-full bg-gradient-to-r from-oz-neutral/20 to-oz-neutral/10 shadow-inner">
                          <motion.div 
                            className="h-full rounded-full bg-gradient-to-r from-oz-accent via-oz-accent to-oz-accent shadow-lg"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${step.progress}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.2, delay: index * 0.15 + 0.5, ease: "easeOut" }}
                          >
                            <div className="h-full w-full animate-pulse bg-white/20" />
                          </motion.div>
                          {step.progress > 0 && (
                            <motion.div
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.15 + 1.5 }}
                            >
                              {step.progress}%
                            </motion.div>
                          )}
                        </div>
                      </div>
                      
                      {/* Connector line */}
                      {index < 3 && (
                        <div className="absolute -right-4 top-10 hidden h-px w-8 md:block">
                          <div className="h-full w-full bg-gradient-to-r from-oz-primary/40 via-oz-accent/40 to-transparent" />
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-oz-accent to-transparent"
                            initial={{ scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: index * 0.15 + 0.8 }}
                            style={{ originX: 0 }}
                          />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* 8️⃣ Consultation Call-Out */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="group relative overflow-hidden border-2 border-oz-primary/30 bg-gradient-to-br from-oz-neutral/30 via-oz-primary/5 to-oz-accent/10 shadow-xl transition-all duration-500 hover:shadow-2xl">
              {/* Decorative glow effect */}
              <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-oz-primary/10 blur-3xl transition-all duration-700 group-hover:bg-oz-primary/20" />
              <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-oz-accent/10 blur-3xl transition-all duration-700 group-hover:bg-oz-accent/20" />
              
              <CardContent className="relative grid items-center gap-8 p-8 md:grid-cols-[1fr_auto] md:p-12">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  {/* Badge */}
                  <motion.div
                    className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oz-primary/20 to-oz-accent/20 px-4 py-1.5 text-sm font-semibold text-oz-primary shadow-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    <span className="text-base">🎯</span>
                    Personalized Guidance
                  </motion.div>
                  
                  <h3 className="text-lg font-bold text-oz-primary md:text-xl">
                    Not sure what plan fits you?
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                    Talk to our nutrition expert and get matched in minutes. Free consultation with personalized meal recommendations.
                  </p>
                  
                  {/* Feature highlights */}
                  <div className="mt-6 flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oz-primary/10 text-xs">✓</span>
                      Free & No Commitment
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oz-primary/10 text-xs">✓</span>
                      Expert Nutritionists
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oz-primary/10 text-xs">✓</span>
                      Personalized Plans
                    </div>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="flex gap-3"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <Link to="/consultation">
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        size="lg" 
                        className="group/btn relative overflow-hidden bg-gradient-to-r from-oz-primary to-oz-primary/90 px-8 py-6 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl md:text-lg"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          Book a Free Consultation
                          <motion.span
                            animate={{ x: [0, 4, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            →
                          </motion.span>
                        </span>
                        {/* Hover gradient effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-oz-accent to-oz-primary opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
                      </Button>
                    </motion.div>
                  </Link>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* 9️⃣ Testimonials / Social Proof */}
      <section className="relative overflow-hidden bg-gradient-to-br from-oz-neutral/30 via-oz-primary/5 to-oz-accent/10 py-20">
        {/* Decorative background elements */}
        <div className="gsap-parallax-decoration absolute left-0 top-0 h-64 w-64 rounded-full bg-oz-primary/5 blur-3xl" />
        <div className="gsap-parallax-decoration absolute bottom-0 right-0 h-64 w-64 rounded-full bg-oz-accent/5 blur-3xl" />
        
        <div className="container relative mx-auto px-4">
          <motion.div 
            className="gsap-section-header mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oz-primary/20 to-oz-accent/20 px-4 py-1.5 text-sm font-semibold text-oz-primary shadow-sm"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-base">💪</span>
              Real Stories, Real Results
            </motion.div>
            
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">
              Loved by lifters and professionals
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              Short transformation stories from real routines.
            </p>
          </motion.div>

          <TestimonialCarousel testimonials={testimonials} />
        </div>
      </section>

      {/* 🔟 Trust & Quality Assurance */}
      <section className="relative overflow-hidden bg-white py-20">
        {/* Decorative elements */}
        <div className="gsap-parallax-decoration absolute left-0 top-0 h-48 w-48 rounded-full bg-oz-primary/5 blur-3xl" />
        <div className="gsap-parallax-decoration absolute bottom-0 right-0 h-48 w-48 rounded-full bg-oz-accent/5 blur-3xl" />
        
        <div className="container relative mx-auto px-4">
          <motion.div
            className="gsap-section-header mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oz-primary/20 to-oz-accent/20 px-4 py-1.5 text-sm font-semibold text-oz-primary shadow-sm"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-base">🛡️</span>
              Quality Assurance
            </motion.div>
            
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">
              Trust & Quality
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              Clean kitchens. Verified nutrition. Fresh ingredients. Secure payments.
            </p>
          </motion.div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Hygienic kitchens", Icon: ChefHat, desc: "Clean prep standards for daily production." },
              { title: "Certified nutritionists", Icon: BadgeCheck, desc: "Plans built with performance in mind." },
              { title: "Fresh ingredients", Icon: Leaf, desc: "Quality inputs for consistent results." },
              { title: "Secure payments (Razorpay)", Icon: ShieldCheck, desc: "Safe checkout experience." },
            ].map(({ title, desc, Icon }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <Card className="gsap-card group h-full border-2 border-oz-neutral/20 bg-gradient-to-br from-white to-oz-neutral/5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-oz-primary/30 hover:shadow-xl">
                  <CardHeader className="space-y-3 pb-5">
                    <motion.div
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-oz-primary/10 to-oz-accent/10 transition-all duration-300 group-hover:from-oz-primary/20 group-hover:to-oz-accent/20"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <Icon className="h-6 w-6 text-oz-primary" />
                    </motion.div>
                    <CardTitle className="text-lg font-bold text-oz-primary">{title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">{desc}</CardDescription>
                    
                    {/* Bottom accent line */}
                    <div className="h-1 w-8 rounded-full bg-gradient-to-r from-oz-primary to-oz-accent transition-all duration-300 group-hover:w-12" />
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 1️⃣1️⃣ FAQs */}
      <section className="relative overflow-hidden bg-gradient-to-br from-oz-neutral/20 via-white to-oz-primary/5 py-20">
        {/* Decorative background elements */}
        <div className="absolute left-0 top-20 h-72 w-72 rounded-full bg-oz-accent/10 blur-3xl" />
        <div className="absolute right-0 bottom-20 h-96 w-96 rounded-full bg-oz-primary/10 blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            className="gsap-section-header mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oz-accent/20 to-oz-primary/20 px-5 py-2 text-sm font-semibold text-oz-primary shadow-md border border-oz-primary/10"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <span className="text-lg">❓</span>
              Common Questions
            </motion.div>
            
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl bg-gradient-to-r from-oz-primary to-oz-secondary bg-clip-text text-transparent">
              FAQs
            </h2>
            <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-oz-primary to-oz-accent" />
            <p className="mt-4 text-sm md:text-base text-muted-foreground font-medium">
              Quick answers to the most common questions.
            </p>
          </motion.div>

          <motion.div
            className="mx-auto mt-12 max-w-3xl"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="border-2 border-oz-primary/10 bg-white shadow-xl overflow-hidden">
              <CardContent className="p-5 md:p-6">`n                <Accordion type="single" collapsible className="w-full space-y-2">
                  <AccordionItem value="pause">
                    <AccordionTrigger>Can I pause my subscription?</AccordionTrigger>
                    <AccordionContent>
                      Yes — pause anytime. Your schedule can resume when you’re ready.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="skip">
                    <AccordionTrigger>Can I skip a day?</AccordionTrigger>
                    <AccordionContent>
                      Yes — skip today’s meal when plans change, without losing control of your routine.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem 
                    value="trial" 
                    className="border-0 rounded-xl bg-gradient-to-r from-oz-primary/5 to-oz-accent/5 px-5 py-2 shadow-sm hover:shadow-md transition-all duration-300 data-[state=open]:shadow-lg data-[state=open]:from-oz-primary/10 data-[state=open]:to-oz-accent/10"
                  >
                    <AccordionTrigger className="text-oz-primary font-semibold hover:no-underline py-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                          <BadgeCheck className="h-5 w-5" />
                        </div>
                        <span>Is there a trial?</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pt-2 pb-4 pl-[52px]">
                      Yes — start with Trial Packs to experience OG Gainz before subscribing.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem 
                    value="delivery" 
                    className="border-0 rounded-xl bg-gradient-to-r from-oz-primary/5 to-oz-accent/5 px-5 py-2 shadow-sm hover:shadow-md transition-all duration-300 data-[state=open]:shadow-lg data-[state=open]:from-oz-primary/10 data-[state=open]:to-oz-accent/10"
                  >
                    <AccordionTrigger className="text-oz-primary font-semibold hover:no-underline py-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-md">
                          <Truck className="h-5 w-5" />
                        </div>
                        <span>How does delivery work?</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pt-2 pb-4 pl-[52px]">
                      Meals follow a clear daily workflow (cooking → packed → out for delivery → delivered).
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* 1️⃣2️⃣ Final CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-oz-primary via-oz-secondary to-oz-primary py-20 text-white md:py-24">
        {/* Decorative elements */}
        <div className="gsap-parallax-decoration absolute left-0 top-0 h-64 w-64 rounded-full bg-oz-accent/20 blur-3xl" />
        <div className="gsap-parallax-decoration absolute bottom-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="gsap-parallax-decoration absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-oz-accent/10 blur-3xl" />
        
        <div className="container relative mx-auto px-4">
          <motion.div
            className="gsap-section-header mx-auto max-w-3xl text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div
              className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm"
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-base">🚀</span>
              Ready to Transform?
            </motion.div>
            
            <motion.h2
              className="text-3xl font-bold leading-tight md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Start your fitness nutrition journey today.
            </motion.h2>
            
            <motion.p
              className="mt-6 text-base text-white/90 md:text-lg"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Choose a plan, lock in consistency, and let the system do the work.
            </motion.p>
            
            <motion.div
              className="mt-10 flex flex-col justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Link to="/trial" className="hidden md:inline-flex">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    className="group/btn relative w-full overflow-hidden bg-oz-accent px-8 py-6 text-base font-semibold text-white shadow-xl transition-all duration-300 hover:shadow-2xl sm:w-auto md:text-lg"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Get Started
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight className="h-5 w-5" />
                      </motion.span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-oz-accent to-oz-primary opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
                  </Button>
                </motion.div>
              </Link>
              <Link to="/meal-packs">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-2 border-white/40 bg-white/10 px-8 py-6 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20 sm:w-auto md:text-lg"
                  >
                    View Plans
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
            
            {/* Trust indicators */}
            <motion.div
              className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-white/70"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">✓</span>
                No commitment trial
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base">✓</span>
                Pause or skip anytime
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base">✓</span>
                Secure payments
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default Index;

