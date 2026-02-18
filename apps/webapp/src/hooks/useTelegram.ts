import { useEffect, useMemo, useState } from 'react';
import { TelegramBridge, type TelegramUserData } from '@/core/TelegramBridge';

/**
 * React hook for accessing the Telegram WebApp bridge and user data.
 */
export function useTelegram() {
  const bridge = useMemo(() => TelegramBridge.getInstance(), []);
  const [userData, setUserData] = useState<TelegramUserData | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!bridge.isReady) {
      bridge.init();
    }
    setIsReady(bridge.isReady);
    setUserData(bridge.getUserData());
  }, [bridge]);

  return {
    /** The TelegramBridge singleton instance */
    bridge,
    /** Parsed Telegram user data, or null if not in Telegram */
    userData,
    /** Whether the bridge has been initialized */
    isReady,
    /** Raw initData string for authentication */
    initData: bridge.getInitData(),
    /** Theme parameters from Telegram */
    theme: bridge.getTheme(),
    /** Platform string (e.g., 'android', 'ios', 'tdesktop') */
    platform: bridge.getPlatform(),
    /** Trigger haptic feedback */
    haptic: bridge.hapticFeedback.bind(bridge),
    /** Show confirmation dialog */
    showConfirm: bridge.showConfirm.bind(bridge),
    /** Show alert dialog */
    showAlert: bridge.showAlert.bind(bridge),
    /** Open a link */
    openLink: bridge.openLink.bind(bridge),
    /** Close the mini app */
    close: bridge.close.bind(bridge),
  };
}
