import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';

interface TournamentInfo {
  id: string;
  name: string;
  status: string;
  entryFee: number;
  prizePool: number;
  entryCount: number;
  maxEntries: number;
  startTime: string;
  endTime: string;
}

interface TournamentEntry {
  userId: string;
  bestScore: number;
  rank: number | null;
}

export function Tournaments() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [selected, setSelected] = useState<(TournamentInfo & { entries: TournamentEntry[] }) | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTournaments(); }, [filter]);

  const loadTournaments = async () => {
    try {
      const url = filter ? `/tournaments?status=${filter}` : '/tournaments';
      const res = await api.get<{ data: TournamentInfo[] }>(url);
      setTournaments(res.data);
    } catch {} finally { setLoading(false); }
  };

  const viewTournament = async (id: string) => {
    try {
      const res = await api.get<{ data: TournamentInfo & { entries: TournamentEntry[] } }>(`/tournament/${id}`);
      setSelected(res.data);
    } catch (err) { console.error(err); }
  };

  const handleJoin = async (id: string) => {
    try {
      await api.post(`/tournament/${id}/join`, {});
      viewTournament(id);
    } catch (err) { console.error(err); }
  };

  const statusColor = (s: string) => {
    if (s === 'ACTIVE') return 'text-green-400';
    if (s === 'UPCOMING') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-darker p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => selected ? setSelected(null) : navigate('/')} className="text-gray-400 text-sm">← Back</button>
        <h1 className="text-xl font-bold text-white">Tournaments</h1>
        <div className="w-12" />
      </div>

      {!selected && (
        <>
          <div className="flex gap-2 mb-4">
            {['', 'ACTIVE', 'UPCOMING', 'ENDED'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-xs ${filter === f ? 'bg-primary text-white' : 'bg-dark text-gray-400'}`}>
                {f || 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
          ) : tournaments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tournaments found</p>
          ) : (
            <div className="space-y-2">
              {tournaments.map(t => (
                <div key={t.id} onClick={() => viewTournament(t.id)} className="bg-dark rounded-xl p-4 cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{t.name}</p>
                      <p className={`text-xs ${statusColor(t.status)}`}>{t.status}</p>
                    </div>
                    <span className="text-primary font-bold text-sm">{t.prizePool.toLocaleString()} prize</span>
                  </div>
                  <div className="flex gap-4 mt-2 text-gray-400 text-xs">
                    <span>Entry: {t.entryFee || 'Free'}</span>
                    <span>{t.entryCount}/{t.maxEntries} players</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="bg-dark rounded-xl p-4">
          <h2 className="text-white font-bold text-lg mb-1">{selected.name}</h2>
          <p className={`text-xs mb-3 ${statusColor(selected.status)}`}>{selected.status}</p>
          <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
            <div className="bg-darker rounded-lg p-2 text-center">
              <p className="text-gray-400 text-xs">Prize Pool</p>
              <p className="text-primary font-bold">{selected.prizePool.toLocaleString()}</p>
            </div>
            <div className="bg-darker rounded-lg p-2 text-center">
              <p className="text-gray-400 text-xs">Players</p>
              <p className="text-white font-bold">{selected.entryCount}/{selected.maxEntries}</p>
            </div>
          </div>

          {selected.status === 'ACTIVE' && (
            <button onClick={() => handleJoin(selected.id)} className="w-full py-2 bg-primary rounded-lg text-white font-medium mb-4">
              Join Tournament ({selected.entryFee || 'Free'})
            </button>
          )}

          <p className="text-gray-400 text-xs mb-2">Leaderboard</p>
          <div className="space-y-1">
            {selected.entries.map((e, i) => (
              <div key={e.userId} className="flex justify-between items-center py-1 text-sm">
                <span className="text-white">#{i + 1} {e.userId.slice(0, 8)}...</span>
                <span className="text-primary font-mono">{e.bestScore.toLocaleString()}</span>
              </div>
            ))}
            {selected.entries.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No entries yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
