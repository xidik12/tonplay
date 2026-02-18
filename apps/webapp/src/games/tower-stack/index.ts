import Phaser from 'phaser';
import { TowerStackScene } from './TowerStackScene';

/** URL-safe slug used in routes, API calls, and DB records */
export const TOWER_STACK_SLUG = 'tower-stack' as const;

/**
 * Create a complete Phaser 3 game configuration for Tower Stack.
 *
 * The caller (React `<GamePage>`) passes in the parent DOM element
 * where the canvas should be mounted. The config uses:
 *
 * - 390x844 logical resolution (iPhone 14 / compact mobile viewport)
 * - `Phaser.Scale.FIT` so it scales cleanly to any container size
 * - Dark space background color (#0A0A1E)
 * - No Arcade physics needed (all movement is manual for
 *   deterministic replay verification)
 *
 * @param parent - The DOM element to mount the Phaser canvas into
 * @returns A Phaser `GameConfig` ready to pass to `new Phaser.Game(config)`
 */
export function createTowerStackConfig(
  parent: HTMLElement,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 390,
    height: 844,
    backgroundColor: '#0A0A1E',
    physics: {
      default: 'arcade',
      arcade: {
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
    scene: [TowerStackScene],
  };
}

export { TowerStackScene };
