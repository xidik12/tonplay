import Phaser from 'phaser';
import { BubblePopScene } from './BubblePopScene';
export const BUBBLE_POP_SLUG = 'bubble-pop' as const;
export function createBubblePopConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#0A0A2A',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 1 },
    scene: [BubblePopScene],
  };
}
export { BubblePopScene };
