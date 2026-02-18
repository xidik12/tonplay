import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';
import { BlockManager } from './entities/BlockManager';

/**
 * Tower Stack -- a precision-stacking arcade game.
 *
 * A block swings left and right across the screen. The player taps to
 * drop/place it on top of the tower. If the block overhangs past the
 * previous block, the overhang is sliced off and falls away. The
 * remaining aligned portion becomes the new platform width for the
 * next block. Speed ramps up as blocks stack higher.
 *
 * Game over when a block completely misses (zero overlap with the
 * block below). Score = number of blocks successfully placed.
 *
 * All gameplay-relevant events are recorded via `recordEvent()` so the
 * server can deterministically replay the session for anti-cheat verification.
 */
export class TowerStackScene extends BaseGame {
  // ── Game entities ─────────────────────────────────────────────────────
  private blockManager!: BlockManager;

  // ── Background visuals ────────────────────────────────────────────────
  private bgGradient!: Phaser.GameObjects.Rectangle;
  private gridLines: Phaser.GameObjects.Line[] = [];

  // ── Camera tracking ───────────────────────────────────────────────────
  /** The Y position where the next block should be placed */
  private currentBlockY: number = 0;

  /** The Y position the foundation was placed at */
  private foundationY: number = 0;

  /** Camera offset that smoothly tracks upward as the tower grows */
  private cameraOffsetY: number = 0;

  /** Target camera offset (we lerp toward this for smooth panning) */
  private targetCameraOffsetY: number = 0;

  /** Container that holds all gameplay objects and moves with the camera */
  private gameContainer!: Phaser.GameObjects.Container;

  // ── State flags ───────────────────────────────────────────────────────
  private isWaitingToStart: boolean = true;

  /** Whether a block is currently active and swinging */
  private hasActiveBlock: boolean = false;

  // ── Score display ─────────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;

  // ── Visual helpers ────────────────────────────────────────────────────
  /** Particle emitter for perfect placement sparkles */
  private sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor() {
    super({ key: 'TowerStackScene' });
  }

  // ── BaseGame abstract implementations ─────────────────────────────────

  getGameSlug(): GameSlug {
    return 'tower-stack';
  }

  calculateMultiplier(): number {
    if (this.score >= 80) return 10.0;
    if (this.score >= 60) return 5.0;
    if (this.score >= 40) return 3.0;
    if (this.score >= 25) return 2.0;
    if (this.score >= 15) return 1.5;
    if (this.score >= 10) return 1.0;
    if (this.score >= 5) return 0.5;
    return 0;
  }

  // ── Phaser lifecycle ──────────────────────────────────────────────────

  preload(): void {
    this.createProceduralAssets();
  }

  create(): void {
    const { width, height } = this.scale;

    // ── Background ─────────────────────────────────────────────────────
    this.createBackground(width, height);

    // ── Game container (moves with camera offset) ──────────────────────
    this.gameContainer = this.add.container(0, 0);
    this.gameContainer.setDepth(5);

    // ── Block manager ──────────────────────────────────────────────────
    this.blockManager = new BlockManager(this);

    // ── Score display ──────────────────────────────────────────────────
    this.scoreText = this.add.text(width / 2, 60, '0', {
      fontSize: '48px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    });
    this.scoreText.setOrigin(0.5, 0.5);
    this.scoreText.setDepth(100);
    this.scoreText.setAlpha(0.8);

    // Combo text (shows "PERFECT!" feedback)
    this.comboText = this.add.text(width / 2, 120, '', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffdd00',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    });
    this.comboText.setOrigin(0.5, 0.5);
    this.comboText.setDepth(100);
    this.comboText.setAlpha(0);

    // ── Input ──────────────────────────────────────────────────────────
    this.input.on('pointerdown', () => this.handleTap());
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.handleTap());
    }

    // ── Particle system for perfect placements ─────────────────────────
    this.createSparkleEmitter();

    // ── Reset camera state ─────────────────────────────────────────────
    this.cameraOffsetY = 0;
    this.targetCameraOffsetY = 0;

    // ── Ready state ────────────────────────────────────────────────────
    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    const { width, height } = this.scale;

    // Reset all state
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.hasActiveBlock = false;
    this.replayEvents = [];
    this.startTime = Date.now();

    // Reset camera
    this.cameraOffsetY = 0;
    this.targetCameraOffsetY = 0;
    this.gameContainer.y = 0;

    // Clear any leftover blocks
    this.blockManager.clear();

    // Update score display
    this.scoreText.setText('0');

    // Place the foundation block near the bottom of the screen
    this.foundationY = height - 100;
    this.currentBlockY = this.foundationY;
    const foundation = this.blockManager.spawnFoundation(width / 2, this.foundationY);
    this.gameContainer.add([foundation.rect, foundation.highlight]);

    // Spawn the first swinging block
    this.spawnNextBlock();

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {
      width,
      height,
      foundationY: this.foundationY,
    });
  }

