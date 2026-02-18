import Phaser from 'phaser';
import { NeonRunnerScene } from './NeonRunnerScene';

/** URL-safe slug used in routes, API calls, and DB records */
export const NEON_RUNNER_SLUG = 'neon-runner' as const;

/**
 * Create a complete Phaser 3 game configuration for Neon Runner.
 *
 * The caller (React `<GamePage>`) passes in the parent DOM element
 * where the canvas should be mounted. The config uses:
 *
 * - 390x844 logical resolution (iPhone 14 / compact mobile viewport)
 * - `Phaser.Scale.FIT` so it scales cleanly to any container size
 * - Deep-space cyberpunk background color (#050510)
 * - No Arcade gravity (the Runner class applies gravity manually
 *   so the replay verifier can reproduce the exact trajectory)
 *
 * @param parent - The DOM element to mount the Phaser canvas into
 * @returns A Phaser `GameConfig` ready to pass to `new Phaser.Game(config)`
 */
export function createNeonRunnerConfig(
  parent: HTMLElement,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 390,
    height: 844,
    backgroundColor: '#050510',
    physics: {
      default: 'arcade',
      arcade: {
        // Gravity is handled manually inside Runner for deterministic replays
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: false,
      antialias: true,
      antialiasGL: true,
    },
    input: {
      activePointers: 1,
    },
    scene: [NeonRunnerScene],
  };
}

export { NeonRunnerScene };
