/**
 * Telegram Mini App WebApp bridge singleton.
 * Wraps the Telegram WebApp API for safe access throughout the app.
 */

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    isVisible: boolean;
  };
  MainButton: {
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    setParams: (params: Record<string, unknown>) => void;
    isVisible: boolean;
  };
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    auth_date: number;
    hash: string;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  colorScheme: 'light' | 'dark';
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  platform: string;
  version: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface TelegramUserData {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
}

export class TelegramBridge {
  private static instance: TelegramBridge;
  private webapp: TelegramWebApp | null = null;
  private _isReady = false;
  private backButtonCallback: (() => void) | null = null;

  private constructor() {}

  static getInstance(): TelegramBridge {
    if (!TelegramBridge.instance) {
      TelegramBridge.instance = new TelegramBridge();
    }
    return TelegramBridge.instance;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  init(): void {
    if (this._isReady) return;

    this.webapp = window.Telegram?.WebApp ?? null;

    if (!this.webapp) {
      console.warn('[TelegramBridge] Telegram WebApp not available. Running in dev mode.');
      this._isReady = true;
      return;
    }

    try {
      this.webapp.ready();
      this.webapp.expand();
      this.webapp.setHeaderColor('#060612');
      this.webapp.setBackgroundColor('#060612');
      this.webapp.enableClosingConfirmation();
      this._isReady = true;
    } catch (err) {
      console.error('[TelegramBridge] Failed to initialize:', err);
      this._isReady = true;
    }
  }

  getInitData(): string {
    return this.webapp?.initData ?? '';
  }

  getUserData(): TelegramUserData | null {
    const user = this.webapp?.initDataUnsafe?.user;
    if (!user) return null;

    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      languageCode: user.language_code,
      isPremium: user.is_premium,
    };
  }

  hapticFeedback(type: 'impact' | 'notification' | 'selection', style?: string): void {
    if (!this.webapp) return;

    try {
      switch (type) {
        case 'impact':
          this.webapp.HapticFeedback.impactOccurred(
            (style as 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') ?? 'medium',
          );
          break;
        case 'notification':
          this.webapp.HapticFeedback.notificationOccurred(
            (style as 'error' | 'success' | 'warning') ?? 'success',
          );
          break;
        case 'selection':
          this.webapp.HapticFeedback.selectionChanged();
          break;
      }
    } catch {
      // Haptic feedback might not be available on all platforms
    }
  }

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.webapp) {
        resolve(window.confirm(message));
        return;
      }
      this.webapp.showConfirm(message, (confirmed) => {
        resolve(confirmed);
      });
    });
  }

  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.webapp) {
        window.alert(message);
        resolve();
        return;
      }
      this.webapp.showAlert(message, () => resolve());
    });
  }

  onBackButton(callback: (() => void) | null): void {
    if (!this.webapp) return;

    // Remove previous callback
    if (this.backButtonCallback) {
      this.webapp.BackButton.offClick(this.backButtonCallback);
    }

    if (callback) {
      this.backButtonCallback = callback;
      this.webapp.BackButton.onClick(callback);
      this.webapp.BackButton.show();
    } else {
      this.backButtonCallback = null;
      this.webapp.BackButton.hide();
    }
  }

  openLink(url: string): void {
    if (!this.webapp) {
      window.open(url, '_blank');
      return;
    }

    if (url.startsWith('https://t.me/')) {
      this.webapp.openTelegramLink(url);
    } else {
      this.webapp.openLink(url);
    }
  }

  close(): void {
    this.webapp?.close();
  }

  getTheme(): {
    bgColor: string;
    textColor: string;
    hintColor: string;
    linkColor: string;
    buttonColor: string;
    buttonTextColor: string;
    secondaryBgColor: string;
    colorScheme: 'light' | 'dark';
  } {
    const params = this.webapp?.themeParams;
    return {
      bgColor: params?.bg_color ?? '#060612',
      textColor: params?.text_color ?? '#ffffff',
      hintColor: params?.hint_color ?? '#999999',
      linkColor: params?.link_color ?? '#6C5CE7',
      buttonColor: params?.button_color ?? '#6C5CE7',
      buttonTextColor: params?.button_text_color ?? '#ffffff',
      secondaryBgColor: params?.secondary_bg_color ?? '#1A1A2E',
      colorScheme: this.webapp?.colorScheme ?? 'dark',
    };
  }

  getPlatform(): string {
    return this.webapp?.platform ?? 'unknown';
  }

  getViewportHeight(): number {
    return this.webapp?.viewportStableHeight ?? window.innerHeight;
  }
}
