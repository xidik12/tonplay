import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';

interface NftCollection {
  id: string;
  name: string;
  maxSupply: number;
  currentSupply: number;
}

interface NftItem {
  id: string;
  name: string;
  imageUrl: string | null;
  rarity: string;
  level: number;
}

export function Shop() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<NftCollection[]>([]);
  const [items, setItems] = useState<NftItem[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCollections(); }, []);

  const loadCollections = async () => {
    try {
      const res = await api.get<{ data: NftCollection[] }>('/nft/collections');
      setCollections(res.data);
    } catch {} finally { setLoading(false); }
  };

  const loadItems = async (collectionId: string) => {
    setSelectedCollection(collectionId);
    try {
      const res = await api.get<{ data: NftItem[] }>(`/nft/collection/${collectionId}/items`);
      setItems(res.data);
    } catch {}
  };

  const rarityColor = (r: string) => {
    const map: Record<string, string> = { COMMON: 'text-gray-400', RARE: 'text-blue-400', EPIC: 'text-purple-400', LEGENDARY: 'text-yellow-400' };
    return map[r] || 'text-gray-400';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-darker p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => selectedCollection ? setSelectedCollection(null) : navigate('/')} className="text-gray-400 text-sm">← Back</button>
        <h1 className="text-xl font-bold text-white">Shop</h1>
        <div className="w-12" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : !selectedCollection ? (
        <div className="space-y-3">
          {collections.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No collections available yet</p>
          ) : collections.map(c => (
            <div key={c.id} onClick={() => loadItems(c.id)} className="bg-dark rounded-xl p-4 cursor-pointer">
              <p className="text-white font-medium">{c.name}</p>
              <p className="text-gray-400 text-xs mt-1">{c.currentSupply}/{c.maxSupply} minted</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-dark rounded-xl p-3">
              <div className="w-full aspect-square bg-darker rounded-lg flex items-center justify-center mb-2">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-3xl">🎨</span>
                )}
              </div>
              <p className="text-white text-sm font-medium truncate">{item.name}</p>
              <div className="flex justify-between items-center mt-1">
                <span className={`text-xs font-medium ${rarityColor(item.rarity)}`}>{item.rarity}</span>
                <span className="text-gray-400 text-xs">Lv.{item.level}</span>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="col-span-2 text-gray-500 text-center py-8">No items in this collection</p>}
        </div>
      )}
    </div>
  );
}
