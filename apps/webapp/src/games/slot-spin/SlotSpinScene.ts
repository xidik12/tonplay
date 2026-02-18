import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';
import { FairnessEngine } from '@/core/FairnessEngine';

const SYMBOLS = ['cherry', 'lemon', 'bell', 'diamond', '7', 'star'];
const SYMBOL_COLORS: Record<string, number> = {
  cherry: 0xff2222, lemon: 0xffee00, bell: 0xffaa00, diamond: 0x44ddff, '7': 0xff4488, star: 0xffdd44,
};
const PAYOUTS: Record<string, number> = {
  cherry: 5, lemon: 8, bell: 12, diamond: 20, '7': 35, star: 50,
};

export class SlotSpinScene extends BaseGame {
  private reelDisplays: Phaser.GameObjects.Text[] = [];
  private spinButton!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private isSpinning: boolean = false;
  private isWaitingToStart: boolean = true;

  constructor() { super({ key: 'SlotSpinScene' }); }

  getGameSlug(): GameSlug { return 'slot-spin'; }

  calculateMultiplier(): number {
    if (this.score >= 50) return 10;
    if (this.score >= 35) return 5;
    if (this.score >= 12) return 2;
    if (this.score >= 5) return 1;
    if (this.score >= 1) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1a0028');

    // Title
    this.add.text(width / 2, 80, 'SLOT SPIN', { fontSize: '28px', fontFamily: 'monospace', color: '#ffdd00', fontStyle: 'bold' }).setOrigin(0.5);

    // Reel backgrounds
    const reelY = height / 2 - 40;
    const reelW = 90;
    const gap = 15;
    const totalW = reelW * 3 + gap * 2;
    const startX = (width - totalW) / 2 + reelW / 2;

    for (let i = 0; i < 3; i++) {
      const rx = startX + i * (reelW + gap);
      this.add.rectangle(rx, reelY, reelW, 100, 0x220033).setStrokeStyle(2, 0x6644aa);
      const txt = this.add.text(rx, reelY, '?', { fontSize: '40px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      this.reelDisplays.push(txt);
    }

    // Spin button
    this.spinButton = this.add.text(width / 2, reelY + 120, 'TAP TO SPIN', {
      fontSize: '22px', fontFamily: 'monospace', color: '#000000', backgroundColor: '#ffdd00',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive();

    this.spinButton.on('pointerdown', () => this.handleSpin());

    // Result text
    this.resultText = this.add.text(width / 2, reelY + 200, '', { fontSize: '18px', fontFamily: 'monospace', color: '#44ff44' }).setOrigin(0.5);

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.isSpinning = false;
    this.replayEvents = [];
    this.startTime = Date.now();
    this.resultText.setText('');
    this.reelDisplays.forEach(r => r.setText('?'));
    this.spinButton.setAlpha(1);

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {});
  }

  private async handleSpin(): Promise<void> {
    if (this.isSpinning || this.isWaitingToStart || this.isGameOver) return;
    this.isSpinning = true;
    this.spinButton.setAlpha(0.3);

    // Determine outcome from seeds
    const combined = await FairnessEngine.combinedSeed(this.serverSeedHash, this.clientSeed);
    const floats = FairnessEngine.seedToFloats(combined, 3);
    const results = floats.map(f => SYMBOLS[Math.floor(f * SYMBOLS.length)]);

    this.recordEvent('spin', { results });

    // Animate reels
    for (let i = 0; i < 3; i++) {
      const reel = this.reelDisplays[i];
      let ticks = 0;
      const maxTicks = 10 + i * 5;
      const interval = this.time.addEvent({
        delay: 60,
        repeat: maxTicks,
        callback: () => {
          ticks++;
          const sym = SYMBOLS[ticks % SYMBOLS.length];
          reel.setText(sym.substring(0, 3).toUpperCase());
          reel.setColor('#' + SYMBOL_COLORS[sym].toString(16).padStart(6, '0'));
          if (ticks >= maxTicks) {
            reel.setText(results[i].substring(0, 3).toUpperCase());
            reel.setColor('#' + SYMBOL_COLORS[results[i]].toString(16).padStart(6, '0'));
          }
        },
      });
    }

    // Wait for animation
    await new Promise<void>(resolve => this.time.delayedCall(60 * (10 + 15) + 200, resolve));

    // Calculate score
    if (results[0] === results[1] && results[1] === results[2]) {
      this.score = PAYOUTS[results[0]] || 0;
      this.resultText.setText(`3x ${results[0].toUpperCase()} — ${this.score} pts!`);
      this.resultText.setColor('#ffdd00');
    } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
      this.score = 2;
      this.resultText.setText('2x Match — 2 pts');
      this.resultText.setColor('#88ff88');
    } else {
      this.score = 0;
      this.resultText.setText('No match');
      this.resultText.setColor('#ff4444');
    }

    this.updateScore(this.score);
    this.recordEvent('result', { results, score: this.score });

    await new Promise<void>(resolve => this.time.delayedCall(1500, resolve));
    await this.endGame();
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
  }
}
