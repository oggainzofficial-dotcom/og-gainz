import type { WalletTransaction } from "@/types";
import { apiJsonNoCache } from '@/lib/apiClient';

type ApiEnvelope<T> = { status: 'success' | 'error'; data: T; message?: string };

type WalletSummaryResponse = {
  walletBalance: number;
};

type WalletTransactionsResponse = {
  items: WalletTransaction[];
  nextCursor: string | null;
};

export const walletService = {
  async getBalance(userId: string): Promise<number> {
    if (!userId) return 0;

    const res = await apiJsonNoCache<ApiEnvelope<WalletSummaryResponse>>('/wallet');
    if (res.status !== 'success') {
      throw new Error(res.message || 'Failed to load wallet balance');
    }

    return Number(res.data?.walletBalance || 0);
  },

  async getTransactions(userId: string): Promise<WalletTransaction[]> {
    if (!userId) return [];

    const res = await apiJsonNoCache<ApiEnvelope<WalletTransactionsResponse>>('/wallet/transactions?limit=100');
    if (res.status !== 'success') {
      throw new Error(res.message || 'Failed to load wallet transactions');
    }

    return Array.isArray(res.data?.items) ? res.data.items : [];
  },
};