  update(time: number, delta: number): void {
    // Let BaseGame increment the frame counter
    super.update(time, delta);

    // Don't simulate before start or after game over
    if (this.isWaitingToStart || this.isGameOver || !this.startTime) return;

    const dt = delta / 1000;

    // ── Update active block swing ──────────────────────────────────────
    this.blockManager.update(dt, this.scale.width);

    // ── Smooth camera panning ──────────────────────────────────────────
    this.updateCamera(dt);
  }

  // ── Game actions ────────────────────────────────────────────────────────

  /**
   * Handle player tap: place the active block on the tower.
   */
  private handleTap(): void {
    if (this.isGameOver || this.isWaitingToStart || !this.hasActiveBlock) return;

    const activeBlock = this.blockManager.getActiveBlock();
    if (!activeBlock) return;

    this.recordEvent('tap', {
      blockId: activeBlock.id,
      blockX: Math.round(activeBlock.x),
      blockWidth: Math.round(activeBlock.width),
    });

    // Attempt to place the block
    const result = this.blockManager.placeActiveBlock();
    if (!result) return;

    if (!result.success) {
      // Complete miss -- game over
      this.recordEvent('miss', {
        blockId: activeBlock.id,
        blockX: Math.round(activeBlock.x),
      });
      this.onGameOver();
      return;
    }

    // Successful placement
    this.addScore(1);
    this.scoreText.setText(String(this.score));

    this.recordEvent('place', {
      blockId: activeBlock.id,
      perfect: result.perfect,
      overlapWidth: Math.round(result.overlapWidth),
      overhangWidth: Math.round(result.overhangWidth),
      overhangSide: result.overhangSide,
      score: this.score,
    });

    // Visual feedback for perfect placement
    if (result.perfect) {
      this.onPerfectPlacement();
    } else {
      // Brief camera shake for regular placement
      this.cameras.main.shake(80, 0.005);
    }

    // Spawn the next block
    this.spawnNextBlock();
  }

  /**
   * Spawn the next swinging block above the tower.
   */
  private spawnNextBlock(): void {
    const { width } = this.scale;

    // Move the Y position up by one block height
    this.currentBlockY -= this.blockManager.BLOCK_HEIGHT;

    const block = this.blockManager.spawnNextBlock(this.currentBlockY, width);
    if (!block) return;

    // Add the new block's graphics to the game container
    this.gameContainer.add([block.rect, block.highlight]);

    this.hasActiveBlock = true;

    // Update camera target to keep the action visible
    // We want the active block area to stay roughly in the upper-middle of the screen
    const blockScreenY = this.currentBlockY + this.cameraOffsetY;
    const targetScreenY = this.scale.height * 0.35;

    if (blockScreenY < targetScreenY) {
      this.targetCameraOffsetY += targetScreenY - blockScreenY;
    }

    this.recordEvent('block_spawn', {
      blockId: block.id,
      y: Math.round(this.currentBlockY),
      swingSpeed: Math.round(this.blockManager.getCurrentSwingSpeed()),
    });
  }

  /**
   * Smoothly pan the camera upward as the tower grows.
   */
  private updateCamera(dt: number): void {
    // Lerp the camera offset toward the target
    const lerpSpeed = 4.0;
    const diff = this.targetCameraOffsetY - this.cameraOffsetY;

    if (Math.abs(diff) > 0.5) {
      this.cameraOffsetY += diff * lerpSpeed * dt;
    } else {
      this.cameraOffsetY = this.targetCameraOffsetY;
    }

    // Apply the offset to the game container
    this.gameContainer.y = this.cameraOffsetY;
  }

  /**
   * Visual and audio feedback for a perfect placement.
   */
  private onPerfectPlacement(): void {
    const streak = this.blockManager.perfectStreak;
    const topBlock = this.blockManager.getTopBlock();

    // Show combo text
    let comboMessage = 'PERFECT!';
    if (streak >= 5) {
      comboMessage = `PERFECT x${streak}!`;
    } else if (streak >= 3) {
      comboMessage = `PERFECT x${streak}!`;
    }

    this.comboText.setText(comboMessage);
    this.comboText.setAlpha(1);
    this.comboText.setScale(0.5);

    this.tweens.add({
      targets: this.comboText,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      y: this.comboText.y - 20,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.comboText.y = 120;
        this.comboText.setScale(1);
      },
    });

    // Sparkle particles at the placement location
    if (this.sparkleEmitter && topBlock) {
      const worldY = topBlock.y + this.cameraOffsetY;
      this.sparkleEmitter.setPosition(topBlock.x, worldY);
      this.sparkleEmitter.explode(12, topBlock.x, worldY);
    }

