import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';
import { FairnessEngine } from '@/core/FairnessEngine';

export class DiceDuelScene extends BaseGame {
  private round: number = 0;
  private maxRounds: number = 3;
  private roundText!: Phaser.GameObjects.Text;
  private diceText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];
  private isWaitingToStart: boolean = true;
  private isRolling: boolean = false;

  constructor() { super({ key: 'DiceDuelScene' }); }
  getGameSlug(): GameSlug { return 'dice-duel'; }

  calculateMultiplier(): number {
    if (this.score >= 36) return 10;
    if (this.score >= 31) return 5;
    if (this.score >= 25) return 3;
    if (this.score >= 19) return 2;
    if (this.score >= 13) return 1.5;
    if (this.score >= 7) return 1;
    if (this.score >= 1) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a1628');

    this.add.text(width / 2, 60, 'DICE DUEL', { fontSize: '28px', fontFamily: 'monospace', color: '#ffdd00', fontStyle: 'bold' }).setOrigin(0.5);

    this.roundText = this.add.text(width / 2, 120, '', { fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa' }).setOrigin(0.5);
    this.diceText = this.add.text(width / 2, height / 2 - 40, '', { fontSize: '60px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5);
    this.resultText = this.add.text(width / 2, height / 2 + 40, '', { fontSize: '18px', fontFamily: 'monospace', color: '#44ff44' }).setOrigin(0.5);

    const choices = ['UNDER 7', 'EXACT 7', 'OVER 7'];
    const btnY = height / 2 + 140;
    choices.forEach((label, i) => {
      const btn = this.add.text(width / 2, btnY + i * 55, label, {
        fontSize: '20px', fontFamily: 'monospace', color: '#000', backgroundColor: '#44aaff',
        padding: { x: 30, y: 10 },
      }).setOrigin(0.5).setInteractive();
      btn.on('pointerdown', () => this.handleChoice(label));
      this.buttons.push(btn);
    });

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    this.score = 0;
    this.round = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.isRolling = false;
    this.replayEvents = [];
    this.startTime = Date.now();
    this.diceText.setText('');
    this.resultText.setText('');
    this.showButtons(true);
    this.nextRound();

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {});
  }

  private nextRound(): void {
    this.round++;
    if (this.round > this.maxRounds) {
      this.finishGame();
      return;
    }
    this.roundText.setText(`Round ${this.round} of ${this.maxRounds}`);
    this.diceText.setText('? + ?');
    this.resultText.setText('Choose: Over, Under, or Exact 7');
    this.showButtons(true);
  }

  private async handleChoice(choice: string): Promise<void> {
    if (this.isRolling || this.isWaitingToStart || this.isGameOver) return;
    this.isRolling = true;
    this.showButtons(false);

    const combined = await FairnessEngine.combinedSeed(this.serverSeedHash, this.clientSeed);
    const floats = FairnessEngine.seedToFloats(combined, this.round * 2);
    const die1 = Math.floor(floats[this.round * 2 - 2] * 6) + 1;
    const die2 = Math.floor(floats[this.round * 2 - 1] * 6) + 1;
    const sum = die1 + die2;

    // Animate dice
    let ticks = 0;
    this.time.addEvent({
      delay: 80, repeat: 8,
      callback: () => {
        ticks++;
        const d1 = Phaser.Math.Between(1, 6);
        const d2 = Phaser.Math.Between(1, 6);
        this.diceText.setText(`${d1} + ${d2}`);
        if (ticks >= 8) this.diceText.setText(`${die1} + ${die2}`);
      },
    });

    await new Promise<void>(resolve => this.time.delayedCall(800, resolve));

    let correct = false;
    if (choice === 'UNDER 7' && sum < 7) correct = true;
    if (choice === 'OVER 7' && sum > 7) correct = true;
    if (choice === 'EXACT 7' && sum === 7) correct = true;

    if (correct) {
      this.addScore(sum);
      this.resultText.setText(`Correct! +${sum} pts`);
      this.resultText.setColor('#44ff44');
    } else {
      this.resultText.setText(`Wrong! Sum was ${sum}`);
      this.resultText.setColor('#ff4444');
    }

    this.recordEvent('roll', { round: this.round, choice, die1, die2, sum, correct, score: this.score });

    await new Promise<void>(resolve => this.time.delayedCall(1200, resolve));
    this.isRolling = false;
    this.nextRound();
  }

  private showButtons(visible: boolean): void {
    this.buttons.forEach(b => b.setAlpha(visible ? 1 : 0.3));
  }

  private async finishGame(): Promise<void> {
    this.roundText.setText('Game Over!');
    this.resultText.setText(`Final Score: ${this.score}`);
    this.resultText.setColor('#ffdd00');
    await new Promise<void>(resolve => this.time.delayedCall(800, resolve));
    await this.endGame();
  }

  update(time: number, delta: number): void { super.update(time, delta); }
}
