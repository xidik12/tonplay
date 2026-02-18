import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { GAME_LIST } from '@tonplay/shared';
import type { GameInfo, GameResult, GameSlug } from '@tonplay/shared';
import { ResponsiveScaler } from '@/core/ResponsiveScaler';
import { useTelegram } from '@/hooks/useTelegram';
import { useBalance } from '@/hooks/useBalance';
import { BaseHUD } from '@/ui/BaseHUD';
import { WagerSelector } from '@/ui/WagerSelector';
import { ResultOverlay } from '@/ui/ResultOverlay';
import { BootScene } from '@/scenes/BootScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import type { BaseGame } from '@/games/BaseGame';

type GamePhase = 'wager' | 'loading' | 'playing' | 'result';

/** Lazy-loads game scene classes for code splitting — each game is its own chunk */
async function loadGameScene(slug: GameSlug): Promise<typeof Phaser.Scene | null> {
  switch (slug) {
    case 'flappy-rocket': return (await import('@/games/flappy-rocket/FlappyRocketScene')).FlappyRocketScene;
    case 'tower-stack': return (await import('@/games/tower-stack/TowerStackScene')).TowerStackScene;
    case 'neon-runner': return (await import('@/games/neon-runner/NeonRunnerScene')).NeonRunnerScene;
    case 'snake-arena': return (await import('@/games/snake-arena/SnakeArenaScene')).SnakeArenaScene;
    case 'pixel-blaster': return (await import('@/games/pixel-blaster/PixelBlasterScene')).PixelBlasterScene;
    case 'fruit-slash': return (await import('@/games/fruit-slash/FruitSlashScene')).FruitSlashScene;
    case 'slot-spin': return (await import('@/games/slot-spin/SlotSpinScene')).SlotSpinScene;
    case 'dice-duel': return (await import('@/games/dice-duel/DiceDuelScene')).DiceDuelScene;
    case 'coin-train': return (await import('@/games/coin-train/CoinTrainScene')).CoinTrainScene;
    case 'coin-dropper': return (await import('@/games/coin-dropper/CoinDropperScene')).CoinDropperScene;
    case 'plinko-drop': return (await import('@/games/plinko-drop/PlinkoDropScene')).PlinkoDropScene;
    case 'bubble-pop': return (await import('@/games/bubble-pop/BubblePopScene')).BubblePopScene;
    case 'block-crush': return (await import('@/games/block-crush/BlockCrushScene')).BlockCrushScene;
    case 'memory-cards': return (await import('@/games/memory-cards/MemoryCardsScene')).MemoryCardsScene;
    case 'rhythm-tap': return (await import('@/games/rhythm-tap/RhythmTapScene')).RhythmTapScene;
    default: return null;
  }
}

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
        // Resolve the game scene class (lazy-loaded for code splitting)
        const gameSceneClass = await loadGameScene(gameInfo.slug as GameSlug);
        if (!gameSceneClass) {
          console.error(`[GamePage] No scene registered for slug: ${gameInfo.slug}`);
          addTickets(amount);
          setPhase('wager');
          return;
        }

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
          scene: [BootScene, PreloadScene, gameSceneClass],
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

        // When game scene signals it's ready, start the wager flow
        game.events.on('game:ready', () => {
          // Find the active game scene and call startWager
          const sceneKey = (gameSceneClass as unknown as { prototype: { constructor: { name: string } } }).prototype?.constructor?.name;
          const scenes = game.scene.getScenes(true);
          for (const s of scenes) {
            if (s instanceof gameSceneClass && 'startWager' in s) {
              (s as BaseGame).startWager(amount);
              break;
            }
          }
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
            if (confirmed && phaserGameRef.current) {
              const scenes = phaserGameRef.current.scene.getScenes(true);
              for (const s of scenes) {
                if ('getGameSlug' in s) {
                  phaserGameRef.current.scene.pause(s.scene.key);
                  break;
                }
              }
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
