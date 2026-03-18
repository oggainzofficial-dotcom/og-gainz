import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { WalletTransaction } from '@/types';
import { walletService } from '@/services/walletService';
import { useUser } from './UserContext';

interface WalletContextType {
  balance: number;
  transactions: WalletTransaction[];
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBalance = async () => {
    if (user) {
      const bal = await walletService.getBalance(user.id);
      setBalance(bal);
		window.dispatchEvent(new CustomEvent('og:dashboard-refresh'));
    }
  };

  const refreshTransactions = async () => {
    if (user) {
      setIsLoading(true);
      const txns = await walletService.getTransactions(user.id);
      setTransactions(txns);
      setIsLoading(false);
		window.dispatchEvent(new CustomEvent('og:dashboard-refresh'));
    }
  };

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      Promise.all([walletService.getBalance(user.id), walletService.getTransactions(user.id)])
        .then(([bal, txns]) => {
          setBalance(bal);
          setTransactions(txns);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setBalance(0);
      setTransactions([]);
    }
  }, [user]);

  return (
    <WalletContext.Provider value={{ balance, transactions, isLoading, refreshBalance, refreshTransactions }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
