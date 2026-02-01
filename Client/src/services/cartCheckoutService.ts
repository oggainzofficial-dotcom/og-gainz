import { apiJson } from './apiClient';
import type { CartQuote, CartState } from '@/types/cartPhase4';

type QuoteResponse = {
	status: 'success' | 'error';
	data: CartQuote;
	message?: string;
};

export type DeliveryAddressInput = {
	label?: string;
	username?: string;
	contactNumber?: string;
	housePlotNo?: string;
	street?: string;
	area?: string;
	district?: string;
	addressLine1: string;
	addressLine2?: string;
	city: string;
	state: string;
	pincode: string;
	landmark?: string;
	latitude?: number;
	longitude?: number;
};

export type InitiateCheckoutResponse = {
	status: 'success' | 'error';
	data: {
		keyId: string;
		razorpayOrder: { id: string; amount: number; currency: string; receipt?: string };
		order: {
			id: string;
			subtotal: number;
			deliveryFee: number;
			creditsApplied: number;
			total: number;
			deliveryDistanceKm?: number;
			items: CartQuote['items'];
		};
	};
	message?: string;
};

export type RetryCheckoutResponse = {
	status: 'success' | 'error';
	data: {
		keyId: string;
		razorpayOrder: { id: string; amount: number; currency: string };
		orderId: string;
	};
	message?: string;
};

export const cartCheckoutService = {
	async quoteCart(state: CartState): Promise<CartQuote> {
		const payload = {
			items: state.items.map((i) => {
				if (i.type === 'meal') return { cartItemId: i.id, type: i.type, plan: i.plan, mealId: i.mealId, quantity: i.quantity };
				if (i.type === 'addon') return { cartItemId: i.id, type: i.type, plan: i.plan, addonId: i.addonId, quantity: i.quantity };
				return { cartItemId: i.id, type: i.type, plan: i.plan, selections: i.selections, quantity: i.quantity };
			}),
			creditsToApply: state.creditsToApply,
			deliveryLocation: state.deliveryLocation,
		};

		const res = await apiJson<QuoteResponse>('/cart/quote', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to quote cart');
		return res.data;
	},

	async initiateCheckout(
		state: CartState,
		args: { deliveryAddressId?: string; deliveryAddress?: DeliveryAddressInput }
	): Promise<InitiateCheckoutResponse['data']> {
		const payload = {
			items: state.items.map((i) => {
				if (i.type === 'meal') return { cartItemId: i.id, type: i.type, plan: i.plan, mealId: i.mealId, quantity: i.quantity };
				if (i.type === 'addon') return { cartItemId: i.id, type: i.type, plan: i.plan, addonId: i.addonId, quantity: i.quantity };
				return { cartItemId: i.id, type: i.type, plan: i.plan, selections: i.selections, quantity: i.quantity };
			}),
			orderDetailsByItemId: state.orderDetailsByItemId,
			creditsToApply: state.creditsToApply,
			...(args.deliveryAddressId ? { deliveryAddressId: args.deliveryAddressId } : {}),
			...(!args.deliveryAddressId && args.deliveryAddress ? { deliveryAddress: args.deliveryAddress } : {}),
		};

		if (!args.deliveryAddressId && !args.deliveryAddress) {
			throw new Error('Delivery address is required');
		}

		const res = await apiJson<InitiateCheckoutResponse>('/checkout/initiate', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to initiate checkout');
		return res.data;
	},

	async retryPayment(orderId: string): Promise<RetryCheckoutResponse['data']> {
		const res = await apiJson<RetryCheckoutResponse>('/checkout/retry', {
			method: 'POST',
			body: JSON.stringify({ orderId }),
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to retry payment');
		return res.data;
	},
};
