import Phaser from 'phaser';
import { DiceDuelScene } from './DiceDuelScene';
export const DICE_DUEL_SLUG = 'dice-duel' as const;
export function createDiceDuelConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#0A1628',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 1 },
    scene: [DiceDuelScene],
  };
}
export { DiceDuelScene };
