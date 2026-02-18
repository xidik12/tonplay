import Phaser from 'phaser';

/**
 * Rocket entity — the player-controlled ship.
 *
 * Handles thrust physics, rotation, collision body, and the exhaust
 * particle effect. The rocket uses manual velocity (no Arcade body gravity)
 * so the replay verifier can deterministically reproduce the trajectory.
 */
export class Rocket {
  /** The visual sprite rendered on screen */
  public sprite: Phaser.GameObjects.Sprite;

  /** Current vertical velocity in px/s (positive = downward) */
  public velocity: number = 0;

  /** Particle emitter for the exhaust flame */
  private thrustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  /** Reference to the parent scene */
  private scene: Phaser.Scene;

  // ── Tuning constants ────────────────────────────────────────────────────
  /** Downward acceleration in px/s^2 */
  private readonly GRAVITY = 800;

  /** Velocity applied on each thrust (negative = upward) */
  private readonly FLAP_STRENGTH = -320;

  /** Max upward rotation in degrees when thrusting */
  private readonly MAX_UP_ANGLE = -30;

  /** Max downward rotation in degrees when falling */
  private readonly MAX_DOWN_ANGLE = 90;

  /** How quickly the sprite rotates toward the velocity direction */
  private readonly ROTATION_FACTOR = 0.1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Create the sprite using the procedurally-generated texture
    this.sprite = scene.add.sprite(x, y, 'rocket');
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(10);

    // Setup exhaust particle emitter
    this.createThrustParticles();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Apply upward thrust impulse. Returns the rocket's Y position after the thrust. */
  thrust(): number {
    this.velocity = this.FLAP_STRENGTH;

    // Burst exhaust particles
    if (this.thrustEmitter) {
      this.thrustEmitter.explode(6, this.sprite.x - 12, this.sprite.y + 14);
    }

    return this.sprite.y;
  }

  /**
   * Advance the rocket's physics by `dt` seconds.
   * This is the core simulation step — must be deterministic for replay verification.
   */
  update(dt: number): void {
    // Apply gravity
    this.velocity += this.GRAVITY * dt;

    // Move sprite
    this.sprite.y += this.velocity * dt;

    // Rotate sprite to follow velocity direction
    const targetAngle = Phaser.Math.Clamp(
      this.velocity * this.ROTATION_FACTOR,
      this.MAX_UP_ANGLE,
      this.MAX_DOWN_ANGLE,
    );
    this.sprite.angle = targetAngle;

    // Update exhaust emitter position to follow rocket
    if (this.thrustEmitter) {
      this.thrustEmitter.setPosition(this.sprite.x - 12, this.sprite.y + 14);
    }
  }

  /** Reset the rocket to starting position and zero velocity. */
  reset(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.sprite.setAngle(0);
    this.velocity = 0;
  }

  /** Get the bounding rectangle of the rocket for collision checks. */
  getBounds(): Phaser.Geom.Rectangle {
    // Use a slightly smaller hitbox than the visual for fair gameplay.
    // The texture is 40x36 but the "body" is inset by 6px on each side.
    const w = 28;
    const h = 24;
    return new Phaser.Geom.Rectangle(
      this.sprite.x - w / 2,
      this.sprite.y - h / 2,
      w,
      h,
    );
  }

  /** Check if the rocket is outside the vertical play area. */
  isOutOfBounds(screenHeight: number): boolean {
    return this.sprite.y < -50 || this.sprite.y > screenHeight + 50;
  }

  /** Current Y position of the rocket center. */
  get y(): number {
    return this.sprite.y;
  }

  /** Current X position of the rocket center. */
  get x(): number {
    return this.sprite.x;
  }

  /** Stop the rocket in place (used on game over). */
  stop(): void {
    this.velocity = 0;
  }

  /** Clean up game objects. */
  destroy(): void {
    if (this.thrustEmitter) {
      this.thrustEmitter.stop();
    }
    this.sprite.destroy();
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /** Create the exhaust particle effect for visual flair. */
  private createThrustParticles(): void {
    // Only create if the star texture exists (it should from scene preload)
    if (!this.scene.textures.exists('thrust-particle')) {
      return;
    }

    this.thrustEmitter = this.scene.add.particles(
      this.sprite.x,
      this.sprite.y + 14,
      'thrust-particle',
      {
        speed: { min: 40, max: 100 },
        angle: { min: 160, max: 200 },
        scale: { start: 1.0, end: 0 },
        lifespan: { min: 200, max: 400 },
        alpha: { start: 1, end: 0 },
        tint: [0xff6b35, 0xffaa00, 0xff4444],
        emitting: false,
        quantity: 3,
      },
    );
    this.thrustEmitter.setDepth(9);
  }
}
