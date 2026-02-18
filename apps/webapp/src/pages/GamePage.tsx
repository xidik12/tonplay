import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { GAME_LIST } from '@tonplay/shared';
import type { GameInfo, GameResult } from '@tonplay/shared';
import { ResponsiveScaler } from '@/core/ResponsiveScaler';
import { useTelegram } from '@/hooks/useTelegram';
import { useBalance } from '@/hooks/useBalance';
import { BaseHUD } from '@/ui/BaseHUD';
import { WagerSelector } from '@/ui/WagerSelector';
import { ResultOverlay } from '@/ui/ResultOverlay';
import { BootScene } from '@/scenes/BootScene';
import { PreloadScene } from '@/scenes/PreloadScene';

// Dynamic game scene imports will be lazy loaded
type GamePhase = 'wager' | 'loading' | 'playing' | 'result';

export function GamePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { bridge, haptic } = useTelegram();
  const { tickets, deductTickets, addTickets } = useBalance();

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);

  const [phase, setPhase] = useState<GamePhase>('wager');
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [wagerAmount, setWagerAmount] = useState(0);

  // Find the game info
  useEffect(() => {
    const info = GAME_LIST.find((g) => g.slug === slug);
    if (!info || !info.enabled) {
      navigate('/', { replace: true });
      return;
    }
    setGameInfo(info);
  }, [slug, navigate]);

  // Handle back button
  useEffect(() => {
    bridge.onBackButton(async () => {
      if (phase === 'playing') {
        const confirmed = await bridge.showConfirm(
          'Are you sure you want to exit? You will lose your wager.',
        );
        if (confirmed) {
          destroyGame();
          navigate('/');
        }
      } else {
        destroyGame();
        navigate('/');
      }
    });

    return () => {
      bridge.onBackButton(null);
    };
  }, [bridge, navigate, phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyGame();
    };
  }, []);

  const destroyGame = useCallback(() => {
    if (phaserGameRef.current) {
      phaserGameRef.current.destroy(true);
      phaserGameRef.current = null;
    }
  }, []);

  const handleWagerConfirm = useCallback(
    async (amount: number) => {
      if (!gameInfo || !gameContainerRef.current) return;

      setWagerAmount(amount);
      deductTickets(amount);
      haptic('impact', 'heavy');
      setPhase('loading');

      try {
        // Initialize Phaser game
        const scaleConfig = ResponsiveScaler.getPhaserScaleConfig();

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          parent: gameContainerRef.current,
          backgroundColor: '#060612',
          scale: scaleConfig,
          physics: {
            default: 'arcade',
            arcade: {
              gravity: { x: 0, y: 0 },
              debug: false,
            },
          },
          scene: [BootScene, PreloadScene],
          input: {
            activePointers: 3,
          },
          render: {
            antialias: true,
            pixelArt: false,
          },
          audio: {
            disableWebAudio: false,
          },
        };

        const game = new Phaser.Game(config);
        phaserGameRef.current = game;

        // Pass data to the game via the registry
        game.registry.set('gameSlug', gameInfo.slug);
        game.registry.set('wagerAmount', amount);
        game.registry.set('gameInfo', gameInfo);

        // Listen for game events from Phaser scenes
        game.events.on('game:score-update', (newScore: number) => {
          setScore(newScore);
        });

        game.events.on('game:started', () => {
          setPhase('playing');
        });

        game.events.on('game:over', (gameResult: GameResult) => {
          haptic('notification', gameResult.payout > 0 ? 'success' : 'error');
          setResult(gameResult);
          setScore(gameResult.score);
          if (gameResult.payout > 0) {
            addTickets(gameResult.payout);
          }
          setPhase('result');
        });
      } catch (err) {
        console.error('[GamePage] Failed to initialize Phaser:', err);
        addTickets(amount); // Refund on error
        setPhase('wager');
      }
    },
    [gameInfo, deductTickets, addTickets, haptic],
  );

  const handlePlayAgain = useCallback(() => {
    destroyGame();
    setScore(0);
    setResult(null);
    setPhase('wager');
  }, [destroyGame]);

  const handleBackToLobby = useCallback(() => {
    destroyGame();
    navigate('/');
  }, [destroyGame, navigate]);

  if (!gameInfo) return null;

  return (
    <div className="fixed inset-0 bg-darker">
      {/* Phaser canvas container */}
      <div
        ref={gameContainerRef}
        className="absolute inset-0 z-0"
        style={{ touchAction: 'none' }}
      />

      {/* React UI overlays */}
      {phase === 'wager' && (
        <WagerSelector
          gameInfo={gameInfo}
          balance={tickets}
          onConfirm={handleWagerConfirm}
          onBack={() => navigate('/')}
        />
      )}

      {phase === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-darker/80">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-400">Loading game...</p>
          </div>
        </div>
      )}

      {phase === 'playing' && (
        <BaseHUD
          score={score}
          ticketBalance={tickets}
          onPause={async () => {
            const confirmed = await bridge.showConfirm(
              'Pause the game? You can resume playing.',
            );
            if (confirmed) {
              phaserGameRef.current?.scene.pause('GameScene');
            }
          }}
        />
      )}

      {phase === 'result' && result && (
        <ResultOverlay
          result={result}
          wagerAmount={wagerAmount}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
          onShare={() => {
            const text = `I scored ${formatNumber(result.score)} in ${gameInfo.name} on TONPLAY! Can you beat me?`;
            bridge.openLink(
              `https://t.me/share/url?url=https://t.me/TonPlayBot&text=${encodeURIComponent(text)}`,
            );
          }}
        />
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
