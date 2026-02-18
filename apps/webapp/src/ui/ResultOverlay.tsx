import { useEffect, useState, useRef } from 'react';
import type { GameResult } from '@tonplay/shared';
import { formatNumber, formatMultiplier } from '@/utils/format';
import { FairnessEngine } from '@/core/FairnessEngine';

interface ResultOverlayProps {
  result: GameResult;
  wagerAmount: number;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  onShare?: () => void;
}

interface ConfettiParticle {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
}

function Confetti({ count = 30 }: { count?: number }) {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  useEffect(() => {
    const colors = ['#6C5CE7', '#00CEC9', '#FDCB6E', '#FF6B6B', '#A29BFE', '#55EFC4'];
    const newParticles: ConfettiParticle[] = [];

    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 1,
        size: 4 + Math.random() * 6,
      });
    }

    setParticles(newParticles);
  }, [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute confetti-particle"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${1.5 + Math.random()}s`,
          }}
        />
      ))}
    </div>
  );
}

function AnimatedNumber({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  className = '',
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(value * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatNumber(display)}
      {suffix}
    </span>
  );
}

export function ResultOverlay({
  result,
  wagerAmount,
  onPlayAgain,
  onBackToLobby,
  onShare,
}: ResultOverlayProps) {
  const [showFairness, setShowFairness] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const isWin = result.payout > 0;
  const netProfit = result.payout - wagerAmount;

  useEffect(() => {
    // Client-side verification: hash the revealed server seed and compare against the committed hash
    if (result.serverSeed && result.serverSeedHash) {
      FairnessEngine.verifyServerSeed(result.serverSeed, result.serverSeedHash).then(setVerified);
    }
  }, [result.serverSeed, result.serverSeedHash]);

  return (
    <div className="absolute inset-0 z-30 bg-darker/95 backdrop-blur-sm flex flex-col items-center justify-center safe-top safe-bottom animate-fade-in">
      {/* Confetti for wins */}
      {isWin && <Confetti count={40} />}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 max-w-sm w-full">
        {/* Result icon */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 animate-bounce-in ${
            isWin
              ? 'bg-gradient-to-br from-accent to-yellow-600 shadow-lg shadow-accent/30'
              : 'bg-gradient-to-br from-gray-600 to-gray-800'
          }`}
        >
          <span className="text-3xl">{isWin ? '\u2605' : '\u2715'}</span>
        </div>

        {/* Title */}
        <h1
          className={`text-2xl font-black mb-1 ${
            isWin ? 'text-accent text-glow' : 'text-gray-400'
          }`}
        >
          {isWin ? 'YOU WIN!' : 'GAME OVER'}
        </h1>

        {/* Score */}
        <div className="bg-surface rounded-2xl px-8 py-4 mb-4 text-center w-full">
          <p className="text-xs text-gray-400 mb-1">Final Score</p>
          <p className="text-4xl font-black text-white">
            <AnimatedNumber value={result.score} />
          </p>
        </div>

        {/* Multiplier and payout */}
        <div className="flex gap-3 w-full mb-4">
          <div className="flex-1 bg-surface rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">Multiplier</p>
            <p className="text-lg font-black text-secondary">
              {formatMultiplier(result.multiplier)}
            </p>
          </div>
          <div className="flex-1 bg-surface rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">Payout</p>
            <p
              className={`text-lg font-black ${
                isWin ? 'text-accent' : 'text-gray-500'
              }`}
            >
              {isWin ? '+' : ''}
              <AnimatedNumber value={result.payout} duration={800} />
            </p>
          </div>
        </div>

        {/* Net result */}
        <div className="bg-surface/50 rounded-xl px-4 py-2 mb-6 w-full text-center">
          <span className="text-xs text-gray-400">Net: </span>
          <span
            className={`text-sm font-bold ${
              netProfit >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {netProfit >= 0 ? '+' : ''}
            {formatNumber(netProfit)} tickets
          </span>
        </div>

        {/* Provably fair link */}
        <button
          onClick={() => setShowFairness(!showFairness)}
          className="text-[10px] text-primary/60 font-medium mb-4 flex items-center gap-1"
        >
          {'\u2713'} Provably Fair
          <span className="text-[8px]">{showFairness ? '\u25B2' : '\u25BC'}</span>
        </button>

        {showFairness && (
          <div className="bg-surface rounded-xl p-3 mb-4 w-full animate-fade-in">
            <p className="text-[10px] text-gray-400 mb-2">Verification</p>
            <div className="space-y-1.5">
              <div>
                <p className="text-[9px] text-gray-500">Server Seed</p>
                <p className="text-[10px] text-gray-300 font-mono truncate">
                  {result.serverSeed}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-gray-500">Session ID</p>
                <p className="text-[10px] text-gray-300 font-mono truncate">
                  {result.sessionId}
                </p>
              </div>
              <div className="flex items-center gap-1 pt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    verified === true ? 'bg-green-400' : verified === false ? 'bg-red-400' : 'bg-yellow-400'
                  }`}
                />
                <span className="text-[10px] text-gray-400">
                  {verified === true
                    ? 'Seed verified'
                    : verified === false
                      ? 'Seed mismatch'
                      : result.isVerified
                        ? 'Server verified'
                        : 'Pending verification'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={onBackToLobby}
            className="flex-1 py-3.5 bg-surface rounded-xl text-sm font-bold text-gray-300 transition-all active:scale-[0.97]"
          >
            Lobby
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3.5 gradient-primary rounded-xl text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.97]"
          >
            Play Again
          </button>
        </div>

        {/* Share button */}
        {onShare && isWin && (
          <button
            onClick={onShare}
            className="w-full py-3 mt-2 bg-surface rounded-xl text-sm font-medium text-secondary transition-all active:scale-[0.97]"
          >
            Share Score
          </button>
        )}
      </div>
    </div>
  );
}
