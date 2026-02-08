import { apiJsonNoCache } from './apiClient';

export type AdminWalletSummary = {
	totalUsers: number;
	usersWithBalance: number;
	totalWalletBalance: number;
	avgWalletBalance: number;
	maxWalletBalance: number;
};

export type AdminWalletCreditResult = {
	userId: string;
	amount: number;
	note?: string;
	walletBalance: number;
	createdAt: string;
};

export type AdminWalletTransaction = {
	_id: string;
	userId: string | { _id: string; email?: string; name?: string };
	type: 'CREDIT' | 'DEBIT';
	amount: number;
	currency?: string;
	reason?: string;
	description?: string;
	balanceBefore?: number;
	balanceAfter?: number;
	createdBy?: string;
	createdByUserId?: string;
	metadata?: Record<string, unknown>;
	createdAt?: string;
};

export type AdminWalletTransactionsResponse = {
	items: AdminWalletTransaction[];
	nextCursor: string | null;
};

type ApiEnvelope<T> = { status: 'success' | 'error'; data: T; message?: string };

export const adminWalletService = {
	async getSummary(options?: { signal?: AbortSignal }) {
		const res = await apiJsonNoCache<ApiEnvelope<AdminWalletSummary>>('/admin/wallet/summary', { signal: options?.signal });
		if (res.status !== 'success') throw new Error(res.message || 'Failed to load wallet summary');
		return res.data;
	},

	async addCredits(input: { userId: string; amount: number; note?: string }, options?: { signal?: AbortSignal }) {
		const res = await apiJsonNoCache<ApiEnvelope<AdminWalletCreditResult>>('/admin/wallet/credits', {
			method: 'POST',
			body: JSON.stringify(input),
			signal: options?.signal,
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to add credits');
		return res.data;
	},

	async getTransactions(input?: { userId?: string; limit?: number; cursor?: string }, options?: { signal?: AbortSignal }) {
		const params = new URLSearchParams();
		if (input?.userId) params.set('userId', input.userId);
		if (input?.limit != null) params.set('limit', String(input.limit));
		if (input?.cursor) params.set('cursor', input.cursor);
		const qs = params.toString();
		const res = await apiJsonNoCache<ApiEnvelope<AdminWalletTransactionsResponse>>(`/admin/wallet/transactions${qs ? `?${qs}` : ''}`, {
			signal: options?.signal,
		});
		if (res.status !== 'success') throw new Error(res.message || 'Failed to load wallet transactions');
		return res.data;
	},
};
