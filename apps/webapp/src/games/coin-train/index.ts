import Phaser from 'phaser';
import { CoinTrainScene } from './CoinTrainScene';
export const COIN_TRAIN_SLUG = 'coin-train' as const;
export function createCoinTrainConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#0F0A1A',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 1 },
    scene: [CoinTrainScene],
  };
}
export { CoinTrainScene };
