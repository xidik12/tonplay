import Phaser from 'phaser';

/**
 * Types of power-ups available in the game.
 */
export type PowerUpType = 'shield' | 'magnet' | 'slowmo';

/**
 * Represents an active power-up pickup floating in a lane.
 */
export interface PowerUpPickup {
  /** Unique identifier for replay tracking */
  id: string;
  /** The visual game object */
  sprite: Phaser.GameObjects.Container;
  /** Which lane this power-up is in */
  lane: number;
  /** The type of power-up */
  type: PowerUpType;
  /** Whether this power-up has been collected */
  collected: boolean;
}

/**
 * PowerUpManager -- handles spawning, collection, and active effect tracking
 * for power-up pickups.
 *
 * Power-up types:
 * - Shield: protects from one collision (cyan diamond)
 * - Magnet: attracts nearby orbs for 5 seconds (magenta diamond)
 * - SlowMo: reduces scroll speed for 4 seconds (yellow diamond)
 */
export class PowerUpManager {
  /** Active power-up pickups on screen */
  private pickups: PowerUpPickup[] = [];

  /** Reference to the parent scene */
  private scene: Phaser.Scene;

  /** X position of each lane center */
  private lanePositions: number[];

  /** Monotonically increasing ID counter */
  private nextId: number = 0;

  // -- Active effect state ------------------------------------------------

  /** Whether shield is currently active */
  public shieldActive: boolean = false;

  /** Time remaining for magnet effect (ms) */
  public magnetTimer: number = 0;

  /** Time remaining for slow-mo effect (ms) */
  public slowMoTimer: number = 0;

  /** Visual indicator for active shield */
  private shieldVisual: Phaser.GameObjects.Arc | null = null;

  // -- Constants ----------------------------------------------------------
  private readonly PICKUP_SIZE = 14;
  private readonly MAGNET_DURATION = 5000; // ms
  private readonly SLOWMO_DURATION = 4000; // ms
  private readonly SLOWMO_FACTOR = 0.5; // speed multiplier when active

  /** Colors for each power-up type */
  private readonly TYPE_COLORS: Record<PowerUpType, number> = {
    shield: 0x00ffff,
    magnet: 0xff00ff,
    slowmo: 0xffff00,
  };

  constructor(
    scene: Phaser.Scene,
    lanePositions: number[],
  ) {
    this.scene = scene;
    this.lanePositions = lanePositions;
  }

  // -- Public API ---------------------------------------------------------

  /**
   * Spawn a power-up pickup in the specified lane.
   * @param lane - Lane index (0, 1, or 2)
   * @param type - Type of power-up
   * @param spawnY - Y position to spawn at
   * @returns The pickup ID for replay logging
   */
  spawnPowerUp(lane: number, type: PowerUpType, spawnY?: number): string {
    const id = `pu_${this.nextId++}`;
    const x = this.lanePositions[lane];
    const y = spawnY ?? -60;
    const color = this.TYPE_COLORS[type];
    const s = this.PICKUP_SIZE;

    const container = this.scene.add.container(x, y);
    container.setDepth(8);

    // Outer glow
    const outerGlow = this.scene.add.circle(0, 0, s + 6, color, 0.12);
    outerGlow.setOrigin(0.5, 0.5);

    // Diamond shape (rotated square)
    const diamond = this.scene.add.rectangle(0, 0, s, s, color, 0.85);
    diamond.setOrigin(0.5, 0.5);
    diamond.setAngle(45);

    // Inner icon symbol
    const inner = this.scene.add.rectangle(0, 0, s * 0.4, s * 0.4, 0xffffff, 0.9);
    inner.setOrigin(0.5, 0.5);
    inner.setAngle(45);

    // Type indicator letter
    const letter = type === 'shield' ? 'S' : type === 'magnet' ? 'M' : 'T';
    const label = this.scene.add.text(0, 0, letter, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#000000',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5, 0.5);

    container.add([outerGlow, diamond, inner, label]);
    container.setSize(s * 2, s * 2);

    // Floating animation
    this.scene.tweens.add({
      targets: diamond,
      angle: 405,
      duration: 2000,
      repeat: -1,
      ease: 'Linear',
    });

    const pickup: PowerUpPickup = {
      id,
      sprite: container,
      lane,
      type,
      collected: false,
    };

    this.pickups.push(pickup);
    return id;
  }

  /**
   * Scroll all power-up pickups downward.
   * @param dt - Delta time in seconds
   * @param speed - Scroll speed in px/s
   */
  updatePickups(dt: number, speed: number): void {
    const dy = speed * dt;

    for (const pu of this.pickups) {
      if (!pu.collected) {
        pu.sprite.y += dy;
      }
    }

    this.removeOffscreen();
  }

  /**
   * Update active effect timers.
   * @param delta - Delta time in milliseconds
   */
  updateEffects(delta: number): void {
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - delta);
    }

