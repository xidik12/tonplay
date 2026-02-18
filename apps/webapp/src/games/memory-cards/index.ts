import Phaser from 'phaser';
import { MemoryCardsScene } from './MemoryCardsScene';
export const MEMORY_CARDS_SLUG = 'memory-cards' as const;
export function createMemoryCardsConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#0A1020',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 1 },
    scene: [MemoryCardsScene],
  };
}
export { MemoryCardsScene };
