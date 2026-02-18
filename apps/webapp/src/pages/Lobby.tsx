import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAME_LIST, STREAK_REWARDS } from '@tonplay/shared';
import type { GameInfo, GameCategory, UserMission, UserStreak } from '@tonplay/shared';
import { useAuth } from '@/hooks/useAuth';
import { useBalance } from '@/hooks/useBalance';
import { useSocket } from '@/hooks/useSocket';
import { useTelegram } from '@/hooks/useTelegram';
import { api } from '@/utils/api';
import { formatNumber, formatCompact, getLevelFromXP } from '@/utils/format';

// Category filter options
const CATEGORIES: { key: GameCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All Games' },
  { key: 'arcade', label: 'Arcade' },
  { key: 'casino', label: 'Casino' },
  { key: 'physics', label: 'Physics' },
  { key: 'puzzle', label: 'Puzzle' },
];

// Category badge colors
const CATEGORY_COLORS: Record<GameCategory, string> = {
  arcade: 'bg-primary/20 text-primary',
  casino: 'bg-accent/20 text-accent',
  physics: 'bg-secondary/20 text-secondary',
  puzzle: 'bg-pink-500/20 text-pink-400',
};

function GameCard({ game, onClick }: { game: GameInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!game.enabled}
      className={`relative w-full rounded-xl overflow-hidden transition-all duration-200 active:scale-[0.97] ${
        game.enabled
          ? 'bg-surface hover:bg-surfaceLight neon-border cursor-pointer'
          : 'bg-surface/50 opacity-50 cursor-not-allowed'
      }`}
    >
      {/* Thumbnail area */}
      <div className="aspect-[4/3] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center relative">
        <div className="text-4xl font-bold text-white/10">
          {game.name.charAt(0)}
        </div>
        {!game.enabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-xs font-medium text-gray-400 bg-black/60 px-3 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
        )}
        {/* Category badge */}
        <span
          className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[game.category]}`}
        >
          {game.category.toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 text-left">
        <h3 className="text-sm font-bold text-white truncate">{game.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-tight">
          {game.description}
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-gray-500">
            {game.minWager}-{formatCompact(game.maxWager)} tickets
          </span>
          {game.enabled && (
            <span className="text-[10px] font-bold text-secondary">PLAY</span>
          )}
        </div>
      </div>
    </button>
  );
}

function StreakIndicator({ streak }: { streak: UserStreak | null }) {
  if (!streak) return null;

  const currentDay = streak.currentStreak % 7;

  return (
    <div className="bg-surface rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-white">Daily Streak</span>
        <span className="text-xs text-accent font-bold">
          Day {streak.currentStreak}
        </span>
      </div>
      <div className="flex gap-1">
        {STREAK_REWARDS.map((reward, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i < currentDay
                ? 'bg-accent'
                : i === currentDay
                  ? 'bg-accent/50 animate-pulse'
                  : 'bg-surfaceLight'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {STREAK_REWARDS.map((reward, i) => (
          <span key={i} className="text-[8px] text-gray-500 flex-1 text-center">
            +{reward}
          </span>
        ))}
      </div>
    </div>
  );
}

function MissionPanel({ missions }: { missions: UserMission[] }) {
  if (missions.length === 0) return null;

  return (
    <div className="bg-surface rounded-xl p-3 mb-4">
      <h3 className="text-xs font-bold text-white mb-2">Daily Missions</h3>
      <div className="space-y-2">
        {missions.map((um) => {
          const progress = Math.min(um.progress / um.mission.targetValue, 1);
          return (
            <div key={um.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{um.mission.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-surfaceLight rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {um.progress}/{um.mission.targetValue}
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                {um.isCompleted && !um.claimedAt ? (
                  <button className="text-[10px] font-bold text-darker bg-accent px-2 py-1 rounded-full">
                    Claim
                  </button>
                ) : um.claimedAt ? (
                  <span className="text-[10px] text-green-400">Done</span>
                ) : (
                  <span className="text-[10px] text-gray-500">
                    +{um.mission.rewardAmount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BottomNav({ active }: { active: string }) {
  const navigate = useNavigate();
  const { haptic } = useTelegram();

  const items = [
    { key: 'home', label: 'Home', path: '/', icon: '\u2302' },
    { key: 'leaderboard', label: 'Ranks', path: '/leaderboard', icon: '\u2191' },
    { key: 'profile', label: 'Profile', path: '/profile', icon: '\u2605' },
  ];

  return (
    <div className="flex items-center justify-around bg-surface border-t border-surfaceLight safe-bottom py-2">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            haptic('selection');
            navigate(item.path);
          }}
          className={`flex flex-col items-center gap-0.5 px-6 py-1 transition-colors ${
            active === item.key ? 'text-primary' : 'text-gray-500'
          }`}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Lobby() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tickets, tplay, fetchBalance } = useBalance();
  const { haptic } = useTelegram();
  const [category, setCategory] = useState<GameCategory | 'all'>('all');
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [showMissions, setShowMissions] = useState(false);

  // Connect socket for real-time updates
  useSocket({ enabled: true });

  useEffect(() => {
    fetchBalance();
    loadMissions();
    loadStreak();
  }, [fetchBalance]);

  const loadMissions = useCallback(async () => {
    try {
      const data = await api.get<UserMission[]>('/social/missions');
      setMissions(data);
    } catch {
      // Missions endpoint might not be available yet
    }
  }, []);

  const loadStreak = useCallback(async () => {
    try {
      const data = await api.get<UserStreak>('/social/streak');
      setStreak(data);
    } catch {
      // Streak endpoint might not be available yet
    }
  }, []);

  const filteredGames = GAME_LIST.filter(
    (g) => category === 'all' || g.category === category,
  );

  const levelInfo = user ? getLevelFromXP(user.xp) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-surface/80 backdrop-blur-sm border-b border-surfaceLight safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm">
              {user?.firstName?.charAt(0) ?? 'T'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {user?.firstName ?? 'Player'}
                </span>
                {levelInfo && (
                  <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    Lv.{levelInfo.level}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400">
                @{user?.username ?? 'player'}
              </p>
            </div>
          </div>

          {/* Balances */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-white">
                {formatNumber(tickets)}
              </p>
              <p className="text-[10px] text-accent">tickets</p>
            </div>
            <div className="w-px h-8 bg-surfaceLight" />
            <div className="text-right">
              <p className="text-xs font-bold text-secondary">
                {formatNumber(tplay)}
              </p>
              <p className="text-[10px] text-gray-400">TPLAY</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          {/* Streak */}
          <StreakIndicator streak={streak} />

          {/* Missions toggle */}
          {missions.length > 0 && (
            <button
              onClick={() => {
                haptic('selection');
                setShowMissions(!showMissions);
              }}
              className="w-full flex items-center justify-between bg-surface rounded-xl px-3 py-2.5 mb-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Daily Missions</span>
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">
                  {missions.filter((m) => m.isCompleted && !m.claimedAt).length} ready
                </span>
              </div>
              <span className="text-gray-400 text-xs">
                {showMissions ? '\u25B2' : '\u25BC'}
              </span>
            </button>
          )}

          {showMissions && <MissionPanel missions={missions} />}

          {/* Category filters */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  haptic('selection');
                  setCategory(cat.key);
                }}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                  category === cat.key
                    ? 'bg-primary text-white'
                    : 'bg-surface text-gray-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Game grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredGames.map((game) => (
              <GameCard
                key={game.slug}
                game={game}
                onClick={() => {
                  if (game.enabled) {
                    haptic('impact', 'medium');
                    navigate(`/game/${game.slug}`);
                  }
                }}
              />
            ))}
          </div>

          {/* Spacer for bottom nav */}
          <div className="h-4" />
        </div>
      </div>

      {/* Bottom navigation */}
      <BottomNav active="home" />
    </div>
  );
}
