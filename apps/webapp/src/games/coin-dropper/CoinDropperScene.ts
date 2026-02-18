import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

const SLOT_VALUES = [0, 5, 10, 15, 10, 5, 15, 10, 5, 0];
const PEG_ROWS = 8;
const PEG_COLS = 9;

export class CoinDropperScene extends BaseGame {
  private coinsLeft: number = 10;
  private pegs: { x: number; y: number }[] = [];
  private slotPositions: number[] = [];
  private isWaitingToStart: boolean = true;
  private isDropping: boolean = false;
  private coinsText!: Phaser.GameObjects.Text;
  private pegGraphics!: Phaser.GameObjects.Graphics;
  private slotGraphics!: Phaser.GameObjects.Graphics;
  private boardTop: number = 0;
  private boardBottom: number = 0;
  private boardLeft: number = 0;
  private pegSpacingX: number = 0;
  private pegSpacingY: number = 0;

  constructor() { super({ key: 'CoinDropperScene' }); }
  getGameSlug(): GameSlug { return 'coin-dropper'; }

  calculateMultiplier(): number {
    if (this.score >= 150) return 10;
    if (this.score >= 125) return 5;
    if (this.score >= 100) return 3;
    if (this.score >= 75) return 2;
    if (this.score >= 50) return 1.5;
    if (this.score >= 30) return 1;
    if (this.score >= 15) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0a22');

    this.boardTop = 120;
    this.boardBottom = height - 140;
    this.boardLeft = 30;
    const boardWidth = width - 60;
    this.pegSpacingX = boardWidth / PEG_COLS;
    this.pegSpacingY = (this.boardBottom - this.boardTop - 60) / PEG_ROWS;

    // Build pegs
    this.pegGraphics = this.add.graphics();
    this.pegs = [];
    for (let row = 0; row < PEG_ROWS; row++) {
      const offset = row % 2 === 0 ? 0 : this.pegSpacingX / 2;
      const cols = row % 2 === 0 ? PEG_COLS : PEG_COLS - 1;
      for (let col = 0; col < cols; col++) {
        const px = this.boardLeft + this.pegSpacingX / 2 + col * this.pegSpacingX + offset;
        const py = this.boardTop + 30 + row * this.pegSpacingY;
        this.pegs.push({ x: px, y: py });
        this.pegGraphics.fillStyle(0x6644aa, 0.8);
        this.pegGraphics.fillCircle(px, py, 4);
      }
    }

    // Slot labels
    this.slotGraphics = this.add.graphics();
    this.slotPositions = [];
    const slotWidth = boardWidth / SLOT_VALUES.length;
    for (let i = 0; i < SLOT_VALUES.length; i++) {
      const sx = this.boardLeft + slotWidth / 2 + i * slotWidth;
      this.slotPositions.push(sx);
      const color = SLOT_VALUES[i] >= 15 ? 0xffdd00 : SLOT_VALUES[i] >= 10 ? 0x44aaff : SLOT_VALUES[i] >= 5 ? 0x44ff44 : 0x444444;
      this.slotGraphics.fillStyle(color, 0.3);
      this.slotGraphics.fillRect(sx - slotWidth / 2 + 1, this.boardBottom, slotWidth - 2, 30);
      this.add.text(sx, this.boardBottom + 15, `${SLOT_VALUES[i]}`, { fontSize: '12px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5);
    }

    this.coinsText = this.add.text(width / 2, 40, '', { fontSize: '18px', fontFamily: 'monospace', color: '#ffdd00' }).setOrigin(0.5);

    // Tap to drop
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isWaitingToStart || this.isGameOver || this.isDropping || this.coinsLeft <= 0) return;
      this.dropCoin(pointer.x);
    });

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    this.score = 0;
    this.coinsLeft = 10;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.isDropping = false;
    this.replayEvents = [];
    this.startTime = Date.now();
    this.coinsText.setText(`Coins: ${this.coinsLeft}`);
    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {});
  }

  private async dropCoin(dropX: number): Promise<void> {
    this.isDropping = true;
    this.coinsLeft--;
    this.coinsText.setText(`Coins: ${this.coinsLeft}`);

    const coin = this.add.circle(dropX, this.boardTop, 8, 0xffdd00);
    coin.setDepth(10);

    let cx = dropX;
    let cy = this.boardTop;

    this.recordEvent('coin_drop', { x: dropX, coinsLeft: this.coinsLeft });

    // Simulate falling through pegs
    for (let row = 0; row < PEG_ROWS; row++) {
      const targetY = this.boardTop + 30 + row * this.pegSpacingY;
      // Random deflection
      const deflection = (this.rng() - 0.5) * this.pegSpacingX * 0.8;
      cx = this.clamp(cx + deflection, this.boardLeft + 10, this.boardLeft + (this.scale.width - 60) - 10);

      await new Promise<void>(resolve => {
        this.tweens.add({
          targets: coin,
          x: cx,
          y: targetY,
          duration: 120,
          ease: 'Bounce.easeOut',
          onComplete: () => resolve(),
        });
      });
    }

    // Fall to slot
    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: coin,
        y: this.boardBottom + 15,
        duration: 150,
        ease: 'Quad.easeIn',
        onComplete: () => resolve(),
      });
    });

    // Determine slot
    let bestSlot = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.slotPositions.length; i++) {
      const dist = Math.abs(cx - this.slotPositions[i]);
      if (dist < bestDist) { bestDist = dist; bestSlot = i; }
    }

    const points = SLOT_VALUES[bestSlot];
    this.addScore(points);
    this.recordEvent('coin_landed', { slot: bestSlot, points, score: this.score });

    // Flash effect
    if (points > 0) {
      this.tweens.add({ targets: coin, scale: 1.5, alpha: 0, duration: 300, onComplete: () => coin.destroy() });
    } else {
      this.tweens.add({ targets: coin, alpha: 0, duration: 200, onComplete: () => coin.destroy() });
    }

    await new Promise<void>(resolve => this.time.delayedCall(200, resolve));
    this.isDropping = false;

    if (this.coinsLeft <= 0) {
      await new Promise<void>(resolve => this.time.delayedCall(500, resolve));
      await this.endGame();
    }
  }

  update(time: number, delta: number): void { super.update(time, delta); }
}
