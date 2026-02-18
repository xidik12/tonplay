import Phaser from 'phaser';
import { SnakeArenaScene } from './SnakeArenaScene';

export const SNAKE_ARENA_SLUG = 'snake-arena' as const;

export function createSnakeArenaConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 390,
    height: 844,
    backgroundColor: '#0A0A1E',
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: { pixelArt: false, antialias: true },
    input: { activePointers: 1 },
    scene: [SnakeArenaScene],
  };
}

export { SnakeArenaScene };
