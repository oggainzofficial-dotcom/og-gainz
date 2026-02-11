import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
    description:
      "Meals engineered for fat loss, muscle gain, or recomposition — not generic dieting.",
    Icon: ClipboardList,
  },
  {
    title: "Protein-Forward by Design",
    description:
      "35–50g protein per meal so your nutrition actually supports training.",
    Icon: Dumbbell,
  },
  {
    title: "Zero Missed Days",
    description:
      "Fresh meals delivered daily, so consistency is never optional.",
    Icon: Truck,
  },
  {
    title: "You Stay in Control",
    description: "Pause, skip, or extend anytime — without breaking progress.",
    Icon: CalendarDays,
  },
  {
    title: "Progress You Can Track",
    description:
      "Macro-aware plans that make results measurable, not guesswork.",
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
    quote:
      "I finally stopped guessing my macros. OG Gainz made my cut consistent — and effortless.",
    rating: 5,
  },
  {
    name: "Ayesha",
    role: "Working Professional",
    quote:
      "The subscription controls are a game-changer. I can pause and skip without losing my plan.",
    rating: 5,
  },
  {
    name: "Karan",
    role: "Athlete",
    quote:
      "Protein targets, delivery reliability, clean taste. It feels like a nutrition system — not a food app.",
    rating: 5,
  },
];

