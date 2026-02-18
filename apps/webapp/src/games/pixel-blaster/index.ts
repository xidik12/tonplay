import Phaser from 'phaser';
import { PixelBlasterScene } from './PixelBlasterScene';

export const PIXEL_BLASTER_SLUG = 'pixel-blaster' as const;

export function createPixelBlasterConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 390,
    height: 844,
    backgroundColor: '#050510',
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
    scene: [PixelBlasterScene],
  };
}

export { PixelBlasterScene };
