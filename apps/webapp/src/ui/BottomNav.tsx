import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/tournaments', label: 'Play', icon: '🏆' },
  { path: '/wallet', label: 'Wallet', icon: '💰' },
  { path: '/leaderboard', label: 'Ranks', icon: '📊' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide nav during gameplay
  if (location.pathname.startsWith('/game/')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-dark border-t border-gray-800 safe-bottom">
      <div className="flex items-center justify-around h-14 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive ? 'text-primary' : 'text-gray-500'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
