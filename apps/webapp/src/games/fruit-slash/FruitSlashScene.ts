import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

interface Fruit {
  sprite: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  points: number;
  type: string;
  isBomb: boolean;
  sliced: boolean;
  radius: number;
}

export class FruitSlashScene extends BaseGame {
  private fruits: Fruit[] = [];
  private slashTrail: Phaser.GameObjects.Graphics | null = null;
  private slashPoints: { x: number; y: number }[] = [];
  private spawnTimer: number = 0;
  private spawnInterval: number = 800;
  private isWaitingToStart: boolean = true;
  private timerText!: Phaser.GameObjects.Text;
  private timeLeft: number = 60;
  private combo: number = 0;
  private comboText!: Phaser.GameObjects.Text;
  private isSwiping: boolean = false;
  private gravity: number = 350;

  constructor() {
    super({ key: 'FruitSlashScene' });
  }

  getGameSlug(): GameSlug {
    return 'fruit-slash';
  }

  calculateMultiplier(): number {
    if (this.score >= 380) return 10.0;
    if (this.score >= 300) return 5.0;
    if (this.score >= 200) return 3.0;
    if (this.score >= 100) return 2.0;
    if (this.score >= 50) return 1.5;
    if (this.score >= 25) return 1.0;
    if (this.score >= 10) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1a0a2e');

    // Timer
    this.timerText = this.add.text(width - 10, 10, '60s', {
      fontSize: '16px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(1, 0).setDepth(20);

    // Combo text
    this.comboText = this.add.text(width / 2, 60, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffdd00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    // Slash trail
    this.slashTrail = this.add.graphics().setDepth(15);

    // Input
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isWaitingToStart || this.isGameOver) return;
      this.isSwiping = true;
      this.slashPoints = [{ x: pointer.x, y: pointer.y }];
      this.combo = 0;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwiping || this.isWaitingToStart || this.isGameOver) return;
      this.slashPoints.push({ x: pointer.x, y: pointer.y });
      if (this.slashPoints.length > 20) this.slashPoints.shift();
      this.drawSlashTrail();
      this.checkSlashHits(pointer.x, pointer.y);
    });

    this.input.on('pointerup', () => {
      this.isSwiping = false;
      this.slashPoints = [];
      if (this.slashTrail) this.slashTrail.clear();
      if (this.combo >= 3) {
        const bonus = this.combo * 2;
        this.addScore(bonus);
        this.recordEvent('combo_bonus', { combo: this.combo, bonus });
        this.showCombo(this.combo);
      }
      this.combo = 0;
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
    this.spawnTimer = 0;
    this.spawnInterval = 800;
    this.timeLeft = 60;
    this.combo = 0;

    this.fruits.forEach(f => f.sprite.destroy());
    this.fruits = [];

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {});
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.isWaitingToStart || this.isGameOver || !this.startTime) return;

    const dt = delta / 1000;

    // Timer
    this.timeLeft -= dt;
    this.timerText.setText(`${Math.max(0, Math.ceil(this.timeLeft))}s`);
    if (this.timeLeft <= 0) {
      this.onGameEnd();
      return;
    }

    // Spawn
    this.spawnTimer += delta;
    const adjustedInterval = Math.max(400, this.spawnInterval - (60 - this.timeLeft) * 5);
    if (this.spawnTimer >= adjustedInterval) {
      this.spawnTimer = 0;
      this.spawnFruit();
    }

    // Update fruits
    const { height } = this.scale;
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.sprite.x += f.vx * dt;
      f.vy += this.gravity * dt;
      f.sprite.y += f.vy * dt;

