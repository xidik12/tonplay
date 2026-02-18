import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAME_LIST } from '@tonplay/shared';
import type { LeaderboardEntry } from '@tonplay/shared';
import { useTelegram } from '@/hooks/useTelegram';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/utils/api';
import { formatNumber, formatCompact } from '@/utils/format';

type TimeFilter = 'daily' | 'weekly' | 'alltime';

interface LeaderboardData {
  entries: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
}

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'alltime', label: 'All Time' },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-xs font-black text-darker">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-xs font-black text-darker">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-xs font-black text-white">
        3
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-surfaceLight flex items-center justify-center text-xs font-bold text-gray-400">
      {rank}
    </div>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        isCurrentUser
          ? 'bg-primary/10 border-l-2 border-primary'
          : 'border-b border-surfaceLight/50'
      }`}
    >
      <RankBadge rank={entry.rank} />

      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-xs font-bold text-white shrink-0">
        {entry.username.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            isCurrentUser ? 'text-primary' : 'text-white'
          }`}
        >
          {entry.username}
          {isCurrentUser && (
            <span className="text-[10px] text-primary/60 ml-1">(You)</span>
          )}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-white">{formatCompact(entry.score)}</p>
      </div>
    </div>
  );
}

export function Leaderboard() {
  const navigate = useNavigate();
  const { bridge, haptic } = useTelegram();
  const { user } = useAuth();
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');
  const [data, setData] = useState<LeaderboardData>({ entries: [], userRank: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time leaderboard updates
  const { subscribe, unsubscribe } = useSocket({
    enabled: true,
    onLeaderboardUpdate: (payload) => {
      if (payload.leaderboardId === `${gameFilter}:${timeFilter}`) {
        setData((prev) => ({
          ...prev,
          entries: payload.entries,
        }));
      }
    },
  });

  useEffect(() => {
    bridge.onBackButton(() => navigate('/'));
    return () => {
      bridge.onBackButton(null);
    };
  }, [bridge, navigate]);

  useEffect(() => {
    loadLeaderboard();
    const leaderboardId = `${gameFilter}:${timeFilter}`;
    subscribe(leaderboardId);
    return () => {
      unsubscribe(leaderboardId);
    };
  }, [gameFilter, timeFilter, subscribe, unsubscribe]);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        game: gameFilter,
        period: timeFilter,
      });
      const response = await api.get<LeaderboardData>(
        `/social/leaderboard?${params}`,
      );
      setData(response);
    } catch {
      // Use empty data if endpoint not available
      setData({ entries: [], userRank: null });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [gameFilter, timeFilter]);

  const handleRefresh = () => {
    haptic('impact', 'light');
    setIsRefreshing(true);
    loadLeaderboard();
  };

  const enabledGames = GAME_LIST.filter((g) => g.enabled);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-surface/80 backdrop-blur-sm border-b border-surfaceLight safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white">Leaderboard</h1>
            <button
              onClick={handleRefresh}
              className={`text-xs text-primary font-medium ${isRefreshing ? 'animate-spin' : ''}`}
            >
              {isRefreshing ? '\u21BB' : 'Refresh'}
            </button>
          </div>

          {/* Game filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
            <button
              onClick={() => {
                haptic('selection');
                setGameFilter('all');
              }}
              className={`shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all ${
                gameFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-surfaceLight text-gray-400'
              }`}
            >
              All Games
            </button>
            {enabledGames.map((game) => (
              <button
                key={game.slug}
                onClick={() => {
                  haptic('selection');
                  setGameFilter(game.slug);
                }}
                className={`shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all ${
                  gameFilter === game.slug
                    ? 'bg-primary text-white'
                    : 'bg-surfaceLight text-gray-400'
                }`}
              >
                {game.name}
              </button>
            ))}
          </div>

          {/* Time filter */}
          <div className="flex bg-surfaceLight rounded-lg p-0.5 mt-2">
            {TIME_FILTERS.map((tf) => (
              <button
                key={tf.key}
                onClick={() => {
                  haptic('selection');
                  setTimeFilter(tf.key);
                }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                  timeFilter === tf.key
                    ? 'bg-surface text-white shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : data.entries.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-sm">No rankings yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Play games to climb the leaderboard!
            </p>
          </div>
        ) : (
          <div>
            {/* Top 3 podium */}
            {data.entries.length >= 3 && (
              <div className="flex items-end justify-center gap-3 py-6 px-4">
                {/* 2nd place */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-sm font-bold text-darker mb-1">
                    {data.entries[1].username.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[10px] text-white truncate max-w-full">
                    {data.entries[1].username}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold">
                    {formatCompact(data.entries[1].score)}
                  </p>
                  <div className="w-full h-16 bg-surfaceLight rounded-t-lg mt-1 flex items-center justify-center">
                    <span className="text-lg font-black text-gray-400">2</span>
                  </div>
                </div>

                {/* 1st place */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-lg font-bold text-darker mb-1 ring-2 ring-accent/50">
                    {data.entries[0].username.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-xs text-white truncate max-w-full font-bold">
                    {data.entries[0].username}
                  </p>
                  <p className="text-[10px] text-accent font-bold">
                    {formatCompact(data.entries[0].score)}
                  </p>
                  <div className="w-full h-24 bg-accent/20 rounded-t-lg mt-1 flex items-center justify-center border-t-2 border-accent">
                    <span className="text-2xl font-black text-accent">1</span>
                  </div>
                </div>

                {/* 3rd place */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-sm font-bold text-white mb-1">
                    {data.entries[2].username.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[10px] text-white truncate max-w-full">
                    {data.entries[2].username}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold">
                    {formatCompact(data.entries[2].score)}
                  </p>
                  <div className="w-full h-12 bg-surfaceLight rounded-t-lg mt-1 flex items-center justify-center">
                    <span className="text-lg font-black text-gray-400">3</span>
                  </div>
                </div>
              </div>
            )}

            {/* Rest of leaderboard */}
            <div className="bg-surface">
              {data.entries.slice(3).map((entry) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  isCurrentUser={entry.userId === user?.id}
                />
              ))}
            </div>

            {/* Current user position (if not in top list) */}
            {data.userRank &&
              !data.entries.find((e) => e.userId === user?.id) && (
                <div className="sticky bottom-0 bg-dark border-t border-surfaceLight">
                  <LeaderboardRow
                    entry={data.userRank}
                    isCurrentUser={true}
                  />
                </div>
              )}
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-around bg-surface border-t border-surfaceLight safe-bottom py-2">
        <button
          onClick={() => navigate('/')}
          className="flex flex-col items-center gap-0.5 px-6 py-1 text-gray-500"
        >
          <span className="text-lg">{'\u2302'}</span>
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 px-6 py-1 text-primary">
          <span className="text-lg">{'\u2191'}</span>
          <span className="text-[10px] font-medium">Ranks</span>
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="flex flex-col items-center gap-0.5 px-6 py-1 text-gray-500"
        >
          <span className="text-lg">{'\u2605'}</span>
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </div>
  );
}
