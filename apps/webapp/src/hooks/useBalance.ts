import { create } from 'zustand';
import { api } from '@/utils/api';
import { TokenManager } from '@/core/TokenManager';

interface BalanceState {
  tickets: number;
  tplay: number;
  isLoading: boolean;
  lastFetched: number | null;
  fetchBalance: () => Promise<void>;
  deductTickets: (amount: number) => void;
  addTickets: (amount: number) => void;
  setBalance: (tickets: number, tplay: number) => void;
}

export const useBalance = create<BalanceState>((set, get) => ({
  tickets: 0,
  tplay: 0,
  isLoading: false,
  lastFetched: null,

  fetchBalance: async () => {
    // Throttle: don't fetch if last fetch was less than 5 seconds ago
    const { lastFetched } = get();
    if (lastFetched && Date.now() - lastFetched < 5000) return;

    // Skip if no auth token (dev mode)
    if (!TokenManager.getToken()) {
      console.log('[useBalance] No token, skipping balance fetch');
      return;
    }

    set({ isLoading: true });

    try {
      const res = await api.get<{ success: boolean; data: { ticketBalance: number; tplayBalance: number } }>(
        '/economy/balance',
      );
      set({
        tickets: res.data.ticketBalance,
        tplay: res.data.tplayBalance,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      console.error('[useBalance] Failed to fetch balance:', err);
      set({ isLoading: false });
    }
  },

  deductTickets: (amount: number) => {
    set((state) => ({
      tickets: Math.max(0, state.tickets - amount),
    }));
  },

  addTickets: (amount: number) => {
    set((state) => ({
      tickets: state.tickets + amount,
    }));
  },

  setBalance: (tickets: number, tplay: number) => {
    set({ tickets, tplay, lastFetched: Date.now() });
  },
}));
