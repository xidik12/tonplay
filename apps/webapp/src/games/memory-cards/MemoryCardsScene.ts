import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

const PAIR_COLORS = [0xff4444, 0x44ff44, 0x4466ff, 0xffdd00, 0xff44ff, 0x44ffdd, 0xff8800, 0x8844ff];

interface Card {
  row: number;
  col: number;
  colorIndex: number;
  faceUp: boolean;
  matched: boolean;
  sprite: Phaser.GameObjects.Rectangle;
  symbol: Phaser.GameObjects.Arc;
}

export class MemoryCardsScene extends BaseGame {
  private cards: Card[] = [];
  private flippedCards: Card[] = [];
  private totalFlips: number = 0;
  private matchedPairs: number = 0;
  private isWaitingToStart: boolean = true;
  private isChecking: boolean = false;
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private flipsText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'MemoryCardsScene' }); }
  getGameSlug(): GameSlug { return 'memory-cards'; }

  calculateMultiplier(): number {
    if (this.score >= 100) return 10;
    if (this.score >= 95) return 5;
    if (this.score >= 85) return 3;
    if (this.score >= 75) return 2;
    if (this.score >= 60) return 1.5;
    if (this.score >= 40) return 1;
    if (this.score >= 20) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a1020');

    this.cellSize = Math.floor(Math.min((width - 60) / 4, (height - 250) / 4));
    const gridW = this.cellSize * 4;
    const gridH = this.cellSize * 4;
    this.gridOffsetX = (width - gridW) / 2;
    this.gridOffsetY = (height - gridH) / 2;

    this.flipsText = this.add.text(width / 2, 40, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(20);

    this.add.text(width / 2, 80, 'MEMORY CARDS', {
      fontSize: '22px', fontFamily: 'monospace', color: '#ffdd00', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    const { width, height } = this.scale;
    this.score = 0;
    this.totalFlips = 0;
    this.matchedPairs = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.isChecking = false;
    this.flippedCards = [];
    this.replayEvents = [];
    this.startTime = Date.now();

    // Clean old cards
    this.cards.forEach(c => { c.sprite.destroy(); c.symbol.destroy(); });
    this.cards = [];

    // Shuffle pairs using seeded PRNG for provably fair card layout
    const indices = this.rngShuffle([...Array(8).keys(), ...Array(8).keys()]);

    // Create cards
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const idx = r * 4 + c;
        const colorIndex = indices[idx];
        const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
        const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;

        const sprite = this.add.rectangle(x, y, this.cellSize - 6, this.cellSize - 6, 0x222244);
        sprite.setStrokeStyle(2, 0x4444aa);
        sprite.setInteractive();

        const symbol = this.add.circle(x, y, this.cellSize * 0.25, PAIR_COLORS[colorIndex]);
        symbol.setAlpha(0);

        const card: Card = { row: r, col: c, colorIndex, faceUp: false, matched: false, sprite, symbol };
        this.cards.push(card);

        sprite.on('pointerdown', () => this.flipCard(card));
      }
    }

    this.flipsText.setText('Flips: 0');
    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {});
  }

  private async flipCard(card: Card): Promise<void> {
    if (this.isChecking || card.faceUp || card.matched || this.isGameOver) return;
    if (this.flippedCards.length >= 2) return;

    card.faceUp = true;
    card.symbol.setAlpha(1);
    card.sprite.setFillStyle(0x334466);
    this.totalFlips++;
    this.flipsText.setText(`Flips: ${this.totalFlips}`);
    this.flippedCards.push(card);

    this.recordEvent('flip', { row: card.row, col: card.col, colorIndex: card.colorIndex, totalFlips: this.totalFlips });

    if (this.flippedCards.length === 2) {
      this.isChecking = true;
      const [a, b] = this.flippedCards;

      await new Promise<void>(resolve => this.time.delayedCall(500, resolve));

      if (a.colorIndex === b.colorIndex) {
        a.matched = true;
        b.matched = true;
        a.sprite.setStrokeStyle(2, 0x44ff44);
        b.sprite.setStrokeStyle(2, 0x44ff44);
        this.matchedPairs++;
        this.recordEvent('match', { colorIndex: a.colorIndex, matchedPairs: this.matchedPairs });

        if (this.matchedPairs >= 8) {
          this.score = Math.max(0, 100 - (this.totalFlips - 8) * 5);
          this.updateScore(this.score);
          this.recordEvent('all_matched', { score: this.score, totalFlips: this.totalFlips });
          await new Promise<void>(resolve => this.time.delayedCall(500, resolve));
          await this.endGame();
          return;
        }
      } else {
        a.faceUp = false;
        b.faceUp = false;
        a.symbol.setAlpha(0);
        b.symbol.setAlpha(0);
        a.sprite.setFillStyle(0x222244);
        b.sprite.setFillStyle(0x222244);
      }

      this.flippedCards = [];
      this.isChecking = false;
    }
  }

  update(time: number, delta: number): void { super.update(time, delta); }
}