    if (this.slowMoTimer > 0) {
      this.slowMoTimer = Math.max(0, this.slowMoTimer - delta);
    }

    // Pulse the shield visual if active
    if (this.shieldVisual && this.shieldActive) {
      const pulse = 0.2 + Math.sin(Date.now() * 0.006) * 0.1;
      this.shieldVisual.setAlpha(pulse);
    }
  }

  /**
   * Check if the runner collects any power-up pickups.
   * @param runnerBounds - The runner's bounding rectangle
   * @returns Array of collected power-up types and IDs
   */
  checkCollection(
    runnerBounds: Phaser.Geom.Rectangle,
  ): Array<{ id: string; type: PowerUpType }> {
    const collected: Array<{ id: string; type: PowerUpType }> = [];

    for (const pu of this.pickups) {
      if (pu.collected) continue;

      const puBounds = new Phaser.Geom.Rectangle(
        pu.sprite.x - this.PICKUP_SIZE,
        pu.sprite.y - this.PICKUP_SIZE,
        this.PICKUP_SIZE * 2,
        this.PICKUP_SIZE * 2,
      );

      if (Phaser.Geom.Rectangle.Overlaps(runnerBounds, puBounds)) {
        pu.collected = true;
        collected.push({ id: pu.id, type: pu.type });

        // Collection animation
        this.scene.tweens.add({
          targets: pu.sprite,
          scaleX: 2.5,
          scaleY: 2.5,
          alpha: 0,
          duration: 300,
          ease: 'Quad.easeOut',
          onComplete: () => {
            pu.sprite.destroy();
          },
        });
      }
    }

    return collected;
  }

  /**
   * Activate a power-up effect.
   * @param type - The power-up type to activate
   * @param runnerSprite - The runner's container (for shield visual attachment)
   */
  activateEffect(type: PowerUpType, runnerSprite: Phaser.GameObjects.Container): void {
    switch (type) {
      case 'shield':
        this.shieldActive = true;
        // Create shield visual around runner
        if (this.shieldVisual) {
          this.shieldVisual.destroy();
        }
        this.shieldVisual = this.scene.add.circle(
          0, -26, 28, 0x00ffff, 0.2,
        );
        this.shieldVisual.setStrokeStyle(2, 0x00ffff, 0.6);
        this.shieldVisual.setOrigin(0.5, 0.5);
        runnerSprite.add(this.shieldVisual);
        break;

      case 'magnet':
        this.magnetTimer = this.MAGNET_DURATION;
        break;

      case 'slowmo':
        this.slowMoTimer = this.SLOWMO_DURATION;
        break;
    }
  }

  /**
   * Consume the shield (after surviving a collision).
   * Returns true if shield was active and consumed.
   */
  consumeShield(): boolean {
    if (!this.shieldActive) return false;

    this.shieldActive = false;
    if (this.shieldVisual) {
      // Flash and destroy shield visual
      this.scene.tweens.add({
        targets: this.shieldVisual,
        alpha: 0,
        scaleX: 3,
        scaleY: 3,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (this.shieldVisual) {
            this.shieldVisual.destroy();
            this.shieldVisual = null;
          }
        },
      });
    }
    return true;
  }

  /** Whether slow-mo effect is currently active. */
  get isSlowMo(): boolean {
    return this.slowMoTimer > 0;
  }

  /** Get the slow-mo speed multiplier (1.0 if not active). */
  get speedMultiplier(): number {
    return this.slowMoTimer > 0 ? this.SLOWMO_FACTOR : 1.0;
  }

  /** Whether magnet effect is currently active. */
  get isMagnetActive(): boolean {
    return this.magnetTimer > 0;
  }

  /** Destroy all pickups and effects. */
  clear(): void {
    for (const pu of this.pickups) {
      if (!pu.collected) {
        pu.sprite.destroy();
      }
    }
    this.pickups = [];
    this.nextId = 0;
    this.shieldActive = false;
    this.magnetTimer = 0;
    this.slowMoTimer = 0;
    if (this.shieldVisual) {
      this.shieldVisual.destroy();
      this.shieldVisual = null;
    }
  }

  // -- Private helpers ----------------------------------------------------

  /** Remove pickups that have scrolled off the bottom of the screen. */
  private removeOffscreen(): void {
    const cutoff = this.scene.scale.height + 80;

    this.pickups = this.pickups.filter((pu) => {
      if (pu.collected) return false;
      if (pu.sprite.y > cutoff) {
        pu.sprite.destroy();
        return false;
      }
      return true;
    });
  }
}
