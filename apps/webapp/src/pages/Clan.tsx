import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';

interface ClanInfo {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  totalXp: number;
  memberCount: number;
  maxMembers: number;
}

interface ClanMember {
  userId: string;
  role: string;
  xpContributed: number;
}

export function Clan() {
  const navigate = useNavigate();
  const [clans, setClans] = useState<ClanInfo[]>([]);
  const [myClan, setMyClan] = useState<(ClanInfo & { members: ClanMember[] }) | null>(null);
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { loadClans(); }, []);

  const loadClans = async () => {
    try {
      const res = await api.get<{ data: ClanInfo[] }>('/clans');
      setClans(res.data);
    } catch {} finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!name || !tag) return;
    try {
      await api.post('/clan/create', { name, tag, description });
      setView('list');
      loadClans();
    } catch (err) { console.error(err); }
  };

  const handleJoin = async (id: string) => {
    try {
      await api.post(`/clan/${id}/join`, {});
      loadClans();
    } catch (err) { console.error(err); }
  };

  const viewClan = async (id: string) => {
    try {
      const res = await api.get<{ data: ClanInfo & { members: ClanMember[] } }>(`/clan/${id}`);
      setMyClan(res.data);
      setView('detail');
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-darker"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-darker p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => view === 'list' ? navigate('/') : setView('list')} className="text-gray-400 text-sm">← Back</button>
        <h1 className="text-xl font-bold text-white">Clans</h1>
        <button onClick={() => setView('create')} className="text-primary text-sm">+ Create</button>
      </div>

      {view === 'create' && (
        <div className="bg-dark rounded-xl p-4 mb-4 space-y-3">
          <input placeholder="Clan Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-darker border border-gray-700 rounded-lg p-2 text-white text-sm" />
          <input placeholder="Tag (3-5 chars)" value={tag} onChange={e => setTag(e.target.value.toUpperCase().slice(0, 5))} className="w-full bg-darker border border-gray-700 rounded-lg p-2 text-white text-sm" />
          <input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-darker border border-gray-700 rounded-lg p-2 text-white text-sm" />
          <button onClick={handleCreate} className="w-full py-2 bg-primary rounded-lg text-white font-medium">Create Clan</button>
        </div>
      )}

      {view === 'detail' && myClan && (
        <div className="bg-dark rounded-xl p-4 mb-4">
          <h2 className="text-white font-bold text-lg">[{myClan.tag}] {myClan.name}</h2>
          {myClan.description && <p className="text-gray-400 text-sm mt-1">{myClan.description}</p>}
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-gray-300">XP: <b className="text-primary">{myClan.totalXp.toLocaleString()}</b></span>
            <span className="text-gray-300">Members: <b>{myClan.memberCount}/{myClan.maxMembers}</b></span>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-gray-400 text-xs">Members</p>
            {myClan.members.map((m, i) => (
              <div key={m.userId} className="flex justify-between items-center py-1 text-sm">
                <span className="text-white">#{i + 1} {m.role === 'LEADER' ? '👑 ' : m.role === 'OFFICER' ? '⭐ ' : ''}{m.userId.slice(0, 8)}</span>
                <span className="text-gray-400">{m.xpContributed.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-2">
          {clans.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No clans yet. Be the first to create one!</p>
          ) : (
            clans.map(clan => (
              <div key={clan.id} className="bg-dark rounded-xl p-4 flex justify-between items-center" onClick={() => viewClan(clan.id)}>
                <div>
                  <p className="text-white font-medium">[{clan.tag}] {clan.name}</p>
                  <p className="text-gray-400 text-xs">{clan.memberCount} members · {clan.totalXp.toLocaleString()} XP</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleJoin(clan.id); }} className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-xs">Join</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
