import Phaser from 'phaser';
import { SlotSpinScene } from './SlotSpinScene';
export const SLOT_SPIN_SLUG = 'slot-spin' as const;
export function createSlotSpinConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#1A0028',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 1 },
    scene: [SlotSpinScene],
  };
}
export { SlotSpinScene };
