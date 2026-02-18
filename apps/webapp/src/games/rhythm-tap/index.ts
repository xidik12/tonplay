import Phaser from 'phaser';
import { RhythmTapScene } from './RhythmTapScene';
export const RHYTHM_TAP_SLUG = 'rhythm-tap' as const;
export function createRhythmTapConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, parent, width: 390, height: 844, backgroundColor: '#0A0A18',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true }, input: { activePointers: 3 },
    scene: [RhythmTapScene],
  };
}
export { RhythmTapScene };
