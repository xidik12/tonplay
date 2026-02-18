import Phaser from 'phaser';
import { FruitSlashScene } from './FruitSlashScene';

export const FRUIT_SLASH_SLUG = 'fruit-slash' as const;

export function createFruitSlashConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 390,
    height: 844,
    backgroundColor: '#1A0A2E',
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
    scene: [FruitSlashScene],
  };
}

export { FruitSlashScene };
