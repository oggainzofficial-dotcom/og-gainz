import { apiJson } from './apiClient';

export type AdminOrderLifecycleStatus = 'PAID' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type AdminOrderChangedBy = 'SYSTEM' | 'ADMIN';
export type AdminOrderAcceptanceStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'DECLINED';

export type AdminOrder = {
	_id?: string;
	id?: string;
	userId?: string;
	user?: {
		id?: string;
		name?: string;
		email?: string;
	};
	items?: Array<{
		cartItemId: string;
		type: string;
		plan: string;
		mealId?: string;
		addonId?: string;
		byoSelections?: Array<{ itemId: string; quantity: number }>;
		quantity: number;
		pricingSnapshot?: {
			title: string;
			unitPrice: number;
			lineTotal: number;
		};
		orderDetails?: {
			startDate?: string;
			deliveryTime?: string;
			immediateDelivery?: boolean;
		};
		subscriptionProgress?: {
			cycleStartDate?: string;
			cycleEndDate?: string;
			scheduleEndDate?: string;
			nextServingDate?: string;
			scheduledCount?: number;
			skippedCount?: number;
			delivered?: number;
			total?: number;
			remaining?: number;
			progress?: number;
		};
	}>;
	subtotal?: number;
	deliveryFee?: number;
	creditsApplied?: number;
	total: number;
	deliveryDistanceKm?: number;
	isServiceable?: boolean;
	deliveryAddress?: {
		label?: string;
		username?: string;
		contactNumber?: string;
		housePlotNo?: string;
		street?: string;
		area?: string;
		district?: string;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		pincode?: string;
		landmark?: string;
		latitude?: number;
		longitude?: number;
		googleMapsLink?: string;
	};
	status?: string;
	paymentStatus?: 'PAID' | 'FAILED';
	paymentFailureReason?: string;
	paymentProvider?: string;
	razorpayOrderId?: string;
	razorpayPaymentId?: string;
	payment?: {
		provider?: string;
		orderId?: string;
		paymentId?: string;
		signature?: string;
		method?: string;
		status?: string;
		paidAt?: string;
	};
	paymentAttempts?: Array<{
		attemptId: string;
		razorpayOrderId: string;
		razorpayPaymentId?: string;
		status: 'CREATED' | 'FAILED' | 'PAID';
		reason?: string;
		createdAt: string;
	}>;
	retryCount?: number;
	lastPaymentAttemptAt?: string;

	currentStatus?: AdminOrderLifecycleStatus;
	statusHistory?: Array<{ status: AdminOrderLifecycleStatus; changedAt: string; changedBy: AdminOrderChangedBy }>;
	estimatedDeliveryWindow?: { from?: string; to?: string };
	adminNotes?: string;

	// Phase 6C: acceptance layer (separate from Phase 6A lifecycle)
	acceptanceStatus?: AdminOrderAcceptanceStatus;
	adminSeenAt?: string;
	movedToKitchenAt?: string;

	createdAt?: string;
	updatedAt?: string;
};

type ListOrdersResponse = {
	status: 'success' | 'error';
	data: { page: number; limit: number; total: number; orders: AdminOrder[] };
	message?: string;
};

type SingleOrderResponse = {
	status: 'success' | 'error';
	data: AdminOrder;
	message?: string;
};

type MoveToKitchenResponse = {
	status: 'success' | 'error';
	data: { order: AdminOrder; deliveriesCreated: number };
	message?: string;
};

export const adminOrdersService = {
	async list(params?: { page?: number; limit?: number; currentStatus?: AdminOrderLifecycleStatus; signal?: AbortSignal }) {
		const query = new URLSearchParams();
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));
		if (params?.currentStatus) query.set('currentStatus', params.currentStatus);

		const res = await apiJson<ListOrdersResponse>(`/admin/orders?${query.toString()}`, { signal: params?.signal });
		if (res.status !== 'success') throw new Error(res.message || 'Failed to load orders');
		return res.data;
	},

	async get(orderId: string, options?: { signal?: AbortSignal }) {
		const res = await apiJson<SingleOrderResponse>(`/admin/orders/${encodeURIComponent(orderId)}`, { signal: options?.signal });
		if (res.status !== 'success') throw new Error(res.message || 'Failed to load order');
		return res.data;
	},

	async updateStatus(orderId: string, status: AdminOrderLifecycleStatus, options?: { signal?: AbortSignal }) {
		const res = await apiJson<SingleOrderResponse>(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
			method: 'PATCH',
			body: JSON.stringify({ status }),
			signal: options?.signal,
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to update status');
		return res.data;
	},

	async updateAcceptance(orderId: string, acceptanceStatus: Exclude<AdminOrderAcceptanceStatus, 'PENDING_REVIEW'>, options?: { signal?: AbortSignal }) {
		const res = await apiJson<SingleOrderResponse>(`/admin/orders/${encodeURIComponent(orderId)}/acceptance`, {
			method: 'PATCH',
			body: JSON.stringify({ acceptanceStatus }),
			signal: options?.signal,
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to update acceptance');
		return res.data;
	},

	async updateNotes(orderId: string, adminNotes: string, options?: { signal?: AbortSignal }) {
		const res = await apiJson<SingleOrderResponse>(`/admin/orders/${encodeURIComponent(orderId)}/notes`, {
			method: 'PATCH',
			body: JSON.stringify({ adminNotes }),
			signal: options?.signal,
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to save notes');
		return res.data;
	},

	async moveToKitchen(orderId: string, options?: { signal?: AbortSignal }) {
		const res = await apiJson<MoveToKitchenResponse>(`/admin/orders/${encodeURIComponent(orderId)}/move-to-kitchen`, {
			method: 'POST',
			signal: options?.signal,
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to move order to kitchen');
		return res.data;
	},
};
