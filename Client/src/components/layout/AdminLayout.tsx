import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, matchPath, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  CalendarDays,
  UtensilsCrossed,
  Tag,
  ListChecks,
  Puzzle,
  Layers,
  Truck,
  Wallet,
  MessageSquare,
  Settings,
  Menu,
  X,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/admin/meal-types", label: "Meal Types", icon: Tag },
  { href: "/admin/included-items", label: "Included Items", icon: ListChecks },
  { href: "/admin/byo-item-types", label: "BYO Item Types", icon: Layers },
  { href: "/admin/byo-items", label: "BYO Items", icon: Layers },
  { href: "/admin/byo-config", label: "BYO Minimums", icon: Settings },
  { href: "/admin/addon-categories", label: "Add-on Categories", icon: Tag },
  { href: "/admin/addons", label: "Add-ons", icon: Puzzle },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CalendarDays },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/kitchen", label: "Kitchen", icon: Truck },
  { href: "/admin/wallet", label: "Wallet & Credits", icon: Wallet },
  { href: "/admin/consultations", label: "Consultations", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useUser();

  const pageMeta = useMemo(() => {
    const pathname = location.pathname;

    const routeMeta: Array<{
      path: string;
      title: string | ((params: Record<string, string | undefined>) => string);
      description?: string;
    }> = [
      {
        path: '/admin/orders/:orderId',
        title: (params) => {
          const id = (params.orderId || '').trim();
          return id ? `Order ${id.slice(-6)}` : 'Order';
        },
        description: 'Review a paid order, confirm/decline, and generate deliveries by moving to kitchen.',
      },
      {
        path: '/admin/users/:userId',
        title: 'User Details',
        description: 'Review profile, orders, subscriptions, and deliveries for a customer.',
      },
      {
        path: '/admin/consultations/:id',
        title: 'Consultation',
        description: 'Review a consultation request and update its status.',
      },
      { path: '/admin', title: 'Dashboard', description: 'Overview of platform activity and key metrics.' },
      { path: '/admin/consultations', title: 'Consultations', description: 'Review consultation requests and follow up with customers.' },
      { path: '/admin/users', title: 'Users', description: 'View and manage registered customers and their activity.' },
      { path: '/admin/meals', title: 'Meals', description: 'Create, edit, feature, and manage meal visibility.' },
      { path: '/admin/meal-types', title: 'Meal Types', description: 'Define and manage the meal categories used across the catalog.' },
      { path: '/admin/included-items', title: 'Included Items', description: 'Manage items that are included by default in meal packs and subscriptions.' },
      { path: '/admin/byo-item-types', title: 'BYO Item Types', description: 'Define Build-Your-Own item categories and their ordering/visibility.' },
      { path: '/admin/byo-items', title: 'BYO Items', description: 'Manage Build-Your-Own ingredients and pricing.' },
      { path: '/admin/byo-config', title: 'BYO Minimums', description: 'Admin-configurable minimum order amounts for subscriptions.' },
      { path: '/admin/addon-categories', title: 'Add-on Categories', description: 'Organize add-ons into categories for a clean storefront experience.' },
      { path: '/admin/addons', title: 'Add-ons', description: 'Create, edit, and manage add-ons available for purchase or subscription.' },
      { path: '/admin/subscriptions', title: 'Subscriptions', description: 'Weekly/Monthly operational view. Pause/resume is admin-only.' },
      { path: '/admin/kitchen', title: 'Kitchen', description: 'Execute daily deliveries: cooking → packed → out for delivery → delivered.' },
      { path: '/admin/wallet', title: 'Wallet & Credits', description: 'Review and manage wallet balances and credits.' },
      { path: '/admin/settings', title: 'Settings', description: 'Configure admin settings for operations and cutoffs.' },
    ];

    for (const meta of routeMeta) {
      const match = matchPath({ path: meta.path, end: true }, pathname);
      if (!match) continue;
      const title = typeof meta.title === 'function' ? meta.title(match.params) : meta.title;
      return {
        title,
        description: meta.description,
      };
    }

    return { title: 'Admin', description: undefined as string | undefined };
  }, [location.pathname]);

  // Admin shell uses independent scroll containers; prevent body/window scroll while mounted.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = body.style.height;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.height = '100%';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
    };
  }, []);

  useEffect(() => {
    if (import.meta.env.PROD) {
      console.info("[OG GAINZ] Admin route loaded:", location.pathname);
    }
  }, [location.pathname]);

  const isAdmin = user?.role === 'admin';

  const isActive = (href: string) => {
    if (href === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="h-screen flex bg-oz-neutral/20 overflow-hidden oz-admin">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-oz-primary transform transition-transform duration-300 ease-in-out lg:transform-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
				<div className="h-screen overflow-y-auto scroll-smooth">
					<div className="flex flex-col min-h-full">
						{/* Sidebar Header */}
						<div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
							<Link to="/admin" className="flex items-center gap-2">
								<img 
									src="/home/logo.png" 
									alt="OG GAINZ" 
									className="h-5 w-auto"
								/>
								<span className="text-xs bg-oz-accent text-white px-2 py-0.5 rounded font-medium">
									ADMIN
								</span>
							</Link>
							<Button
								variant="ghost"
								size="icon"
								className="lg:hidden text-white hover:bg-white/10"
								onClick={() => setSidebarOpen(false)}
							>
								<X className="h-5 w-5" />
							</Button>
						</div>

						{/* Navigation */}
						<nav className="flex-1 p-4 space-y-1">
            {isAdmin ? (
              adminLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                    isActive(link.href)
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ))
            ) : (
              <div className="px-4 py-3 rounded-lg bg-white/5 text-white/80 text-sm">
                Admin navigation is hidden because your role is not <span className="font-semibold text-white">admin</span>.
              </div>
            )}
						</nav>

						{/* Sidebar Footer */}
						<div className="p-4 border-t border-white/10">
							<Button
								variant="ghost"
								className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
								onClick={logout}
							>
								<LogOut className="h-5 w-5 mr-2" />
								Logout
							</Button>
						</div>
					</div>
				</div>
      </aside>

      {/* Main Content */}
			<div className="flex-1 min-w-0 h-screen overflow-hidden">
				<div className="h-full overflow-y-auto scroll-smooth">
					{/* Top Header (scrolls with content) */}
					<header className="h-16 bg-white border-b border-oz-neutral flex items-center justify-between px-4 lg:px-6">
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								className="lg:hidden"
								onClick={() => setSidebarOpen(true)}
							>
								<Menu className="h-5 w-5" />
							</Button>
              <div className="text-lg lg:text-xl font-semibold text-oz-primary leading-tight">Admin</div>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">{user?.name || 'User'}</span>
							<div className="w-8 h-8 rounded-full bg-oz-primary flex items-center justify-center text-white font-semibold text-sm">
								{(user?.name?.charAt(0) || 'U').toUpperCase()}
							</div>
						</div>
					</header>

					{/* Page Content */}
          <main className="p-4 lg:p-6">
            <div className="mb-6 animate-in fade-in-0 slide-in-from-bottom-1">
              <h1 className="text-2xl lg:text-3xl font-semibold text-oz-primary leading-tight">
                {pageMeta.title}
              </h1>
              {pageMeta.description ? (
                <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{pageMeta.description}</p>
              ) : null}
            </div>
            <Outlet />
          </main>
				</div>
			</div>
    </div>
  );
}
