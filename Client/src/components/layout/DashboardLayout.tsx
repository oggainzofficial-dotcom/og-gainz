import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Truck,
  Wallet, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ChevronLeft,
  Receipt,
  HelpCircle,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";
import { SUPPORT_WHATSAPP_NUMBER } from "@/config/env";

const sidebarLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: Package },
  { href: "/dashboard/deliveries", label: "Deliveries", icon: Truck },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/orders", label: "Payment History", icon: Receipt },
  { href: "/dashboard/support", label: "Help & Support", icon: HelpCircle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useUser();

  // Dashboard shell uses independent scroll containers; prevent body/window scroll while mounted.
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

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

  return (
		<div className="h-screen flex bg-oz-neutral/30 overflow-hidden">
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
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-oz-neutral transform transition-transform duration-300 ease-in-out lg:transform-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
				<div className="h-screen overflow-y-auto scroll-smooth">
					<div className="flex flex-col min-h-full">
						{/* Sidebar Header */}
						<div className="h-16 flex items-center justify-between px-4 border-b border-oz-neutral">
							<Link to="/" className="flex items-center gap-2">
								<img 
									src="/home/logo.png" 
									alt="OG GAINZ" 
									className="h-5 w-auto"
								/>
							</Link>
							<Button
								variant="ghost"
								size="icon"
								className="lg:hidden"
								onClick={() => setSidebarOpen(false)}
							>
								<X className="h-5 w-5" />
							</Button>
						</div>

						{/* User Info */}
						<div className="p-4 border-b border-oz-neutral">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-oz-secondary flex items-center justify-center text-white font-semibold">
									{user?.name?.charAt(0) || "U"}
								</div>
								<div className="flex-1 min-w-0">
									<p className="font-medium text-oz-primary truncate">{user?.name || "User"}</p>
									<p className="text-sm text-muted-foreground truncate">{user?.email || ""}</p>
								</div>
							</div>
						</div>

						{/* Navigation */}
						<nav className="flex-1 p-4 space-y-1">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                  isActive(link.href)
                    ? "bg-oz-secondary/10 text-oz-secondary"
                    : "text-muted-foreground hover:bg-oz-neutral/50 hover:text-oz-primary"
                )}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            ))}
						</nav>

						{/* WhatsApp Quick Contact */}
						<div className="p-4 border-t border-oz-neutral">
							<Button
								variant="ghost"
								className="w-full justify-start bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
								onClick={() => {
										const n = String(SUPPORT_WHATSAPP_NUMBER || '').trim();
										const phone = n || '919876543210';
										window.open(`https://wa.me/${encodeURIComponent(phone)}?text=Hi%20OG%20Gainz%20team,%20I%20need%20help%20with%20my%20subscription.`, '_blank');
								}}
							>
								<MessageCircle className="h-5 w-5 mr-2" />
								WhatsApp Support
							</Button>
						</div>

						{/* Sidebar Footer */}
						<div className="p-4 border-t border-oz-neutral">
							<Link to="/">
								<Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-oz-primary">
									<ChevronLeft className="h-5 w-5 mr-2" />
									Back to Home
								</Button>
							</Link>
							<Button
								variant="ghost"
								className="w-full justify-start text-muted-foreground hover:text-destructive mt-1"
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
					<header className="h-16 bg-white border-b border-oz-neutral flex items-center px-4 lg:px-6">
						<Button
							variant="ghost"
							size="icon"
							className="lg:hidden mr-2"
							onClick={() => setSidebarOpen(true)}
						>
							<Menu className="h-5 w-5" />
						</Button>
						<h1 className="font-semibold text-oz-primary">
							{sidebarLinks.find((link) => isActive(link.href))?.label || "Dashboard"}
						</h1>
					</header>

					{/* Page Content */}
					<main className="p-4 lg:p-6">
						<Outlet />
					</main>
				</div>
			</div>
    </div>
  );
}
