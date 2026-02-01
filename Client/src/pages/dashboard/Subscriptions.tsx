// OG Gainz - Subscriptions Management
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Package, 
  Calendar, 
  Pause, 
  Play, 
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { pauseSkipService } from "@/services/pauseSkipService";
import { customMealSubscriptionService } from "@/services/customMealSubscriptionService";
import { addonSubscriptionsService } from "@/services/addonSubscriptionsService";
import { addonPurchasesService } from "@/services/addonPurchasesService";
import { addonsCatalogService } from "@/services/addonsCatalogService";
import { mealsCatalogService } from "@/services/mealsCatalogService";
import { buildYourOwnCatalogService } from "@/services/buildYourOwnCatalogService";
import { deliveriesService, type MyDelivery } from "@/services/deliveriesService";
import { ordersService } from "@/services/ordersService";
import type { PauseSkipRequest } from "@/types";
import type { AddonPurchase, AddonSubscription, CustomMealSubscription } from "@/types/phase4";
import type { PublicOrder, PublicOrderItem } from "@/types/ordersPhase5b";
import { normalizeOrderFlags } from "@/types/ordersPhase5b";
import type { Addon, AddonServings, Meal } from "@/types/catalog";
import type { BuildYourOwnItemEntity } from "@/types/buildYourOwn";

