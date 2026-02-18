import Phaser from 'phaser';
import { CoinDropperScene } from './CoinDropperScene';
export const COIN_DROPPER_SLUG = 'coin-dropper' as const;
export function createCoinDropperConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#0A0A22',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 1 },
    scene: [CoinDropperScene],
  };
}
export { CoinDropperScene };
