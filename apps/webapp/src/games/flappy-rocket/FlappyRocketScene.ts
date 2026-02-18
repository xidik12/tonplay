import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';
import { Rocket } from './entities/Rocket';
import { ObstacleManager } from './entities/ObstacleManager';

/**
 * Flappy Rocket — a space-themed Flappy Bird clone.
 *
 * The player taps / clicks / presses Space to thrust a rocket upward
 * against gravity. Pairs of asteroid columns scroll from right to left
 * with a gap between them. Each gap cleared scores +1.
 *
 * Difficulty ramps every 5 points: scroll speed increases and the gap narrows.
 *
 * All gameplay-relevant events are recorded via `recordEvent()` so the
 * server can deterministically replay the session for anti-cheat verification.
 */
export class FlappyRocketScene extends BaseGame {
  // ── Game entities ─────────────────────────────────────────────────────────
  private rocket!: Rocket;
  private obstacles!: ObstacleManager;

  // ── Parallax background layers ────────────────────────────────────────────
  private starFieldFar!: Phaser.GameObjects.TileSprite;
  private starFieldNear!: Phaser.GameObjects.TileSprite;
  private nebulaLayer!: Phaser.GameObjects.TileSprite;

  // ── Difficulty parameters ─────────────────────────────────────────────────
  private scrollSpeed: number = 200;
  private gapSize: number = 160;
  private spawnTimer: number = 0;
  private spawnInterval: number = 1800; // ms between obstacle pairs

  // ── Constants ─────────────────────────────────────────────────────────────
  private readonly INITIAL_SCROLL_SPEED = 200;
  private readonly MAX_SCROLL_SPEED = 350;
  private readonly SCROLL_SPEED_INCREMENT = 15;
  private readonly INITIAL_GAP_SIZE = 160;
  private readonly MIN_GAP_SIZE = 100;
  private readonly GAP_SHRINK_AMOUNT = 5;
  private readonly DIFFICULTY_INTERVAL = 5; // score increment per difficulty step
  private readonly GAP_MARGIN = 60; // min distance from screen edge to gap center
  private readonly ROCKET_START_X_FRACTION = 0.22; // fraction of screen width

  // ── State flags ───────────────────────────────────────────────────────────
  private isWaitingToStart: boolean = true;

  constructor() {
    super({ key: 'FlappyRocketScene' });
  }

  // ── BaseGame abstract implementations ─────────────────────────────────────

  getGameSlug(): GameSlug {
    return 'flappy-rocket';
  }

  calculateMultiplier(): number {
    // Payout tiers based on number of gaps cleared.
    // Designed so that clearing fewer than 3 gaps loses the wager,
    // and reaching 50+ gaps gives the maximum 10x multiplier.
    if (this.score >= 50) return 10.0;
    if (this.score >= 30) return 5.0;
    if (this.score >= 20) return 3.0;
    if (this.score >= 15) return 2.0;
    if (this.score >= 10) return 1.5;
    if (this.score >= 5) return 1.0;
    if (this.score >= 3) return 0.5;
    return 0;
  }

  // ── Phaser lifecycle ──────────────────────────────────────────────────────

  preload(): void {
    this.createPlaceholderAssets();
  }

