import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

const GRID_W = 8;
const GRID_H = 8;
const COLORS = [0xff4444, 0x44ff44, 0x4466ff, 0xffdd00, 0xff44ff, 0x44ffdd];

export class BlockCrushScene extends BaseGame {
  private grid: (number | null)[][] = [];
  private blockSprites: (Phaser.GameObjects.Rectangle | null)[][] = [];
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private isWaitingToStart: boolean = true;
  private isAnimating: boolean = false;
  private timerText!: Phaser.GameObjects.Text;
  private timeLeft: number = 60;

  constructor() { super({ key: 'BlockCrushScene' }); }
  getGameSlug(): GameSlug { return 'block-crush'; }

  calculateMultiplier(): number {
    if (this.score >= 500) return 10;
    if (this.score >= 400) return 5;
    if (this.score >= 300) return 3;
    if (this.score >= 200) return 2;
    if (this.score >= 100) return 1.5;
    if (this.score >= 50) return 1;
    if (this.score >= 20) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0a1e');

    this.cellSize = Math.floor(Math.min(width - 40, (height - 200)) / GRID_H);
    const gridTotal = this.cellSize * GRID_W;
    this.gridOffsetX = Math.floor((width - gridTotal) / 2);
    this.gridOffsetY = Math.floor((height - this.cellSize * GRID_H) / 2) + 20;

    this.timerText = this.add.text(width - 10, 10, '60s', {
      fontSize: '16px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(1, 0).setDepth(20);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isWaitingToStart || this.isGameOver || this.isAnimating) return;
      const col = Math.floor((pointer.x - this.gridOffsetX) / this.cellSize);
      const row = Math.floor((pointer.y - this.gridOffsetY) / this.cellSize);
      if (row >= 0 && row < GRID_H && col >= 0 && col < GRID_W) {
        this.handleTap(row, col);
      }
    });

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.isAnimating = false;
    this.timeLeft = 60;
    this.replayEvents = [];
    this.startTime = Date.now();

    // Clear old sprites
    for (const row of this.blockSprites) {
      if (row) row.forEach(s => s?.destroy());
    }

    // Build grid
    this.grid = [];
    this.blockSprites = [];
    for (let r = 0; r < GRID_H; r++) {
      this.grid[r] = [];
      this.blockSprites[r] = [];
      for (let c = 0; c < GRID_W; c++) {
        const color = COLORS[this.rngBetween(0, COLORS.length - 1)];
        this.grid[r][c] = color;
        this.blockSprites[r][c] = this.createBlock(r, c, color);
      }
    }

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {});
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.isWaitingToStart || this.isGameOver || !this.startTime) return;
    this.timeLeft -= delta / 1000;
    this.timerText.setText(`${Math.max(0, Math.ceil(this.timeLeft))}s`);
    if (this.timeLeft <= 0) this.onTimeUp();
  }

  private createBlock(row: number, col: number, color: number): Phaser.GameObjects.Rectangle {
    const x = this.gridOffsetX + col * this.cellSize + this.cellSize / 2;
    const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2;
    const block = this.add.rectangle(x, y, this.cellSize - 3, this.cellSize - 3, color);
    block.setStrokeStyle(1, 0xffffff, 0.15);
    return block;
  }

  private async handleTap(row: number, col: number): Promise<void> {
    const color = this.grid[row][col];
    if (color === null) return;

    const group = this.floodFill(row, col, color);
    if (group.length < 2) return;

    this.isAnimating = true;
    const points = group.length * (group.length - 1);
    this.addScore(points);
    this.recordEvent('crush', { row, col, count: group.length, points, score: this.score });

    // Remove blocks
    for (const { r, c } of group) {
      this.blockSprites[r][c]?.destroy();
      this.blockSprites[r][c] = null;
      this.grid[r][c] = null;
    }

    await this.applyGravity();
    await this.fillEmpty();
    this.isAnimating = false;
  }

  private floodFill(row: number, col: number, color: number): { r: number; c: number }[] {
    const visited = new Set<string>();
    const result: { r: number; c: number }[] = [];
    const queue: { r: number; c: number }[] = [{ r: row, c: col }];

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      if (r < 0 || r >= GRID_H || c < 0 || c >= GRID_W) continue;
      if (this.grid[r][c] !== color) continue;
      visited.add(key);
      result.push({ r, c });
      queue.push({ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 });
    }
    return result;
  }

  private async applyGravity(): Promise<void> {
    for (let c = 0; c < GRID_W; c++) {
      let writeRow = GRID_H - 1;
      for (let r = GRID_H - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (r !== writeRow) {
            this.grid[writeRow][c] = this.grid[r][c];
            this.blockSprites[writeRow][c] = this.blockSprites[r][c];
            this.grid[r][c] = null;
            this.blockSprites[r][c] = null;
            // Animate fall
            const targetY = this.gridOffsetY + writeRow * this.cellSize + this.cellSize / 2;
            if (this.blockSprites[writeRow][c]) {
              this.tweens.add({ targets: this.blockSprites[writeRow][c], y: targetY, duration: 100, ease: 'Quad.easeIn' });
            }
          }
          writeRow--;
        }
      }
    }
    await new Promise<void>(resolve => this.time.delayedCall(120, resolve));
  }

  private async fillEmpty(): Promise<void> {
    for (let c = 0; c < GRID_W; c++) {
      for (let r = 0; r < GRID_H; r++) {
        if (this.grid[r][c] === null) {
          const color = COLORS[this.rngBetween(0, COLORS.length - 1)];
          this.grid[r][c] = color;
          const block = this.createBlock(r, c, color);
          block.setAlpha(0);
          this.tweens.add({ targets: block, alpha: 1, duration: 150 });
          this.blockSprites[r][c] = block;
        }
      }
    }
    await new Promise<void>(resolve => this.time.delayedCall(160, resolve));
  }

  private async onTimeUp(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.recordEvent('time_up', { score: this.score });
    await new Promise<void>(resolve => this.time.delayedCall(300, resolve));
    await this.endGame();
  }
}
