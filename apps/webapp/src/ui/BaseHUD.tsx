import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@/utils/format';

interface BaseHUDProps {
  score: number;
  ticketBalance: number;
  timer?: number | null;
  onPause?: () => void;
}

function AnimatedScore({ value }: { value: number }) {
  const prevRef = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const duration = 300; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    prevRef.current = value;

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [value]);

  return (
    <span className="tabular-nums">{formatNumber(displayValue)}</span>
  );
}

export function BaseHUD({ score, ticketBalance, timer, onPause }: BaseHUDProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 pointer-events-none safe-top">
      <div className="flex items-start justify-between px-4 pt-2">
        {/* Ticket balance (top left) */}
        <div className="pointer-events-auto bg-dark/70 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <span className="text-accent text-xs">🎫</span>
          <span className="text-xs font-bold text-white tabular-nums">
            {formatNumber(ticketBalance)}
          </span>
        </div>

        {/* Score (top center) */}
        <div className="flex flex-col items-center">
          <div className="bg-dark/70 backdrop-blur-sm rounded-lg px-4 py-1.5">
            <p className="text-[10px] text-gray-400 text-center">SCORE</p>
            <p className="text-xl font-black text-white text-center leading-tight">
              <AnimatedScore value={score} />
            </p>
          </div>

          {/* Timer (if applicable) */}
          {timer !== null && timer !== undefined && (
            <div className="bg-dark/70 backdrop-blur-sm rounded-lg px-3 py-1 mt-1">
              <p
                className={`text-sm font-bold tabular-nums ${
                  timer <= 10 ? 'text-red-400 animate-pulse' : 'text-white'
                }`}
              >
                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </p>
            </div>
          )}
        </div>

        {/* Pause button (top right) */}
        <button
          onClick={onPause}
          className="pointer-events-auto bg-dark/70 backdrop-blur-sm rounded-lg w-9 h-9 flex items-center justify-center active:scale-90 transition-transform"
        >
          <div className="flex gap-0.5">
            <div className="w-1 h-3 bg-white rounded-full" />
            <div className="w-1 h-3 bg-white rounded-full" />
          </div>
        </button>
      </div>
    </div>
  );
}