const Subscriptions = () => {
  const { user } = useUser();
  const { toast } = useToast();

  const safeString = (v: unknown) => String(v ?? '').trim();
  const [orders, setOrders] = useState<PublicOrder[]>([]);
  const [customMealSubscriptions, setCustomMealSubscriptions] = useState<CustomMealSubscription[]>([]);
  const [addonSubscriptions, setAddonSubscriptions] = useState<AddonSubscription[]>([]);
  const [addonPurchases, setAddonPurchases] = useState<AddonPurchase[]>([]);
  const [addonNameById, setAddonNameById] = useState<Record<string, string>>({});
  const [addonServingsById, setAddonServingsById] = useState<Record<string, AddonServings>>({});
  const [addonsById, setAddonsById] = useState<Record<string, Addon>>({});
  const [mealsById, setMealsById] = useState<Record<string, Meal>>({});
  const [byoItemsById, setByoItemsById] = useState<Record<string, BuildYourOwnItemEntity>>({});
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Server-backed deliveries (Phase 7 integration)
  const [windowDeliveries, setWindowDeliveries] = useState<MyDelivery[]>([]);
  const [calendarDeliveries, setCalendarDeliveries] = useState<MyDelivery[]>([]);
  const [historyDeliveries, setHistoryDeliveries] = useState<MyDelivery[]>([]);
  const [requestingSkipDeliveryId, setRequestingSkipDeliveryId] = useState<string | null>(null);

  type ViewSubscriptionKind = 'meal' | 'addon' | 'byo';
  const [viewSubscriptionOpen, setViewSubscriptionOpen] = useState(false);
  const [viewSubscriptionTarget, setViewSubscriptionTarget] = useState<
    | {
        kind: ViewSubscriptionKind;
        subscriptionId: string;
        orderId?: string;
        plan?: string;
        title?: string;
      }
    | null
  >(null);

  // Phase 7: Pause/Skip requests (admin approval workflow)
  const [myRequests, setMyRequests] = useState<PauseSkipRequest[]>([]);
  const [pauseRequestOpen, setPauseRequestOpen] = useState(false);
  const [pauseRequestTarget, setPauseRequestTarget] = useState<{ kind: 'customMeal' | 'addon' | 'mealPack'; subscriptionId: string } | null>(null);
  const [pauseRequestStart, setPauseRequestStart] = useState('');
  const [pauseRequestEnd, setPauseRequestEnd] = useState('');
  const [pauseRequestReason, setPauseRequestReason] = useState('');
  const [pauseRequestSaving, setPauseRequestSaving] = useState(false);
  const [withdrawingRequestId, setWithdrawingRequestId] = useState<string | null>(null);

  const toLocalISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const tomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalISO(d);
  };

  const parseTimeToMinutes = (raw: string) => {
    const s = safeString(raw).toUpperCase();
    if (!s) return null;

    const m24 = s.match(/^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/);
    if (m24) {
      const hh = Number(m24[1]);
      const mm = Number(m24[2]);
      if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return hh * 60 + mm;
    }

    const m12 = s.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/);
    if (m12) {
      let hh = Number(m12[1]);
      const mm = Number(m12[2] || "0");
      const ap = m12[3];
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
      if (ap === "AM") {
        if (hh === 12) hh = 0;
      } else {
        if (hh !== 12) hh += 12;
      }
      return hh * 60 + mm;
    }

    return null;
  };

  const toLocalDateTime = (isoDate: string, rawTime: string) => {
    const d = safeString(isoDate);
    const t = safeString(rawTime);
    if (!d || !t) return null;
    const mins = parseTimeToMinutes(t);
    if (mins == null) return null;
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    const dt = new Date(`${d}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return null;
    dt.setHours(hh, mm, 0, 0);
    return dt;
  };

  const formatLeadTime = (minutes: number) => {
    const m = Math.max(0, Math.floor(Number(minutes) || 0));
    if (m === 1) return "1 minute";
    if (m < 60) return `${m} minutes`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    const hLabel = h === 1 ? "1 hour" : `${h} hours`;
    if (rem === 0) return hLabel;
    const rLabel = rem === 1 ? "1 minute" : `${rem} minutes`;
    return `${hLabel} ${rLabel}`;
  };

  const pauseCutoffMinutes = useMemo(() => {
    const raw = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_PAUSE_REQUEST_CUTOFF_MINUTES;
    const n = Number(raw ?? 120);
    return Number.isFinite(n) && n > 0 ? n : 120;
  }, []);

  const skipCutoffMinutes = useMemo(() => {
    const raw = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_SKIP_REQUEST_CUTOFF_MINUTES;
    const n = Number(raw ?? 120);
    return Number.isFinite(n) && n > 0 ? n : 120;
  }, []);

  const nextDeliveryBySubscriptionId = useMemo(() => {
    const now = Date.now();
    const bestById = new Map<string, MyDelivery>();
    const bestTsById = new Map<string, number>();

    for (const d of windowDeliveries) {
      const subId = safeString(d.subscriptionId);
      if (!subId) continue;
      if (d.status === "DELIVERED" || d.status === "SKIPPED") continue;
      const dt = toLocalDateTime(safeString(d.date), safeString(d.time));
      if (!dt) continue;
      const ts = dt.getTime();
      if (ts < now) continue;
      const prev = bestTsById.get(subId);
      if (prev == null || ts < prev) {
        bestTsById.set(subId, ts);
        bestById.set(subId, d);
      }
    }

    return bestById;
  }, [windowDeliveries]);

  const isPauseCutoffExceededForSubscription = (subscriptionId: string) => {
    const next = nextDeliveryBySubscriptionId.get(subscriptionId);
    if (!next) return false;
    const dt = toLocalDateTime(safeString(next.date), safeString(next.time));
    if (!dt) return false;
    return dt.getTime() - Date.now() < pauseCutoffMinutes * 60_000;
  };

  const isSkipCutoffExceededForDelivery = (d: MyDelivery) => {
    const dt = toLocalDateTime(safeString(d.date), safeString(d.time));
    if (!dt) return false;
    return dt.getTime() - Date.now() < skipCutoffMinutes * 60_000;
  };

  useEffect(() => {
    const fetchSubscriptions = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        const today = toLocalISO(new Date());
        const windowTo = (() => {
          const d = new Date();
          d.setDate(d.getDate() + 13);
          return toLocalISO(d);
        })();

        const historyFrom = (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return toLocalISO(d);
        })();

        const byoItemsResPromise = buildYourOwnCatalogService
          .listItems()
          .catch(() => ({ status: 'error' as const, data: [] as BuildYourOwnItemEntity[] }));

        const [customSubs, addSub, addPurchases, addonCatalog, requests, deliveries14, deliveriesHistory, ordersRes, mealsRes, byoItemsRes] = await Promise.all([
          customMealSubscriptionService.listByUser(user.id),
          addonSubscriptionsService.listByUser(user.id),
          addonPurchasesService.listByUser(user.id),
          addonsCatalogService.listAddons({ page: 1, limit: 500 }),
			pauseSkipService.listMyRequests({}),
          deliveriesService.listMy({ from: today, to: windowTo }),
          deliveriesService.listMy({ from: historyFrom, to: today }),
          ordersService.listMyOrders({ page: 1, limit: 50 }),
          mealsCatalogService.listMeals({ page: 1, limit: 500 }),
          byoItemsResPromise,
        ]);

        setCustomMealSubscriptions(customSubs);
        setAddonSubscriptions(addSub);
        setAddonPurchases(addPurchases);
    		setMyRequests(requests);
        setWindowDeliveries(deliveries14 || []);
          setHistoryDeliveries(deliveriesHistory || []);
        setOrders(ordersRes.items || []);

        const mealMap: Record<string, Meal> = {};
        for (const m of mealsRes.data || []) {
          if (m?.id) mealMap[String(m.id)] = m;
        }
        setMealsById(mealMap);

        const map: Record<string, string> = {};
        const servingsMap: Record<string, AddonServings> = {};
        const addonMap: Record<string, Addon> = {};
        for (const a of addonCatalog.data) map[a.id] = a.name;
        for (const a of addonCatalog.data) {
          if (a?.id) addonMap[String(a.id)] = a;
          if (a?.id && a?.servings) servingsMap[String(a.id)] = a.servings;
        }
        setAddonNameById(map);
          setAddonServingsById(servingsMap);
        setAddonsById(addonMap);

        const byoMap: Record<string, BuildYourOwnItemEntity> = {};
        for (const it of (byoItemsRes as unknown as { data?: BuildYourOwnItemEntity[] })?.data || []) {
          if (it?.id) byoMap[String(it.id)] = it;
        }
        setByoItemsById(byoMap);
      } finally {
        setLoading(false);
      }
    };
    fetchSubscriptions();
  }, [user?.id]);

  useEffect(() => {
    // Load deliveries for the visible calendar month.
    const controller = new AbortController();
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const from = toLocalISO(new Date(year, month, 1));
    const to = toLocalISO(new Date(year, month + 1, 0));
    deliveriesService
      .listMy({ from, to, signal: controller.signal })
      .then((data) => setCalendarDeliveries(data || []))
      .catch(() => {
        // Non-blocking: calendar tab can still render without markers.
      });
    return () => controller.abort();
  }, [calendarMonth]);

  const openPauseRequest = (kind: 'customMeal' | 'addon' | 'mealPack', subscriptionId: string) => {
    setPauseRequestTarget({ kind, subscriptionId });
    const t = tomorrowISO();
    setPauseRequestStart(t);
    setPauseRequestEnd(t);
    setPauseRequestReason('');
    setPauseRequestOpen(true);
  };

  const submitPauseRequest = async () => {
    if (!pauseRequestTarget) return;
    setPauseRequestSaving(true);
    try {
      await pauseSkipService.requestPause({
        kind: pauseRequestTarget.kind,
        subscriptionId: pauseRequestTarget.subscriptionId,
        pauseStartDate: pauseRequestStart,
        pauseEndDate: pauseRequestEnd,
        reason: pauseRequestReason || undefined,
      });
      const next = await pauseSkipService.listMyRequests({});
      setMyRequests(next);
      toast({
        title: 'Pause Requested',
        description: 'An admin will review your request shortly.',
      });
      setPauseRequestOpen(false);
    } catch (e: unknown) {
      toast({
        title: 'Failed to request pause',
        description: String((e as { message?: unknown })?.message || e),
        variant: 'destructive',
      });
    } finally {
      setPauseRequestSaving(false);
    }
  };

  const withdrawRequest = async (requestId: string) => {
    setWithdrawingRequestId(requestId);
    try {
      await pauseSkipService.withdrawRequest(requestId);
      setMyRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'WITHDRAWN' } : r)));
      toast({ title: 'Withdraw Request' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to withdraw',
        description: String((e as { message?: unknown })?.message || e),
        variant: 'destructive',
      });
    } finally {
      setWithdrawingRequestId(null);
    }
  };

  const activeCustomMealSubscriptions = useMemo(
    () => customMealSubscriptions.filter((s) => s.status === "active" || s.status === "paused"),
    [customMealSubscriptions]
  );
  const activeAddonSubscriptions = useMemo(
    () => addonSubscriptions.filter((s) => s.status === "active" || s.status === "paused"),
    [addonSubscriptions]
  );

  const paidOrders = useMemo(() => {
    return (orders || []).filter((o) => normalizeOrderFlags({ status: o.status, paymentStatus: o.paymentStatus }).isPaid);
  }, [orders]);


  const pendingPauseSubscriptionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of myRequests) {
      if (r.requestType !== 'PAUSE') continue;
      if (r.status !== 'PENDING') continue;
      if (r.subscriptionId) ids.add(r.subscriptionId);
    }
    return ids;
  }, [myRequests]);

  const withdrawnApprovedPauseIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of myRequests) {
      if (r.requestType !== 'WITHDRAW_PAUSE') continue;
      if (r.status !== 'APPROVED') continue;
      const linked = safeString(r.linkedTo);
      if (linked) set.add(linked);
    }
    return set;
  }, [myRequests]);

  const pendingWithdrawByPauseId = useMemo(() => {
    const map = new Map<string, PauseSkipRequest>();
    for (const r of myRequests) {
      if (r.requestType !== 'WITHDRAW_PAUSE') continue;
      if (r.status !== 'PENDING') continue;
      const linked = safeString(r.linkedTo);
      if (linked) map.set(linked, r);
    }
    return map;
  }, [myRequests]);

  const approvedEffectivePauseBySubscriptionId = useMemo(() => {
    const map = new Map<string, PauseSkipRequest>();
    for (const r of myRequests) {
      if (r.requestType !== 'PAUSE') continue;
      if (r.status !== 'APPROVED') continue;
      const subId = safeString(r.subscriptionId);
      if (!subId) continue;
      if (withdrawnApprovedPauseIds.has(r.id)) continue;
      const end = safeString(r.pauseEndDate);
      if (!end) continue;
      const prev = map.get(subId);
      const prevEnd = prev ? safeString(prev.pauseEndDate) : '';
      if (!prev || end > prevEnd) map.set(subId, r);
    }
    return map;
  }, [myRequests, withdrawnApprovedPauseIds]);

  const pauseStateForSubscription = (subscriptionId: string) => {
    const today = toLocalISO(new Date());
    if (pendingPauseSubscriptionIds.has(subscriptionId)) {
      return { state: 'pending' as const, request: undefined as PauseSkipRequest | undefined, withdrawPending: false };
    }
    const approved = approvedEffectivePauseBySubscriptionId.get(subscriptionId);
    if (!approved) return { state: 'none' as const, request: undefined as PauseSkipRequest | undefined, withdrawPending: false };
    const start = safeString(approved.pauseStartDate);
    const end = safeString(approved.pauseEndDate);
    if (end && today > end) return { state: 'none' as const, request: undefined as PauseSkipRequest | undefined, withdrawPending: false };
    const withdrawPending = pendingWithdrawByPauseId.has(approved.id);
    if (start && end) {
      if (today >= start && today <= end) return { state: 'paused' as const, request: approved, withdrawPending };
      if (today < start) return { state: 'scheduled' as const, request: approved, withdrawPending };
    }
    return { state: 'scheduled' as const, request: approved, withdrawPending };
  };

  const approvedPauseEndBySubscriptionId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of myRequests) {
      if (r.requestType !== 'PAUSE') continue;
      if (r.status !== 'APPROVED') continue;
      if (!r.subscriptionId) continue;
      const end = r.pauseEndDate || '';
      if (!end) continue;
      if (!map[r.subscriptionId] || end > map[r.subscriptionId]) map[r.subscriptionId] = end;
    }
    return map;
  }, [myRequests]);

  const subscriptionStatusLine = (status: string, subscriptionId: string) => {
    const pauseState = pauseStateForSubscription(subscriptionId);
    if (pauseState.state === 'pending') return 'Status: Pause requested';
    if (pauseState.state === 'paused') {
      const end = safeString(pauseState.request?.pauseEndDate);
      return end ? `Status: Paused until ${end}` : 'Status: Paused';
    }
    if (pauseState.state === 'scheduled') {
      const start = safeString(pauseState.request?.pauseStartDate);
      const end = safeString(pauseState.request?.pauseEndDate);
      return start && end ? `Status: Pause scheduled ${start} → ${end}` : 'Status: Pause scheduled';
    }

    if (status === 'active') return 'Status: Active';
    if (status === 'paused') {
      const end = approvedPauseEndBySubscriptionId[subscriptionId];
      return end ? `Status: Paused until ${end}` : 'Status: Paused';
    }
    return `Status: ${status}`;
  };

  const requestWithdrawPause = async (pauseRequestId: string) => {
    setWithdrawingRequestId(pauseRequestId);
    try {
      const created = await pauseSkipService.requestWithdrawPause(pauseRequestId);
      setMyRequests((prev) => [created, ...prev]);
      toast({ title: 'Withdraw Pause requested', description: 'An admin will review your request shortly.' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to request withdraw',
        description: String((e as { message?: unknown })?.message || e),
        variant: 'destructive',
      });
    } finally {
      setWithdrawingRequestId(null);
    }
  };

  const handleToggleCustomMealSub = async (id: string, nextStatus: "active" | "paused") => {
    const updated = await customMealSubscriptionService.setStatus(id, nextStatus);
    if (!updated) return;
    setCustomMealSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    toast({
      title: nextStatus === "paused" ? "Custom subscription paused" : "Custom subscription resumed",
      description: "This does not affect meal pack subscriptions.",
    });
  };

  const handleToggleAddonSub = async (id: string, nextStatus: "active" | "paused") => {
    const updated = await addonSubscriptionsService.setStatus(id, nextStatus);
    if (!updated) return;
    setAddonSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    toast({
      title: nextStatus === "paused" ? "Add-on subscription paused" : "Add-on subscription resumed",
      description: "This is separate from meal subscriptions.",
    });
  };

  const openViewSubscription = (target: {
    kind: ViewSubscriptionKind;
    subscriptionId: string;
    orderId?: string;
    plan?: string;
    title?: string;
  }) => {
    setViewSubscriptionTarget(target);
    setViewSubscriptionOpen(true);
  };

  const isWeekdayISO = (iso: string) => {
    const s = safeString(iso);
    if (!s) return false;
    const d = new Date(`${s}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    const dow = d.getDay();
    return dow >= 1 && dow <= 5;
  };

  const addDaysISO = (iso: string, days: number) => {
    const s = safeString(iso);
    const d = new Date(`${s}T00:00:00`);
    if (Number.isNaN(d.getTime())) return s;
    d.setDate(d.getDate() + days);
    return toLocalISO(d);
  };

  const getCurrentCycleStartISO = (baseStartISO: string, plan: string, todayISO: string) => {
    const base = safeString(baseStartISO);
    const today = safeString(todayISO);
    const periodDays = plan === 'monthly' ? 28 : 7;

    const baseDate = new Date(`${base}T00:00:00`);
    const todayDate = new Date(`${today}T00:00:00`);
    if (Number.isNaN(baseDate.getTime()) || Number.isNaN(todayDate.getTime())) return base || today;

    const diffDays = Math.floor((todayDate.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000));
    const cycles = diffDays > 0 ? Math.floor(diffDays / periodDays) : 0;
    const start = new Date(baseDate);
    start.setDate(start.getDate() + cycles * periodDays);
    return toLocalISO(start);
  };

  const deliveryMatchesSubscription = (d: MyDelivery, subscriptionId: string) => {
    const subId = safeString(subscriptionId);
    if (!subId) return false;
    const direct = safeString(d.subscriptionId);
    if (direct && direct === subId) return true;
    return Boolean((d.items || []).some((it) => safeString(it.cartItemId) === subId));
  };

  const findOrderItem = (orderId: string | undefined, cartItemId: string) => {
    const oId = safeString(orderId);
    if (!oId) return undefined;
    const o = (orders || []).find((x) => safeString(x.id) === oId);
    if (!o) return undefined;
    return (o.items || []).find((it) => safeString(it.cartItemId) === safeString(cartItemId));
  };

  const getTotalServingsForSubscription = (args: { type: 'meal' | 'addon' | 'byo'; plan: string; orderId?: string; cartItemId: string }) => {
    const plan = safeString(args.plan).toLowerCase();
    if (plan !== 'weekly' && plan !== 'monthly') return 1;

    const orderItem = findOrderItem(args.orderId, args.cartItemId);

    if (args.type === 'meal') {
      const mealId = safeString(orderItem?.mealId);
      const meal = mealId ? mealsById[mealId] : undefined;
      const servings = plan === 'monthly' ? meal?.pricing?.monthly?.servings : meal?.pricing?.weekly?.servings;
      if (typeof servings === 'number' && servings > 0) return servings;
    }

    if (args.type === 'addon') {
      const addonId = safeString(orderItem?.addonId);
      const servingsObj = addonId ? addonServingsById[addonId] : undefined;
      const servings = plan === 'monthly' ? servingsObj?.monthly : servingsObj?.weekly;
      if (typeof servings === 'number' && servings > 0) return servings;
    }

    // Safe fallback consistent with platform defaults.
    return plan === 'monthly' ? 20 : 5;
  };

  const getServingProgressForSubscription = (args: { type: 'meal' | 'addon' | 'byo'; plan: string; orderId?: string; cartItemId: string }) => {
    const plan = safeString(args.plan).toLowerCase();
    const todayISO = toLocalISO(new Date());
    const periodDays = plan === 'monthly' ? 28 : 7;

    const orderItem = findOrderItem(args.orderId, args.cartItemId);
    const baseStartISO = safeString(orderItem?.orderDetails?.startDate);

		// Backend-computed schedule meta (source of truth)
		const scheduleEndDate = safeString(orderItem?.subscriptionSchedule?.scheduleEndDate);
		const nextServingDate = safeString(orderItem?.subscriptionSchedule?.nextServingDate);

    const inferredStartISO = (() => {
      if (baseStartISO) return baseStartISO;
      const subId = safeString(args.cartItemId);
      const candidates = [...(historyDeliveries || []), ...(windowDeliveries || [])]
        .filter((d) => deliveryMatchesSubscription(d, subId))
        .map((d) => safeString(d.date))
        .filter(Boolean)
        .sort();
      return candidates[0] || todayISO;
    })();

    const cycleStartISO = getCurrentCycleStartISO(inferredStartISO, plan, todayISO);
    const cycleEndISO = addDaysISO(cycleStartISO, periodDays - 1);

    const cycleEndWeekdayISO = (() => {
      for (let i = periodDays - 1; i >= 0; i -= 1) {
        const dt = addDaysISO(cycleStartISO, i);
        if (isWeekdayISO(dt)) return dt;
      }
      return cycleEndISO;
    })();

    const totalServings = getTotalServingsForSubscription(args);
    const deliveredCount = (historyDeliveries || []).filter((d) => {
      if (!deliveryMatchesSubscription(d, args.cartItemId)) return false;
      if (d.status !== 'DELIVERED') return false;
      const date = safeString(d.date);
      if (!date) return false;
      if (date < cycleStartISO || date > cycleEndISO) return false;
      return isWeekdayISO(date);
    }).length;

    const delivered = Math.max(0, Math.min(totalServings, deliveredCount));
    const remaining = Math.max(0, totalServings - delivered);
    const progress = totalServings > 0 ? (delivered / totalServings) * 100 : 0;
    return {
      total: totalServings,
      delivered,
      remaining,
      progress,
      startDate: inferredStartISO,
      cycleStartDate: cycleStartISO,
		// UI should display backend-derived dynamic end date when available.
		scheduleEndDate: scheduleEndDate || undefined,
		nextServingDate: nextServingDate || undefined,
		cycleEndDate: scheduleEndDate || cycleEndWeekdayISO,
      deliveryTime: safeString(orderItem?.orderDetails?.deliveryTime),
    };
  };

  const requestSkip = async (deliveryId: string) => {
    if (!deliveryId) return;
    setRequestingSkipDeliveryId(deliveryId);
    try {
      await pauseSkipService.requestSkipDelivery({ deliveryId });
      const next = await pauseSkipService.listMyRequests({});
      setMyRequests(next);
      toast({ title: 'Skip Requested', description: 'An admin will review your request shortly.' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to request skip',
        description: String((e as { message?: unknown })?.message || e),
        variant: 'destructive',
      });
    } finally {
      setRequestingSkipDeliveryId(null);
    }
  };

  const toDeliveryBadge = (status: MyDelivery['status']) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Pending', cls: 'bg-slate-100 text-slate-900 border-slate-200' };
      case 'COOKING':
        return { label: 'Cooking', cls: 'bg-orange-100 text-orange-900 border-orange-200' };
      case 'PACKED':
        return { label: 'Packed', cls: 'bg-blue-100 text-blue-900 border-blue-200' };
      case 'OUT_FOR_DELIVERY':
        return { label: 'Out for delivery', cls: 'bg-purple-100 text-purple-900 border-purple-200' };
      case 'DELIVERED':
        return { label: 'Delivered', cls: 'bg-green-100 text-green-900 border-green-200' };
      case 'SKIPPED':
        return { label: 'Skipped', cls: 'bg-red-100 text-red-900 border-red-200' };
      default:
        return { label: String(status), cls: 'bg-muted text-muted-foreground border' };
    }
  };

  const pendingSkipByDeliveryId = useMemo(() => {
    const set = new Set<string>();
    for (const r of myRequests) {
      if (r.requestType !== 'SKIP') continue;
      if (r.status !== 'PENDING') continue;
      const id = safeString(r.deliveryId);
      if (id) set.add(id);
    }
    return set;
  }, [myRequests]);

  type MealPackSubCard = {
    subscriptionId: string;
    title: string;
    plan: string;
    orderId?: string;
    quantity?: number;
    deliveries: Array<{ id: string; date: string; time: string; status: MyDelivery['status']; items: MyDelivery['items'] }>;
  };

  type PendingSubCard = {
    subscriptionId: string;
    orderId: string;
    title: string;
    plan: PublicOrderItem['plan'];
    type: PublicOrderItem['type'];
    quantity: number;
    startDate?: string;
    deliveryTime?: string;
    createdAt: string;
  };

  const activatedOrderItemKeys = useMemo(() => {
    const set = new Set<string>();
    for (const d of windowDeliveries) {
      for (const it of d.items || []) {
        const key = `${safeString(it.orderId)}|${safeString(it.cartItemId)}`;
        if (key !== '|') set.add(key);
      }
    }
    return set;
  }, [windowDeliveries]);

  const pendingSubsFromOrders = useMemo(() => {
    const pending: PendingSubCard[] = [];

    for (const o of paidOrders) {
      for (const it of o.items || []) {
        if (it.plan !== 'weekly' && it.plan !== 'monthly') continue;
        const key = `${safeString(o.id)}|${safeString(it.cartItemId)}`;
        if (activatedOrderItemKeys.has(key)) continue;

        const title = safeString(it.pricingSnapshot?.title) || (it.type === 'byo' ? 'Custom Meal Pack' : it.type === 'addon' ? 'Add-on' : 'Meal Pack');
        pending.push({
          subscriptionId: safeString(it.cartItemId),
          orderId: safeString(o.id),
          title,
          plan: it.plan,
          type: it.type,
          quantity: typeof it.quantity === 'number' ? it.quantity : 1,
          startDate: it.orderDetails?.startDate,
          deliveryTime: it.orderDetails?.deliveryTime,
          createdAt: safeString(o.createdAt),
        });
      }
    }

    return pending.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [paidOrders, activatedOrderItemKeys]);

  const mealPackSubscriptions = useMemo(() => {
    const map = new Map<string, MealPackSubCard>();
    const today = toLocalISO(new Date());

    for (const d of windowDeliveries) {
      const subId = safeString(d.subscriptionId);
      if (!subId) continue;

      const deliveryId = safeString(d._id || d.id);
      if (!deliveryId) continue;

      const item = (d.items || [])[0];
      const plan = safeString(item?.plan).toLowerCase();
      const type = safeString(item?.type).toLowerCase();
      if (!['weekly', 'monthly'].includes(plan)) continue;
      if (type && type !== 'meal') continue;

      const title = safeString(item?.title) || 'Meal Pack';
      const orderId = item?.orderId ? safeString(item.orderId) : undefined;
      const quantity = typeof item?.quantity === 'number' ? item.quantity : undefined;

      if (!map.has(subId)) {
        map.set(subId, {
          subscriptionId: subId,
          title,
          plan,
          orderId,
          quantity,
          deliveries: [],
        });
      }

      map.get(subId)!.deliveries.push({
        id: deliveryId,
        date: safeString(d.date),
        time: safeString(d.time),
        status: d.status,
        items: d.items,
      });
    }

    const arr = Array.from(map.values());
    for (const s of arr) {
      s.deliveries.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      const first = s.deliveries.find((x) => x.date >= today) || s.deliveries[0];
      if (first?.items?.[0]?.title) s.title = safeString(first.items[0].title) || s.title;
      if (first?.items?.[0]?.plan) s.plan = safeString(first.items[0].plan).toLowerCase() || s.plan;
    }

    return arr.sort((a, b) => a.title.localeCompare(b.title));
  }, [windowDeliveries]);

  const byoSubscriptions = useMemo(() => {
    const map = new Map<string, MealPackSubCard>();
    const today = toLocalISO(new Date());

    for (const d of windowDeliveries) {
      const subId = safeString(d.subscriptionId);
      if (!subId) continue;

      const deliveryId = safeString(d._id || d.id);
      if (!deliveryId) continue;

      const item = (d.items || [])[0];
      const plan = safeString(item?.plan).toLowerCase();
      const type = safeString(item?.type).toLowerCase();
      if (!['weekly', 'monthly'].includes(plan)) continue;
      if (type !== 'byo') continue;

      const title = safeString(item?.title) || 'Custom Meal Pack';
      const orderId = item?.orderId ? safeString(item.orderId) : undefined;
      const quantity = typeof item?.quantity === 'number' ? item.quantity : undefined;

      if (!map.has(subId)) {
        map.set(subId, {
          subscriptionId: subId,
          title,
          plan,
          orderId,
          quantity,
          deliveries: [],
        });
      }

      map.get(subId)!.deliveries.push({
        id: deliveryId,
        date: safeString(d.date),
        time: safeString(d.time),
        status: d.status,
        items: d.items,
      });
    }

    const arr = Array.from(map.values());
    for (const s of arr) {
      s.deliveries.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      const first = s.deliveries.find((x) => x.date >= today) || s.deliveries[0];
      if (first?.items?.[0]?.title) s.title = safeString(first.items[0].title) || s.title;
      if (first?.items?.[0]?.plan) s.plan = safeString(first.items[0].plan).toLowerCase() || s.plan;
    }

    return arr.sort((a, b) => a.title.localeCompare(b.title));
  }, [windowDeliveries]);

  const addonSubscriptionsFromDeliveries = useMemo(() => {
    const map = new Map<string, MealPackSubCard>();
    const today = toLocalISO(new Date());

    for (const d of windowDeliveries) {
      const subId = safeString(d.subscriptionId);
      if (!subId) continue;

      const deliveryId = safeString(d._id || d.id);
      if (!deliveryId) continue;

      const item = (d.items || [])[0];
      const plan = safeString(item?.plan).toLowerCase();
      const type = safeString(item?.type).toLowerCase();
      if (!['weekly', 'monthly'].includes(plan)) continue;
      if (type !== 'addon') continue;

      const title = safeString(item?.title) || 'Add-on';
      const orderId = item?.orderId ? safeString(item.orderId) : undefined;
      const quantity = typeof item?.quantity === 'number' ? item.quantity : undefined;

      if (!map.has(subId)) {
        map.set(subId, {
          subscriptionId: subId,
          title,
          plan,
          orderId,
          quantity,
          deliveries: [],
        });
      }

      map.get(subId)!.deliveries.push({
        id: deliveryId,
        date: safeString(d.date),
        time: safeString(d.time),
        status: d.status,
        items: d.items,
      });
    }

    const arr = Array.from(map.values());
    for (const s of arr) {
      s.deliveries.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      const first = s.deliveries.find((x) => x.date >= today) || s.deliveries[0];
      if (first?.items?.[0]?.title) s.title = safeString(first.items[0].title) || s.title;
      if (first?.items?.[0]?.plan) s.plan = safeString(first.items[0].plan).toLowerCase() || s.plan;
    }

    return arr.sort((a, b) => a.title.localeCompare(b.title));
  }, [windowDeliveries]);

  const addonPurchasesFromOrders = useMemo(() => {
    const items: Array<{ orderId: string; createdAt: string; item: PublicOrderItem }> = [];
    for (const o of paidOrders) {
      for (const it of o.items || []) {
        if (it.type !== 'addon') continue;
        if (it.plan !== 'single' && it.plan !== 'trial') continue;
        items.push({ orderId: safeString(o.id), createdAt: safeString(o.createdAt), item: it });
      }
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [paidOrders]);

  const pendingMeal = pendingSubsFromOrders.filter((p) => p.type === 'meal');
  const pendingByo = pendingSubsFromOrders.filter((p) => p.type === 'byo');
  const pendingAddon = pendingSubsFromOrders.filter((p) => p.type === 'addon');

  const activeTotalCount =
    activeCustomMealSubscriptions.length +
    activeAddonSubscriptions.length +
    mealPackSubscriptions.length +
    byoSubscriptions.length +
    addonSubscriptionsFromDeliveries.length +
    pendingSubsFromOrders.length;

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-oz-neutral/50 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
    <Dialog open={pauseRequestOpen} onOpenChange={setPauseRequestOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pause Requested</DialogTitle>
          <DialogDescription>
            Pick a date range. Your request will be reviewed by an admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium">Start date</div>
              <Input type="date" value={pauseRequestStart} onChange={(e) => setPauseRequestStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">End date</div>
              <Input type="date" value={pauseRequestEnd} onChange={(e) => setPauseRequestEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Reason (optional)</div>
            <Textarea value={pauseRequestReason} onChange={(e) => setPauseRequestReason(e.target.value)} placeholder="Tell us why you need a pause…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPauseRequestOpen(false)} disabled={pauseRequestSaving}>
              Cancel
            </Button>
            <Button onClick={submitPauseRequest} disabled={pauseRequestSaving || !pauseRequestTarget}>
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={viewSubscriptionOpen}
      onOpenChange={(open) => {
        setViewSubscriptionOpen(open);
        if (!open) setViewSubscriptionTarget(null);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {(() => {
          const target = viewSubscriptionTarget;
          if (!target) {
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Subscription details</DialogTitle>
                </DialogHeader>
                <div className="text-sm text-muted-foreground">No subscription selected.</div>
              </>
            );
          }

          const subscriptionId = safeString(target.subscriptionId);
          const orderId = safeString(target.orderId);
          const orderItem = orderId ? findOrderItem(orderId, subscriptionId) : undefined;
          const kind = (target.kind || safeString(orderItem?.type)) as ViewSubscriptionKind;
          const plan = safeString(target.plan || orderItem?.plan).toLowerCase();
          const servingProgress = getServingProgressForSubscription({
            type: kind,
            plan,
            orderId: orderId || undefined,
            cartItemId: subscriptionId,
          });

          const deliveriesForTarget = (() => {
            const groups = {
              meal: mealPackSubscriptions,
              byo: byoSubscriptions,
              addon: addonSubscriptionsFromDeliveries,
            } as const;
            const sub = groups[kind]?.find((s) => s.subscriptionId === subscriptionId);
            return sub?.deliveries || [];
          })();

          const upcomingServingItems = (() => {
            const remaining = Math.max(0, Number(servingProgress.remaining) || 0);
            if (remaining === 0) return [] as Array<{
              date: string;
              time: string;
              status: string;
              id?: string;
              isPlaceholder: boolean;
            }>;

            const todayISO = toLocalISO(new Date());

            const byDate = new Map<string, (typeof deliveriesForTarget)[number]>();
            for (const d of deliveriesForTarget) {
              const date = safeString(d.date);
              if (!date) continue;
              if (date < todayISO) continue;
              if (!byDate.has(date)) byDate.set(date, d);
            }

            const items: Array<{ date: string; time: string; status: string; id?: string; isPlaceholder: boolean }> = [];
            let cursor = todayISO;
            let safety = 0;
            while (items.length < remaining && safety < 220) {
              safety += 1;
              if (isWeekdayISO(cursor)) {
                const existing = byDate.get(cursor);
                if (existing) {
                  items.push({
                    date: safeString(existing.date),
                    time: safeString(existing.time) || servingProgress.deliveryTime || '—',
                    status: safeString(existing.status) || 'PENDING',
                    id: safeString(existing.id),
                    isPlaceholder: false,
                  });
                } else {
                  items.push({
                    date: cursor,
                    time: servingProgress.deliveryTime || '—',
                    status: 'SCHEDULED',
                    isPlaceholder: true,
                  });
                }
              }

              cursor = addDaysISO(cursor, 1);
            }

            return items;
          })();

          const title =
            safeString(target.title) ||
            safeString(orderItem?.pricingSnapshot?.title) ||
            (kind === 'byo' ? 'Custom Meal Pack' : kind === 'addon' ? 'Add-on' : 'Meal Pack');

          const meal = kind === 'meal' ? mealsById[safeString(orderItem?.mealId)] : undefined;
          const addon = kind === 'addon' ? addonsById[safeString(orderItem?.addonId)] : undefined;

          const includedFlags = meal?.includedItems || {};
          const includedFlagLabels = Object.entries(includedFlags)
            .filter(([, v]) => Boolean(v))
            .map(([k]) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()));

          const includedAssignments = Array.isArray(meal?.includedItemAssignments) ? meal!.includedItemAssignments : [];
          const activeAssignments = includedAssignments.filter((a) => a && a.isActive !== false);

          const byoSelections = Array.isArray(orderItem?.byoSelections) ? orderItem!.byoSelections : [];

          return (
            <>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  <span className="capitalize">{kind}</span> · <span className="capitalize">{plan}</span>
                  {orderId ? <> · Order {orderId.slice(0, 8)}…</> : null}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Schedule</div>
                    <div className="text-sm font-medium">
                      {servingProgress.cycleStartDate || '—'} → {servingProgress.scheduleEndDate || servingProgress.cycleEndDate || '—'}
                    </div>
                    {servingProgress.deliveryTime ? (
                      <div className="text-xs text-muted-foreground mt-1">Delivery time: {servingProgress.deliveryTime}</div>
                    ) : null}
					{servingProgress.nextServingDate ? (
						<div className="text-xs text-muted-foreground mt-1">Upcoming Serving Date: {servingProgress.nextServingDate}</div>
					) : (
						<div className="text-xs text-muted-foreground mt-1">Upcoming Serving Date: —</div>
					)}
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Servings (Mon–Fri)</div>
                        <div className="text-sm font-medium">{servingProgress.delivered} served · {servingProgress.remaining} remaining</div>
                      </div>
                      <div className="text-sm font-semibold">{servingProgress.total}</div>
                    </div>
                    <div className="mt-2">
                      <Progress value={servingProgress.progress} className="h-2" />
                    </div>
                  </div>
                </div>

                {kind === 'meal' && meal ? (
                  <div className="space-y-2">
                    <div className="font-medium">Meal details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Meal type</div>
                        <div className="text-sm">{meal.mealTypeRef?.name || meal.mealType || '—'}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Total quantity</div>
                        <div className="text-sm">{meal.totalQuantity ? `${meal.totalQuantity} ${meal.totalQuantityUnit || ''}`.trim() : '—'}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Protein per meal</div>
                        <div className="text-sm">{typeof meal.proteinPerMeal === 'number' ? `${meal.proteinPerMeal}g` : '—'}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Calories</div>
                        <div className="text-sm">{meal.caloriesRange || '—'}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Ingredients / included items</div>
                      {includedFlagLabels.length ? (
                        <div className="flex flex-wrap gap-2">
                          {includedFlagLabels.map((x) => (
                            <Badge key={x} variant="outline" className="bg-white">{x}</Badge>
                          ))}
                        </div>
                      ) : null}

                      {activeAssignments.length ? (
                        <div className="space-y-1 text-sm">
                          {activeAssignments.map((a) => (
                            <div key={safeString(a.itemId)} className="flex items-center justify-between gap-3">
                              <div className="truncate">{a.item?.name || safeString(a.itemId) || 'Item'}</div>
                              <div className="text-muted-foreground">{a.quantity} {a.unit}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No ingredient breakdown provided for this meal.</div>
                      )}
                    </div>
                  </div>
                ) : null}

                {kind === 'addon' && addon ? (
                  <div className="space-y-2">
                    <div className="font-medium">Add-on details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Category</div>
                        <div className="text-sm">{addon.categoryRef?.name || addon.category || '—'}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Serving size</div>
                        <div className="text-sm">{addon.servingSizeText || '—'}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Protein</div>
                        <div className="text-sm">{typeof addon.proteinGrams === 'number' ? `${addon.proteinGrams}g` : '—'}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Pricing</div>
                        <div className="text-sm">Single: ₹{addon.pricing?.single ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {kind === 'byo' ? (
                  <div className="space-y-2">
                    <div className="font-medium">Custom meal selections</div>
                    {byoSelections.length ? (
                      <div className="space-y-1 text-sm">
                        {byoSelections.map((s) => {
                          const id = safeString(s.itemId);
                          const item = id ? byoItemsById[id] : undefined;
                          const name = item?.name || id || 'Item';
                          const unit = item?.quantityUnit;
                          const baseQty = typeof item?.quantityValue === 'number' ? item.quantityValue : undefined;
                          const displayQty = baseQty ? `${s.quantity} × ${baseQty}${unit ? unit : ''}` : `${s.quantity}`;
                          return (
                            <div key={`${id}_${s.quantity}`} className="flex items-center justify-between gap-3">
                              <div className="truncate">{name}</div>
                              <div className="text-muted-foreground">{displayQty}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No BYO selections found for this subscription.</div>
                    )}
                  </div>
                ) : null}

                {upcomingServingItems.length ? (
                  <div className="space-y-2">
                    <div className="font-medium">Upcoming deliveries (next {upcomingServingItems.length} servings)</div>
                    <div className="space-y-2 max-h-[280px] overflow-auto">
                      {upcomingServingItems.map((d) => {
                        const badge = toDeliveryBadge(d.status === 'SCHEDULED' ? 'PENDING' : d.status);
                        return (
                          <div key={`${d.date}_${d.id || 'scheduled'}`} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-medium">{d.date} · {d.time}</div>
                                {!d.isPlaceholder && d.id ? (
                                  <div className="text-xs text-muted-foreground">Delivery ID: {d.id.slice(0, 8)}…</div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">Scheduled</div>
                                )}
                              </div>
                              <Badge variant="outline" className={badge.cls}>
                                {d.isPlaceholder ? 'Scheduled' : badge.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active">Active ({activeTotalCount})</TabsTrigger>
          <TabsTrigger value="calendar">Delivery Calendar</TabsTrigger>
          <TabsTrigger value="history">History ({paidOrders.length})</TabsTrigger>
        </TabsList>

        {/* Active Subscriptions */}
        <TabsContent value="active" className="space-y-4">

          {/* Phase 4: Custom Meal Subscriptions */}
          <Card className="overflow-hidden bg-white">
            <CardHeader className="bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Custom Meal Subscriptions</CardTitle>
                  <p className="text-sm text-muted-foreground">Saved from Build-Your-Own. Separate from meal packs.</p>
                </div>
                <Link to="/build-your-own">
                  <Button variant="outline">
                    Build a meal
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {pendingByo.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-oz-primary">Pending activation</div>
                  {pendingByo.slice(0, 5).map((p) => (
                    <div key={`${p.orderId}_${p.subscriptionId}`} className="rounded-lg border p-4 bg-white">
                      {(() => {
                        const servingProgress = getServingProgressForSubscription({
                          type: 'byo',
                          plan: p.plan,
                          orderId: p.orderId,
                          cartItemId: p.subscriptionId,
                        });

                        return (
                          <>
                      <div className="min-w-0">
                        <div className="font-medium text-oz-primary truncate">{p.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">{p.plan.toUpperCase()} · Qty {p.quantity}</div>
                        {p.startDate || p.deliveryTime ? (
                          <div className="text-xs text-muted-foreground mt-1">Starts: {p.startDate || '—'} at {p.deliveryTime || '—'}</div>
                        ) : null}
                        <div className="text-xs text-muted-foreground mt-1">Order: {p.orderId.slice(0, 8)}…</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <Badge variant="outline" className="bg-white">Pending</Badge>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewSubscription({ kind: 'byo', subscriptionId: p.subscriptionId, orderId: p.orderId, plan: p.plan, title: p.title })}
                          >
                            View
                          </Button>
                          <Link to={`/my-orders/${encodeURIComponent(p.orderId)}`}>
                            <Button size="sm" variant="outline">View Order</Button>
                          </Link>
                          {(() => {
                            const isPending = pendingPauseSubscriptionIds.has(p.subscriptionId);
                            const disabledByCutoff = !isPending && isPauseCutoffExceededForSubscription(p.subscriptionId);
                            const btn = (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPauseRequest('customMeal', p.subscriptionId)}
                                disabled={isPending || disabledByCutoff}
                              >
                                <Pause className="mr-2 h-4 w-4" /> {isPending ? 'Pause Requested' : 'Request Pause'}
                              </Button>
                            );
                            if (!disabledByCutoff) return btn;
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">{btn}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Pause requests must be submitted at least {formatLeadTime(pauseCutoffMinutes)} before delivery.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Servings progress (Mon–Fri)</span>
                          <span className="font-medium">{servingProgress.delivered} / {servingProgress.total}</span>
                        </div>
                        <Progress value={servingProgress.progress} className="h-2" />
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ) : null}

              {byoSubscriptions.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-oz-primary">Active (delivery-backed)</div>
                  {byoSubscriptions.map((sub) => {
                    const pauseState = pauseStateForSubscription(sub.subscriptionId);
                    const servingProgress = getServingProgressForSubscription({
                      type: 'byo',
                      plan: sub.plan,
                      orderId: sub.orderId,
                      cartItemId: sub.subscriptionId,
                    });
                    return (
                      <div key={sub.subscriptionId} className="rounded-lg border p-4 bg-white">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-medium text-oz-primary truncate">{sub.title}</div>
                            <div className="text-sm text-muted-foreground mt-1">{sub.plan.toUpperCase()} · Qty {sub.quantity ?? '—'}</div>
                            {sub.orderId ? <div className="text-xs text-muted-foreground mt-1">Order: {sub.orderId.slice(0, 8)}…</div> : null}
                          </div>
                          <div className="text-right">
                            {pauseState.state === 'paused' ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200">Paused</Badge>
                            ) : pauseState.state === 'pending' ? (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-900 border-yellow-200">Pause Requested</Badge>
                            ) : pauseState.state === 'scheduled' ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200">Pause Scheduled</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-white">Active</Badge>
                            )}
                            <div className="text-xs text-muted-foreground mt-2">{subscriptionStatusLine('active', sub.subscriptionId)}</div>
                            <div className="mt-2 flex flex-wrap justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openViewSubscription({ kind: 'byo', subscriptionId: sub.subscriptionId, orderId: sub.orderId, plan: sub.plan, title: sub.title })}
                              >
                                View
                              </Button>
                              {sub.orderId ? (
                                <Link to={`/my-orders/${encodeURIComponent(sub.orderId)}`}>
                                  <Button size="sm" variant="outline">View Order</Button>
                                </Link>
                              ) : (
                                <Button size="sm" variant="outline" disabled>View Order</Button>
                              )}
                              {(() => {
                                const isPending = pauseState.state === 'pending';
                                const isPausedOrScheduled = pauseState.state === 'paused' || pauseState.state === 'scheduled';
                                const disabledByCutoff = !isPending && !isPausedOrScheduled && isPauseCutoffExceededForSubscription(sub.subscriptionId);
                                const btn = (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openPauseRequest('customMeal', sub.subscriptionId)}
                                    disabled={isPending || isPausedOrScheduled || disabledByCutoff}
                                  >
                                    <Pause className="mr-2 h-4 w-4" /> {isPending ? 'Pause Requested' : 'Request Pause'}
                                  </Button>
                                );
                                if (!disabledByCutoff) return btn;
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex">{btn}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Pause requests must be submitted at least {formatLeadTime(pauseCutoffMinutes)} before delivery.
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })()}

                              {pauseState.request ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => requestWithdrawPause(pauseState.request!.id)}
                                  disabled={pauseState.withdrawPending || withdrawingRequestId === pauseState.request!.id}
                                >
                                  {pauseState.withdrawPending ? 'Withdraw Requested' : 'Withdraw Pause'}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Servings progress (Mon–Fri)</span>
                            <span className="font-medium">{servingProgress.delivered} / {servingProgress.total}</span>
                          </div>
                          <Progress value={servingProgress.progress} className="h-2" />
                        </div>
						<div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div className="rounded-md border p-3 bg-white">
								<div className="text-xs text-muted-foreground">Upcoming Serving Date</div>
								<div className="text-sm font-medium">{servingProgress.nextServingDate || '—'}</div>
							</div>
							<div className="rounded-md border p-3 bg-white">
								<div className="text-xs text-muted-foreground">End date</div>
								<div className="text-sm font-medium">{servingProgress.scheduleEndDate || servingProgress.cycleEndDate || '—'}</div>
							</div>
						</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {activeCustomMealSubscriptions.length === 0 && pendingByo.length === 0 && byoSubscriptions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No active custom meal subscriptions yet.</div>
              ) : null}
            </CardContent>
          </Card>

          {/* Phase 4: Add-on Subscriptions & Purchases */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-oz-neutral/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Add-on Store</CardTitle>
                  <p className="text-sm text-muted-foreground">Buy once or subscribe (separate lifecycle).</p>
                </div>
                <Link to="/addons">
                  <Button variant="outline">
                    Browse add-ons
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-oz-secondary" />
                  <div className="font-medium">Active Add-on Subscriptions</div>
                </div>
                {pendingAddon.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-oz-primary">Pending activation</div>
                    {pendingAddon.slice(0, 5).map((p) => (
                      <div key={`${p.orderId}_${p.subscriptionId}`} className="rounded-lg border p-4 bg-white">
                        {(() => {
                          const servingProgress = getServingProgressForSubscription({
                            type: 'addon',
                            plan: p.plan,
                            orderId: p.orderId,
                            cartItemId: p.subscriptionId,
                          });

                          return (
                            <>
                        <div className="min-w-0">
                          <div className="font-medium text-oz-primary truncate">{p.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">{p.plan.toUpperCase()} · Qty {p.quantity}</div>
                          <div className="text-xs text-muted-foreground mt-1">Order: {p.orderId.slice(0, 8)}…</div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <Badge variant="outline" className="bg-white">Pending</Badge>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openViewSubscription({ kind: 'addon', subscriptionId: p.subscriptionId, orderId: p.orderId, plan: p.plan, title: p.title })}
                            >
                              View
                            </Button>
                            <Link to={`/my-orders/${encodeURIComponent(p.orderId)}`}>
                              <Button size="sm" variant="outline">View Order</Button>
                            </Link>
                            {(() => {
                              const isPending = pendingPauseSubscriptionIds.has(p.subscriptionId);
                              const disabledByCutoff = !isPending && isPauseCutoffExceededForSubscription(p.subscriptionId);
                              const btn = (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPauseRequest('addon', p.subscriptionId)}
                                  disabled={isPending || disabledByCutoff}
                                >
                                  <Pause className="mr-2 h-4 w-4" /> {isPending ? 'Pause Requested' : 'Request Pause'}
                                </Button>
                              );
                              if (!disabledByCutoff) return btn;
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex">{btn}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Pause requests must be submitted at least {formatLeadTime(pauseCutoffMinutes)} before delivery.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Servings progress (Mon–Fri)</span>
                            <span className="font-medium">{servingProgress.delivered} / {servingProgress.total}</span>
                          </div>
                          <Progress value={servingProgress.progress} className="h-2" />
                        </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ) : null}

                {addonSubscriptionsFromDeliveries.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-oz-primary">Active (delivery-backed)</div>
                    {addonSubscriptionsFromDeliveries.map((sub) => {
                      const pauseState = pauseStateForSubscription(sub.subscriptionId);
                      const servingProgress = getServingProgressForSubscription({
                        type: 'addon',
                        plan: sub.plan,
                        orderId: sub.orderId,
                        cartItemId: sub.subscriptionId,
                      });

                      return (
                        <div key={sub.subscriptionId} className="rounded-lg border p-4 bg-white">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-medium text-oz-primary">{sub.title}</div>
                              <div className="text-sm text-muted-foreground mt-1">{sub.plan.toUpperCase()} · Qty {sub.quantity ?? '—'}</div>
                              {sub.orderId ? <div className="text-xs text-muted-foreground mt-1">Order: {sub.orderId.slice(0, 8)}…</div> : null}
                            </div>
                            <div className="text-right">
                              {pauseState.state === 'paused' ? (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200">Paused</Badge>
                              ) : pauseState.state === 'pending' ? (
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-900 border-yellow-200">Pause Requested</Badge>
                              ) : pauseState.state === 'scheduled' ? (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200">Pause Scheduled</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-white">Active</Badge>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">{subscriptionStatusLine('active', sub.subscriptionId)}</div>
                              <div className="mt-2 flex flex-wrap justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openViewSubscription({ kind: 'addon', subscriptionId: sub.subscriptionId, orderId: sub.orderId, plan: sub.plan, title: sub.title })}
                                >
                                  View
                                </Button>
                                {sub.orderId ? (
                                  <Link to={`/my-orders/${encodeURIComponent(sub.orderId)}`}>
                                    <Button size="sm" variant="outline">View Order</Button>
                                  </Link>
                                ) : (
                                  <Button size="sm" variant="outline" disabled>View Order</Button>
                                )}
                                {(() => {
                                  const isPending = pauseState.state === 'pending';
                                  const isPausedOrScheduled = pauseState.state === 'paused' || pauseState.state === 'scheduled';
                                  const disabledByCutoff = !isPending && !isPausedOrScheduled && isPauseCutoffExceededForSubscription(sub.subscriptionId);
                                  const btn = (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openPauseRequest('addon', sub.subscriptionId)}
                                      disabled={isPending || isPausedOrScheduled || disabledByCutoff}
                                    >
                                      <Pause className="mr-2 h-4 w-4" /> {isPending ? 'Pause Requested' : 'Request Pause'}
                                    </Button>
                                  );
                                  if (!disabledByCutoff) return btn;
                                  return (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex">{btn}</span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Pause requests must be submitted at least {formatLeadTime(pauseCutoffMinutes)} before delivery.
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })()}

                                {pauseState.request ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => requestWithdrawPause(pauseState.request!.id)}
                                    disabled={pauseState.withdrawPending || withdrawingRequestId === pauseState.request!.id}
                                  >
                                    {pauseState.withdrawPending ? 'Withdraw Requested' : 'Withdraw Pause'}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Servings progress (Mon–Fri)</span>
                              <span className="font-medium">{servingProgress.delivered} / {servingProgress.total}</span>
                            </div>
                            <Progress value={servingProgress.progress} className="h-2" />
                          </div>

						<div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div className="rounded-md border p-3 bg-white">
								<div className="text-xs text-muted-foreground">Upcoming Serving Date</div>
								<div className="text-sm font-medium">{servingProgress.nextServingDate || '—'}</div>
							</div>
							<div className="rounded-md border p-3 bg-white">
								<div className="text-xs text-muted-foreground">End date</div>
								<div className="text-sm font-medium">{servingProgress.scheduleEndDate || servingProgress.cycleEndDate || '—'}</div>
							</div>
						</div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {activeAddonSubscriptions.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-oz-primary">Active (commerce)</div>
                    {activeAddonSubscriptions.map((s) => (
                      <div key={s.id} className="rounded-lg border p-4 bg-white">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-medium text-oz-primary">{addonNameById[s.addonId] || "Add-on"}</div>
                            <div className="text-sm text-muted-foreground mt-1">{s.frequency.toUpperCase()} · {s.servings} servings</div>
                            <div className="text-xs text-muted-foreground mt-1">Starts: {new Date(s.startDate).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">₹{s.price}</div>
                            <div className="text-xs text-muted-foreground mt-1">{subscriptionStatusLine(s.status, s.id)}</div>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewSubscription({ kind: 'addon', subscriptionId: s.id, plan: s.frequency, title: addonNameById[s.addonId] || 'Add-on' })}
                          >
                            View
                          </Button>
                          <Button size="sm" variant="outline" disabled>View Order</Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPauseRequest('addon', s.id)}
                            disabled={s.status !== 'active' || pendingPauseSubscriptionIds.has(s.id)}
                          >
                            <Pause className="mr-2 h-4 w-4" /> {pendingPauseSubscriptionIds.has(s.id) ? 'Pause Requested' : 'Request Pause'}
                          </Button>
                        </div>

                        {s.status !== "active" ? (
                          <div className="mt-2 flex justify-end">
                            <Button
                              size="sm"
                              className="bg-oz-accent hover:bg-oz-accent/90"
                              onClick={() => handleToggleAddonSub(s.id, "active")}
                            >
                              <Play className="mr-2 h-4 w-4" /> Resume
                            </Button>
                          </div>
                        ) : null}

                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Servings progress (Mon–Fri)</span>
                            <span className="font-medium">0 / {s.frequency === 'monthly' ? 20 : 5}</span>
                          </div>
                          <Progress value={0} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {activeAddonSubscriptions.length === 0 && addonSubscriptionsFromDeliveries.length === 0 && pendingAddon.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No active add-on subscriptions yet.</div>
                ) : null}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-oz-secondary" />
                  <div className="font-medium">Recent Add-on Purchases</div>
                </div>
                {addonPurchasesFromOrders.length > 0 ? (
                  <div className="space-y-3">
                    {addonPurchasesFromOrders.slice(0, 5).map((p) => (
                      <div key={`${p.orderId}_${p.item.cartItemId}`} className="flex items-start justify-between gap-4 rounded-lg border p-4 bg-white">
                        <div className="min-w-0">
                          <div className="font-medium text-oz-primary">{safeString(p.item.pricingSnapshot?.title) || 'Add-on'}</div>
                          <div className="text-sm text-muted-foreground mt-1">{p.item.plan.toUpperCase()} · Qty {p.item.quantity}</div>
                          <div className="text-xs text-muted-foreground mt-1">{new Date(p.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₹{p.item.pricingSnapshot?.lineTotal ?? '—'}</div>
                          <Link to={`/my-orders/${encodeURIComponent(p.orderId)}`}>
                            <Button size="sm" variant="outline" className="mt-2">View order</Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : addonPurchases.length > 0 ? (
                  <div className="space-y-3">
                    {addonPurchases.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-start justify-between gap-4 rounded-lg border p-4 bg-white">
                        <div className="min-w-0">
                          <div className="font-medium text-oz-primary">{addonNameById[p.addonId] || "Add-on"}</div>
                          <div className="text-sm text-muted-foreground mt-1">Qty: {p.quantity} · Status: {p.status}</div>
                          <div className="text-xs text-muted-foreground mt-1">{new Date(p.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₹{p.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No add-on purchases yet.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Existing: Meal Pack Subscriptions */}
          <div className="flex items-center justify-between">
            <div className="font-semibold text-oz-primary">Meal Pack Subscriptions</div>
            <div className="text-sm text-muted-foreground">(affects delivery calendar)</div>
          </div>

          {pendingMeal.length > 0 ? (
            <Card className="border-oz-neutral/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Pending activation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingMeal.slice(0, 5).map((p) => (
                  <div key={`${p.orderId}_${p.subscriptionId}`} className="rounded-lg border p-4">
                    {(() => {
                      const servingProgress = getServingProgressForSubscription({
                        type: 'meal',
                        plan: p.plan,
                        orderId: p.orderId,
                        cartItemId: p.subscriptionId,
                      });

                      return (
                        <>
                    <div className="min-w-0">
                      <div className="font-medium text-oz-primary truncate">{p.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{p.plan.toUpperCase()} · Qty {p.quantity}</div>
                      {p.startDate || p.deliveryTime ? (
                        <div className="text-xs text-muted-foreground mt-1">Starts: {p.startDate || '—'} at {p.deliveryTime || '—'}</div>
                      ) : null}
                      <div className="text-xs text-muted-foreground mt-1">Order: {p.orderId.slice(0, 8)}…</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <Badge variant="outline" className="bg-white">Pending</Badge>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openViewSubscription({ kind: 'meal', subscriptionId: p.subscriptionId, orderId: p.orderId, plan: p.plan, title: p.title })}
                        >
                          View
                        </Button>
                        <Link to={`/my-orders/${encodeURIComponent(p.orderId)}`}>
                          <Button size="sm" variant="outline">View Order</Button>
                        </Link>
                        {(() => {
                          const isPending = pendingPauseSubscriptionIds.has(p.subscriptionId);
                          const disabledByCutoff = !isPending && isPauseCutoffExceededForSubscription(p.subscriptionId);
                          const btn = (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openPauseRequest('mealPack', p.subscriptionId)}
                              disabled={isPending || disabledByCutoff}
                            >
                              <Pause className="mr-2 h-4 w-4" /> {isPending ? 'Pause Requested' : 'Request Pause'}
                            </Button>
                          );
                          if (!disabledByCutoff) return btn;
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">{btn}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Pause requests must be submitted at least {formatLeadTime(pauseCutoffMinutes)} before delivery.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Servings progress (Mon–Fri)</span>
                        <span className="font-medium">{servingProgress.delivered} / {servingProgress.total}</span>
                      </div>
                      <Progress value={servingProgress.progress} className="h-2" />
                    </div>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {mealPackSubscriptions.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Active Meal Pack Subscriptions</h3>
                <p className="text-muted-foreground mb-4">Start your fitness journey with our meal packs!</p>
                <Link to="/meal-packs">
                  <Button className="bg-oz-accent hover:bg-oz-accent/90">
                    Browse Meal Packs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            mealPackSubscriptions.map((sub) => {
              const pauseState = pauseStateForSubscription(sub.subscriptionId);
              const servingProgress = getServingProgressForSubscription({
                type: 'meal',
                plan: sub.plan,
                orderId: sub.orderId,
                cartItemId: sub.subscriptionId,
              });

              return (
                <Card key={sub.subscriptionId} className="overflow-hidden bg-white">
                  <CardHeader className="bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate text-oz-primary font-semibold">{sub.title}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground capitalize">{sub.plan}</span>
                          {sub.orderId ? (
                            <span className="text-xs text-muted-foreground">Order: {sub.orderId.slice(0, 8)}…</span>
                          ) : null}
                          {sub.quantity != null ? (
                            <span className="text-xs text-muted-foreground">Qty {sub.quantity}</span>
                          ) : null}
                        </div>
                      </div>
                      {pauseState.state === 'paused' ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200">Paused</Badge>
                      ) : pauseState.state === 'pending' ? (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-900 border-yellow-200">Pause Requested</Badge>
                      ) : pauseState.state === 'scheduled' ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200">Pause Scheduled</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-white">Active</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Servings progress (Mon–Fri)</span>
                        <span className="font-medium">{servingProgress.delivered} / {servingProgress.total}</span>
                      </div>
                      <Progress value={servingProgress.progress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-md border p-3 bg-white">
                        <div className="text-xs text-muted-foreground">Upcoming Serving Date</div>
                        <div className="text-sm font-medium">{servingProgress.nextServingDate || '—'}</div>
                      </div>
                      <div className="rounded-md border p-3 bg-white">
                        <div className="text-xs text-muted-foreground">End date</div>
                        <div className="text-sm font-medium">{servingProgress.scheduleEndDate || servingProgress.cycleEndDate || '—'}</div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {subscriptionStatusLine('active', sub.subscriptionId)}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openViewSubscription({ kind: 'meal', subscriptionId: sub.subscriptionId, orderId: sub.orderId, plan: sub.plan, title: sub.title })}
                      >
                        View
                      </Button>

                      {sub.orderId ? (
                        <Link to={`/my-orders/${encodeURIComponent(sub.orderId)}`}>
                          <Button size="sm" variant="outline">View Order</Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" disabled>View Order</Button>
                      )}

                      {(() => {
                        const isPending = pauseState.state === 'pending';
                        const isPausedOrScheduled = pauseState.state === 'paused' || pauseState.state === 'scheduled';
                        const disabledByCutoff = !isPending && !isPausedOrScheduled && isPauseCutoffExceededForSubscription(sub.subscriptionId);
                        const btn = (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPauseRequest('mealPack', sub.subscriptionId)}
                            disabled={isPending || isPausedOrScheduled || disabledByCutoff}
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            {isPending ? 'Pause Requested' : 'Request Pause'}
                          </Button>
                        );
                        if (!disabledByCutoff) return btn;
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">{btn}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Pause requests must be submitted at least {formatLeadTime(pauseCutoffMinutes)} before delivery.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}

                      {pauseState.request ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => requestWithdrawPause(pauseState.request!.id)}
                          disabled={pauseState.withdrawPending || withdrawingRequestId === pauseState.request!.id}
                        >
                          {pauseState.withdrawPending ? 'Withdraw Requested' : 'Withdraw Pause'}
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Delivery Calendar */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Delivery Calendar</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium min-w-[140px] text-center">{formatMonthYear(calendarMonth)}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
                {(() => {
                  const { daysInMonth, startingDay } = getDaysInMonth(calendarMonth);
                  const days = [];

                  for (let i = 0; i < startingDay; i++) {
                    days.push(<div key={`empty-${i}`} className="p-2" />);
                  }

                  const byDate = new Map<string, MyDelivery[]>();
                  for (const d of calendarDeliveries) {
                    const key = safeString(d.date);
                    if (!key) continue;
                    if (!byDate.has(key)) byDate.set(key, []);
                    byDate.get(key)!.push(d);
                  }

                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const deliveries = byDate.get(dateStr) || [];
                    const today = new Date().toISOString().split("T")[0];
                    const isToday = dateStr === today;
                    const isSelected = dateStr === calendarSelectedDate;

                    days.push(
                      <div
                        key={day}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCalendarSelectedDate(dateStr)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setCalendarSelectedDate(dateStr);
                        }}
                        className={`p-2 min-h-[60px] border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "border-oz-secondary bg-oz-secondary/5"
                            : isToday
                              ? "border-oz-accent bg-oz-accent/5"
                              : "border-transparent hover:border-oz-neutral/40"
                        }`}
                      >
                        <p className={`text-sm ${isToday ? "font-bold text-oz-accent" : ""}`}>{day}</p>
                        {deliveries.slice(0, 2).map((d) => {
                          const badge = toDeliveryBadge(d.status);
                          return (
                            <div key={safeString(d._id || d.id)} className={`mt-1 px-1.5 py-0.5 rounded text-[11px] border ${badge.cls}`}>
                              {badge.label}
                            </div>
                          );
                        })}
                        {deliveries.length > 2 ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">+{deliveries.length - 2} more</div>
                        ) : null}
                      </div>
                    );
                  }

                  return days;
                })()}
              </div>

              <div className="mt-6 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{calendarSelectedDate}</div>
                    <div className="text-sm text-muted-foreground">
                      {calendarDeliveries.filter((d) => safeString(d.date) === calendarSelectedDate).length} deliveries
                    </div>
                  </div>
                  <Link to="/dashboard/deliveries">
                    <Button variant="outline" size="sm">
                      Open Deliveries
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="mt-3 space-y-2">
                  {calendarDeliveries
                    .filter((d) => safeString(d.date) === calendarSelectedDate)
                    .sort((a, b) => safeString(a.time).localeCompare(safeString(b.time)))
                    .map((d) => {
                      const id = safeString(d._id || d.id);
                      const badge = toDeliveryBadge(d.status);
                      const pendingSkip = id ? pendingSkipByDeliveryId.has(id) : false;
                      const isToday = calendarSelectedDate === toLocalISO(new Date());
                      const skipCutoffExceeded = Boolean(isToday && d.status === 'PENDING' && isSkipCutoffExceededForDelivery(d));
                      const canRequestSkip = Boolean(isToday && d.status === 'PENDING' && id && !pendingSkip && !skipCutoffExceeded);

                      return (
                        <div key={id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{safeString(d.time) || '—'}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={badge.cls}>
                                {badge.label}
                              </Badge>
                              {isToday ? (
                                (() => {
                                  const disabled = !canRequestSkip || requestingSkipDeliveryId === id;
                                  const btn = (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={disabled}
                                      onClick={() => id && requestSkip(id)}
                                    >
                                      {pendingSkip ? 'Skip Requested' : 'Request Skip'}
                                    </Button>
                                  );
                                  if (!skipCutoffExceeded) return btn;
                                  return (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex">{btn}</span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Skip is available only for today before the cutoff time (at least {formatLeadTime(skipCutoffMinutes)} before delivery).
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })()
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-2 space-y-1 text-sm">
                            {(d.items || []).map((it) => (
                              <div key={safeString(it.cartItemId)} className="flex items-center justify-between gap-2">
                                <div className="truncate">{safeString(it.title) || 'Item'}</div>
                                <div className="text-muted-foreground">Qty {it.quantity}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                  {calendarDeliveries.filter((d) => safeString(d.date) === calendarSelectedDate).length === 0 ? (
                    <div className="text-sm text-muted-foreground py-6 text-center">No deliveries scheduled for this day.</div>
                  ) : null}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded bg-slate-100" />
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded bg-orange-100" />
                  <span>Cooking</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded bg-green-100" />
                  <span>Delivered</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded bg-red-100" />
                  <span>Skipped</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pause / Skip Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myRequests.length === 0 ? (
            <div className="text-sm text-muted-foreground">No requests yet.</div>
          ) : (
            myRequests.slice(0, 20).map((r) => {
              const details = r.requestType === 'PAUSE'
                ? `${r.kind} · ${r.pauseStartDate || '?'} → ${r.pauseEndDate || '?'}`
                : `delivery · ${r.skipDate || '?'} · ${String(r.deliveryId || '').slice(0, 8)}…`;
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-white">{r.status}</Badge>
                      <div className="text-sm font-medium">{r.requestType}</div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{details}</div>
                    {r.reason ? <div className="text-xs text-muted-foreground mt-1">Reason: {r.reason}</div> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.status === 'PENDING' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={withdrawingRequestId === r.id}
                        onClick={() => withdrawRequest(r.id)}
                      >
                        Withdraw Request
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

          {paidOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No order history yet.</h3>
                <p className="text-muted-foreground">Your paid orders will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {paidOrders.slice(0, 15).map((o) => (
                <Card key={o.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-oz-primary">Order {o.id.slice(-6)}</div>
                        <div className="text-sm text-muted-foreground mt-1">{new Date(o.createdAt).toLocaleString()}</div>
                        <div className="mt-2 space-y-1 text-sm">
                          {(o.items || []).slice(0, 3).map((it) => (
                            <div key={it.cartItemId} className="flex items-center justify-between gap-2">
                              <div className="truncate">{safeString(it.pricingSnapshot?.title) || it.type}</div>
                              <div className="text-muted-foreground">{it.plan} · Qty {it.quantity}</div>
                            </div>
                          ))}
                          {(o.items || []).length > 3 ? (
                            <div className="text-xs text-muted-foreground">+{(o.items || []).length - 3} more items</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Link to={`/my-orders/${encodeURIComponent(o.id)}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Subscriptions;
