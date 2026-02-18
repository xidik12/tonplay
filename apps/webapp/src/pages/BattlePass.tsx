import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';

interface SeasonInfo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  premiumPrice: number;
  maxLevel: number;
  isActive: boolean;
}

interface ProgressInfo {
  seasonId: string;
  isPremium: boolean;
  currentLevel: number;
  xp: number;
  xpToNextLevel: number;
}

export function BattlePass() {
  const navigate = useNavigate();
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [seasonRes, progressRes] = await Promise.all([
        api.get<{ data: SeasonInfo }>('/season/current'),
        api.get<{ data: ProgressInfo }>('/season/progress'),
      ]);
      setSeason(seasonRes.data);
      setProgress(progressRes.data);
    } catch {} finally { setLoading(false); }
  };

  const handleUpgrade = async () => {
    try {
      await api.post('/season/upgrade', {});
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleClaim = async (level: number) => {
    try {
      await api.post(`/season/claim/${level}`, {});
      loadData();
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-darker"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!season) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-darker p-4">
        <p className="text-gray-400 text-center">No active season right now.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-primary text-sm">← Back</button>
      </div>
    );
  }

  const xpPercent = progress ? ((progress.xp % 100) / 100) * 100 : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-darker p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/')} className="text-gray-400 text-sm">← Back</button>
        <h1 className="text-xl font-bold text-white">Battle Pass</h1>
        <div className="w-12" />
      </div>

      {/* Season Header */}
      <div className="bg-dark rounded-xl p-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-white font-bold">{season.name}</h2>
            <p className="text-gray-400 text-xs mt-1">Ends {new Date(season.endDate).toLocaleDateString()}</p>
          </div>
          {progress?.isPremium ? (
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">PREMIUM</span>
          ) : (
            <button onClick={handleUpgrade} className="px-3 py-1 bg-primary rounded-lg text-white text-xs">
              Upgrade ({season.premiumPrice} tickets)
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="bg-dark rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">Level {progress.currentLevel}</span>
            <span className="text-gray-400">{progress.xp % 100}/100 XP</span>
          </div>
          <div className="w-full h-2 bg-darker rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
      )}

      {/* Reward Track */}
      <div className="bg-dark rounded-xl p-4">
        <p className="text-gray-400 text-xs mb-3">Rewards</p>
        <div className="space-y-2">
          {Array.from({ length: Math.min(season.maxLevel, 10) }, (_, i) => {
            const level = i + 1;
            const unlocked = (progress?.currentLevel ?? 0) >= level;
            return (
              <div key={level} className={`flex items-center justify-between p-2 rounded-lg ${unlocked ? 'bg-primary/10' : 'bg-darker'}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold ${unlocked ? 'bg-primary text-white' : 'bg-gray-700 text-gray-400'}`}>
                    {level}
                  </span>
                  <div>
                    <p className="text-white text-sm">Level {level} Reward</p>
                    <p className="text-gray-400 text-xs">Free Track</p>
                  </div>
                </div>
                {unlocked && (
                  <button onClick={() => handleClaim(level)} className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-xs">Claim</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
