import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout, DashboardLayout, AdminLayout } from "@/components/layout";
import { useUser } from "@/context/UserContext";

import Index from "@/pages/Index";
import MealPacks from "@/pages/MealPacks";
import MealPackDetails from "@/pages/MealPackDetails";
import AddOns from "@/pages/AddOns";
import TrialPacksPhase4 from "@/pages/TrialPacksPhase4";
import BuildYourOwn from "@/pages/BuildYourOwn";
import Cart from "@/pages/Cart";
import OrderDetails from "@/pages/OrderDetails";
import Checkout from "@/pages/Checkout";
import Consultation from "@/pages/Consultation";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import MyOrders from "@/pages/MyOrders";
import MyOrderDetails from "@/pages/MyOrderDetails";
import OrderSuccess from "@/pages/OrderSuccess";
import OrderFailed from "@/pages/OrderFailed";

import {
  Dashboard,
  Subscriptions,
  SubscriptionDetail,
  Deliveries,
  Wallet,
  Settings,
  Orders,
  Support,
} from "@/pages/dashboard";

import {
  AdminDashboard,
  AdminConsultations,
  AdminMeals,
  AdminAddons,
  AdminAddonCategories,
  AdminMealTypes,
  AdminIncludedItems,
  AdminBuildYourOwnItemTypes,
  AdminBuildYourOwnItems,
  AdminBuildYourOwnConfig,
  AdminOrders,
  AdminOrderDetails,
  AdminSubscriptions,
  AdminKitchen,
	AdminUsers,
  AdminUserDetails,
} from "@/pages/admin";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-oz-neutral/30">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-oz-neutral/30">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Index />} />
        <Route path="meal-packs" element={<MealPacks />} />
        <Route path="meal-packs/:id" element={<MealPackDetails />} />
        <Route path="addons" element={<AddOns />} />
        <Route path="trial" element={<TrialPacksPhase4 />} />
        <Route path="build-your-own" element={<BuildYourOwn />} />
        <Route path="consultation" element={<Consultation />} />
        <Route path="cart" element={<Cart />} />
        <Route path="order-details" element={<OrderDetails />} />
        <Route path="checkout" element={<Checkout />} />
        <Route
          path="my-deliveries"
          element={
            <RequireAuth>
              <Deliveries />
            </RequireAuth>
          }
        />
        <Route
          path="order/success/:orderId"
          element={
            <RequireAuth>
              <OrderSuccess />
            </RequireAuth>
          }
        />
        <Route
          path="order/failed/:orderId"
          element={
            <RequireAuth>
              <OrderFailed />
            </RequireAuth>
          }
        />
        <Route
          path="my-orders"
          element={
            <RequireAuth>
              <MyOrders />
            </RequireAuth>
          }
        />
        <Route
          path="my-orders/:orderId"
          element={
            <RequireAuth>
              <MyOrderDetails />
            </RequireAuth>
          }
        />
        <Route path="login" element={<Login />} />
      </Route>

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="orders" element={<Orders />} />
        <Route path="support" element={<Support />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route
          index
          element={<AdminDashboard />}
          handle={{
            title: 'Dashboard',
            description: 'Overview of platform activity and key metrics.',
          }}
        />
        <Route
          path="consultations"
          element={<AdminConsultations />}
          handle={{
            title: 'Consultations',
            description: 'Review consultation requests and follow up with customers.',
          }}
        />
        <Route
          path="consultations/:id"
          element={<AdminConsultations />}
          handle={{
            title: 'Consultation',
            description: 'Review a consultation request and update its status.',
          }}
        />
        <Route
          path="users"
          element={<AdminUsers />}
          handle={{
            title: 'Users',
            description: 'View and manage registered customers and their activity.',
          }}
        />
        <Route
          path="users/:userId"
          element={<AdminUserDetails />}
          handle={{
            title: 'User Details',
            description: 'Review profile, orders, subscriptions, and deliveries for a customer.',
          }}
        />
        <Route
          path="meals"
          element={<AdminMeals />}
          handle={{
            title: 'Meals',
            description: 'Create, edit, feature, and manage meal visibility.',
          }}
        />
        <Route
          path="addons"
          element={<AdminAddons />}
          handle={{
            title: 'Add-ons',
            description: 'Create, edit, and manage add-ons available for purchase or subscription.',
          }}
        />
        <Route
          path="addon-categories"
          element={<AdminAddonCategories />}
          handle={{
            title: 'Add-on Categories',
            description: 'Organize add-ons into categories for a clean storefront experience.',
          }}
        />
		<Route
          path="meal-types"
          element={<AdminMealTypes />}
          handle={{
            title: 'Meal Types',
            description: 'Define and manage the meal categories used across the catalog.',
          }}
        />
		<Route
          path="included-items"
          element={<AdminIncludedItems />}
          handle={{
            title: 'Included Items',
            description: 'Manage items that are included by default in meal packs and subscriptions.',
          }}
        />
		<Route
          path="byo-item-types"
          element={<AdminBuildYourOwnItemTypes />}
          handle={{
            title: 'BYO Item Types',
            description: 'Define Build-Your-Own item categories and their ordering/visibility.',
          }}
        />
		<Route
          path="byo-items"
          element={<AdminBuildYourOwnItems />}
          handle={{
            title: 'BYO Items',
            description: 'Create and manage the items available in Build-Your-Own.',
          }}
        />
		<Route
          path="byo-config"
          element={<AdminBuildYourOwnConfig />}
          handle={{
            title: 'BYO Minimums',
            description: 'Configure minimum selections and validation rules for Build-Your-Own orders.',
          }}
        />
		<Route
          path="orders"
          element={<AdminOrders />}
          handle={{
            title: 'Orders',
            description: 'Review orders, confirm payments, and manage kitchen flow.',
          }}
        />
		<Route
          path="orders/:orderId"
          element={<AdminOrderDetails />}
          handle={{
            title: 'Order Details',
            description: 'Inspect order contents, customer info, and subscription progress.',
          }}
        />
        <Route
          path="subscriptions"
          element={<AdminSubscriptions />}
          handle={{
            title: 'Subscriptions',
            description: 'Monitor subscriptions, pauses, skips, and schedules.',
          }}
        />
        <Route
          path="kitchen"
          element={<AdminKitchen />}
          handle={{
            title: 'Kitchen',
            description: 'Track and update daily meal preparation and delivery status.',
          }}
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
