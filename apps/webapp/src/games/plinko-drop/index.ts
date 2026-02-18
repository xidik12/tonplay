import Phaser from 'phaser';
import { PlinkoDropScene } from './PlinkoDropScene';
export const PLINKO_DROP_SLUG = 'plinko-drop' as const;
export function createPlinkoDropConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#0A1A0A',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 1 },
    scene: [PlinkoDropScene],
  };
}
export { PlinkoDropScene };
