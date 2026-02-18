import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

interface Enemy {
  sprite: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  points: number;
  speed: number;
  type: string;
}

interface Bullet {
  sprite: Phaser.GameObjects.Rectangle;
  speed: number;
}

export class PixelBlasterScene extends BaseGame {
  private ship!: Phaser.GameObjects.Container;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private shootTimer: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 1200;
  private wave: number = 1;
  private waveTimer: number = 0;
  private isWaitingToStart: boolean = true;
  private isDragging: boolean = false;
  private timerText!: Phaser.GameObjects.Text;
  private timeLeft: number = 60;

  constructor() {
    super({ key: 'PixelBlasterScene' });
  }

  getGameSlug(): GameSlug {
    return 'pixel-blaster';
  }

  calculateMultiplier(): number {
    if (this.score >= 900) return 10.0;
    if (this.score >= 700) return 5.0;
    if (this.score >= 400) return 3.0;
    if (this.score >= 200) return 2.0;
    if (this.score >= 100) return 1.5;
    if (this.score >= 50) return 1.0;
    if (this.score >= 20) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#050510');

    // Star background
    const starGfx = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, height);
      starGfx.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 0.6));
      starGfx.fillCircle(sx, sy, Phaser.Math.FloatBetween(0.5, 1.5));
    }

    // Ship
    const shipBody = this.add.rectangle(0, 0, 30, 30, 0x00aaff);
    const shipNose = this.add.triangle(0, -20, -10, 5, 10, 5, 0, -10, 0x0088dd);
    const leftWing = this.add.triangle(-18, 5, 0, -8, 8, 8, 0, 8, 0x0066bb);
    const rightWing = this.add.triangle(18, 5, 0, -8, -8, 8, 0, 8, 0x0066bb);
    this.ship = this.add.container(width / 2, height - 80, [shipBody, shipNose, leftWing, rightWing]);
    this.ship.setDepth(10);

    // Timer display
    this.timerText = this.add.text(width - 10, 10, '60s', {
      fontSize: '16px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(1, 0).setDepth(20);

    // Touch/drag input
    this.input.on('pointerdown', () => { this.isDragging = true; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || this.isWaitingToStart || this.isGameOver) return;
      this.ship.x = this.clamp(pointer.x, 20, width - 20);
    });
    this.input.on('pointerup', () => { this.isDragging = false; });

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    const { width } = this.scale;
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.replayEvents = [];
    this.startTime = Date.now();
    this.shootTimer = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1200;
    this.wave = 1;
    this.waveTimer = 0;
    this.timeLeft = 60;

    // Clear existing
    this.enemies.forEach(e => e.sprite.destroy());
    this.bullets.forEach(b => b.sprite.destroy());
    this.enemies = [];
    this.bullets = [];

    this.ship.x = width / 2;

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', { wave: this.wave });
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

    // Wave progression
    this.waveTimer += delta;
    if (this.waveTimer >= 10000) {
      this.waveTimer = 0;
      this.wave++;
      this.spawnInterval = Math.max(400, this.spawnInterval - 100);
      this.recordEvent('wave_up', { wave: this.wave });
    }

    // Shoot
    this.shootTimer += delta;
    if (this.shootTimer >= 200) {
      this.shootTimer = 0;
      this.fireBullet();
    }

    // Spawn enemies
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.sprite.y -= b.speed * dt;
      if (b.sprite.y < -10) {
        b.sprite.destroy();
        this.bullets.splice(i, 1);
      }
    }

    // Update enemies
    const { height } = this.scale;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.sprite.y += e.speed * dt;

      // Hit bottom
      if (e.sprite.y > height + 20) {
        this.onGameEnd();
        return;
      }

      // Hit ship
      const dx = Math.abs(e.sprite.x - this.ship.x);
      const dy = Math.abs(e.sprite.y - this.ship.y);
      if (dx < 25 && dy < 25) {
        this.onGameEnd();
        return;
      }

      // Bullet collision
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        const bx = Math.abs(b.sprite.x - e.sprite.x);
        const by = Math.abs(b.sprite.y - e.sprite.y);
        if (bx < 15 && by < 15) {
          e.hp--;
          b.sprite.destroy();
          this.bullets.splice(j, 1);

          if (e.hp <= 0) {
            this.addScore(e.points);
            this.recordEvent('enemy_destroyed', { type: e.type, points: e.points, score: this.score });
            e.sprite.destroy();
            this.enemies.splice(i, 1);
          }
          break;
        }
      }
    }
  }

  private fireBullet(): void {
    const bullet = this.add.rectangle(this.ship.x, this.ship.y - 20, 4, 12, 0xffff00);
    bullet.setDepth(5);
    this.bullets.push({ sprite: bullet, speed: 500 });
  }

  private spawnEnemy(): void {
    const { width } = this.scale;
    const x = this.rngBetween(30, width - 30);
    const roll = this.rng();
    let type: string, hp: number, points: number, speed: number, size: number, color: number;

    if (roll < 0.05 && this.wave >= 3) {
      type = 'boss'; hp = 5; points = 10; speed = 40; size = 28; color = 0xff0000;
    } else if (roll < 0.2) {
      type = 'large'; hp = 3; points = 5; speed = 60; size = 22; color = 0xff6600;
    } else if (roll < 0.5) {
      type = 'medium'; hp = 2; points = 3; speed = 80 + this.wave * 5; size = 16; color = 0xcc44ff;
    } else {
      type = 'small'; hp = 1; points = 1; speed = 100 + this.wave * 8; size = 10; color = 0x44ff44;
    }

    const sprite = this.add.rectangle(x, -20, size, size, color);
    sprite.setDepth(8);
    this.enemies.push({ sprite, hp, maxHp: hp, points, speed, type });
    this.recordEvent('enemy_spawn', { type, x });
  }

  private async onGameEnd(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.recordEvent('game_end', { score: this.score, wave: this.wave });
    this.cameras.main.shake(200, 0.02);
    this.cameras.main.flash(150, 255, 50, 50, false);
    await new Promise<void>(resolve => this.time.delayedCall(300, resolve));
    await this.endGame();
  }
}
