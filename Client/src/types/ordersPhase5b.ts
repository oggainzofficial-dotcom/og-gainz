export type PublicOrderItem = {
	cartItemId: string;
	type: 'meal' | 'addon' | 'byo';
	plan: 'single' | 'trial' | 'weekly' | 'monthly';
	mealId?: string;
	addonId?: string;
	quantity: number;
	byoSelections?: Array<{ itemId?: string; quantity: number }>;
	subscriptionSchedule?: {
		scheduleEndDate?: string;
		nextServingDate?: string;
		deliveredCount?: number;
		skippedCount?: number;
		scheduledCount?: number;
	};
	pricingSnapshot?: {
		title?: string;
		unitPrice?: number;
		lineTotal?: number;
	};
	orderDetails?: {
		startDate?: string;
		deliveryTime?: string;
		immediateDelivery?: boolean;
	};
};

export type PaymentAttempt = {
	attemptId: string;
	razorpayOrderId: string;
	razorpayPaymentId?: string;
	status: 'CREATED' | 'FAILED' | 'PAID';
	reason?: string;
	createdAt: string;
};

export type PublicOrder = {
	id: string;
	status?: string;
	paymentStatus?: string;
	paymentFailureReason?: string;
	paymentProvider?: string;
	razorpayOrderId?: string;
	razorpayPaymentId?: string;

	subtotal: number;
	deliveryFee: number;
	creditsApplied: number;
	total: number;

	deliveryDistanceKm?: number;
	deliveryAddress?: unknown;
	deliveryAddressSummary?: string;

	paidAt?: string;
	paymentMethod?: string;

	retryCount?: number;
	lastPaymentAttemptAt?: string;
	paymentAttempts?: PaymentAttempt[];

	createdAt: string;
	updatedAt: string;

	items: PublicOrderItem[];
};

export type OrdersListResponse = {
	status: 'success' | 'error';
	data: {
		items: PublicOrder[];
		meta: {
			page: number;
			limit: number;
			total: number;
			hasNextPage: boolean;
		};
	};
	message?: string;
};

export type OrderGetResponse = {
	status: 'success' | 'error';
	data: PublicOrder;
	message?: string;
};

export const normalizeOrderFlags = (order: Pick<PublicOrder, 'status' | 'paymentStatus'>) => {
	const status = String(order.status || '');
	const paymentStatus = String(order.paymentStatus || '');

	const statusUpper = status.toUpperCase();
	const statusLower = status.toLowerCase();
	const paymentUpper = paymentStatus.toUpperCase();
	const paymentLower = paymentStatus.toLowerCase();

	const isPaid = statusUpper === 'PAID' || statusLower === 'paid' || paymentUpper === 'PAID' || paymentLower === 'paid';
	const isFailed =
		statusUpper === 'PAYMENT_FAILED' ||
		statusUpper === 'FAILED' ||
		statusLower === 'failed' ||
		paymentUpper === 'FAILED' ||
		paymentLower === 'failed';
	const isPending = !isPaid && !isFailed;

	return { isPaid, isFailed, isPending };
};
