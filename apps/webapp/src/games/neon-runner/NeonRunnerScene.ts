import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';
import { Runner } from './entities/Runner';
import { LaneManager } from './entities/LaneManager';
import { PowerUpManager } from './entities/PowerUp';
import type { PowerUpType } from './entities/PowerUp';

/**
 * Neon Runner -- a cyberpunk-themed 3-lane endless runner.
 *
 * The player swipes left/right to switch lanes and swipes up to jump.
 * Obstacles scroll from top to bottom (simulating forward movement in
 * portrait orientation). Orbs can be collected for score, and power-ups
 * grant temporary abilities.
 *
 * Score = orbs collected + distance bonus (1 point per 50px traveled).
 * Speed increases gradually over time.
 *
 * All gameplay-relevant events are recorded via `recordEvent()` so the
 * server can deterministically replay the session for anti-cheat verification.
 */
export class NeonRunnerScene extends BaseGame {
  // -- Game entities --------------------------------------------------------
  private runner!: Runner;
  private laneManager!: LaneManager;
  private powerUpManager!: PowerUpManager;

  // -- Visual layers --------------------------------------------------------
  private gridLines: Phaser.GameObjects.Graphics[] = [];
  private gridScrollOffset: number = 0;
  private laneDividers: Phaser.GameObjects.Rectangle[] = [];
  private bgGlow!: Phaser.GameObjects.Rectangle;

  // -- Lane geometry --------------------------------------------------------
  private lanePositions: number[] = [];
  private laneWidth: number = 0;
  private groundY: number = 0;

  // -- Scrolling & difficulty -----------------------------------------------
  private scrollSpeed: number = 200;
  private distanceTraveled: number = 0;
  private orbsCollected: number = 0;

  // -- Spawn timers ---------------------------------------------------------
  private obstacleTimer: number = 0;
  private orbTimer: number = 0;
  private powerUpTimer: number = 0;

  // -- Input tracking -------------------------------------------------------
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private isSwiping: boolean = false;

  // -- State flags ----------------------------------------------------------
  private isWaitingToStart: boolean = true;

  // -- Score display --------------------------------------------------------
  private scoreText!: Phaser.GameObjects.Text;
  private multiplierText!: Phaser.GameObjects.Text;

  // -- Constants ------------------------------------------------------------
  private readonly INITIAL_SCROLL_SPEED = 200;
  private readonly MAX_SCROLL_SPEED = 550;
  private readonly SPEED_INCREASE_RATE = 3; // px/s per second of play
  private readonly OBSTACLE_SPAWN_INTERVAL = 1200; // ms (initial)
  private readonly MIN_OBSTACLE_INTERVAL = 600; // ms (fastest)
  private readonly ORB_SPAWN_INTERVAL = 800; // ms
  private readonly POWERUP_SPAWN_INTERVAL = 12000; // ms
  private readonly SWIPE_THRESHOLD = 30; // px minimum swipe distance
  private readonly DISTANCE_PER_POINT = 50; // px per 1 distance score point
  private readonly GRID_LINE_SPACING = 60; // px between grid lines
  private readonly RUNNER_Y_FRACTION = 0.78; // runner position from top

  constructor() {
    super({ key: 'NeonRunnerScene' });
  }

  // -- BaseGame abstract implementations ------------------------------------

  getGameSlug(): GameSlug {
    return 'neon-runner';
  }

  calculateMultiplier(): number {
    if (this.score >= 400) return 10.0;
    if (this.score >= 250) return 5.0;
    if (this.score >= 150) return 3.0;
    if (this.score >= 100) return 2.0;
    if (this.score >= 50) return 1.5;
    if (this.score >= 25) return 1.0;
    if (this.score >= 10) return 0.5;
    return 0;
  }

  // -- Phaser lifecycle -----------------------------------------------------

