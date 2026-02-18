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
  isLoading: false,
  error: null,

  login: async () => {
    console.log('[useAuth] login() called');

    // Check for existing valid token first
    if (!TokenManager.isExpired()) {
      const existing = TokenManager.getToken();
      if (existing) {
        console.log('[useAuth] Found valid token, fetching profile...');
        try {
          const res = await api.get<{ success: boolean; data: UserProfile }>('/user/me');
          set({
            user: res.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          console.log('[useAuth] Restored session from token');
          return;
        } catch {
          console.log('[useAuth] Token expired/invalid, clearing');
          TokenManager.clearToken();
        }
      }
    }

    // Get initData from Telegram for login
    const bridge = TelegramBridge.getInstance();
    const initData = bridge.getInitData();
    console.log('[useAuth] initData length:', initData.length, 'empty:', !initData);

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
    console.log('[useAuth] Calling /auth/login...');

    try {
      const response = await api.post<{ success: boolean; data: { token: string; user: UserProfile } }>(
        '/auth/login',
        { initData },
      );
      console.log('[useAuth] Login response:', JSON.stringify(response).substring(0, 200));

      const { token, user } = response.data;
      TokenManager.setToken(token);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      console.log('[useAuth] Login successful, user:', user.firstName);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('[useAuth] Login failed:', message, err);
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
      const res = await api.get<{ success: boolean; data: UserProfile }>('/user/me');
      set({ user: res.data });
    } catch (err) {
      console.error('[useAuth] Failed to refresh profile:', err);
    }
  },

  setUser: (user: UserProfile) => {
    set({ user });
  },
}));
