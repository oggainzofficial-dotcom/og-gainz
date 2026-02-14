import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X, ShoppingCart, User, LayoutDashboard, Package, Wallet, Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/context/CartContext";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";
import { businessContact } from "@/config/contact";

const navLinks = [
  { href: "/meal-packs", label: "Meal Packs" },
  { href: "/addons", label: "Add-Ons" },
  { href: "/trial", label: "Trial Packs" },
  { href: "/build-your-own", label: "Build Your Own" },
  { href: "/consultation", label: "Consultation" },
];

const dashboardLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/subscriptions", label: "My Subscriptions", icon: Package },
  { href: "/dashboard/wallet", label: "Wallet & Credits", icon: Wallet },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { itemCount } = useCart();
  const { user, isAuthenticated, logout } = useUser();

  return (
    <div className="min-h-screen flex flex-col bg-oz-neutral/30">
      {/* Header */}
      <header className="bg-oz-primary sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="/home/logo.png" 
                alt="OG GAINZ" 
                className="h-6 md:h-7 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="relative group text-white/80 hover:text-white transition-all duration-300 font-medium py-1"
                  >
                    <span className={cn("transition-colors duration-300", isActive && "text-white")}>
                      {link.label}
                    </span>
                    {/* Animated underline */}
                    <span 
                      className={cn(
                        "absolute bottom-0 left-0 h-0.5 bg-oz-accent transition-all duration-300 ease-out",
                        isActive ? "w-full" : "w-0 group-hover:w-full"
                      )}
                    />
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <Link to="/cart" className="relative">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-oz-accent text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                      {itemCount}
                    </span>
                  )}
                </Button>
              </Link>

              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="text-white hover:bg-white/10 gap-2 px-3">
                      <div className="w-8 h-8 rounded-full bg-oz-accent flex items-center justify-center text-white font-semibold text-sm">
                        {user?.name?.charAt(0) || "U"}
                      </div>
                      <span className="hidden lg:inline font-medium">{user?.name?.split(" ")[0]}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white z-50">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user?.name}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {dashboardLinks.map((link) => (
                      <DropdownMenuItem key={link.href} asChild>
                        <Link to={link.href} className="flex items-center gap-2 cursor-pointer">
                          <link.icon className="h-4 w-4" />
                          {link.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  to="/login"
                  className="shrink-0 inline-flex items-center justify-center h-11 min-w-[112px] px-6 leading-none whitespace-nowrap rounded-lg bg-oz-accent text-white hover:bg-oz-accent/90 shadow-sm hover:shadow-md transition-all duration-150 ease-out"
                >
                  Login
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              <Link to="/cart" className="relative">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-oz-accent text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                      {itemCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
            mobileMenuOpen ? "max-h-[80vh]" : "max-h-0"
          )}
        >
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "relative text-white/80 hover:text-white py-2 px-4 rounded-lg transition-all duration-300",
                    isActive && "bg-white/10 text-white font-medium"
                  )}
                >
                  {link.label}
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-oz-accent rounded-r-full" />
                  )}
                </Link>
              );
            })}
            <div className="border-t border-white/20 my-2" />
            {isAuthenticated ? (
              <div className="space-y-2">
                <div className="px-4 py-2 rounded-lg bg-white/10">
                  <div className="text-sm font-semibold text-white truncate">{user?.name || "User"}</div>
                  <div className="text-xs text-white/70 truncate">{user?.email || ""}</div>
                </div>
                {dashboardLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 text-white/80 hover:text-white py-2 px-4 rounded-lg transition-colors",
                      location.pathname.startsWith(link.href) && "bg-white/10 text-white"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-3 text-red-200 hover:text-white py-2 px-4 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-oz-accent hover:bg-oz-accent/90 text-white py-2 px-4 rounded-lg text-center font-medium"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-oz-primary text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <img 
                src="/home/logo.png" 
                alt="OG GAINZ" 
                className="h-6 w-auto mb-4"
              />
              <p className="text-white/70 text-sm">
                Precision nutrition for your fitness journey. Fresh, macro-balanced meals delivered daily.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/meal-packs" className="hover:text-white transition-colors">Meal Packs</Link></li>
                <li><Link to="/trial" className="hover:text-white transition-colors">Trial Packs</Link></li>
                <li><Link to="/build-your-own" className="hover:text-white transition-colors">Build Your Own</Link></li>
                <li><Link to="/consultation" className="hover:text-white transition-colors">Consultation</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  <a
                    href={businessContact.emailHref}
                    className="hover:text-white transition-colors underline decoration-white/40"
                  >
                    {businessContact.email}
                  </a>
                </li>
                <li>
                  <a
                    href={businessContact.phoneHref}
                    className="hover:text-white transition-colors"
                  >
                    {businessContact.phone}
                  </a>
                </li>
                <li>
                  <address className="not-italic whitespace-pre-line leading-relaxed">
                    {businessContact.addressLines.join('\n')}
                  </address>
                </li>
              </ul>
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="mt-4 text-oz-primary"
              >
                <a href={businessContact.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  {businessContact.googleMapsLabel}
                </a>
              </Button>
            </div>
          </div>

          <div className="border-t border-white/20 mt-8 pt-8 text-center text-sm text-white/50">
            © {new Date().getFullYear()} OG GAINZ. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