const desktopHeroBanners = [
  "/home/banner1.png",
  "/home/banner2.png",
  "/home/banner3.png",
  "/home/banner4.png",
] as const;
const mobileOnlyHeroBanners = [
  "/home/mobile-banner1.png",
  "/home/mobile-banner2.png",
  "/home/mobile-banner3.png",
] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-1"
      aria-label={`${rating} out of 5 stars`}
    >
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
function TestimonialCarousel({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-slide every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [testimonials.length]);

  const handlePrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length,
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <div className="mx-auto mt-12 max-w-5xl">
      <div className="relative overflow-hidden px-4">
        {/* Testimonial Cards */}
        <div className="relative h-[280px] md:h-[240px]">
          <div key={currentIndex} className="absolute inset-0">
            <div className="grid h-full gap-6 md:grid-cols-2">
              {[
                testimonials[currentIndex],
                testimonials[(currentIndex + 1) % testimonials.length],
              ].map((testimonial, idx) => (
                <div
                  key={`${currentIndex}-${idx}`}
                  className="testimonial-card-item"
                >
                  <Card className="group relative h-full overflow-hidden border-2 border-oz-primary/30 bg-gradient-to-br from-white via-oz-neutral/5 to-oz-primary/5 shadow-lg transition-all duration-500 hover:scale-[1.02] hover:border-oz-primary/50 hover:shadow-xl">
                    {/* Decorative quote icon */}
                    <div className="testimonial-quote-icon absolute right-4 top-4 opacity-5 transition-opacity duration-300 group-hover:opacity-10">
                      <Quote className="h-20 w-20 text-oz-primary" />
                    </div>

                    {/* Glow effect */}
                    <div className="testimonial-glow-effect absolute -right-8 -top-8 h-24 w-24 rounded-full bg-oz-accent/5 blur-2xl transition-all duration-500 group-hover:bg-oz-accent/10" />

                    <CardHeader className="relative space-y-2 pb-3">
                      <div className="flex items-center justify-between">
                        <div className="testimonial-stars inline-flex">
                          <Stars rating={testimonial.rating} />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="testimonial-initial flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oz-primary text-lg font-bold text-white shadow-md ring-2 ring-oz-primary/20 transition-transform duration-300 group-hover:scale-110">
                          {testimonial.name[0]}
                        </div>
                        <div className="testimonial-info min-w-0">
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
                      <p className="testimonial-quote text-sm leading-relaxed text-muted-foreground">
                        "{testimonial.quote}"
                      </p>

                      {/* Bottom accent line */}
                      <div className="testimonial-accent-line mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-oz-accent to-oz-primary transition-all duration-300 group-hover:w-20" />
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="mt-8 flex items-center justify-center gap-6">
        <button
          onClick={handlePrev}
          className="nav-prev-btn flex h-12 w-12 items-center justify-center rounded-full border-2 border-oz-primary/30 bg-white text-oz-primary shadow-lg transition-all duration-300 hover:border-oz-primary hover:bg-oz-primary hover:text-white"
        >
          <ArrowRight className="h-5 w-5 rotate-180" />
        </button>

        {/* Dot indicators */}
        <div className="flex gap-2">
          {testimonials.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
              }}
              className={`dot-indicator h-2.5 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-8 bg-oz-primary shadow-md"
                  : "w-2.5 bg-oz-primary/30 hover:bg-oz-primary/50"
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="nav-next-btn flex h-12 w-12 items-center justify-center rounded-full border-2 border-oz-primary/30 bg-white text-oz-primary shadow-lg transition-all duration-300 hover:border-oz-primary hover:bg-oz-primary hover:text-white"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="testimonial-progress-bar mx-auto mt-6 h-1 w-full max-w-md overflow-hidden rounded-full bg-oz-accent/10">
        <div className="testimonial-progress-fill h-full bg-gradient-to-r from-oz-accent to-oz-accent" />
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
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
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
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-gradient-to-b from-white via-oz-neutral/10 to-white py-20 md:py-24"
    >
      {/* Parallax Background Layer */}
      <div className="how-it-works-bg-parallax absolute inset-0 bg-gradient-to-br from-oz-primary/5 via-transparent to-oz-accent/5" />

      {/* Decorative Elements */}
      <div className="absolute -right-20 top-20 h-64 w-64 rounded-full bg-oz-accent/10 blur-3xl" />
      <div className="absolute -left-20 bottom-20 h-64 w-64 rounded-full bg-oz-primary/10 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="how-it-works-header">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-oz-primary/20 bg-oz-primary/5 px-4 py-1.5 text-sm font-medium text-oz-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-oz-primary" />
              Simple Process
            </div>
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              A clean flow from goal → plan → delivery — without friction.
            </p>
          </div>
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
function StepCard({
  n,
  title,
  desc,
  Icon,
  index,
}: {
  n: number;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={cardRef} className="gsap-step-card-element group">
      <Card className="relative h-full overflow-hidden border-oz-neutral/40 bg-white shadow-lg transition-all duration-300 hover:border-oz-primary/40 hover:shadow-2xl">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-oz-primary/0 via-oz-primary/0 to-oz-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />

        <CardHeader className="relative space-y-4 p-6">
          <div className="flex items-center justify-between">
            {/* Enhanced Icon with green background and white icon */}
            <div className="step-card-icon-container relative inline-flex h-14 w-14 items-center justify-center rounded-xl bg-oz-primary shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
              <Icon className="relative h-6 w-6 text-white transition-transform duration-300 group-hover:scale-110" />
            </div>

            {/* Enhanced Number badge */}
            <div className="step-card-number-badge flex h-10 w-10 items-center justify-center rounded-full border-2 border-oz-primary/20 bg-gradient-to-br from-white to-oz-neutral/20 text-base font-bold text-oz-primary shadow-sm transition-all duration-300 group-hover:border-oz-primary/50 group-hover:shadow-md">
              {String(n).padStart(2, "0")}
            </div>
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
    </div>
  );
}

const FeaturedMealCard = ({ meal }: { meal: Meal }) => {
  // Handle image - it could be a string or an object with url property
  const imageUrl =
    typeof meal.image === "string"
      ? meal.image
      : meal.image?.url ||
        (meal.images?.[0] as any)?.url ||
        "/placeholder-meal.png";

  // Calculate minimum weekly price based on protein pricing mode
  const getMinimumWeeklyPrice = () => {
    const mode = meal.proteinPricingMode || "default";

    if (mode === "default") {
      return meal.pricing?.weekly?.price || 0;
    }

    if (mode === "with-only") {
      return meal.proteinPricing?.withProtein?.weekly?.price || 0;
    }

    if (mode === "without-only") {
      return meal.proteinPricing?.withoutProtein?.weekly?.price || 0;
    }

    if (mode === "both") {
      const withPrice =
        meal.proteinPricing?.withProtein?.weekly?.price || Infinity;
      const withoutPrice =
        meal.proteinPricing?.withoutProtein?.weekly?.price || Infinity;
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
              e.currentTarget.src = "/placeholder-meal.png";
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
              <span className="text-oz-primary/70 text-xs">
                {meal.caloriesRange}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-oz-primary/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-oz-primary/50">Starting from</p>
                <p className="text-xl font-bold text-oz-primary">
                  ₹{startingPrice}
                </p>
                <p className="text-xs text-oz-primary/50">
                  Weekly • 5 Servings
                </p>
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
        <CardDescription className="text-sm">
          {plan.protein} • {plan.calories}
        </CardDescription>
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
        const response = await mealsCatalogService.listMeals({
          isFeatured: true,
          limit: 4,
        });
        console.log("Featured Meals API Response:", response.data);
        response.data.forEach((meal) => {
          console.log(`Meal: ${meal.name}`, {
            pricing: meal.pricing,
            weeklyPrice: meal.pricing?.weekly?.price,
            image: meal.image,
          });
        });
        setFeaturedMeals(response.data);
      } catch (error) {
        console.error("Failed to fetch featured meals:", error);
      } finally {
        setLoadingFeatured(false);
      }
    };
    fetchFeatured();
  }, []);

  // Smart sticky CTA visibility based on scroll
  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector("[data-hero-section]");
      const footer = document.querySelector("footer");

      if (heroSection && footer) {
        const heroBottom = heroSection.getBoundingClientRect().bottom;
        const footerTop = footer.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        // Show sticky CTA when hero is out of view but footer is not visible
        setShowStickyCTA(heroBottom < 0 && footerTop > windowHeight);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // GSAP ScrollTrigger animations
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const isMobileDevice = window.innerWidth < 768;

    // Hero background parallax (desktop only)
    if (!isMobileDevice) {
      const heroSection = document.querySelector("[data-hero-section]");
      if (heroSection) {
        gsap.to(heroSection, {
          backgroundPositionY: "20%",
          ease: "none",
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });
      }
    }

    // Animate section headers
    const sectionHeaders = gsap.utils.toArray(".gsap-section-header");
    sectionHeaders.forEach((header: any) => {
      gsap.from(header, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: header,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    });

    // Animate cards with fade-in and upward motion
    const cards = gsap.utils.toArray(".gsap-card");
    cards.forEach((card: any, index: number) => {
      gsap.from(card, {
        opacity: 0,
        y: 40,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: card,
          start: "top 90%",
          toggleActions: "play none none none",
        },
        delay: (index % 4) * 0.1, // Stagger within groups of 4
      });
    });

    // Stagger animations for step-based sections
    const stepCards = gsap.utils.toArray(".gsap-step-card");
    if (stepCards.length > 0) {
      gsap.from(stepCards, {
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: "power2.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: stepCards[0] as HTMLElement,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    }

    // Micro-parallax for decorative elements (desktop only)
    if (!isMobileDevice) {
      const decorativeElements = gsap.utils.toArray(
        ".gsap-parallax-decoration",
      );
      decorativeElements.forEach((element: any) => {
        gsap.to(element, {
          y: -50,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            scrub: 2,
          },
        });
      });
    }

    // 1. Hero Section Content Entrance Animation
    const heroSectionEl = document.querySelector("[data-hero-section]");
    if (heroSectionEl) {
      const heroContentWrapper = heroSectionEl.querySelector(
        ".container.mx-auto.px-4.py-6.flex.items-center.h-\\[50vh\\].md\\:min-h-\\[520px\\].md\\:py-18 > div",
      ); // The div containing all hero text and buttons
      const heroBadge = heroContentWrapper?.querySelector(
        ".inline-flex.items-center.gap-1\\.5",
      );
      const heroHeadline = heroContentWrapper?.querySelector("h1");
      const heroSubheadline =
        heroContentWrapper?.querySelector("p.mt-3.text-sm");
      const heroProcessLine =
        heroContentWrapper?.querySelector("div.mt-3.text-xs"); // specific class for process line
      const heroCTABtns = heroContentWrapper?.querySelector(
        "div.mt-6.space-y-3 > div",
      ); // The div containing the two Link buttons
      if (
        heroBadge &&
        heroHeadline &&
        heroSubheadline &&
        heroProcessLine &&
        heroCTABtns
      ) {
        gsap
          .timeline({ delay: 0.5 }) // Initial delay for page load
          .from(heroBadge, {
            opacity: 0,
            y: 20,
            scale: 0.8,
            ease: "back.out(1.7)",
            duration: 0.7,
          })
          .from(
            heroHeadline,
            { opacity: 0, y: 30, ease: "power3.out", duration: 0.8 },
            "<0.2",
          )
          .from(
            heroSubheadline,
            { opacity: 0, y: 20, ease: "power2.out", duration: 0.7 },
            "<0.1",
          )
          .from(
            heroProcessLine,
            { opacity: 0, y: 15, ease: "power1.out", duration: 0.6 },
            "<0.1",
          )
          .from(
            heroCTABtns,
            { opacity: 0, y: 20, ease: "back.out(1.2)", duration: 0.7 },
            "<0.2",
          );
      }
    }

    // Hero background parallax (desktop only)
    if (!isMobileDevice) {
      const heroSection = document.querySelector("[data-hero-section]");
      if (heroSection) {
        gsap.to(heroSection, {
          backgroundPositionY: "20%",
          ease: "none",
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });
      }
    }

    // Micro-parallax for decorative elements (desktop only)
    if (!isMobileDevice) {
      const decorativeElements = gsap.utils.toArray(
        ".gsap-parallax-decoration",
      );
      decorativeElements.forEach((element: any) => {
        gsap.to(element, {
          y: -50,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            scrub: 2,
          },
        });
      });
    }

    // Feature boxes animation
    const featureBoxes = gsap.utils.toArray(".gsap-feature-box");
    featureBoxes.forEach((box: any, index: number) => {
      gsap.from(box, {
        opacity: 0,
        scale: 0.95,
        y: 30,
        duration: 0.6,
        ease: "back.out(1.2)",
        scrollTrigger: {
          trigger: box,
          start: "top 88%",
          toggleActions: "play none none none",
        },
        delay: index * 0.1,
      });
    });

    // 4. How It Works Section Animations
    const howItWorksSection = document.querySelector(".how-it-works-section");
    if (howItWorksSection) {
      // Header animation
      const headerElement = howItWorksSection.querySelector(
        ".how-it-works-header",
      );
      if (headerElement) {
        gsap.from(headerElement, {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: headerElement,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });
      }

      // Step cards animation
      const stepCards = gsap.utils.toArray(".gsap-step-card-element");
      gsap.from(stepCards, {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power2.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: stepCards[0] as HTMLElement,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      // Parallax background effect
      const bgParallax = howItWorksSection.querySelector(
        ".how-it-works-bg-parallax",
      );
      if (bgParallax) {
        gsap.to(bgParallax, {
          y: 50,
          scrollTrigger: {
            trigger: howItWorksSection,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // Decorative elements parallax
      const decoRight = howItWorksSection.querySelector(
        ".how-it-works-deco-right",
      );
      const decoLeft = howItWorksSection.querySelector(
        ".how-it-works-deco-left",
      );
      if (decoRight) {
        gsap.to(decoRight, {
          y: -30,
          x: -30,
          scrollTrigger: {
            trigger: howItWorksSection,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
          },
        });
      }
      if (decoLeft) {
        gsap.to(decoLeft, {
          y: 30,
          x: 30,
          scrollTrigger: {
            trigger: howItWorksSection,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
          },
        });
      }
    }

    // 5. Build-Your-Own Section Animations
    const buildYourOwnSection = document.querySelector(
      ".gsap-build-your-own-section",
    );
    if (buildYourOwnSection) {
      gsap.from(buildYourOwnSection, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: buildYourOwnSection,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      const buildYourOwnCard = document.querySelector(
        ".gsap-build-your-own-card",
      );
      if (buildYourOwnCard) {
        gsap.from(buildYourOwnCard, {
          opacity: 0,
          x: 50,
          duration: 0.9,
          ease: "power2.out",
          scrollTrigger: {
            trigger: buildYourOwnCard,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });
      }

      const ingredientItems = gsap.utils.toArray(".gsap-ingredient-item");
      gsap.from(ingredientItems, {
        opacity: 0,
        scale: 0.8,
        duration: 0.6,
        ease: "elastic.out(1, 0.5)",
        stagger: 0.1,
        scrollTrigger: {
          trigger: ingredientItems[0] as HTMLElement,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    }

    // 6. Subscription Power Section Animations
    const subscriptionSection = document.querySelector(
      ".gsap-subscription-card",
    );
    if (subscriptionSection) {
      gsap.from(subscriptionSection, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: subscriptionSection,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      const featureBoxes = gsap.utils.toArray(".gsap-feature-box");
      gsap.from(featureBoxes, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: featureBoxes[0] as HTMLElement,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    }

    // 7. Daily Delivery Timeline Animations
    const dailyDeliverySection = document.querySelector(
      ".daily-delivery-card-container",
    );
    if (dailyDeliverySection) {
      gsap.from(dailyDeliverySection, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: dailyDeliverySection,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      const deliverySteps = gsap.utils.toArray(".daily-delivery-step");
      gsap.from(deliverySteps, {
        opacity: 0,
        x: -30,
        duration: 0.7,
        ease: "power2.out",
        stagger: 0.2,
        scrollTrigger: {
          trigger: deliverySteps[0] as HTMLElement,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });

      const deliveryIcons = gsap.utils.toArray(
        ".gsap-delivery-step-icon-container",
      );
      gsap.from(deliveryIcons, {
        opacity: 0,
        scale: 0.8,
        duration: 0.6,
        ease: "bounce.out",
        stagger: 0.2,
        scrollTrigger: {
          trigger: deliveryIcons[0] as HTMLElement,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    }

    // 8. Consultation Card Animations
    const consultationCard = document.querySelector(
      ".gsap-consultation-card-wrapper",
    );
    if (consultationCard) {
      gsap.from(consultationCard, {
        opacity: 0,
        y: 30,
        duration: 0.9,
        ease: "power2.out",
        scrollTrigger: {
          trigger: consultationCard,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });
    }

    // 9. Testimonials Section Animations
    const testimonialsSection = document.querySelector(
      ".gsap-testimonials-section",
    );
    if (testimonialsSection) {
      // Header animation
      const testimonialHeader = testimonialsSection.querySelector(
        ".gsap-section-header",
      );
      if (testimonialHeader) {
        gsap.from(testimonialHeader, {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: testimonialHeader,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });
      }

      // Parallax decorative elements
      const testimonialDecorations = gsap.utils.toArray(
        ".gsap-parallax-decoration",
      );
      testimonialDecorations.forEach((el: any, i) => {
        gsap.to(el, {
          y: i % 2 === 0 ? -50 : 50,
          x: i % 2 === 0 ? 30 : -30,
          rotation: 5,
          scrollTrigger: {
            trigger: testimonialsSection,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });
    }

    // 10. Trust & Quality Assurance Animations
    const trustSection = document.querySelector(
      ".trust-quality-assurance-section",
    );
    if (trustSection) {
      // Header animation
      const trustHeader = trustSection.querySelector(".gsap-section-header");
      if (trustHeader) {
        gsap.from(trustHeader, {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: trustHeader,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });
      }

      // Trust cards animation
      const trustCards = gsap.utils.toArray(".gsap-card");
      gsap.from(trustCards, {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power2.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: trustCards[0] as HTMLElement,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });

      // Icons animation
      const trustIcons = gsap.utils.toArray(".gsap-trust-icon-container");
      gsap.from(trustIcons, {
        opacity: 0,
        scale: 0.8,
        rotation: -15,
        duration: 0.8,
        ease: "elastic.out(1.2, 0.5)",
        stagger: 0.1,
        scrollTrigger: {
          trigger: trustIcons[0],
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    }

    // 11. FAQs Section Animations
    const faqSection = document.querySelector(".faqs-section");
    if (buildYourOwnSection) {
      const buildYourOwnTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: buildYourOwnSection,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      // Left side elements
      const badge = buildYourOwnSection.querySelector(
        ".inline-flex.items-center.gap-2.rounded-full",
      );
      const h2 = buildYourOwnSection.querySelector("h2");
      const p = buildYourOwnSection.querySelector("p.mt-3.text-white\\/80");
      const ctaButton = buildYourOwnSection.querySelector(
        'a[href="/build-your-own"]',
      );

      buildYourOwnTimeline
        .from(badge, { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" })
        .from(
          h2,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        )
        .from(
          p,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        )
        .from(
          ctaButton,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        );

      // Right side card and its items
      const rightCard = buildYourOwnSection.querySelector(
        ".gsap-build-your-own-card",
      );
      const ingredientItems = gsap.utils.toArray(
        ".gsap-build-your-own-section .gsap-ingredient-item",
      );

      buildYourOwnTimeline
        .from(
          rightCard,
          { opacity: 0, x: 50, duration: 0.8, ease: "power2.out" },
          "<0.2",
        )
        .from(
          ingredientItems,
          {
            opacity: 0,
            y: 20,
            stagger: 0.05,
            duration: 0.5,
            ease: "power2.out",
          },
          "<0.3",
        );
    }

    // 6. Subscription Power Section Animations
    const subscriptionCards = gsap.utils.toArray(".gsap-subscription-card");
    subscriptionCards.forEach((card: any, index: number) => {
      gsap.from(card, {
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: card,
          start: "top 85%",
          toggleActions: "play none none none",
        },
        delay: index * 0.15, // Stagger between the two cards
      });

      // Icon hover animations within each subscription card's feature boxes
      const icons = gsap.utils.toArray(
        card.querySelectorAll(".gsap-feature-box .inline-flex"),
      );
      icons.forEach((icon: any) => {
        const hoverTween = gsap.to(icon, {
          scale: 1.1,
          rotate: 5,
          duration: 0.3,
          ease: "power1.inOut",
          paused: true,
          overwrite: true, // Prevents conflicts if mouse quickly moves between elements
        });
        icon.addEventListener("mouseenter", () => hoverTween.play());
        icon.addEventListener("mouseleave", () => hoverTween.reverse());
      });
    });

    // 7. Daily Delivery Timeline Preview Animations
    const dailyDeliveryCardContainer = document.querySelector(
      ".daily-delivery-card-container",
    );
    if (dailyDeliveryCardContainer) {
      gsap.from(dailyDeliveryCardContainer, {
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: dailyDeliveryCardContainer,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });

      const deliveryStepIcons = gsap.utils.toArray(
        ".daily-delivery-step .gsap-delivery-step-icon-container",
      );
      const deliveryStepTitles = gsap.utils.toArray(
        ".daily-delivery-step .gsap-delivery-step-title",
      );

      gsap.from(deliveryStepIcons, {
        opacity: 0,
        scale: 0.8,
        duration: 0.6,
        ease: "back.out(1.7)",
        stagger: 0.1,
        scrollTrigger: {
          trigger: dailyDeliveryCardContainer,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      gsap.from(deliveryStepTitles, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: dailyDeliveryCardContainer,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        delay: 0.2, // Slight delay after icons
      });
    }

    // 8. Consultation Call-Out Animations
    const consultationCardWrapper = document.querySelector(
      ".gsap-consultation-card-wrapper",
    );
    if (consultationCardWrapper) {
      const consultationTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: consultationCardWrapper,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      const badge = consultationCardWrapper.querySelector(
        ".mb-4.inline-flex.items-center.gap-2.rounded-full",
      );
      const h3 = consultationCardWrapper.querySelector("h3");
      const p = consultationCardWrapper.querySelector("p.mt-3.text-sm");
      const featureHighlights = gsap.utils.toArray(
        consultationCardWrapper.querySelectorAll(
          ".mt-6.flex.flex-wrap.gap-4 > div",
        ),
      );
      const ctaButton = consultationCardWrapper.querySelector(
        'a[href="/consultation"]',
      );
      const ctaArrow = ctaButton?.querySelector("span span"); // The arrow element

      consultationTimeline
        .from(consultationCardWrapper, {
          opacity: 0,
          y: 50,
          duration: 0.8,
          ease: "power2.out",
        })
        .from(
          badge,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.2",
        )
        .from(
          h3,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        )
        .from(
          p,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        )
        .from(
          featureHighlights,
          {
            opacity: 0,
            y: 10,
            stagger: 0.1,
            duration: 0.5,
            ease: "power2.out",
          },
          "<0.2",
        )
        .from(
          ctaButton,
          { opacity: 0, y: 20, duration: 0.6, ease: "back.out(1.2)" },
          "<0.2",
        );

      // Arrow infinite animation
      if (ctaArrow) {
        gsap.to(ctaArrow, {
          x: 4,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut",
          duration: 0.8,
          delay: consultationTimeline.duration(), // Start after the main timeline finishes
        });
      }
    }

    // 9. Testimonials Section Badge Animation
    const testimonialSection = document.querySelector(
      ".gsap-testimonials-section",
    );
    if (testimonialSection) {
      const testimonialBadge = testimonialSection.querySelector(
        ".gsap-section-header .mb-4.inline-flex",
      );
      if (testimonialBadge) {
        gsap.from(testimonialBadge, {
          opacity: 0,
          scale: 0.8,
          y: 20,
          duration: 0.7,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: testimonialBadge,
            start: "top 90%",
            toggleActions: "play none none none",
          },
        });
      }
    }

    // 10. Trust & Quality Assurance Section Animations
    const trustSection = document.querySelector(
      ".trust-quality-assurance-section",
    );
    if (trustSection) {
      const trustCards = gsap.utils.toArray(
        trustSection.querySelectorAll(".gsap-trust-icon-container"),
      );
      gsap.from(trustCards, {
        opacity: 0,
        y: 50,
        scale: 0.9,
        duration: 0.8,
        ease: "back.out(1.2)",
        stagger: 0.1,
        scrollTrigger: {
          trigger: trustSection,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      // Icon hover animations
      trustCards.forEach((iconContainer: any) => {
        const hoverTween = gsap.to(iconContainer, {
          scale: 1.15,
          rotation: 10,
          duration: 0.3,
          ease: "power1.inOut",
          paused: true,
          overwrite: true,
        });
        iconContainer.addEventListener("mouseenter", () => hoverTween.play());
        iconContainer.addEventListener("mouseleave", () =>
          hoverTween.reverse(),
        );
      });
    }

    // 11. FAQs Section Animations
    const faqSection = document.querySelector(".faqs-section");
    if (faqSection) {
      // Staggered entrance for accordion items
      const accordionItems = gsap.utils.toArray(
        faqSection.querySelectorAll(".gsap-faq-accordion-item"),
      );
      gsap.from(accordionItems, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: faqSection,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      // Hover effect for accordion triggers
      const accordionTriggers = gsap.utils.toArray(
        faqSection.querySelectorAll(".gsap-faq-accordion-trigger"),
      );
      accordionTriggers.forEach((trigger: any) => {
        const hoverTween = gsap.to(trigger, {
          x: 5,
          duration: 0.2,
          ease: "power1.inOut",
          paused: true,
        });
        trigger.addEventListener("mouseenter", () => hoverTween.play());
        trigger.addEventListener("mouseleave", () => hoverTween.reverse());
      });
    }

    // 12. Final CTA Section Animations
    const finalCtaSection = document.querySelector(".gsap-final-cta-section");
    if (finalCtaSection) {
      const finalCtaTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: finalCtaSection,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });

      const ctaBadge = finalCtaSection.querySelector(".gsap-final-cta-badge");
      const ctaHeading = finalCtaSection.querySelector(
        ".gsap-final-cta-heading",
      );
      const ctaSubheading = finalCtaSection.querySelector(
        ".gsap-final-cta-subheading",
      );
      const ctaButtons = finalCtaSection.querySelector(
        ".gsap-final-cta-buttons",
      );
      const ctaTrustIndicators = finalCtaSection.querySelector(
        ".gsap-final-cta-trust-indicators",
      );
      const ctaArrow = finalCtaSection.querySelector(
        ".gsap-final-cta-buttons .group\\/btn span span",
      ); // Specific arrow in the first button

      finalCtaTimeline
        .from(ctaBadge, {
          opacity: 0,
          y: 20,
          duration: 0.6,
          ease: "power2.out",
        })
        .from(
          ctaHeading,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        )
        .from(
          ctaSubheading,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        )
        .from(
          ctaButtons,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        )
        .from(
          ctaTrustIndicators,
          { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" },
          "<0.1",
        );

      // Infinite arrow animation for the "Get Started" button
      if (ctaArrow) {
        gsap.to(ctaArrow, {
          x: 4,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut",
          duration: 0.8,
          delay: finalCtaTimeline.duration(), // Start after main timeline finishes
        });
      }
    }

    // 13. Enhanced Hover Effects Throughout Page
    // Card hover effects
    const allCards = gsap.utils.toArray(".group");
    allCards.forEach((card: any) => {
      const hoverTween = gsap.to(card, {
        scale: 1.03,
        y: -5,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        duration: 0.3,
        ease: "power2.inOut",
        paused: true,
      });

      card.addEventListener("mouseenter", () => hoverTween.play());
      card.addEventListener("mouseleave", () => hoverTween.reverse());
    });

    // Button hover effects
    const allButtons = gsap.utils.toArray("button, a");
    allButtons.forEach((button: any) => {
      // Skip if it's already handled by other animations
      if (
        button.classList.contains("nav-prev-btn") ||
        button.classList.contains("nav-next-btn") ||
        button.classList.contains("dot-indicator")
      )
        return;

      const hoverTween = gsap.to(button, {
        scale: 1.05,
        boxShadow:
          "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        duration: 0.2,
        ease: "power2.inOut",
        paused: true,
      });

      button.addEventListener("mouseenter", () => hoverTween.play());
      button.addEventListener("mouseleave", () => hoverTween.reverse());
    });

    // Icon hover effects
    const allIcons = gsap.utils.toArray(
      ".inline-flex.h-10.w-10, .inline-flex.h-12.w-12, .inline-flex.h-14.w-14",
    );
    allIcons.forEach((icon: any) => {
      const hoverTween = gsap.to(icon, {
        scale: 1.1,
        rotation: 5,
        backgroundColor: "#0b5d44", // oz-primary color
        color: "white",
        duration: 0.3,
        ease: "power2.inOut",
        paused: true,
      });

      icon.addEventListener("mouseenter", () => hoverTween.play());
      icon.addEventListener("mouseleave", () => hoverTween.reverse());
    });

    // Accordion trigger hover effects
    const accordionTriggers = gsap.utils.toArray(".gsap-faq-accordion-trigger");
    accordionTriggers.forEach((trigger: any) => {
      const hoverTween = gsap.to(trigger, {
        x: 8,
        scale: 1.02,
        color: "#0b5d44", // oz-primary color
        duration: 0.3,
        ease: "power2.inOut",
        paused: true,
      });

      trigger.addEventListener("mouseenter", () => hoverTween.play());
      trigger.addEventListener("mouseleave", () => hoverTween.reverse());
    });

    // Testimonial card hover effects
    const testimonialCards = gsap.utils.toArray(".testimonial-card-item");
    testimonialCards.forEach((card: any) => {
      const hoverTween = gsap.to(card, {
        scale: 1.02,
        y: -3,
        boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.15)",
        duration: 0.3,
        ease: "power2.inOut",
        paused: true,
      });

      card.addEventListener("mouseenter", () => hoverTween.play());
      card.addEventListener("mouseleave", () => hoverTween.reverse());
    });

    // Cleanup
    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
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
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to bottom, rgba(6, 78, 59, 0.55), rgba(6, 78, 59, 0.75))",
          }}
        />

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
              High-protein meals, cooked fresh and delivered daily — designed to
              help you train better and stay consistent.
            </p>

            {/* Process line */}
            <div className="mt-3 text-xs md:text-sm text-white/70 font-medium text-center md:text-left">
              Choose → We Cook → We Deliver → You Perform
            </div>

            {/* Dual CTAs */}
            <div className="mt-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link to="/consultation">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto bg-oz-accent hover:bg-oz-accent/90 text-white font-semibold px-6 py-2.5 text-sm shadow-lg transition-all hover:scale-105 active:scale-[0.98]"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/meal-packs">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-2.5 text-sm backdrop-blur-sm transition-all hover:scale-105 active:scale-[0.98]"
                  >
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
            <h2 className="text-2xl font-bold tracking-tight text-oz-primary md:text-4xl">
              Why OG Gainz Works
            </h2>
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
                style={{ borderRadius: "16px", minHeight: "180px" }}
              >
                <CardHeader className="flex flex-col justify-between h-full space-y-3 p-6">
                  <div className="flex flex-col space-y-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-oz-primary">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg font-bold text-oz-primary">
                      {title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed text-oz-primary/70">
                      {description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}

            {/* CTA Card */}
            <Card
              className="group h-full border-2 border-oz-primary/20 bg-white shadow-md transition-all hover:-translate-y-2 hover:border-oz-accent hover:shadow-lg"
              style={{ borderRadius: "16px", minHeight: "180px" }}
            >
              <CardHeader className="flex flex-col justify-between h-full space-y-3 p-6">
                <div className="flex flex-col space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-oz-primary">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg font-bold text-oz-primary">
                    This Is a System
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-oz-primary/70">
                    Not a diet. Not motivation. A repeatable performance
                    framework.
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
                {[
                  ...valueCards,
                  {
                    title: "This Is a System",
                    description:
                      "Not a diet. Not motivation. A repeatable performance framework.",
                    Icon: Sparkles,
                    isCTA: true,
                  },
                ].map(({ title, description, Icon }) => (
                  <CarouselItem key={title} className="pl-2 basis-1/2">
                    <Card
                      className="h-full border-2 border-oz-primary/20 bg-white shadow-md"
                      style={{ borderRadius: "12px" }}
                    >
                      <CardHeader className="space-y-2 p-3">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-oz-primary">
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <CardTitle className="text-sm font-bold text-oz-primary leading-tight">
                          {title}
                        </CardTitle>
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
              <span className="text-sm font-semibold text-oz-primary">
                Handpicked For You
              </span>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-oz-primary tracking-tight">
              Featured Meal Plans
            </h2>
            <p className="mt-4 text-base md:text-lg text-oz-primary/70 font-medium">
              Curated nutrition solutions engineered for peak performance and
              results.
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
                <Carousel
                  opts={{ align: "start", loop: true }}
                  className="w-full"
                >
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
                  <Button
                    size="lg"
                    className="bg-oz-accent hover:bg-oz-accent/90 text-white font-semibold px-8 py-6 text-base shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    Explore All Meal Plans
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">
                No featured meals available at the moment.
              </p>
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
              <h2 className="mt-4 text-2xl font-bold md:text-4xl">
                Build meals your way.
              </h2>
              <p className="mt-3 text-white/80">
                Build meals your way — choose ingredients, portions, and
                nutrition.
              </p>
              <div className="mt-6">
                <Link to="/build-your-own">
                  <Button
                    size="lg"
                    className="bg-oz-accent text-white hover:bg-oz-accent/90"
                  >
                    Build Your Meal <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            <Card className="border-white/10 bg-white/5 text-white shadow-lg backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">
                  Ingredient grid (preview)
                </CardTitle>
                <CardDescription className="text-white/70">
                  Visual mockup — sliders are non-functional.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    "Chicken",
                    "Paneer",
                    "Rice",
                    "Veggies",
                    "Eggs",
                    "Sauce",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm"
                    >
                      <div className="font-semibold">{item}</div>
                      <div className="mt-1 text-xs text-white/70">
                        Portion preset
                      </div>
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
          <div className="gsap-section-header mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-oz-primary/20 bg-oz-primary/5 px-4 py-1.5 text-sm font-medium text-oz-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-oz-primary" />
              Flexible Control
            </div>
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">
              Subscription Power
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              A system that adapts to real life — while protecting your
              long-term results.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            <div className="subscription-controls-card">
              <Card className="group h-full overflow-hidden border-oz-neutral/40 bg-white shadow-lg transition-all duration-300 hover:border-oz-primary/40 hover:shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-oz-primary/0 to-oz-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
                <CardHeader className="relative">
                  <CardTitle className="text-lg font-bold text-oz-primary md:text-xl">
                    Controls that keep you consistent
                  </CardTitle>
                  <CardDescription className="text-base">
                    Pause, skip, auto-extend, and view delivery schedules
                    transparently.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="gsap-feature-box group/item rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-5 transition-all duration-300 hover:scale-105 hover:border-oz-primary/30 hover:shadow-md">
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-oz-primary text-white transition-transform duration-300 group-hover/item:scale-110">
                        <PauseCircle className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-oz-primary">
                        Pause anytime
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Take breaks without resetting your plan.
                      </p>
                    </div>

                    <div className="gsap-feature-box group/item rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-5 transition-all duration-300 hover:scale-105 hover:border-oz-primary/30 hover:shadow-md">
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-oz-primary text-white transition-transform duration-300 group-hover/item:scale-110">
                        <SkipForward className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-oz-primary">
                        Skip today's meal
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Busy day? Skip without losing control.
                      </p>
                    </div>

                    <div className="gsap-feature-box group/item rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-5 transition-all duration-300 hover:scale-105 hover:border-oz-primary/30 hover:shadow-md">
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-oz-primary text-white transition-transform duration-300 group-hover/item:scale-110">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-oz-primary">
                        Auto-extend end date
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Skipped days extend your schedule automatically.
                      </p>
                    </div>

                    <div className="gsap-feature-box group/item rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-5 transition-all duration-300 hover:scale-105 hover:border-oz-primary/30 hover:shadow-md">
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-oz-primary text-white transition-transform duration-300 group-hover/item:scale-110">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-oz-primary">
                        Admin-verified schedules
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Operational clarity with verified delivery plans.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="calendar-preview-card">
              <Card className="group h-full overflow-hidden border-oz-neutral/40 bg-white shadow-lg transition-all duration-300 hover:border-oz-primary/40 hover:shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-oz-primary/0 to-oz-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
                <CardHeader className="relative">
                  <CardTitle className="text-lg font-bold text-oz-primary md:text-xl">
                    Calendar preview
                  </CardTitle>
                  <CardDescription className="text-base">
                    Display-only preview of statuses and schedule clarity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <div className="rounded-xl border border-oz-neutral/30 bg-gradient-to-br from-oz-neutral/10 to-oz-neutral/20 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-oz-primary text-white hover:bg-oz-primary/90 shadow-sm">
                        Active
                      </Badge>
                      <Badge variant="secondary" className="shadow-sm">
                        Paused
                      </Badge>
                      <Badge variant="outline" className="shadow-sm">
                        Skipped
                      </Badge>
                    </div>
                    <Separator className="my-5" />
                    <div className="grid grid-cols-7 gap-2 text-center text-xs">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d) => (
                        <div
                          key={d}
                          className="font-semibold text-oz-primary/70"
                        >
                          {d}
                        </div>
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
                          <div
                            key={day}
                            className={`rounded-lg px-2 py-2.5 ${tone}`}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* 7️⃣ Daily Delivery Timeline Preview */}
      <section className="relative overflow-hidden bg-gradient-to-b from-oz-neutral/10 via-white to-oz-neutral/10 py-20 md:py-24">
        {/* Decorative Elements */}
        <div className="absolute -right-32 top-16 h-80 w-80 rounded-full bg-oz-accent/5 blur-3xl" />
        <div className="absolute -left-32 bottom-16 h-80 w-80 rounded-full bg-oz-primary/5 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4">
          <div className="daily-delivery-header mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-oz-primary/20 bg-oz-primary/5 px-4 py-1.5 text-sm font-medium text-oz-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-oz-primary" />
              Real-Time Tracking
            </div>
            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">
              Daily Delivery Timeline
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              Enterprise-grade clarity from kitchen to doorstep.
            </p>
          </div>

          <div className="daily-delivery-card-container mx-auto mt-16 max-w-5xl">
            <Card className="group overflow-hidden border-oz-neutral/40 bg-white shadow-2xl transition-all duration-300 hover:shadow-3xl">
              <div className="absolute inset-0 bg-gradient-to-br from-oz-primary/0 via-transparent to-oz-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
              <CardContent className="relative p-8 md:p-10">
                <div className="grid gap-8 md:grid-cols-4">
                  {[
                    {
                      title: "Cooking",
                      status: "Active",
                      tone: "bg-oz-primary text-white",
                      progress: 100,
                      icon: "🍳",
                    },
                    {
                      title: "Packed",
                      status: "Active",
                      tone: "bg-oz-primary text-white",
                      progress: 100,
                      icon: "📦",
                    },
                    {
                      title: "Out for Delivery",
                      status: "Active",
                      tone: "bg-oz-primary text-white",
                      progress: 75,
                      icon: "🚚",
                    },
                    {
                      title: "Delivered",
                      status: "Scheduled",
                      tone: "bg-oz-neutral/60 text-oz-primary",
                      progress: 0,
                      icon: "✓",
                    },
                  ].map((step, index) => (
                    <div
                      key={step.title}
                      className="daily-delivery-step group/step relative"
                    >
                      {/* Background glow effect */}
                      <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-oz-primary/5 to-oz-accent/5 opacity-0 blur-xl transition-opacity duration-300 group-hover/step:opacity-100" />

                      <div className="relative">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="gsap-delivery-step-icon-container flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-oz-primary/10 to-oz-accent/10 shadow-md transition-all duration-300 group-hover/step:scale-110 group-hover/step:shadow-lg">
                              <span className="text-2xl">{step.icon}</span>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-oz-primary">
                                {step.title}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                In Progress
                              </div>
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-md transition-all duration-300 group-hover/step:scale-110 ${step.tone}`}
                          >
                            {step.status}
                          </span>
                        </div>

                        <div className="relative h-4 overflow-hidden rounded-full bg-gradient-to-r from-oz-neutral/20 to-oz-neutral/10 shadow-inner">
                          <div className="delivery-progress-bar h-full rounded-full bg-gradient-to-r from-oz-accent via-oz-accent to-oz-accent shadow-lg">
                            <div className="h-full w-full animate-pulse bg-white/20" />
                          </div>
                          {step.progress > 0 && (
                            <div className="delivery-progress-percent absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                              {step.progress}%
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Connector line */}
                      {index < 3 && (
                        <div className="absolute -right-4 top-10 hidden h-px w-8 md:block">
                          <div className="h-full w-full bg-gradient-to-r from-oz-primary/40 via-oz-accent/40 to-transparent" />
                          <div className="delivery-connector-line absolute inset-0 bg-gradient-to-r from-oz-accent to-transparent" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 8️⃣ Consultation Call-Out */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="gsap-consultation-card-wrapper">
            <Card className="group relative overflow-hidden border-2 border-oz-primary/30 bg-gradient-to-br from-oz-neutral/30 via-oz-primary/5 to-oz-accent/10 shadow-xl transition-all duration-500 hover:shadow-2xl">
              {/* Decorative glow effect */}
              <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-oz-primary/10 blur-3xl transition-all duration-700 group-hover:bg-oz-primary/20" />
              <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-oz-accent/10 blur-3xl transition-all duration-700 group-hover:bg-oz-accent/20" />

              <CardContent className="relative grid items-center gap-8 p-8 md:grid-cols-[1fr_auto] md:p-12">
                <div className="consultation-content">
                  {/* Badge */}
                  <div className="consultation-badge mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oz-primary/20 to-oz-accent/20 px-4 py-1.5 text-sm font-semibold text-oz-primary shadow-sm">
                    <span className="text-base">🎯</span>
                    Personalized Guidance
                  </div>

                  <h3 className="text-lg font-bold text-oz-primary md:text-xl">
                    Not sure what plan fits you?
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                    Talk to our nutrition expert and get matched in minutes.
                    Free consultation with personalized meal recommendations.
                  </p>

                  {/* Feature highlights */}
                  <div className="mt-6 flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oz-primary/10 text-xs">
                        ✓
                      </span>
                      Free & No Commitment
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oz-primary/10 text-xs">
                        ✓
                      </span>
                      Expert Nutritionists
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oz-primary/10 text-xs">
                        ✓
                      </span>
                      Personalized Plans
                    </div>
                  </div>
                </div>

                <div className="consultation-button-container flex gap-3">
                  <Link to="/consultation">
                    <div className="consultation-button-wrapper">
                      <Button
                        size="lg"
                        className="group/btn relative overflow-hidden bg-gradient-to-r from-oz-primary to-oz-primary/90 px-8 py-6 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl md:text-lg"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          Book a Free Consultation
                          <span className="consultation-arrow">→</span>
                        </span>
                        {/* Hover gradient effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-oz-accent to-oz-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      </Button>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 9️⃣ Testimonials / Social Proof */}
      <section className="relative overflow-hidden bg-gradient-to-br from-oz-neutral/30 via-oz-primary/5 to-oz-accent/10 py-20">
        {/* Decorative background elements */}
        <div className="gsap-parallax-decoration absolute left-0 top-0 h-64 w-64 rounded-full bg-oz-primary/5 blur-3xl" />
        <div className="gsap-parallax-decoration absolute bottom-0 right-0 h-64 w-64 rounded-full bg-oz-accent/5 blur-3xl" />

        <div className="container relative mx-auto px-4">
          <div className="testimonials-section-header gsap-section-header mx-auto max-w-2xl text-center">
            {/* Badge */}
            <div className="testimonials-badge mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oz-primary/20 to-oz-accent/20 px-4 py-1.5 text-sm font-semibold text-oz-primary shadow-sm">
              <span className="text-base">💪</span>
              Real Stories, Real Results
            </div>

            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">
              Loved by lifters and professionals
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              Short transformation stories from real routines.
            </p>
          </div>

          <TestimonialCarousel testimonials={testimonials} />
        </div>
      </section>

      {/* 🔟 Trust & Quality Assurance */}
      <section className="relative overflow-hidden bg-white py-20">
        {/* Decorative elements */}
        <div className="gsap-parallax-decoration absolute left-0 top-0 h-48 w-48 rounded-full bg-oz-primary/5 blur-3xl" />
        <div className="gsap-parallax-decoration absolute bottom-0 right-0 h-48 w-48 rounded-full bg-oz-accent/5 blur-3xl" />

        <div className="container relative mx-auto px-4">
          <div className="gsap-section-header mx-auto max-w-2xl text-center">
            {/* Badge */}
            <div className="trust-badge mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oz-primary/20 to-oz-accent/20 px-4 py-1.5 text-sm font-semibold text-oz-primary shadow-sm">
              <span className="text-base">🛡️</span>
              Quality Assurance
            </div>

            <h2 className="text-2xl font-bold text-oz-primary md:text-4xl">
              Trust & Quality
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              Clean kitchens. Verified nutrition. Fresh ingredients. Secure
              payments.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Hygienic kitchens",
                Icon: ChefHat,
                desc: "Clean prep standards for daily production.",
              },
              {
                title: "Certified nutritionists",
                Icon: BadgeCheck,
                desc: "Plans built with performance in mind.",
              },
              {
                title: "Fresh ingredients",
                Icon: Leaf,
                desc: "Quality inputs for consistent results.",
              },
              {
                title: "Secure payments (Razorpay)",
                Icon: ShieldCheck,
                desc: "Safe checkout experience.",
              },
            ].map(({ title, desc, Icon }, idx) => (
              <div key={title} className="trust-item">
                <Card className="gsap-card group h-full border-2 border-oz-neutral/20 bg-gradient-to-br from-white to-oz-neutral/5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-oz-primary/30 hover:shadow-xl">
                  <CardHeader className="space-y-3 pb-5">
                    <div className="gsap-trust-icon-container inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-oz-primary/10 to-oz-accent/10 transition-all duration-300 group-hover:from-oz-primary/20 group-hover:to-oz-accent/20">
                      <Icon className="h-6 w-6 text-oz-primary" />
                    </div>
                    <CardTitle className="text-lg font-bold text-oz-primary">
                      {title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {desc}
                    </CardDescription>

                    {/* Bottom accent line */}
                    <div className="h-1 w-8 rounded-full bg-gradient-to-r from-oz-primary to-oz-accent transition-all duration-300 group-hover:w-12" />
                  </CardHeader>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="relative overflow-hidden bg-gradient-to-br from-oz-neutral/10 via-white to-oz-neutral/5 py-16 md:py-20">
        {/* Decorative background elements - subtle */}
        <div className="absolute left-0 top-20 h-72 w-72 rounded-full bg-oz-primary/5 blur-3xl" />
        <div className="absolute right-0 bottom-20 h-96 w-96 rounded-full bg-oz-accent/5 blur-3xl" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="faqs-section-header gsap-section-header mx-auto max-w-3xl text-center mb-10 md:mb-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <svg
                className="w-6 h-6 text-oz-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="text-2xl md:text-3xl font-bold text-oz-primary">
                FAQs
              </h2>
            </div>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
              Quick answers to the most common questions.
            </p>
          </div>

          <div className="faqs-content mx-auto max-w-3xl">
            <Card className="border-0 bg-white shadow-lg rounded-xl overflow-hidden">
              <CardContent className="p-4 md:p-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem
                    value="pause"
                    className="border-b border-oz-neutral/20 last:border-0 transition-colors duration-200 hover:bg-oz-primary/[0.02] data-[state=open]:bg-oz-primary/[0.03] data-[state=open]:border-l-4 data-[state=open]:border-l-oz-primary data-[state=open]:pl-3"
                  >
                    <AccordionTrigger className="text-oz-primary font-semibold hover:no-underline py-4 text-base md:text-lg transition-all">
                      Can I pause my subscription?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1 text-sm md:text-base leading-relaxed animate-accordion-down">
                      Yes, you can pause your subscription at any time through
                      your dashboard. This gives you the flexibility to take a
                      break whenever you need without losing your meal
                      preferences or account settings. When you're ready to
                      resume, simply reactivate your subscription and your
                      deliveries will continue as scheduled.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="skip"
                    className="border-b border-oz-neutral/20 last:border-0 transition-colors duration-200 hover:bg-oz-primary/[0.02] data-[state=open]:bg-oz-primary/[0.03] data-[state=open]:border-l-4 data-[state=open]:border-l-oz-primary data-[state=open]:pl-3"
                  >
                    <AccordionTrigger className="text-oz-primary font-semibold hover:no-underline py-4 text-base md:text-lg transition-all">
                      Can I skip a day?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1 text-sm md:text-base leading-relaxed animate-accordion-down">
                      Absolutely! Life happens and plans change. You can skip
                      any upcoming delivery day directly from your dashboard
                      without affecting your subscription. This feature lets you
                      maintain control over your meal schedule while staying
                      flexible with your routine and commitments.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="trial"
                    className="border-b border-oz-neutral/20 last:border-0 transition-colors duration-200 hover:bg-oz-primary/[0.02] data-[state=open]:bg-oz-primary/[0.03] data-[state=open]:border-l-4 data-[state=open]:border-l-oz-primary data-[state=open]:pl-3"
                  >
                    <AccordionTrigger className="text-oz-primary font-semibold hover:no-underline py-4 text-base md:text-lg transition-all">
                      Is there a trial?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1 text-sm md:text-base leading-relaxed animate-accordion-down">
                      Yes! We offer Trial Packs that let you experience the
                      quality and taste of OG Gainz meals before committing to a
                      subscription. These trial options give you a chance to try
                      different meal varieties and see how our nutrition plans
                      fit into your lifestyle and goals.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="delivery"
                    className="border-b border-oz-neutral/20 last:border-0 transition-colors duration-200 hover:bg-oz-primary/[0.02] data-[state=open]:bg-oz-primary/[0.03] data-[state=open]:border-l-4 data-[state=open]:border-l-oz-primary data-[state=open]:pl-3"
                  >
                    <AccordionTrigger className="text-oz-primary font-semibold hover:no-underline py-4 text-base md:text-lg transition-all">
                      How does delivery work?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1 text-sm md:text-base leading-relaxed animate-accordion-down">
                      Our meals follow a streamlined daily workflow to ensure
                      freshness. Each day, your meals are prepared in our
                      kitchen, carefully packed with quality ingredients,
                      dispatched for delivery, and arrive at your doorstep. You
                      can track your delivery status in real-time through your
                      dashboard for complete transparency.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* Optional CTA */}
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Still have questions?
              </p>
              <Link to="/consultation">
                <Button
                  variant="outline"
                  className="border-oz-primary text-oz-primary hover:bg-oz-primary hover:text-white transition-colors"
                >
                  Get in Touch
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-oz-primary via-oz-secondary to-oz-primary py-20 text-white md:py-24">
        {/* Decorative elements */}
        <div className="gsap-parallax-decoration absolute left-0 top-0 h-64 w-64 rounded-full bg-oz-accent/20 blur-3xl" />
        <div className="gsap-parallax-decoration absolute bottom-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="gsap-parallax-decoration absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-oz-accent/10 blur-3xl" />

        <div className="container relative mx-auto px-4">
          <div className="gsap-final-cta-section gsap-section-header mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="gsap-final-cta-badge mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
              <span className="text-base">🚀</span>
              Ready to Transform?
            </div>

            <h2 className="cta-heading text-3xl font-bold leading-tight md:text-5xl">
              Start your fitness nutrition journey today.
            </h2>

            <p className="cta-subheading mt-6 text-base text-white/90 md:text-lg">
              Choose a plan, lock in consistency, and let the system do the
              work.
            </p>

            <div className="cta-buttons-container mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link to="/trial" className="hidden md:inline-flex">
                <div className="cta-button-wrapper">
                  <Button
                    size="lg"
                    className="group/btn relative w-full overflow-hidden bg-oz-accent px-8 py-6 text-base font-semibold text-white shadow-xl transition-all duration-300 hover:shadow-2xl sm:w-auto md:text-lg"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Get Started
                      <span className="cta-arrow">
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-oz-accent to-oz-primary opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
                  </Button>
                </div>
              </Link>
              <Link to="/meal-packs">
                <div className="view-plans-btn-wrapper">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-2 border-white/40 bg-white/10 px-8 py-6 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20 sm:w-auto md:text-lg"
                  >
                    View Plans
                  </Button>
                </div>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="cta-trust-indicators mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-white/70">
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
