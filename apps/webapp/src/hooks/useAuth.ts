import { create } from 'zustand';
import { api } from '@/utils/api';
import { TokenManager } from '@/core/TokenManager';
import { TelegramBridge } from '@/core/TelegramBridge';

interface UserProfile {
  id: string;
  telegramId: string;
  username: string;
  firstName: string;
  lastName: string;
  level: number;
  xp: number;
  isPremium: boolean;
  referralCode: string;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  setUser: (user: UserProfile) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async () => {
    // Check for existing valid token first
    if (!TokenManager.isExpired()) {
      const existing = TokenManager.getToken();
      if (existing) {
        try {
          const profile = await api.get<UserProfile>('/auth/me');
          set({
            user: profile,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return;
        } catch {
          TokenManager.clearToken();
        }
      }
    }

    // Get initData from Telegram for login
    const bridge = TelegramBridge.getInstance();
    const initData = bridge.getInitData();

    if (!initData) {
      // Dev mode: create mock user
      console.warn('[useAuth] No Telegram initData. Using dev mode.');
      set({
        user: {
          id: 'dev-user-001',
          telegramId: '123456789',
          username: 'dev_player',
          firstName: 'Dev',
          lastName: 'Player',
          level: 1,
          xp: 0,
          isPremium: false,
          referralCode: 'DEVCODE',
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await api.post<{ token: string; user: UserProfile }>(
        '/auth/login',
        { initData },
      );

      TokenManager.setToken(response.token);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('[useAuth] Login failed:', message);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      });
    }
  },

  logout: () => {
    TokenManager.clearToken();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  refreshProfile: async () => {
    if (!get().isAuthenticated) return;

    try {
      const profile = await api.get<UserProfile>('/auth/me');
      set({ user: profile });
    } catch (err) {
      console.error('[useAuth] Failed to refresh profile:', err);
    }
  },

  setUser: (user: UserProfile) => {
    set({ user });
  },
}));