      if (f.sprite.y > height + 50) {
        f.sprite.destroy();
        this.fruits.splice(i, 1);
      }
    }
  }

  private spawnFruit(): void {
    const { width, height } = this.scale;
    const x = this.rngBetween(40, width - 40);
    const isBomb = this.rng() < 0.08 + (60 - this.timeLeft) * 0.002;

    let type: string, color: number, points: number, radius: number;
    if (isBomb) {
      type = 'bomb'; color = 0x333333; points = 0; radius = 18;
    } else {
      const roll = this.rng();
      if (roll < 0.1) {
        type = 'pineapple'; color = 0xffdd00; points = 3; radius = 20;
      } else if (roll < 0.3) {
        type = 'watermelon'; color = 0xff3333; points = 2; radius = 22;
      } else if (roll < 0.6) {
        type = 'orange'; color = 0xff8800; points = 1; radius = 16;
      } else {
        type = 'apple'; color = 0x44dd44; points = 1; radius = 16;
      }
    }

    const sprite = this.add.circle(x, height + 20, radius, color);
    sprite.setDepth(10);
    if (isBomb) {
      // Draw X on bomb
      const g = this.add.graphics().setDepth(11);
      g.lineStyle(2, 0xff0000);
      g.moveTo(x - 8, height + 12); g.lineTo(x + 8, height + 28);
      g.moveTo(x + 8, height + 12); g.lineTo(x - 8, height + 28);
      g.strokePath();
      // Attach graphics to sprite for cleanup
      (sprite as any)._bombGfx = g;
    }

    const vx = this.rngBetween(-80, 80);
    const vy = this.rngBetween(-550, -400);

    this.fruits.push({ sprite, vx, vy, points, type, isBomb, sliced: false, radius });
    this.recordEvent('fruit_spawn', { type, x, isBomb });
  }

  private checkSlashHits(px: number, py: number): void {
    for (const f of this.fruits) {
      if (f.sliced) continue;
      const dx = f.sprite.x - px;
      const dy = f.sprite.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < f.radius + 10) {
        f.sliced = true;

        if (f.isBomb) {
          this.recordEvent('bomb_hit', { score: this.score });
          this.onBombHit();
          return;
        }

        this.addScore(f.points);
        this.combo++;
        this.recordEvent('fruit_sliced', { type: f.type, points: f.points, combo: this.combo, score: this.score });

        // Split effect
        const leftHalf = this.add.circle(f.sprite.x - 5, f.sprite.y, f.radius * 0.8, (f.sprite as any).fillColor, 0.8);
        const rightHalf = this.add.circle(f.sprite.x + 5, f.sprite.y, f.radius * 0.8, (f.sprite as any).fillColor, 0.8);
        leftHalf.setDepth(9); rightHalf.setDepth(9);

        this.tweens.add({ targets: leftHalf, x: leftHalf.x - 30, y: leftHalf.y + 80, alpha: 0, duration: 400, onComplete: () => leftHalf.destroy() });
        this.tweens.add({ targets: rightHalf, x: rightHalf.x + 30, y: rightHalf.y + 80, alpha: 0, duration: 400, onComplete: () => rightHalf.destroy() });

        // Remove bomb gfx if any
        if ((f.sprite as any)._bombGfx) (f.sprite as any)._bombGfx.destroy();
        f.sprite.destroy();
      }
    }
  }

  private drawSlashTrail(): void {
    if (!this.slashTrail || this.slashPoints.length < 2) return;
    this.slashTrail.clear();
    this.slashTrail.lineStyle(3, 0xffffff, 0.8);
    this.slashTrail.beginPath();
    this.slashTrail.moveTo(this.slashPoints[0].x, this.slashPoints[0].y);
    for (let i = 1; i < this.slashPoints.length; i++) {
      this.slashTrail.lineTo(this.slashPoints[i].x, this.slashPoints[i].y);
    }
    this.slashTrail.strokePath();
  }

  private showCombo(combo: number): void {
    this.comboText.setText(`${combo}x COMBO!`);
    this.comboText.setAlpha(1);
    this.tweens.add({ targets: this.comboText, alpha: 0, y: 40, duration: 800, onComplete: () => { this.comboText.y = 60; } });
  }

  private async onBombHit(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.cameras.main.shake(300, 0.03);
    this.cameras.main.flash(200, 255, 100, 0, false);
    await new Promise<void>(resolve => this.time.delayedCall(400, resolve));
    await this.endGame();
  }

  private async onGameEnd(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.recordEvent('time_up', { score: this.score });
    await new Promise<void>(resolve => this.time.delayedCall(300, resolve));
    await this.endGame();
  }
}
