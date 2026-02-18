import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserStats, UserNft, GameSession } from '@tonplay/shared';
import { useAuth } from '@/hooks/useAuth';
import { useBalance } from '@/hooks/useBalance';
import { useTelegram } from '@/hooks/useTelegram';
import { api } from '@/utils/api';
import {
  formatNumber,
  formatPercent,
  formatCompact,
  timeAgo,
  getLevelFromXP,
} from '@/utils/format';

function StatCard({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-surface rounded-xl p-3 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function XPBar({
  currentXp,
  nextLevelXp,
  level,
}: {
  currentXp: number;
  nextLevelXp: number;
  level: number;
}) {
  const progress = Math.min(currentXp / nextLevelXp, 1);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Level {level}</span>
        <span className="text-xs text-gray-400">Level {level + 1}</span>
      </div>
      <div className="w-full h-2 bg-surfaceLight rounded-full overflow-hidden">
        <div
          className="h-full gradient-primary rounded-full transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-500 text-center mt-1">
        {formatNumber(currentXp)} / {formatNumber(nextLevelXp)} XP
      </p>
    </div>
  );
}

function RecentGameItem({ session }: { session: GameSession }) {
  const isWin = session.status === 'verified' && (session.rewards?.payout ?? 0) > 0;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-surfaceLight last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
            isWin ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {isWin ? 'W' : 'L'}
        </div>
        <div>
          <p className="text-xs font-medium text-white capitalize">
            {session.gameSlug.replace(/-/g, ' ')}
          </p>
          <p className="text-[10px] text-gray-500">{timeAgo(session.startedAt)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-white">
          {formatNumber(session.score ?? 0)}
        </p>
        <p className="text-[10px] text-gray-500">
          -{session.wagerAmount} entry
        </p>
      </div>
    </div>
  );
}

function NftCard({ nft }: { nft: UserNft }) {
  const rarityColors: Record<string, string> = {
    COMMON: 'border-gray-500',
    RARE: 'border-blue-500',
    EPIC: 'border-purple-500',
    LEGENDARY: 'border-accent',
  };

  return (
    <div
      className={`bg-surface rounded-xl border-2 ${rarityColors[nft.nft.rarity] ?? 'border-gray-500'} p-2`}
    >
      <div className="aspect-square bg-surfaceLight rounded-lg flex items-center justify-center mb-2">
        <span className="text-2xl">{nft.nft.rarity === 'LEGENDARY' ? '\u2B50' : '\u25C6'}</span>
      </div>
      <p className="text-[10px] font-bold text-white truncate">{nft.nft.name}</p>
      <p className="text-[8px] text-gray-400">{nft.nft.rarity}</p>
      {nft.isEquipped && (
        <span className="text-[8px] text-secondary font-bold">EQUIPPED</span>
      )}
    </div>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tickets, tplay } = useBalance();
  const { bridge, haptic } = useTelegram();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentGames, setRecentGames] = useState<GameSession[]>([]);
  const [nfts, setNfts] = useState<UserNft[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'games' | 'nfts'>('stats');

  useEffect(() => {
    bridge.onBackButton(() => {
      navigate('/');
    });
    return () => {
      bridge.onBackButton(null);
    };
  }, [bridge, navigate]);

  useEffect(() => {
    loadStats();
    loadRecentGames();
    loadNfts();
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.get<UserStats>('/user/stats');
      setStats(data);
    } catch {
      // Stats endpoint might not be available
      setStats({
        gamesPlayed: 0,
        totalWagered: 0,
        totalWon: 0,
        biggestWin: 0,
        favoriteGame: null,
        winRate: 0,
      });
    }
  }, []);

  const loadRecentGames = useCallback(async () => {
    try {
      const data = await api.get<GameSession[]>('/game/sessions?limit=10');
      setRecentGames(data);
    } catch {
      // Sessions endpoint might not be available
    }
  }, []);

  const loadNfts = useCallback(async () => {
    try {
      const data = await api.get<UserNft[]>('/nft/owned');
      setNfts(data);
    } catch {
      // NFT endpoint might not be available
    }
  }, []);

  const levelInfo = user ? getLevelFromXP(user.xp) : null;

  const handleShare = () => {
    haptic('impact', 'medium');
    const referralLink = `https://t.me/TonPlayBot?start=${user?.referralCode ?? ''}`;
    const text = `Join me on TONPLAY! Play arcade games and earn crypto. Use my referral link:`;

    bridge.openLink(
      `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`,
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-surface/80 backdrop-blur-sm border-b border-surfaceLight safe-top">
        <div className="px-4 py-4">
          {/* Avatar and info */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              {user?.firstName?.charAt(0) ?? 'T'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">
                  {user?.firstName ?? 'Player'} {user?.lastName ?? ''}
                </h1>
                {user?.isPremium && (
                  <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">
                    PREMIUM
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">@{user?.username ?? 'player'}</p>
              {levelInfo && (
                <div className="mt-2">
                  <XPBar
                    currentXp={levelInfo.currentXp}
                    nextLevelXp={levelInfo.nextLevelXp}
                    level={levelInfo.level}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Balance summary */}
          <div className="flex gap-3">
            <div className="flex-1 bg-surfaceLight rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-white">{formatCompact(tickets)}</p>
              <p className="text-[10px] text-accent">Tickets</p>
            </div>
            <div className="flex-1 bg-surfaceLight rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-secondary">{formatCompact(tplay)}</p>
              <p className="text-[10px] text-gray-400">TPLAY</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="shrink-0 flex border-b border-surfaceLight">
        {(['stats', 'games', 'nfts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              haptic('selection');
              setActiveTab(tab);
            }}
            className={`flex-1 py-3 text-xs font-bold transition-colors relative ${
              activeTab === tab ? 'text-primary' : 'text-gray-500'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'stats' && stats && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Games Played"
                value={formatNumber(stats.gamesPlayed)}
              />
              <StatCard
                label="Win Rate"
                value={formatPercent(stats.winRate)}
                color="text-secondary"
              />
              <StatCard
                label="Total Won"
                value={formatCompact(stats.totalWon)}
                color="text-accent"
              />
              <StatCard
                label="Biggest Win"
                value={formatCompact(stats.biggestWin)}
                color="text-green-400"
              />
            </div>

            {stats.favoriteGame && (
              <div className="bg-surface rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-1">Favorite Game</p>
                <p className="text-sm font-bold text-white capitalize">
                  {stats.favoriteGame.replace(/-/g, ' ')}
                </p>
              </div>
            )}

            {/* Referral section */}
            <div className="bg-surface rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-2">Invite Friends</h3>
              <p className="text-xs text-gray-400 mb-3">
                Earn 10% of your friends' game entry fees! Share your referral link below.
              </p>
              <div className="flex items-center gap-2 bg-surfaceLight rounded-lg px-3 py-2 mb-3">
                <p className="text-xs text-gray-300 flex-1 truncate font-mono">
                  {user?.referralCode ?? 'LOADING...'}
                </p>
                <button
                  onClick={() => {
                    haptic('notification', 'success');
                    navigator.clipboard.writeText(
                      `https://t.me/TonPlayBot?start=${user?.referralCode ?? ''}`,
                    );
                  }}
                  className="text-[10px] font-bold text-primary"
                >
                  COPY
                </button>
              </div>
              <button
                onClick={handleShare}
                className="w-full py-2.5 bg-primary rounded-lg text-xs font-bold text-white transition-all active:scale-[0.98]"
              >
                Share Referral Link
              </button>
            </div>
          </div>
        )}

        {activeTab === 'games' && (
          <div className="animate-fade-in">
            {recentGames.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No games played yet</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-3 text-xs font-bold text-primary"
                >
                  Play your first game
                </button>
              </div>
            ) : (
              <div className="bg-surface rounded-xl px-3">
                {recentGames.map((session) => (
                  <RecentGameItem key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'nfts' && (
          <div className="animate-fade-in">
            {nfts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No NFTs collected yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  Earn NFTs through gameplay and events
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {nfts.map((nft) => (
                  <NftCard key={nft.id} nft={nft} />
                ))}
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
        <button
          onClick={() => navigate('/leaderboard')}
          className="flex flex-col items-center gap-0.5 px-6 py-1 text-gray-500"
        >
          <span className="text-lg">{'\u2191'}</span>
          <span className="text-[10px] font-medium">Ranks</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 px-6 py-1 text-primary">
          <span className="text-lg">{'\u2605'}</span>
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </div>
  );
}