  create(): void {
    const { width, height } = this.scale;

    // ── Parallax star background ──────────────────────────────────────────
    this.createStarFieldTexture('stars-far', width, height, 80, 0.4);
    this.createStarFieldTexture('stars-near', width, height, 40, 0.9);
    this.createNebulaTexture('nebula-tex', width, height);

    this.starFieldFar = this.add.tileSprite(0, 0, width, height, 'stars-far');
    this.starFieldFar.setOrigin(0, 0);
    this.starFieldFar.setDepth(0);

    this.nebulaLayer = this.add.tileSprite(0, 0, width, height, 'nebula-tex');
    this.nebulaLayer.setOrigin(0, 0);
    this.nebulaLayer.setDepth(1);
    this.nebulaLayer.setAlpha(0.35);

    this.starFieldNear = this.add.tileSprite(0, 0, width, height, 'stars-near');
    this.starFieldNear.setOrigin(0, 0);
    this.starFieldNear.setDepth(2);

    // ── Rocket ────────────────────────────────────────────────────────────
    const rocketX = Math.round(width * this.ROCKET_START_X_FRACTION);
    const rocketY = Math.round(height / 2);
    this.rocket = new Rocket(this, rocketX, rocketY);

    // ── Obstacle manager ──────────────────────────────────────────────────
    this.obstacles = new ObstacleManager(this);

    // ── Input ─────────────────────────────────────────────────────────────
    this.input.on('pointerdown', () => this.handleFlap());
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.handleFlap());
    }

    // ── Ready state ───────────────────────────────────────────────────────
    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    const { width, height } = this.scale;

    // Reset all state
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.replayEvents = [];
    this.startTime = Date.now();

    // Reset difficulty
    this.scrollSpeed = this.INITIAL_SCROLL_SPEED;
    this.gapSize = this.INITIAL_GAP_SIZE;
    this.spawnTimer = 0;

    // Reset rocket position
    const rocketX = Math.round(this.scale.width * this.ROCKET_START_X_FRACTION);
    const rocketY = Math.round(height / 2);
    this.rocket.reset(rocketX, rocketY);

    // Clear leftover obstacles
    this.obstacles.clear();

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {
      width,
      height,
      scrollSpeed: this.scrollSpeed,
      gapSize: this.gapSize,
    });
  }

  update(time: number, delta: number): void {
    // Let BaseGame increment the frame counter
    super.update(time, delta);

    // Always scroll backgrounds (even before game starts, for ambiance)
    const bgSpeed = this.isWaitingToStart || this.isGameOver ? 40 : this.scrollSpeed;
    const dt = delta / 1000;

    this.starFieldFar.tilePositionX += bgSpeed * dt * 0.15;
    this.nebulaLayer.tilePositionX += bgSpeed * dt * 0.35;
    this.starFieldNear.tilePositionX += bgSpeed * dt * 0.55;

    // Don't simulate game physics before start or after game over
    if (this.isWaitingToStart || this.isGameOver || !this.startTime) return;

    // ── Rocket physics ────────────────────────────────────────────────────
    this.rocket.update(dt);

    // ── Obstacle spawning ─────────────────────────────────────────────────
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnObstaclePair();
      this.spawnTimer = 0;
    }

    // ── Obstacle scrolling ────────────────────────────────────────────────
    this.obstacles.updateAll(dt, this.scrollSpeed);

    // ── Score detection ───────────────────────────────────────────────────
    const newlyPassed = this.obstacles.checkPassing(this.rocket.x);
    for (const pairId of newlyPassed) {
      this.score++;
      this.recordEvent('gap_cleared', { pairId, score: this.score });
      this.emitToUI('score:update', { score: this.score });

      // Quick scale-pulse feedback on the rocket
      this.tweens.add({
        targets: this.rocket.sprite,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 80,
        yoyo: true,
        ease: 'Quad.easeOut',
      });

      // Difficulty ramp
      if (this.score % this.DIFFICULTY_INTERVAL === 0) {
        this.scrollSpeed = Math.min(
          this.scrollSpeed + this.SCROLL_SPEED_INCREMENT,
          this.MAX_SCROLL_SPEED,
        );
        this.gapSize = Math.max(
          this.gapSize - this.GAP_SHRINK_AMOUNT,
          this.MIN_GAP_SIZE,
        );
        this.recordEvent('difficulty_up', {
          scrollSpeed: this.scrollSpeed,
          gapSize: this.gapSize,
        });
      }
    }

    // ── Collision detection ───────────────────────────────────────────────
    const rocketBounds = this.rocket.getBounds();
    if (this.obstacles.checkCollision(rocketBounds)) {
      this.onCollision();
      return;
    }

    // ── Bounds check ──────────────────────────────────────────────────────
    if (this.rocket.isOutOfBounds(this.scale.height)) {
      this.onCollision();
    }
  }

  // ── Game actions ──────────────────────────────────────────────────────────

  private handleFlap(): void {
    if (this.isGameOver || this.isWaitingToStart) return;

    const y = this.rocket.thrust();
    this.recordEvent('flap', { y: Math.round(y) });
  }

  private spawnObstaclePair(): void {
    const { height } = this.scale;

    // Randomize gap center within safe vertical bounds
    const minCenter = this.GAP_MARGIN + this.gapSize / 2;
    const maxCenter = height - this.GAP_MARGIN - this.gapSize / 2;
    const gapCenter = this.rngBetween(Math.round(minCenter), Math.round(maxCenter));

    const pairId = this.obstacles.spawnPair(gapCenter, this.gapSize);

    this.recordEvent('obstacle_spawn', {
      pairId,
      gapCenter,
      gapSize: this.gapSize,
    });
  }

  private async onCollision(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;

    this.recordEvent('collision', {
      y: Math.round(this.rocket.y),
      score: this.score,
    });

    // ── Death effects ─────────────────────────────────────────────────────

    // Screen shake
    this.cameras.main.shake(250, 0.025);

    // Red flash
    this.cameras.main.flash(200, 255, 50, 50, false);

    // Freeze the rocket
    this.rocket.stop();

    // Spin the rocket downward for dramatic effect
    this.tweens.add({
      targets: this.rocket.sprite,
      angle: 180,
      alpha: 0.4,
      y: this.rocket.y + 80,
      duration: 600,
      ease: 'Quad.easeIn',
    });

    // Explosion particles at the rocket position
    this.spawnExplosionParticles(this.rocket.x, this.rocket.y);

    // Brief delay before sending result so the player sees the death animation
    await this.delay(400);

    // Compute result and emit to React layer (endGame handles the game:over emit)
    await this.endGame();
  }

  // ── Asset generation ──────────────────────────────────────────────────────

  /**
   * Generate all placeholder textures procedurally.
   * These are simple colored shapes that look crisp and intentional.
   * They can be swapped for real sprite assets later.
   */
  private createPlaceholderAssets(): void {
    // ── Rocket texture (40x36) ────────────────────────────────────────────
    const rg = this.make.graphics({ x: 0, y: 0 }, false);

    // Rocket body (nose-up triangle + rectangular body)
    rg.fillStyle(0xff6b35);
    rg.fillTriangle(20, 0, 4, 14, 36, 14); // nose cone

    rg.fillStyle(0xe05525);
    rg.fillRect(8, 14, 24, 12); // fuselage

    // Side fins
    rg.fillStyle(0xcc4420);
    rg.fillTriangle(4, 14, 0, 26, 10, 26); // left fin
    rg.fillTriangle(36, 14, 40, 26, 30, 26); // right fin

    // Exhaust flame
    rg.fillStyle(0xffaa00);
    rg.fillTriangle(12, 26, 20, 36, 28, 26);

    // Window
    rg.fillStyle(0x88ddff);
    rg.fillCircle(20, 16, 3);

    rg.generateTexture('rocket', 40, 36);
    rg.destroy();

    // ── Thrust particle texture (6x6 soft glow) ──────────────────────────
    const tp = this.make.graphics({ x: 0, y: 0 }, false);
    tp.fillStyle(0xffaa00, 1);
    tp.fillCircle(3, 3, 3);
    tp.generateTexture('thrust-particle', 6, 6);
    tp.destroy();

    // ── Explosion particle texture (4x4) ─────────────────────────────────
    const ep = this.make.graphics({ x: 0, y: 0 }, false);
    ep.fillStyle(0xff6b35, 1);
    ep.fillCircle(2, 2, 2);
    ep.generateTexture('explosion-particle', 4, 4);
    ep.destroy();
  }

  /**
   * Generate a random star field texture for parallax scrolling.
   *
   * @param key        - Texture key
   * @param w          - Width in pixels
   * @param h          - Height in pixels
   * @param starCount  - Number of stars to scatter
   * @param maxAlpha   - Maximum brightness of each star
   */
  private createStarFieldTexture(
    key: string,
    w: number,
    h: number,
    starCount: number,
    maxAlpha: number,
  ): void {
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);

    for (let i = 0; i < starCount; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const alpha = Phaser.Math.FloatBetween(0.2, maxAlpha);
      const size = Phaser.Math.FloatBetween(0.5, 1.5);
      const tint = Phaser.Math.RND.pick([0xffffff, 0xccddff, 0xffeedd, 0xaaccff]);
      gfx.fillStyle(tint, alpha);
      gfx.fillCircle(x, y, size);
    }

    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  /**
   * Generate a subtle nebula cloud texture using semi-transparent blobs.
   */
  private createNebulaTexture(key: string, w: number, h: number): void {
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);
    const colors = [0x6c5ce7, 0x00cec9, 0xe17055, 0x0984e3];

    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const r = Phaser.Math.Between(40, 120);
      const color = Phaser.Math.RND.pick(colors);
      gfx.fillStyle(color, Phaser.Math.FloatBetween(0.03, 0.08));
      gfx.fillCircle(x, y, r);
    }

    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  /** Spawn a burst of particles at the given position for the death explosion. */
  private spawnExplosionParticles(x: number, y: number): void {
    if (!this.textures.exists('explosion-particle')) return;

    const emitter = this.add.particles(x, y, 'explosion-particle', {
      speed: { min: 60, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      lifespan: { min: 300, max: 700 },
      alpha: { start: 1, end: 0 },
      tint: [0xff6b35, 0xffaa00, 0xff4444, 0xffffff],
      quantity: 16,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(16, x, y);

    // Clean up emitter after particles finish
    this.time.delayedCall(800, () => {
      emitter.destroy();
    });
  }

  /** Promise-based delay helper for sequencing post-death effects. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }
}
