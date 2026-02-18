import { useState } from 'react';
import type { GameInfo } from '@tonplay/shared';
import { formatNumber } from '@/utils/format';

interface WagerSelectorProps {
  gameInfo: GameInfo;
  balance: number;
  onConfirm: (amount: number) => void;
  onBack: () => void;
}

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500];

export function WagerSelector({
  gameInfo,
  balance,
  onConfirm,
  onBack,
}: WagerSelectorProps) {
  const [amount, setAmount] = useState(gameInfo.minWager);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const isValid =
    amount >= gameInfo.minWager &&
    amount <= gameInfo.maxWager &&
    amount <= balance;

  const handlePresetClick = (preset: number) => {
    setCustomMode(false);
    setAmount(preset);
  };

  const handleCustomChange = (value: string) => {
    setCustomInput(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setAmount(num);
    }
  };

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(amount);
    }
  };

  return (
    <div className="absolute inset-0 z-30 bg-darker/95 flex flex-col safe-top safe-bottom">
      {/* Dimmed background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative flex flex-col h-full">
        {/* Back button */}
        <div className="px-4 pt-3">
          <button
            onClick={onBack}
            className="text-gray-400 text-sm font-medium flex items-center gap-1"
          >
            <span className="text-lg">{'\u2190'}</span> Back
          </button>
        </div>

        {/* Game info */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Game thumbnail placeholder */}
          <div className="w-24 h-24 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <span className="text-3xl font-black text-white/30">
              {gameInfo.name.charAt(0)}
            </span>
          </div>

          <h1 className="text-2xl font-black text-white mb-1">{gameInfo.name}</h1>
          <p className="text-sm text-gray-400 text-center mb-8 max-w-xs">
            {gameInfo.description}
          </p>

          {/* Wager amount display */}
          <div className="mb-6 text-center">
            <p className="text-xs text-gray-500 mb-1">Your Wager</p>
            <p className="text-4xl font-black text-white tabular-nums">
              {formatNumber(amount)}
            </p>
            <p className="text-xs text-accent mt-1">tickets</p>
          </div>

          {/* Preset amounts */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-xs mb-4">
            {PRESET_AMOUNTS.filter(
              (p) => p >= gameInfo.minWager && p <= gameInfo.maxWager,
            ).map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                disabled={preset > balance}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  amount === preset && !customMode
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : preset > balance
                      ? 'bg-surface/50 text-gray-600 cursor-not-allowed'
                      : 'bg-surface text-gray-300 hover:bg-surfaceLight'
                }`}
              >
                {formatNumber(preset)}
              </button>
            ))}
          </div>

          {/* Custom input toggle */}
          <button
            onClick={() => setCustomMode(!customMode)}
            className="text-xs text-primary font-medium mb-3"
          >
            {customMode ? 'Use preset' : 'Custom amount'}
          </button>

          {customMode && (
            <div className="w-full max-w-xs mb-4 animate-fade-in">
              <input
                type="number"
                value={customInput}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder={`${gameInfo.minWager} - ${gameInfo.maxWager}`}
                className="w-full bg-surface border border-surfaceLight rounded-xl px-4 py-3 text-center text-white font-bold text-lg outline-none focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min={gameInfo.minWager}
                max={Math.min(gameInfo.maxWager, balance)}
              />
            </div>
          )}

          {/* Wager limits */}
          <div className="flex items-center justify-between w-full max-w-xs text-[10px] text-gray-500 mb-6">
            <span>Min: {gameInfo.minWager}</span>
            <span>Max: {formatNumber(gameInfo.maxWager)}</span>
          </div>

          {/* Balance display */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-400">Balance:</span>
            <span
              className={`text-sm font-bold ${
                balance < amount ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatNumber(balance)} tickets
            </span>
          </div>
        </div>

        {/* Play button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className={`w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-[0.98] ${
              isValid
                ? 'gradient-primary text-white shadow-lg shadow-primary/30'
                : 'bg-surfaceLight text-gray-600 cursor-not-allowed'
            }`}
          >
            {balance < amount
              ? 'Insufficient Balance'
              : `PLAY for ${formatNumber(amount)} tickets`}
          </button>

          {balance < gameInfo.minWager && (
            <p className="text-center text-xs text-red-400 mt-2">
              You need at least {gameInfo.minWager} tickets to play
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
