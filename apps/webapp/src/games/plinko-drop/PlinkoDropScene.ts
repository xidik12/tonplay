import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

const SLOT_VALUES = [0, 1, 2, 5, 10, 25, 10, 5, 2, 1, 0];
const PEG_ROWS = 10;

export class PlinkoDropScene extends BaseGame {
  private ballsLeft: number = 5;
  private pegs: { x: number; y: number }[] = [];
  private slotPositions: number[] = [];
  private isWaitingToStart: boolean = true;
  private isDropping: boolean = false;
  private ballsText!: Phaser.GameObjects.Text;
  private boardTop: number = 0;
  private boardBottom: number = 0;
  private boardLeft: number = 0;
  private pegSpacingX: number = 0;
  private pegSpacingY: number = 0;

  constructor() { super({ key: 'PlinkoDropScene' }); }
  getGameSlug(): GameSlug { return 'plinko-drop'; }

  calculateMultiplier(): number {
    if (this.score >= 100) return 10;
    if (this.score >= 80) return 5;
    if (this.score >= 60) return 3;
    if (this.score >= 40) return 2;
    if (this.score >= 20) return 1.5;
    if (this.score >= 10) return 1;
    if (this.score >= 5) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a1a0a');

    this.boardTop = 120;
    this.boardBottom = height - 140;
    this.boardLeft = 20;
    const boardWidth = width - 40;
    this.pegSpacingX = boardWidth / (SLOT_VALUES.length - 1);
    this.pegSpacingY = (this.boardBottom - this.boardTop - 60) / PEG_ROWS;

    // Build pegs
    const pegGfx = this.add.graphics();
    this.pegs = [];
    for (let row = 0; row < PEG_ROWS; row++) {
      const offset = row % 2 === 0 ? 0 : this.pegSpacingX / 2;
      const cols = row % 2 === 0 ? SLOT_VALUES.length : SLOT_VALUES.length - 1;
      for (let col = 0; col < cols; col++) {
        const px = this.boardLeft + col * this.pegSpacingX + offset;
        const py = this.boardTop + 30 + row * this.pegSpacingY;
        this.pegs.push({ x: px, y: py });
        pegGfx.fillStyle(0x44aa44, 0.8);
        pegGfx.fillCircle(px, py, 3);
      }
    }

    // Slots
    this.slotPositions = [];
    const slotWidth = boardWidth / SLOT_VALUES.length;
    for (let i = 0; i < SLOT_VALUES.length; i++) {
      const sx = this.boardLeft + slotWidth / 2 + i * slotWidth;
      this.slotPositions.push(sx);
      const color = SLOT_VALUES[i] >= 25 ? 0xffdd00 : SLOT_VALUES[i] >= 5 ? 0x44aaff : 0x444444;
      const slotGfx = this.add.graphics();
      slotGfx.fillStyle(color, 0.3);
      slotGfx.fillRect(sx - slotWidth / 2 + 1, this.boardBottom, slotWidth - 2, 30);
      this.add.text(sx, this.boardBottom + 15, `${SLOT_VALUES[i]}`, { fontSize: '11px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5);
    }

    this.ballsText = this.add.text(width / 2, 40, '', { fontSize: '18px', fontFamily: 'monospace', color: '#44ff44' }).setOrigin(0.5);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isWaitingToStart || this.isGameOver || this.isDropping || this.ballsLeft <= 0) return;
      this.dropBall(pointer.x);
    });

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    this.score = 0;
    this.ballsLeft = 5;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.isDropping = false;
    this.replayEvents = [];
    this.startTime = Date.now();
    this.ballsText.setText(`Balls: ${this.ballsLeft}`);
    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {});
  }

  private async dropBall(dropX: number): Promise<void> {
    this.isDropping = true;
    this.ballsLeft--;
    this.ballsText.setText(`Balls: ${this.ballsLeft}`);

    const ball = this.add.circle(dropX, this.boardTop, 7, 0x44ff44);
    ball.setDepth(10);

    let cx = dropX;
    this.recordEvent('ball_drop', { x: dropX, ballsLeft: this.ballsLeft });

    for (let row = 0; row < PEG_ROWS; row++) {
      const targetY = this.boardTop + 30 + row * this.pegSpacingY;
      const deflection = (this.rng() - 0.5) * this.pegSpacingX * 0.9;
      cx = this.clamp(cx + deflection, this.boardLeft + 5, this.boardLeft + (this.scale.width - 40) - 5);

      await new Promise<void>(resolve => {
        this.tweens.add({ targets: ball, x: cx, y: targetY, duration: 100, ease: 'Bounce.easeOut', onComplete: () => resolve() });
      });
    }

    await new Promise<void>(resolve => {
      this.tweens.add({ targets: ball, y: this.boardBottom + 15, duration: 120, ease: 'Quad.easeIn', onComplete: () => resolve() });
    });

    let bestSlot = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.slotPositions.length; i++) {
      const dist = Math.abs(cx - this.slotPositions[i]);
      if (dist < bestDist) { bestDist = dist; bestSlot = i; }
    }

    const points = SLOT_VALUES[bestSlot];
    this.addScore(points);
    this.recordEvent('ball_landed', { slot: bestSlot, points, score: this.score });

    this.tweens.add({ targets: ball, scale: 1.3, alpha: 0, duration: 300, onComplete: () => ball.destroy() });

    await new Promise<void>(resolve => this.time.delayedCall(200, resolve));
    this.isDropping = false;

    if (this.ballsLeft <= 0) {
      await new Promise<void>(resolve => this.time.delayedCall(500, resolve));
      await this.endGame();
    }
  }

  update(time: number, delta: number): void { super.update(time, delta); }
}
