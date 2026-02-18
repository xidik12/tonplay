import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { TelegramBridge } from '@/core/TelegramBridge';
import { useAuth } from '@/hooks/useAuth';
import { Lobby } from '@/pages/Lobby';
import { Profile } from '@/pages/Profile';
import { Leaderboard } from '@/pages/Leaderboard';
import { GamePage } from '@/pages/GamePage';

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
  const { isLoading, isAuthenticated, login } = useAuth();
  const [telegramReady, setTelegramReady] = useState(false);

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

  if (isLoading || !telegramReady) {
    return <LoadingScreen />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-darker safe-top safe-bottom">
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/game/:slug" element={<GamePage />} />
      </Routes>
    </div>
  );
}
