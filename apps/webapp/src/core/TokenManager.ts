/**
 * JWT token manager for authentication.
 * Stores tokens in memory with localStorage fallback for persistence.
 */

const STORAGE_KEY = 'tonplay_jwt';

let memoryToken: string | null = null;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export const TokenManager = {
  /**
   * Get the current JWT token from memory or localStorage.
   */
  getToken(): string | null {
    if (memoryToken) return memoryToken;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        memoryToken = stored;
        return stored;
      }
    } catch {
      // localStorage not available (e.g., in some Telegram WebView contexts)
    }

    return null;
  },

  /**
   * Store a JWT token in memory and localStorage.
   */
  setToken(token: string): void {
    memoryToken = token;
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch {
      // Silently fail if localStorage is not available
    }
  },

  /**
   * Clear the stored token from memory and localStorage.
   */
  clearToken(): void {
    memoryToken = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently fail
    }
  },

  /**
   * Check if the current token is expired.
   * Returns true if no token exists or if expired.
   */
  isExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') return true;

    // Add 30 second buffer before actual expiry
    const expiresAt = payload.exp * 1000;
    return Date.now() >= expiresAt - 30_000;
  },

  /**
   * Get the Authorization header object for API requests.
   */
  getAuthHeader(): Record<string, string> {
    const token = this.getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  },

  /**
   * Extract the user ID from the JWT payload.
   */
  getUserId(): string | null {
    const token = this.getToken();
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    return (payload.sub as string) ?? (payload.userId as string) ?? null;
  },
};
