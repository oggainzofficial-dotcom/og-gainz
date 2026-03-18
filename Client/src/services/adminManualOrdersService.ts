import { apiClient, apiJson } from '@/lib/apiClient';

export type ManualOrderItem = {
  itemId: string;
  sourceId?: string;
  type: 'meal' | 'addon' | 'byo';
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  subscription_type?: 'trial' | 'weekly' | 'monthly';
  subscription_days?: number;
  delivery_time?: string;
  start_date?: string;
};

export type ManualOrder = {
  _id: string;
  manual_order_id: string;
  user_id?: string;
  customer_name: string;
  phone_number: string;
  whatsapp_number?: string;
  address: string;
  notes?: string;
  distance_km: number;
  delivery_cost_per_km: number;
  single_delivery_cost: number;
  deliveries_per_day: number;
  delivery_time: string;
  subscription_type: 'trial' | 'weekly' | 'monthly';
  subscription_days: number;
  start_date: string;
  meal_items: ManualOrderItem[];
  addon_items: ManualOrderItem[];
  byo_items: ManualOrderItem[];
  meal_cost: number;
  addon_cost: number;
  byo_cost: number;
  delivery_cost_total: number;
  discount_percentage: number;
  discount_amount: number;
  grand_total: number;
  payment_status: 'PENDING' | 'PAID' | 'CANCELLED';
  order_status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'IN_KITCHEN';
  order_id?: string;
  bill_generated_at?: string;
  created_at?: string;
  updated_at?: string;
};

type ApiEnvelope<T> = { status: 'success' | 'error'; data: T; message?: string };

export type ManualOrderInput = {
  customerName: string;
  phoneNumber: string;
  whatsappNumber?: string;
  address: string;
  notes?: string;
  distanceKm: number;
  deliveryTime: string;
  deliveriesPerDay: number;
  subscriptionType: 'trial' | 'weekly' | 'monthly';
  trialDays?: number;
  subscriptionDays?: number;
  discountPercentage?: number;
  startDate: string;
  mealItems: Array<{
    mealId: string;
    quantity: number;
    subscriptionType: 'trial' | 'weekly' | 'monthly';
    deliveryTime: string;
    trialDays?: string;
    startDate?: string;
  }>;
  addonItems: Array<{
    addonId: string;
    quantity: number;
    subscriptionType: 'trial' | 'weekly' | 'monthly';
    deliveryTime: string;
    trialDays?: string;
    startDate?: string;
  }>;
  byoItems: Array<{
    byoId: string;
    quantity: number;
    subscriptionType: 'trial' | 'weekly' | 'monthly';
    deliveryTime: string;
    trialDays?: string;
    startDate?: string;
  }>;
};

export const adminManualOrdersService = {
  async create(payload: ManualOrderInput) {
    const res = await apiJson<ApiEnvelope<ManualOrder>>('/manual-orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.status !== 'success') throw new Error(res.message || 'Failed to create manual order');
    return res.data;
  },

  async update(id: string, payload: ManualOrderInput) {
    const res = await apiJson<ApiEnvelope<ManualOrder>>(`/manual-orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (res.status !== 'success') throw new Error(res.message || 'Failed to update manual order');
    return res.data;
  },

  async get(id: string) {
    const res = await apiJson<ApiEnvelope<ManualOrder>>(`/manual-orders/${encodeURIComponent(id)}`);
    if (res.status !== 'success') throw new Error(res.message || 'Failed to load manual order');
    return res.data;
  },

  async cancel(id: string) {
    const res = await apiJson<ApiEnvelope<ManualOrder>>(`/manual-orders/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
    });
    if (res.status !== 'success') throw new Error(res.message || 'Failed to cancel manual order');
    return res.data;
  },

  async generateBill(id: string) {
    const res = await apiJson<ApiEnvelope<{ billUrl: string; billGeneratedAt?: string }>>('/manual-orders/generate-bill', {
      method: 'POST',
      body: JSON.stringify({ manualOrderId: id }),
    });
    if (res.status !== 'success') throw new Error(res.message || 'Failed to generate bill');
    return res.data;
  },

  async markPaid(id: string) {
    const res = await apiJson<ApiEnvelope<ManualOrder>>(`/manual-orders/${encodeURIComponent(id)}/mark-paid`, {
      method: 'PATCH',
    });
    if (res.status !== 'success') throw new Error(res.message || 'Failed to mark as paid');
    return res.data;
  },

  async fetchBillBlob(id: string) {
    const res = await apiClient.get<Blob>(`/manual-orders/${encodeURIComponent(id)}/bill`, {
      responseType: 'blob',
    });
    return res.data;
  },
};