  create(): void {
    const { width, height } = this.scale;

    // -- Compute lane geometry -----------------------------------------------
    this.laneWidth = Math.floor(width / 3);
    this.lanePositions = [
      Math.floor(this.laneWidth * 0.5),
      Math.floor(this.laneWidth * 1.5),
      Math.floor(this.laneWidth * 2.5),
    ];
    this.groundY = Math.floor(height * this.RUNNER_Y_FRACTION);

    // -- Background ----------------------------------------------------------
    this.createBackground(width, height);

    // -- Neon grid floor -----------------------------------------------------
    this.createGridFloor(width, height);

    // -- Lane dividers -------------------------------------------------------
    this.createLaneDividers(width, height);

    // -- Runner entity -------------------------------------------------------
    this.runner = new Runner(this, this.lanePositions, this.groundY);

    // -- Lane manager --------------------------------------------------------
    this.laneManager = new LaneManager(
      this,
      this.lanePositions,
      this.groundY,
      this.laneWidth,
    );

    // -- Power-up manager ----------------------------------------------------
    this.powerUpManager = new PowerUpManager(this, this.lanePositions);

    // -- HUD -----------------------------------------------------------------
    this.createHUD(width);

    // -- Input ---------------------------------------------------------------
    this.setupInput();

    // -- Ready state ---------------------------------------------------------
    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    const { width, height } = this.scale;

    // Reset all state
    this.score = 0;
    this.orbsCollected = 0;
    this.distanceTraveled = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.replayEvents = [];
    this.startTime = Date.now();

    // Reset difficulty
    this.scrollSpeed = this.INITIAL_SCROLL_SPEED;
    this.obstacleTimer = 0;
    this.orbTimer = 0;
    this.powerUpTimer = 0;

    // Reset entities
    this.runner.reset();
    this.laneManager.clear();
    this.powerUpManager.clear();

    // Reset HUD
    this.updateScoreDisplay();

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', {
      width,
      height,
      scrollSpeed: this.scrollSpeed,
      lanes: this.lanePositions,
    });
  }

  update(time: number, delta: number): void {
    // Let BaseGame increment the frame counter
    super.update(time, delta);

    const dt = delta / 1000;

    // Always animate background grid (even before game starts)
    this.updateGridScroll(dt);

    // Don't simulate gameplay before start or after game over
    if (this.isWaitingToStart || this.isGameOver || !this.startTime) return;

    // -- Increase speed over time -------------------------------------------
    this.scrollSpeed = Math.min(
      this.scrollSpeed + this.SPEED_INCREASE_RATE * dt,
      this.MAX_SCROLL_SPEED,
    );

    // -- Effective speed (with slow-mo) -------------------------------------
    const effectiveSpeed = this.scrollSpeed * this.powerUpManager.speedMultiplier;

    // -- Update distance traveled -------------------------------------------
    this.distanceTraveled += effectiveSpeed * dt;

    // -- Runner physics -----------------------------------------------------
    this.runner.update(dt);

    // -- Spawn obstacles ----------------------------------------------------
    this.obstacleTimer += delta;
    const spawnInterval = Math.max(
      this.MIN_OBSTACLE_INTERVAL,
      this.OBSTACLE_SPAWN_INTERVAL - (this.scrollSpeed - this.INITIAL_SCROLL_SPEED) * 1.5,
    );
    if (this.obstacleTimer >= spawnInterval) {
      this.spawnObstacle();
      this.obstacleTimer = 0;
    }

    // -- Spawn orbs ---------------------------------------------------------
    this.orbTimer += delta;
    if (this.orbTimer >= this.ORB_SPAWN_INTERVAL) {
      this.spawnOrbs();
      this.orbTimer = 0;
    }

    // -- Spawn power-ups ----------------------------------------------------
    this.powerUpTimer += delta;
    if (this.powerUpTimer >= this.POWERUP_SPAWN_INTERVAL) {
      this.spawnPowerUp();
      this.powerUpTimer = 0;
    }

    // -- Scroll entities ----------------------------------------------------
    this.laneManager.updateAll(dt, effectiveSpeed);
    this.powerUpManager.updatePickups(dt, effectiveSpeed);
    this.powerUpManager.updateEffects(delta);

    // -- Orb collection -----------------------------------------------------
    const runnerBounds = this.runner.getBounds();
    const collectedOrbs = this.laneManager.checkOrbCollection(runnerBounds);
    for (const orbId of collectedOrbs) {
      this.orbsCollected++;
      this.recordEvent('orb_collected', { orbId, orbs: this.orbsCollected });

      // Flash effect
      this.cameras.main.flash(100, 0, 255, 255, false);

      // Collect sound feedback via scale pulse
      this.tweens.add({
        targets: this.runner.sprite,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 60,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }

    // -- Power-up collection ------------------------------------------------
    const collectedPowerUps = this.powerUpManager.checkCollection(runnerBounds);
    for (const pu of collectedPowerUps) {
      this.powerUpManager.activateEffect(pu.type, this.runner.sprite);
      this.recordEvent('powerup_collected', { id: pu.id, type: pu.type });

      // Flash in power-up color
      const flashColors: Record<PowerUpType, [number, number, number]> = {
        shield: [0, 255, 255],
        magnet: [255, 0, 255],
        slowmo: [255, 255, 0],
      };
      const [r, g, b] = flashColors[pu.type];
      this.cameras.main.flash(150, r, g, b, false);
    }

    // -- Obstacle collision -------------------------------------------------
    const hitObstacle = this.laneManager.checkObstacleCollision(
      runnerBounds,
      this.runner.isJumping,
    );
    if (hitObstacle) {
      // Check if shield absorbs the hit
      if (this.powerUpManager.consumeShield()) {
        this.recordEvent('shield_consumed', { obstacleId: hitObstacle.id });
        this.cameras.main.flash(200, 0, 255, 255, false);
      } else {
        this.onCollision(hitObstacle.id);
        return;
      }
    }

    // -- Update score -------------------------------------------------------
    const distanceScore = Math.floor(this.distanceTraveled / this.DISTANCE_PER_POINT);
    const totalScore = this.orbsCollected + distanceScore;
    this.updateScore(totalScore);
    this.updateScoreDisplay();
  }

  // -- Game actions ---------------------------------------------------------

  private spawnObstacle(): void {
    // Decide how many lanes to block (1-2)
    const blockCount = this.scrollSpeed > 350 ? this.rngBetween(1, 2) : 1;
    const shuffledLanes = this.rngShuffle([0, 1, 2]);
    const blockedLanes = shuffledLanes.slice(0, blockCount);

    // Decide obstacle type (low obstacles become more common over time)
    const lowChance = Math.min(0.35, (this.scrollSpeed - this.INITIAL_SCROLL_SPEED) / 1000);

    for (const lane of blockedLanes) {
      const isLow = this.rng() < lowChance;
      const obsId = this.laneManager.spawnObstacle(lane, isLow);
      this.recordEvent('obstacle_spawn', {
        id: obsId,
        lane,
        isLow,
        speed: this.scrollSpeed,
      });
    }
  }

  private spawnOrbs(): void {
    // Spawn 1-3 orbs in random lanes
    const count = this.rngBetween(1, 3);
    const lanes = this.rngShuffle([0, 1, 2]);

    for (let i = 0; i < count; i++) {
      const orbId = this.laneManager.spawnOrb(lanes[i], -40 - i * 30);
      this.recordEvent('orb_spawn', {
        id: orbId,
        lane: lanes[i],
      });
    }
  }

  private spawnPowerUp(): void {
    // Random lane and type
    const lane = this.rngBetween(0, 2);
    const types: PowerUpType[] = ['shield', 'magnet', 'slowmo'];
    const type = this.rngPick(types);

    const puId = this.powerUpManager.spawnPowerUp(lane, type);
    this.recordEvent('powerup_spawn', { id: puId, lane, type });
  }

  private async onCollision(obstacleId: string): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;

    this.recordEvent('collision', {
      obstacleId,
      lane: this.runner.lane,
      score: this.score,
      distance: Math.round(this.distanceTraveled),
      orbs: this.orbsCollected,
    });

    // -- Death effects -------------------------------------------------------

    // Screen shake
    this.cameras.main.shake(300, 0.03);

    // Red flash
    this.cameras.main.flash(250, 255, 50, 50, false);

    // Freeze the runner
    this.runner.stop();

    // Death animation: runner fades and drops
    this.tweens.add({
      targets: this.runner.sprite,
      alpha: 0.3,
      y: this.runner.y + 40,
      duration: 500,
      ease: 'Quad.easeIn',
    });

    // Explosion particles
    this.spawnExplosionParticles(this.runner.x, this.runner.y - 26);

    // Brief delay before sending result
    await this.delay(500);

    // Compute result and emit to React layer
    await this.endGame();
  }

  // -- Input setup ----------------------------------------------------------

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isWaitingToStart || this.isGameOver) return;
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
      this.isSwiping = true;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwiping || this.isWaitingToStart || this.isGameOver) return;
      this.isSwiping = false;

      const dx = pointer.x - this.swipeStartX;
      const dy = pointer.y - this.swipeStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Determine swipe direction
      if (absDx < this.SWIPE_THRESHOLD && absDy < this.SWIPE_THRESHOLD) {
        // Tap -- treat as jump
        this.handleJump();
        return;
      }

      if (absDy > absDx && dy < -this.SWIPE_THRESHOLD) {
        // Swipe up -- jump
        this.handleJump();
      } else if (absDx > absDy) {
        if (dx > this.SWIPE_THRESHOLD) {
          // Swipe right
          this.handleMoveRight();
        } else if (dx < -this.SWIPE_THRESHOLD) {
          // Swipe left
          this.handleMoveLeft();
        }
      }
    });

    // Keyboard fallback (for desktop testing)
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-LEFT', () => this.handleMoveLeft());
      this.input.keyboard.on('keydown-RIGHT', () => this.handleMoveRight());
      this.input.keyboard.on('keydown-UP', () => this.handleJump());
      this.input.keyboard.on('keydown-SPACE', () => this.handleJump());
      this.input.keyboard.on('keydown-A', () => this.handleMoveLeft());
      this.input.keyboard.on('keydown-D', () => this.handleMoveRight());
      this.input.keyboard.on('keydown-W', () => this.handleJump());
    }
  }

  private handleMoveLeft(): void {
    if (this.isGameOver || this.isWaitingToStart) return;
    const newLane = this.runner.moveLeft();
    this.recordEvent('move_left', { lane: newLane });
  }

  private handleMoveRight(): void {
    if (this.isGameOver || this.isWaitingToStart) return;
    const newLane = this.runner.moveRight();
    this.recordEvent('move_right', { lane: newLane });
  }

  private handleJump(): void {
    if (this.isGameOver || this.isWaitingToStart) return;
    const jumped = this.runner.jump();
    if (jumped) {
      this.recordEvent('jump', { y: Math.round(this.runner.y) });
    }
  }

  // -- Visual creation ------------------------------------------------------

  private createBackground(width: number, height: number): void {
    // Deep dark background
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x050510);
    bg.setOrigin(0.5, 0.5);
    bg.setDepth(0);

    // Ambient neon glow at the bottom (horizon effect)
    this.bgGlow = this.add.rectangle(
      width / 2, height, width, height * 0.4,
      0x0a0a30,
    );
    this.bgGlow.setOrigin(0.5, 1);
    this.bgGlow.setDepth(0);
    this.bgGlow.setAlpha(0.8);

    // Side neon strips (left)
    const leftStrip = this.add.rectangle(0, height / 2, 2, height, 0x00ffff, 0.15);
    leftStrip.setOrigin(0, 0.5);
    leftStrip.setDepth(1);

    // Side neon strips (right)
    const rightStrip = this.add.rectangle(width, height / 2, 2, height, 0xff00ff, 0.15);
    rightStrip.setOrigin(1, 0.5);
    rightStrip.setDepth(1);

    // Scattered "star" dots for atmosphere
    const starGfx = this.add.graphics();
    starGfx.setDepth(0);
    for (let i = 0; i < 40; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, Math.floor(height * 0.6));
      const alpha = Phaser.Math.FloatBetween(0.1, 0.4);
      const size = Phaser.Math.FloatBetween(0.5, 1.2);
      const color = Phaser.Math.RND.pick([0xffffff, 0x00ffff, 0xff00ff, 0xffff00]);
      starGfx.fillStyle(color, alpha);
      starGfx.fillCircle(sx, sy, size);
    }
  }

  private createGridFloor(width: number, height: number): void {
    // Create horizontal grid lines that will scroll to simulate movement
    const gridAreaTop = Math.floor(height * 0.65);
    const gridAreaBottom = height;
    const lineCount = Math.ceil((gridAreaBottom - gridAreaTop) / this.GRID_LINE_SPACING) + 2;

    for (let i = 0; i < lineCount; i++) {
      const y = gridAreaTop + i * this.GRID_LINE_SPACING;
      const gfx = this.add.graphics();
      gfx.setDepth(2);

      // Perspective effect: lines get brighter and wider near the bottom
      const progress = i / lineCount;
      const alpha = 0.08 + progress * 0.2;

      gfx.lineStyle(1, 0x00ffff, alpha);
      gfx.beginPath();
      gfx.moveTo(0, y);
      gfx.lineTo(width, y);
      gfx.strokePath();

      this.gridLines.push(gfx);
    }

    // Vertical lane lines (static)
    const vertGfx = this.add.graphics();
    vertGfx.setDepth(2);

    for (let i = 0; i <= 3; i++) {
      const x = i * this.laneWidth;
      const alpha = 0.2;
      vertGfx.lineStyle(1, 0x00ffff, alpha);
      vertGfx.beginPath();
      vertGfx.moveTo(x, gridAreaTop);
      vertGfx.lineTo(x, gridAreaBottom);
      vertGfx.strokePath();
    }
  }

  private createLaneDividers(width: number, height: number): void {
    // Bright neon lane dividers
    const dividerTop = Math.floor(height * 0.1);

    for (let i = 1; i < 3; i++) {
      const x = i * this.laneWidth;
      const divider = this.add.rectangle(x, height / 2, 1, height, 0x00ffff, 0.12);
      divider.setOrigin(0.5, 0.5);
      divider.setDepth(3);
      this.laneDividers.push(divider);
    }

    // Ground line (where runner stands)
    const groundLine = this.add.rectangle(
      width / 2, this.groundY, width, 2, 0x00ffff, 0.3,
    );
    groundLine.setOrigin(0.5, 0.5);
    groundLine.setDepth(3);

    // Horizon glow line
    const horizonY = Math.floor(height * 0.65);
    const horizonLine = this.add.rectangle(
      width / 2, horizonY, width, 1, 0xff00ff, 0.25,
    );
    horizonLine.setOrigin(0.5, 0.5);
    horizonLine.setDepth(3);
  }

  private createHUD(width: number): void {
    // Score display
    this.scoreText = this.add.text(width / 2, 30, 'SCORE: 0', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#00ffff',
      fontStyle: 'bold',
      stroke: '#003333',
      strokeThickness: 2,
    });
    this.scoreText.setOrigin(0.5, 0);
    this.scoreText.setDepth(20);

    // Multiplier display
    this.multiplierText = this.add.text(width / 2, 56, '0x', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ff00ff',
      fontStyle: 'bold',
    });
    this.multiplierText.setOrigin(0.5, 0);
    this.multiplierText.setDepth(20);
  }

  private updateScoreDisplay(): void {
    if (this.scoreText) {
      this.scoreText.setText(`SCORE: ${this.score}`);
    }
    if (this.multiplierText) {
      const mult = this.calculateMultiplier();
      this.multiplierText.setText(`${mult}x`);
      // Color based on multiplier tier
      if (mult >= 5) {
        this.multiplierText.setColor('#ffff00');
      } else if (mult >= 2) {
        this.multiplierText.setColor('#00ff00');
      } else if (mult >= 1) {
        this.multiplierText.setColor('#ff00ff');
      } else {
        this.multiplierText.setColor('#ff0055');
      }
    }
  }

  private updateGridScroll(dt: number): void {
    const speed = this.isWaitingToStart || this.isGameOver ? 30 : this.scrollSpeed * 0.3;
    this.gridScrollOffset += speed * dt;

    if (this.gridScrollOffset >= this.GRID_LINE_SPACING) {
      this.gridScrollOffset -= this.GRID_LINE_SPACING;
    }

    // Re-draw grid lines at their scrolled positions
    const { width, height } = this.scale;
    const gridAreaTop = Math.floor(height * 0.65);

    for (let i = 0; i < this.gridLines.length; i++) {
      const gfx = this.gridLines[i];
      gfx.clear();

      const baseY = gridAreaTop + i * this.GRID_LINE_SPACING + this.gridScrollOffset;

      if (baseY > height || baseY < gridAreaTop) continue;

      const progress = (baseY - gridAreaTop) / (height - gridAreaTop);
      const alpha = 0.06 + progress * 0.22;

      gfx.lineStyle(1, 0x00ffff, alpha);
      gfx.beginPath();
      gfx.moveTo(0, baseY);
      gfx.lineTo(width, baseY);
      gfx.strokePath();
    }
  }

  // -- Effects --------------------------------------------------------------

  private spawnExplosionParticles(x: number, y: number): void {
    // Create a temporary particle texture
    const texKey = 'neon-particle';
    if (!this.textures.exists(texKey)) {
      const gfx = this.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(0x00ffff, 1);
      gfx.fillCircle(3, 3, 3);
      gfx.generateTexture(texKey, 6, 6);
      gfx.destroy();
    }

    const emitter = this.add.particles(x, y, texKey, {
      speed: { min: 80, max: 250 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      lifespan: { min: 300, max: 800 },
      alpha: { start: 1, end: 0 },
      tint: [0x00ffff, 0xff00ff, 0xffff00, 0xffffff],
      quantity: 20,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(20, x, y);

    // Clean up after particles finish
    this.time.delayedCall(900, () => {
      emitter.destroy();
    });
  }

  // -- Helpers --------------------------------------------------------------

  /** Promise-based delay helper for sequencing post-death effects. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }
}
