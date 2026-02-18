import { Component, useEffect, useState, type ReactNode, type ErrorInfo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { TelegramBridge } from '@/core/TelegramBridge';
import { useAuth } from '@/hooks/useAuth';
import { Lobby } from '@/pages/Lobby';
import { Profile } from '@/pages/Profile';
import { Leaderboard } from '@/pages/Leaderboard';
import { GamePage } from '@/pages/GamePage';
import { Wallet } from '@/pages/Wallet';
import { Clan } from '@/pages/Clan';
import { Tournaments } from '@/pages/Tournaments';
import { BattlePass } from '@/pages/BattlePass';
import { Shop } from '@/pages/Shop';
import { BottomNav } from '@/ui/BottomNav';

const MANIFEST_URL = new URL('/tonconnect-manifest.json', window.location.origin).toString();

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-darker flex flex-col items-center justify-center p-6">
          <p className="text-red-400 text-lg font-bold mb-2">Something went wrong</p>
          <p className="text-gray-400 text-sm text-center mb-4 break-all">
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          <pre className="text-gray-500 text-xs max-w-full overflow-auto max-h-40 mb-4">
            {this.state.error?.stack?.split('\n').slice(0, 5).join('\n')}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary rounded-lg text-white font-medium"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-darker flex flex-col items-center justify-center z-50">
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-spin-slow" />
        <div className="absolute inset-1 rounded-full border-2 border-t-secondary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary text-glow">T</span>
        </div>
      </div>
      <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
        TONPLAY
      </h1>
      <p className="text-sm text-gray-500 animate-pulse">Loading arcade...</p>
    </div>
  );
}

export function App() {
  const { isLoading, isAuthenticated, error, login } = useAuth();
  const [telegramReady, setTelegramReady] = useState(false);

  console.log('[App] render:', { telegramReady, isLoading, isAuthenticated, error: error?.substring(0, 50) });

  useEffect(() => {
    const bridge = TelegramBridge.getInstance();
    bridge.init();
    setTelegramReady(true);
  }, []);

  useEffect(() => {
    if (telegramReady && !isAuthenticated && !isLoading) {
      login();
    }
  }, [telegramReady, isAuthenticated, isLoading, login]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-darker flex flex-col items-center justify-center p-6">
        <p className="text-red-400 text-lg font-bold mb-2">Auth Error</p>
        <p className="text-gray-400 text-sm text-center mb-4">{error}</p>
        <button
          onClick={() => login()}
          className="px-6 py-2 bg-primary rounded-lg text-white font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!telegramReady || isLoading || !isAuthenticated) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
        <div className="w-full h-full flex flex-col bg-darker safe-top safe-bottom">
          <div className="flex-1 overflow-auto pb-16">
            <Routes>
              <Route path="/" element={<Lobby />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/game/:slug" element={<GamePage />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/clan" element={<Clan />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/battlepass" element={<BattlePass />} />
              <Route path="/shop" element={<Shop />} />
            </Routes>
          </div>
          <BottomNav />
        </div>
      </TonConnectUIProvider>
    </ErrorBoundary>
  );
}
