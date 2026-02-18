import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';
import { FairnessEngine } from '@/core/FairnessEngine';

export class CoinTrainScene extends BaseGame {
  private multiplier: number = 1.0;
  private crashPoint: number = 1.0;
  private isRunning: boolean = false;
  private hasCashedOut: boolean = false;
  private isWaitingToStart: boolean = true;
  private multiplierText!: Phaser.GameObjects.Text;
  private cashOutBtn!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private trainRect!: Phaser.GameObjects.Rectangle;
  private trackLine!: Phaser.GameObjects.Rectangle;

  constructor() { super({ key: 'CoinTrainScene' }); }
  getGameSlug(): GameSlug { return 'coin-train'; }

  calculateMultiplier(): number {
    if (this.score >= 100) return 10;
    if (this.score >= 80) return 5;
    if (this.score >= 60) return 3;
    if (this.score >= 40) return 2;
    if (this.score >= 20) return 1.5;
    if (this.score >= 10) return 1;
    if (this.score >= 1) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0f0a1a');

    this.add.text(width / 2, 60, 'COIN TRAIN', { fontSize: '28px', fontFamily: 'monospace', color: '#ffdd00', fontStyle: 'bold' }).setOrigin(0.5);

    this.multiplierText = this.add.text(width / 2, height / 2 - 60, '1.00x', { fontSize: '48px', fontFamily: 'monospace', color: '#44ff44', fontStyle: 'bold' }).setOrigin(0.5);

    // Track
    this.trackLine = this.add.rectangle(width / 2, height / 2 + 60, width - 40, 4, 0x333355);
    // Train
    this.trainRect = this.add.rectangle(30, height / 2 + 48, 40, 28, 0xff6644);

    this.cashOutBtn = this.add.text(width / 2, height / 2 + 160, 'CASH OUT', {
      fontSize: '24px', fontFamily: 'monospace', color: '#000', backgroundColor: '#44ff44',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setInteractive();
    this.cashOutBtn.on('pointerdown', () => this.handleCashOut());

    this.statusText = this.add.text(width / 2, height / 2 + 240, '', { fontSize: '16px', fontFamily: 'monospace', color: '#aaaaaa' }).setOrigin(0.5);

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  async startGame(): Promise<void> {
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.isRunning = true;
    this.hasCashedOut = false;
    this.multiplier = 1.0;
    this.replayEvents = [];
    this.startTime = Date.now();

    // Determine crash point from seeds
    const combined = await FairnessEngine.combinedSeed(this.serverSeedHash, this.clientSeed);
    const float = FairnessEngine.seedToFloat(combined);
    // Crash point: 1.0 to ~11.0, weighted toward lower values
    this.crashPoint = Math.max(1.0, 1.0 / (1.0 - float * 0.95));
    this.crashPoint = Math.min(this.crashPoint, 11.0);

    this.multiplierText.setText('1.00x').setColor('#44ff44');
    this.cashOutBtn.setAlpha(1);
    this.statusText.setText('');
    this.trainRect.x = 30;

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', { crashPoint: Math.round(this.crashPoint * 100) / 100 });
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!this.isRunning || this.isWaitingToStart || this.isGameOver) return;

    const dt = delta / 1000;
    // Exponential growth
    this.multiplier += this.multiplier * dt * 0.5;

    // Move train
    const { width } = this.scale;
    const progress = Math.min((this.multiplier - 1) / (this.crashPoint - 1), 1);
    this.trainRect.x = 30 + progress * (width - 70);

    this.multiplierText.setText(`${this.multiplier.toFixed(2)}x`);

    // Color shift
    if (this.multiplier >= 5) this.multiplierText.setColor('#ff4444');
    else if (this.multiplier >= 3) this.multiplierText.setColor('#ffaa00');
    else this.multiplierText.setColor('#44ff44');

    // Crash check
    if (this.multiplier >= this.crashPoint) {
      this.onCrash();
    }
  }

  private handleCashOut(): void {
    if (!this.isRunning || this.hasCashedOut || this.isGameOver) return;
    this.hasCashedOut = true;
    this.isRunning = false;
    this.score = Math.min(100, Math.floor(this.multiplier * 10));
    this.updateScore(this.score);
    this.recordEvent('cash_out', { multiplier: this.multiplier, score: this.score });
    this.statusText.setText(`Cashed out at ${this.multiplier.toFixed(2)}x!`);
    this.statusText.setColor('#44ff44');
    this.cashOutBtn.setAlpha(0.3);

    this.time.delayedCall(1000, () => this.endGame());
  }

  private async onCrash(): Promise<void> {
    this.isRunning = false;
    if (this.hasCashedOut) return;
    this.score = 0;
    this.updateScore(0);
    this.recordEvent('crash', { crashPoint: this.crashPoint });
    this.multiplierText.setText('CRASHED!').setColor('#ff4444');
    this.statusText.setText(`Train crashed at ${this.crashPoint.toFixed(2)}x`);
    this.statusText.setColor('#ff4444');
    this.cashOutBtn.setAlpha(0.3);
    this.cameras.main.shake(300, 0.03);

    await new Promise<void>(resolve => this.time.delayedCall(1200, resolve));
    await this.endGame();
  }
}
