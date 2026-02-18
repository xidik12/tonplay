import Phaser from 'phaser';
import { BlockCrushScene } from './BlockCrushScene';
export const BLOCK_CRUSH_SLUG = 'block-crush' as const;
export function createBlockCrushConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#0A0A1E',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 1 },
    scene: [BlockCrushScene],
  };
}
export { BlockCrushScene };
