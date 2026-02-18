import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

const COLORS = [0xff4444, 0x44ff44, 0x4444ff, 0xffdd00, 0xff44ff, 0x44ffff];
const BUBBLE_RADIUS = 14;
const GRID_COLS = 11;
const GRID_ROWS = 8;

interface GridBubble {
  row: number;
  col: number;
  color: number;
  sprite: Phaser.GameObjects.Arc;
}

export class BubblePopScene extends BaseGame {
  private grid: (GridBubble | null)[][] = [];
  private shooterColor: number = 0;
  private aimLine!: Phaser.GameObjects.Graphics;
  private shooterBubble!: Phaser.GameObjects.Arc;
  private shooterX: number = 0;
  private shooterY: number = 0;
  private isWaitingToStart: boolean = true;
  private isShooting: boolean = false;
  private timerText!: Phaser.GameObjects.Text;
  private timeLeft: number = 60;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;

  constructor() { super({ key: 'BubblePopScene' }); }
  getGameSlug(): GameSlug { return 'bubble-pop'; }

  calculateMultiplier(): number {
    if (this.score >= 250) return 10;
    if (this.score >= 200) return 5;
    if (this.score >= 150) return 3;
    if (this.score >= 100) return 2;
    if (this.score >= 50) return 1.5;
    if (this.score >= 25) return 1;
    if (this.score >= 10) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0a2a');

    this.gridOffsetX = (width - GRID_COLS * BUBBLE_RADIUS * 2) / 2 + BUBBLE_RADIUS;
    this.gridOffsetY = 80;

    this.shooterX = width / 2;
    this.shooterY = height - 80;

    this.aimLine = this.add.graphics().setDepth(5);
    this.timerText = this.add.text(width - 10, 10, '60s', { fontSize: '16px', fontFamily: 'monospace', color: '#888' }).setOrigin(1, 0).setDepth(20);

    // Build initial grid
    this.buildGrid();

    // Shooter bubble
    this.shooterColor = COLORS[0]; // Placeholder until startGame() initializes RNG
    this.shooterBubble = this.add.circle(this.shooterX, this.shooterY, BUBBLE_RADIUS, this.shooterColor).setDepth(10);

    // Aim + shoot
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isWaitingToStart || this.isGameOver || this.isShooting) return;
      this.drawAim(pointer.x, pointer.y);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isWaitingToStart || this.isGameOver || this.isShooting) return;
      this.shoot(pointer.x, pointer.y);
    });

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.isShooting = false;
    this.timeLeft = 60;
    this.replayEvents = [];
    this.startTime = Date.now();
    // Reinitialize shooter color with seeded RNG
    this.shooterColor = COLORS[this.rngBetween(0, COLORS.length - 1)];
    this.shooterBubble.destroy();
    this.shooterBubble = this.add.circle(this.shooterX, this.shooterY, BUBBLE_RADIUS, this.shooterColor).setDepth(10);

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {});
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.isWaitingToStart || this.isGameOver || !this.startTime) return;
    this.timeLeft -= delta / 1000;
    this.timerText.setText(`${Math.max(0, Math.ceil(this.timeLeft))}s`);
    if (this.timeLeft <= 0) { this.onTimeUp(); }
  }

  private buildGrid(): void {
    this.grid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let col = 0; col < cols; col++) {
        const color = COLORS[this.rngBetween(0, COLORS.length - 1)];
        const { x, y } = this.gridToPixel(row, col);
        const sprite = this.add.circle(x, y, BUBBLE_RADIUS - 1, color);
        this.grid[row][col] = { row, col, color, sprite };
      }
    }
  }

  private gridToPixel(row: number, col: number): { x: number; y: number } {
    const offset = row % 2 === 0 ? 0 : BUBBLE_RADIUS;
    return {
      x: this.gridOffsetX + col * BUBBLE_RADIUS * 2 + offset,
      y: this.gridOffsetY + row * BUBBLE_RADIUS * 1.7,
    };
  }

  private pixelToGrid(px: number, py: number): { row: number; col: number } {
    const row = Math.round((py - this.gridOffsetY) / (BUBBLE_RADIUS * 1.7));
    const offset = row % 2 === 0 ? 0 : BUBBLE_RADIUS;
    const col = Math.round((px - this.gridOffsetX - offset) / (BUBBLE_RADIUS * 2));
    return { row: Math.max(0, row), col: Math.max(0, col) };
  }

  private drawAim(tx: number, ty: number): void {
    this.aimLine.clear();
    this.aimLine.lineStyle(1, 0xffffff, 0.3);
    this.aimLine.moveTo(this.shooterX, this.shooterY);
    this.aimLine.lineTo(tx, Math.min(ty, this.shooterY - 20));
    this.aimLine.strokePath();
  }

  private async shoot(tx: number, ty: number): Promise<void> {
    this.isShooting = true;
    this.aimLine.clear();

    const angle = Math.atan2(ty - this.shooterY, tx - this.shooterX);
    const speed = 600;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const bullet = this.add.circle(this.shooterX, this.shooterY, BUBBLE_RADIUS - 1, this.shooterColor).setDepth(8);
    let bx = this.shooterX;
    let by = this.shooterY;
    const { width } = this.scale;

    this.recordEvent('shoot', { angle, color: this.shooterColor });

    // Simulate movement
    const dt = 1 / 60;
    let bulletVx = vx;
    let bulletVy = vy;
    let landed = false;

    for (let step = 0; step < 300 && !landed; step++) {
      bx += bulletVx * dt;
      by += bulletVy * dt;

      // Wall bounce
      if (bx < BUBBLE_RADIUS || bx > width - BUBBLE_RADIUS) {
        bulletVx *= -1;
        bx = this.clamp(bx, BUBBLE_RADIUS, width - BUBBLE_RADIUS);
      }

      // Top wall
      if (by <= this.gridOffsetY) {
        by = this.gridOffsetY;
        landed = true;
      }

      // Check collision with grid bubbles
      for (const row of this.grid) {
        for (const b of row) {
          if (!b) continue;
          const dist = Math.sqrt((bx - b.sprite.x) ** 2 + (by - b.sprite.y) ** 2);
          if (dist < BUBBLE_RADIUS * 2) {
            landed = true;
            break;
          }
        }
        if (landed) break;
      }

      bullet.x = bx;
      bullet.y = by;

      if (step % 3 === 0) {
        await new Promise<void>(resolve => this.time.delayedCall(16, resolve));
      }
    }

    // Place in grid
    const { row, col } = this.pixelToGrid(bx, by);
    if (row >= 0 && row < 20) {
      if (!this.grid[row]) this.grid[row] = [];
      const maxCol = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      const safeCol = this.clamp(col, 0, maxCol - 1);
      const pos = this.gridToPixel(row, safeCol);
      bullet.x = pos.x;
      bullet.y = pos.y;

      this.grid[row][safeCol] = { row, col: safeCol, color: this.shooterColor, sprite: bullet };

      // Check matches
      const matches = this.findMatches(row, safeCol, this.shooterColor);
      if (matches.length >= 3) {
        for (const m of matches) {
          m.sprite.destroy();
          this.grid[m.row][m.col] = null;
        }
        this.addScore(matches.length);
        this.recordEvent('pop', { count: matches.length, score: this.score });

        // Remove orphans
        const orphans = this.findOrphans();
        for (const o of orphans) {
          o.sprite.destroy();
          this.grid[o.row][o.col] = null;
        }
        if (orphans.length > 0) {
          this.addScore(orphans.length);
          this.recordEvent('orphans_fell', { count: orphans.length, score: this.score });
        }
      }
    } else {
      bullet.destroy();
    }

    // Next shooter
    this.shooterColor = COLORS[this.rngBetween(0, COLORS.length - 1)];
    this.shooterBubble.destroy();
    this.shooterBubble = this.add.circle(this.shooterX, this.shooterY, BUBBLE_RADIUS, this.shooterColor).setDepth(10);
    this.isShooting = false;
  }

  private findMatches(row: number, col: number, color: number): GridBubble[] {
    const visited = new Set<string>();
    const matches: GridBubble[] = [];
    const queue: { r: number; c: number }[] = [{ r: row, c: col }];

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const b = this.grid[r]?.[c];
      if (!b || b.color !== color) continue;
      matches.push(b);

      // Get hex neighbors
      const neighbors = this.getNeighbors(r, c);
      for (const n of neighbors) queue.push(n);
    }

    return matches;
  }

  private getNeighbors(row: number, col: number): { r: number; c: number }[] {
    const even = row % 2 === 0;
    const offsets = even
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    return offsets.map(([dr, dc]) => ({ r: row + dr, c: col + dc }));
  }

  private findOrphans(): GridBubble[] {
    const connected = new Set<string>();
    const queue: { r: number; c: number }[] = [];

    // Start from top row
    if (this.grid[0]) {
      for (let c = 0; c < this.grid[0].length; c++) {
        if (this.grid[0][c]) queue.push({ r: 0, c });
      }
    }

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      const key = `${r},${c}`;
      if (connected.has(key)) continue;
      if (!this.grid[r]?.[c]) continue;
      connected.add(key);
      for (const n of this.getNeighbors(r, c)) queue.push(n);
    }

    const orphans: GridBubble[] = [];
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        const b = this.grid[r][c];
        if (b && !connected.has(`${r},${c}`)) orphans.push(b);
      }
    }
    return orphans;
  }

  private async onTimeUp(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.recordEvent('time_up', { score: this.score });
    await new Promise<void>(resolve => this.time.delayedCall(300, resolve));
    await this.endGame();
  }
}
