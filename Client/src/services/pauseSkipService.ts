import { apiJson, apiJsonNoCache } from './apiClient';
import type { PauseSkipRequest } from '@/types';

type ListResponse = {
	status: 'success' | 'error';
	data: PauseSkipRequest[];
	message?: string;
};

type SingleResponse = {
	status: 'success' | 'error';
	data: PauseSkipRequest;
	message?: string;
};

export const pauseSkipService = {
	async listMyRequests(params?: { status?: string; requestType?: string; signal?: AbortSignal }) {
		const query = new URLSearchParams();
		if (params?.status) query.set('status', params.status);
		if (params?.requestType) query.set('requestType', params.requestType);

		const res = await apiJsonNoCache<ListResponse>(`/subscriptions/requests?${query.toString()}`, { signal: params?.signal });
		if (res.status !== 'success') throw new Error(res.message || 'Failed to load requests');
		return res.data;
	},

	async requestPause(input: {
		kind: 'customMeal' | 'addon' | 'mealPack';
		subscriptionId: string;
		pauseStartDate: string;
		pauseEndDate: string;
		reason?: string;
	}) {
		const res = await apiJson<SingleResponse>('/subscriptions/pause-requests', {
			method: 'POST',
			body: JSON.stringify(input),
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to request pause');
		window.dispatchEvent(new CustomEvent('og:dashboard-refresh'));
		return res.data;
	},

	async requestSkipDelivery(input: { deliveryId: string; reason?: string }) {
		const res = await apiJson<SingleResponse>('/subscriptions/skip-requests', {
			method: 'POST',
			body: JSON.stringify(input),
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to request skip');
		window.dispatchEvent(new CustomEvent('og:dashboard-refresh'));
		return res.data;
	},

	async requestWithdrawPause(pauseRequestId: string) {
		const res = await apiJson<SingleResponse>('/subscriptions/withdraw-pause-requests', {
			method: 'POST',
			body: JSON.stringify({ pauseRequestId }),
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to request withdraw pause');
		window.dispatchEvent(new CustomEvent('og:dashboard-refresh'));
		return res.data;
	},

	async withdrawRequest(requestId: string) {
		const res = await apiJson<SingleResponse>(`/subscriptions/requests/${encodeURIComponent(requestId)}/withdraw`, {
			method: 'POST',
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to withdraw request');
		window.dispatchEvent(new CustomEvent('og:dashboard-refresh'));
		return res.data;
	},
};
