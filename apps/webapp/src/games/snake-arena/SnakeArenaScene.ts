import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

const GRID_SIZE = 20;
const MIN_MOVE_INTERVAL = 60;

export class SnakeArenaScene extends BaseGame {
  private snake: { x: number; y: number }[] = [];
  private direction: { x: number; y: number } = { x: 1, y: 0 };
  private nextDirection: { x: number; y: number } = { x: 1, y: 0 };
  private food: { x: number; y: number } = { x: 0, y: 0 };
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private moveTimer: number = 0;
  private moveInterval: number = 150;
  private isWaitingToStart: boolean = true;

  private snakeGraphics!: Phaser.GameObjects.Graphics;
  private foodGraphics!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;

  private swipeStartX: number = 0;
  private swipeStartY: number = 0;

  constructor() {
    super({ key: 'SnakeArenaScene' });
  }

  getGameSlug(): GameSlug {
    return 'snake-arena';
  }

  calculateMultiplier(): number {
    if (this.score >= 250) return 10.0;
    if (this.score >= 150) return 5.0;
    if (this.score >= 80) return 3.0;
    if (this.score >= 40) return 2.0;
    if (this.score >= 20) return 1.5;
    if (this.score >= 10) return 1.0;
    if (this.score >= 5) return 0.5;
    return 0;
  }

  preload(): void {
    // No external assets needed
  }

  create(): void {
    const { width, height } = this.scale;

    // Calculate grid dimensions
    const playAreaSize = Math.min(width - 20, height * 0.7);
    this.cellSize = Math.floor(playAreaSize / GRID_SIZE);
    const gridTotal = this.cellSize * GRID_SIZE;
    this.gridOffsetX = Math.floor((width - gridTotal) / 2);
    this.gridOffsetY = Math.floor((height - gridTotal) / 2);

    // Background
    this.cameras.main.setBackgroundColor('#0a0a1e');

    // Grid
    this.gridGraphics = this.add.graphics();
    this.drawGrid();

    // Snake and food graphics
    this.snakeGraphics = this.add.graphics();
    this.foodGraphics = this.add.graphics();

    // Input: keyboard
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-W', () => this.setDirection(0, -1));
      this.input.keyboard.on('keydown-A', () => this.setDirection(-1, 0));
      this.input.keyboard.on('keydown-S', () => this.setDirection(0, 1));
      this.input.keyboard.on('keydown-D', () => this.setDirection(1, 0));
      this.input.keyboard.on('keydown-UP', () => this.setDirection(0, -1));
      this.input.keyboard.on('keydown-DOWN', () => this.setDirection(0, 1));
      this.input.keyboard.on('keydown-LEFT', () => this.setDirection(-1, 0));
      this.input.keyboard.on('keydown-RIGHT', () => this.setDirection(1, 0));
    }

    // Input: swipe
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.swipeStartX;
      const dy = pointer.y - this.swipeStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 30) return; // Too small

      if (absDx > absDy) {
        this.setDirection(dx > 0 ? 1 : -1, 0);
      } else {
        this.setDirection(0, dy > 0 ? 1 : -1);
      }
    });

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.replayEvents = [];
    this.startTime = Date.now();
    this.moveTimer = 0;
    this.moveInterval = 150;

    // Initialize snake at center
    const cx = Math.floor(GRID_SIZE / 2);
    const cy = Math.floor(GRID_SIZE / 2);
    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };

    this.spawnFood();
    this.drawSnake();
    this.drawFood();

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', { gridSize: GRID_SIZE });
  }

  update(time: number, delta: number): void {
    super.update(time, delta);

    if (this.isWaitingToStart || this.isGameOver || !this.startTime) return;

    this.moveTimer += delta;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;
      this.moveSnake();
    }
  }

  private setDirection(x: number, y: number): void {
    // Prevent 180-degree turns
    if (this.direction.x + x === 0 && this.direction.y + y === 0) return;
    this.nextDirection = { x, y };
  }

  private moveSnake(): void {
    this.direction = { ...this.nextDirection };

    const head = this.snake[0];
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      this.onDeath();
      return;
    }

    // Self collision
    if (this.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      this.onDeath();
      return;
    }

    this.snake.unshift(newHead);

    // Food collision
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score++;
      this.recordEvent('food_eaten', { score: this.score, x: newHead.x, y: newHead.y });
      this.updateScore(this.score);

      // Speed up
      this.moveInterval = Math.max(MIN_MOVE_INTERVAL, this.moveInterval - 2);

      this.spawnFood();
    } else {
      this.snake.pop();
    }

    this.drawSnake();
    this.drawFood();
  }

  private spawnFood(): void {
    const occupied = new Set(this.snake.map(s => `${s.x},${s.y}`));
    const empty: { x: number; y: number }[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!occupied.has(`${x},${y}`)) {
          empty.push({ x, y });
        }
      }
    }
    if (empty.length === 0) {
      this.onDeath(); // Board full = win
      return;
    }
    this.food = empty[this.rngBetween(0, empty.length - 1)];
    this.recordEvent('food_spawn', { x: this.food.x, y: this.food.y });
  }

  private drawGrid(): void {
    const g = this.gridGraphics;
    g.clear();
    g.lineStyle(1, 0x1a1a3e, 0.3);
    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = this.gridOffsetX + i * this.cellSize;
      const y = this.gridOffsetY + i * this.cellSize;
      g.moveTo(x, this.gridOffsetY);
      g.lineTo(x, this.gridOffsetY + GRID_SIZE * this.cellSize);
      g.moveTo(this.gridOffsetX, y);
      g.lineTo(this.gridOffsetX + GRID_SIZE * this.cellSize, y);
    }
    g.strokePath();
  }

  private drawSnake(): void {
    const g = this.snakeGraphics;
    g.clear();
    this.snake.forEach((segment, i) => {
      const px = this.gridOffsetX + segment.x * this.cellSize;
      const py = this.gridOffsetY + segment.y * this.cellSize;
      const pad = 1;
      if (i === 0) {
        g.fillStyle(0x00ff88, 1);
      } else {
        const alpha = 0.9 - (i / this.snake.length) * 0.4;
        g.fillStyle(0x00cc66, alpha);
      }
      g.fillRoundedRect(px + pad, py + pad, this.cellSize - pad * 2, this.cellSize - pad * 2, 3);
    });
  }

  private drawFood(): void {
    const g = this.foodGraphics;
    g.clear();
    const px = this.gridOffsetX + this.food.x * this.cellSize + this.cellSize / 2;
    const py = this.gridOffsetY + this.food.y * this.cellSize + this.cellSize / 2;
    g.fillStyle(0xff4444, 1);
    g.fillCircle(px, py, this.cellSize * 0.35);
    g.fillStyle(0xff8888, 0.6);
    g.fillCircle(px - 2, py - 2, this.cellSize * 0.15);
  }

  private async onDeath(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.recordEvent('death', { score: this.score, length: this.snake.length });

    this.cameras.main.shake(200, 0.02);
    this.cameras.main.flash(150, 255, 50, 50, false);

    await new Promise<void>(resolve => this.time.delayedCall(300, resolve));
    await this.endGame();
  }
}
