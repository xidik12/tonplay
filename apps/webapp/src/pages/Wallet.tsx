import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { api } from '@/utils/api';
import { useBalance } from '@/hooks/useBalance';

interface WalletInfo {
  tonAddress: string | null;
  isConnected: boolean;
}

interface Transaction {
  id: string;
  type: string;
  currency: string;
  amount: number;
  direction: string;
  memo: string | null;
  createdAt: string;
}

export function Wallet() {
  const navigate = useNavigate();
  const { tickets, tplay } = useBalance();
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    loadWallet();
    loadTransactions();
  }, []);

  // Sync TonConnect wallet with backend
  useEffect(() => {
    if (tonWallet) {
      const address = tonWallet.account.address;
      api.post('/wallet/connect', { tonAddress: address }).then(() => loadWallet());
    }
  }, [tonWallet]);

  const loadWallet = async () => {
    try {
      const res = await api.get<{ data: WalletInfo }>('/wallet');
      setWallet(res.data);
    } catch (err) {
      console.error('Failed to load wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await api.get<{ data: Transaction[] }>('/wallet/transactions');
      setTransactions(res.data);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const handleConnect = async () => {
    try {
      await tonConnectUI.openModal();
    } catch (err) {
      console.error('Failed to open TonConnect modal:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await tonConnectUI.disconnect();
      await api.post('/wallet/disconnect', {});
      setWallet({ tonAddress: null, isConnected: false });
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!withdrawAmount || !wallet?.tonAddress || isNaN(amount) || amount <= 0) return;
    try {
      await api.post('/wallet/withdraw', {
        currency: 'TPLAY',
        amount,
        toAddress: wallet.tonAddress,
      });
      setWithdrawAmount('');
      loadTransactions();
    } catch (err) {
      console.error('Failed to withdraw:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-darker">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-darker p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 text-sm">← Back</button>
        <h1 className="text-xl font-bold text-white">Wallet</h1>
        <div className="w-12" />
      </div>

      {/* Balances */}
      <div className="bg-dark rounded-xl p-4 mb-4">
        <p className="text-gray-400 text-xs mb-2">Balances</p>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300">Tickets</span>
          <span className="text-white font-bold">{tickets.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-300">TPLAY</span>
          <span className="text-primary font-bold">{tplay}</span>
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="bg-dark rounded-xl p-4 mb-4">
        <p className="text-gray-400 text-xs mb-2">TON Wallet</p>
        {wallet?.isConnected ? (
          <div>
            <p className="text-white text-sm font-mono mb-2 break-all">{wallet.tonAddress}</p>
            <button onClick={handleDisconnect} className="w-full py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">
              Disconnect
            </button>
          </div>
        ) : (
          <button onClick={handleConnect} className="w-full py-3 bg-primary rounded-lg text-white font-medium">
            Connect TON Wallet
          </button>
        )}
      </div>

      {/* Withdraw */}
      {wallet?.isConnected && (
        <div className="bg-dark rounded-xl p-4 mb-4">
          <p className="text-gray-400 text-xs mb-2">Withdraw TPLAY</p>
          <input
            type="number"
            placeholder="Amount"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="w-full bg-darker border border-gray-700 rounded-lg p-2 text-white text-sm mb-2"
          />
          <p className="text-gray-500 text-xs mb-2">Withdrawing to: {wallet.tonAddress}</p>
          <button onClick={handleWithdraw} className="w-full py-2 bg-primary rounded-lg text-white text-sm font-medium">
            Withdraw
          </button>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-dark rounded-xl p-4">
        <p className="text-gray-400 text-xs mb-3">Recent Transactions</p>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white text-sm">{tx.type.replace(/_/g, ' ')}</p>
                  <p className="text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`font-mono text-sm ${tx.direction === 'CREDIT' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.direction === 'CREDIT' ? '+' : '-'}{tx.amount} {tx.currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