    // Scale pulse on score text
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    this.recordEvent('perfect_streak', { streak });
  }

  /**
   * Handle game over: block completely missed the tower.
   */
  private async onGameOver(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.hasActiveBlock = false;

    this.recordEvent('game_over', {
      score: this.score,
      multiplier: this.calculateMultiplier(),
    });

    // ── Death effects ──────────────────────────────────────────────────

    // Screen shake
    this.cameras.main.shake(300, 0.03);

    // Red flash
    this.cameras.main.flash(250, 255, 50, 50, false);

    // Animate tower blocks falling apart (top blocks tumble)
    this.animateTowerCollapse();

    // Brief delay before sending result
    await this.delay(600);

    // Compute result and emit to React layer
    await this.endGame();
  }

  /**
   * Animate the top portion of the tower collapsing after game over.
   * Only animates the top ~5 blocks for visual effect.
   */
  private animateTowerCollapse(): void {
    const tower = this.blockManager.getTower();
    const collapseCount = Math.min(5, tower.length - 1); // Don't collapse foundation

    for (let i = 0; i < collapseCount; i++) {
      const block = tower[tower.length - 1 - i];
      const delay = i * 80;
      const direction = i % 2 === 0 ? 1 : -1;

      this.tweens.add({
        targets: [block.rect, block.highlight],
        x: block.x + direction * Phaser.Math.Between(60, 150),
        y: block.y + 300 + i * 40,
        angle: direction * Phaser.Math.Between(15, 45),
        alpha: 0,
        delay,
        duration: 600,
        ease: 'Quad.easeIn',
      });
    }
  }

  // ── Background creation ─────────────────────────────────────────────────

  /**
   * Create the dark gradient background with subtle grid lines.
   */
  private createBackground(width: number, height: number): void {
    // Dark gradient background -- use two overlapping rectangles
    // Bottom: slightly lighter dark blue
    const bgBottom = this.add.rectangle(width / 2, height, width, height, 0x0a0a1e);
    bgBottom.setOrigin(0.5, 1);
    bgBottom.setDepth(0);

    // Top: darker tone
    const bgTop = this.add.rectangle(width / 2, 0, width, height / 2, 0x050510);
    bgTop.setOrigin(0.5, 0);
    bgTop.setDepth(0);
    bgTop.setAlpha(0.8);

    this.bgGradient = bgBottom;

    // Subtle vertical grid lines
    const gridColor = 0x1a1a3a;
    const gridAlpha = 0.3;
    const gridSpacing = 40;

    for (let x = 0; x <= width; x += gridSpacing) {
      const line = this.add.line(0, 0, x, 0, x, height, gridColor);
      line.setOrigin(0, 0);
      line.setDepth(1);
      line.setAlpha(gridAlpha);
      this.gridLines.push(line);
    }

    // Subtle horizontal grid lines
    for (let y = 0; y <= height; y += gridSpacing) {
      const line = this.add.line(0, 0, 0, y, width, y, gridColor);
      line.setOrigin(0, 0);
      line.setDepth(1);
      line.setAlpha(gridAlpha * 0.5);
      this.gridLines.push(line);
    }

    // Scatter a few dim stars for depth
    for (let i = 0; i < 30; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, height);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.4);
      const size = Phaser.Math.FloatBetween(0.5, 1.5);
      const star = this.add.circle(sx, sy, size, 0xffffff, alpha);
      star.setDepth(2);
    }
  }

  // ── Procedural asset generation ─────────────────────────────────────────

  /**
   * Generate all procedural textures needed by the game.
   */
  private createProceduralAssets(): void {
    // Sparkle particle texture (small white circle)
    if (!this.textures.exists('sparkle-particle')) {
      const sp = this.make.graphics({ x: 0, y: 0 }, false);
      sp.fillStyle(0xffffff, 1);
      sp.fillCircle(4, 4, 4);
      sp.generateTexture('sparkle-particle', 8, 8);
      sp.destroy();
    }
  }

  /**
   * Create the sparkle particle emitter for perfect placements.
   */
  private createSparkleEmitter(): void {
    if (!this.textures.exists('sparkle-particle')) return;

    this.sparkleEmitter = this.add.particles(0, 0, 'sparkle-particle', {
      speed: { min: 80, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.0, end: 0 },
      lifespan: { min: 300, max: 600 },
      alpha: { start: 1, end: 0 },
      tint: [0xffdd00, 0xffffff, 0xff8800, 0x00ffaa],
      quantity: 12,
      emitting: false,
    });
    this.sparkleEmitter.setDepth(50);
  }

  // ── Utility ─────────────────────────────────────────────────────────────

  /** Promise-based delay helper for sequencing post-death effects. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }
}
