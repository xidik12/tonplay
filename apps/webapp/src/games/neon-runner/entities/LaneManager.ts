import Phaser from 'phaser';

/**
 * Represents an obstacle that occupies a lane.
 * The runner must dodge these by switching lanes or jumping.
 */
export interface Obstacle {
  /** Unique identifier for replay tracking */
  id: string;
  /** The visual game object */
  sprite: Phaser.GameObjects.Container;
  /** Which lane this obstacle is in (0, 1, or 2) */
  lane: number;
  /** Whether the obstacle can be jumped over (low obstacle) */
  isLow: boolean;
  /** Whether this obstacle has already been scored (passed) */
  passed: boolean;
}

/**
 * Represents a collectible orb in a lane.
 */
export interface Orb {
  /** Unique identifier */
  id: string;
  /** The visual game object */
  sprite: Phaser.GameObjects.Container;
  /** Which lane this orb is in */
  lane: number;
  /** Whether this orb has been collected */
  collected: boolean;
  /** The inner glow for animation */
  inner: Phaser.GameObjects.Arc;
}

/**
 * LaneManager -- handles spawning, scrolling, and cleanup of obstacles and orbs.
 *
 * Obstacles come in two types:
 * - Tall barriers: must be dodged by switching lanes
 * - Low hurdles: can be jumped over OR dodged by switching lane
 *
 * Orbs float in lanes and award +1 score when collected.
 */
export class LaneManager {
  /** Active obstacles currently on screen */
  private obstacles: Obstacle[] = [];

  /** Active orbs currently on screen */
  private orbs: Orb[] = [];

  /** Reference to the parent scene */
  private scene: Phaser.Scene;

  /** X position of each lane center */
  private lanePositions: number[];

  /** Ground Y position (bottom of obstacles) */
  private groundY: number;

  /** Lane width for sizing */
  private laneWidth: number;

  /** Monotonically increasing ID counter */
  private nextId: number = 0;

  // -- Constants ----------------------------------------------------------
  private readonly OBSTACLE_TALL_HEIGHT = 60;
  private readonly OBSTACLE_LOW_HEIGHT = 28;
  private readonly OBSTACLE_WIDTH_FRACTION = 0.7; // fraction of lane width
  private readonly ORB_RADIUS = 8;

  constructor(
    scene: Phaser.Scene,
    lanePositions: number[],
    groundY: number,
    laneWidth: number,
  ) {
    this.scene = scene;
    this.lanePositions = lanePositions;
    this.groundY = groundY;
    this.laneWidth = laneWidth;
  }

  // -- Public API ---------------------------------------------------------

  /**
   * Spawn an obstacle in the specified lane at the top of the screen.
   * @param lane - Lane index (0, 1, or 2)
   * @param isLow - If true, creates a low hurdle that can be jumped over
   * @param spawnY - Y position to spawn at (default: above screen)
   * @returns The obstacle ID for replay logging
   */
  spawnObstacle(lane: number, isLow: boolean, spawnY?: number): string {
    const id = `obs_${this.nextId++}`;
    const x = this.lanePositions[lane];
    const y = spawnY ?? -80;
    const obstW = this.laneWidth * this.OBSTACLE_WIDTH_FRACTION;
    const obstH = isLow ? this.OBSTACLE_LOW_HEIGHT : this.OBSTACLE_TALL_HEIGHT;

    // Build the obstacle visually
    const container = this.scene.add.container(x, y);
    container.setDepth(6);

    // Main body -- neon colored barrier
    const bodyColor = isLow ? 0xffff00 : 0xff0055;
    const body = this.scene.add.rectangle(0, 0, obstW, obstH, bodyColor, 0.85);
    body.setOrigin(0.5, 1);

    // Neon border glow
    const borderGlow = this.scene.add.rectangle(0, 0, obstW + 4, obstH + 4, bodyColor, 0.2);
    borderGlow.setOrigin(0.5, 1);

    // Top edge highlight
    const edge = this.scene.add.rectangle(0, -obstH, obstW, 3, 0xffffff, 0.8);
    edge.setOrigin(0.5, 0.5);

    // Side stripes for tall obstacles
    if (!isLow) {
      const stripeL = this.scene.add.rectangle(
        -obstW / 2 + 3, -obstH / 2,
        2, obstH - 6, 0xffffff, 0.3,
      );
      stripeL.setOrigin(0.5, 0.5);
      const stripeR = this.scene.add.rectangle(
        obstW / 2 - 3, -obstH / 2,
        2, obstH - 6, 0xffffff, 0.3,
      );
      stripeR.setOrigin(0.5, 0.5);
      container.add([borderGlow, body, edge, stripeL, stripeR]);
    } else {
      // Warning stripes for low hurdles
      const stripe1 = this.scene.add.rectangle(
        -obstW / 4, -obstH / 2,
        3, obstH - 4, 0x000000, 0.4,
      );
      stripe1.setOrigin(0.5, 0.5);
      const stripe2 = this.scene.add.rectangle(
        obstW / 4, -obstH / 2,
        3, obstH - 4, 0x000000, 0.4,
      );
      stripe2.setOrigin(0.5, 0.5);
      container.add([borderGlow, body, edge, stripe1, stripe2]);
    }

    container.setSize(obstW, obstH);

    const obstacle: Obstacle = {
      id,
      sprite: container,
      lane,
      isLow,
      passed: false,
    };

    this.obstacles.push(obstacle);
    return id;
  }

  /**
   * Spawn a collectible orb in the specified lane.
   * @param lane - Lane index (0, 1, or 2)
   * @param spawnY - Y position to spawn at
   * @returns The orb ID for replay logging
   */
  spawnOrb(lane: number, spawnY?: number): string {
    const id = `orb_${this.nextId++}`;
    const x = this.lanePositions[lane];
    const y = spawnY ?? -40;

    const container = this.scene.add.container(x, y);
    container.setDepth(7);

    // Outer glow ring
    const outerGlow = this.scene.add.circle(0, 0, this.ORB_RADIUS + 4, 0x00ffff, 0.15);
    outerGlow.setOrigin(0.5, 0.5);

    // Main orb
    const outer = this.scene.add.circle(0, 0, this.ORB_RADIUS, 0x00ffff, 0.7);
    outer.setOrigin(0.5, 0.5);

    // Bright center
    const inner = this.scene.add.circle(0, 0, this.ORB_RADIUS * 0.5, 0xffffff, 0.9);
    inner.setOrigin(0.5, 0.5);

    container.add([outerGlow, outer, inner]);
    container.setSize(this.ORB_RADIUS * 2, this.ORB_RADIUS * 2);

    const orb: Orb = {
      id,
      sprite: container,
      lane,
      collected: false,
      inner: inner as Phaser.GameObjects.Arc,
    };

    this.orbs.push(orb);
    return id;
  }

  /**
   * Scroll all obstacles and orbs downward (simulating forward movement).
   * @param dt - Delta time in seconds
   * @param speed - Scroll speed in px/s
   */
  updateAll(dt: number, speed: number): void {
    const dy = speed * dt;

    for (const obs of this.obstacles) {
      obs.sprite.y += dy;
    }

    for (const orb of this.orbs) {
      orb.sprite.y += dy;
      // Pulse animation on orbs
      const pulse = 0.4 + Math.sin(Date.now() * 0.008 + orb.sprite.x) * 0.3;
      orb.inner.setScale(pulse);
    }

    this.removeOffscreen();
  }

  /**
   * Check collision between the runner and all active obstacles.
   * @param runnerBounds - The runner's bounding rectangle
   * @param isJumping - Whether the runner is currently jumping
   * @returns The obstacle that was hit, or null
   */
  checkObstacleCollision(
    runnerBounds: Phaser.Geom.Rectangle,
    isJumping: boolean,
  ): Obstacle | null {
    for (const obs of this.obstacles) {
      if (obs.passed) continue;

      // Low obstacles can be jumped over
      if (obs.isLow && isJumping) continue;

      // Get obstacle bounds
      const obsBounds = this.getObstacleBounds(obs);

      if (Phaser.Geom.Rectangle.Overlaps(runnerBounds, obsBounds)) {
        return obs;
      }
    }
    return null;
  }

  /**
   * Check if the runner collects any orbs.
   * @param runnerBounds - The runner's bounding rectangle
   * @returns Array of collected orb IDs
   */
  checkOrbCollection(runnerBounds: Phaser.Geom.Rectangle): string[] {
    const collected: string[] = [];

    for (const orb of this.orbs) {
      if (orb.collected) continue;

      const orbBounds = new Phaser.Geom.Rectangle(
        orb.sprite.x - this.ORB_RADIUS,
        orb.sprite.y - this.ORB_RADIUS,
        this.ORB_RADIUS * 2,
        this.ORB_RADIUS * 2,
      );

      if (Phaser.Geom.Rectangle.Overlaps(runnerBounds, orbBounds)) {
        orb.collected = true;
        collected.push(orb.id);

        // Collection animation: scale up and fade
        this.scene.tweens.add({
          targets: orb.sprite,
          scaleX: 2,
          scaleY: 2,
          alpha: 0,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => {
            orb.sprite.destroy();
          },
        });
      }
    }

    return collected;
  }

  /**
   * Check which obstacles the runner has successfully passed.
   * An obstacle is "passed" when its Y position goes below the runner.
   * @param runnerY - The runner's Y position (foot level / ground)
   * @returns Array of passed obstacle IDs
   */
  checkPassing(runnerY: number): string[] {
    const newlyPassed: string[] = [];

    for (const obs of this.obstacles) {
      if (obs.passed) continue;

      // The obstacle has been passed if its top is below the runner's feet
      if (obs.sprite.y > runnerY + 20) {
        obs.passed = true;
        newlyPassed.push(obs.id);
      }
    }

    return newlyPassed;
  }

  /** Destroy all obstacles and orbs. */
  clear(): void {
    for (const obs of this.obstacles) {
      obs.sprite.destroy();
    }
    for (const orb of this.orbs) {
      if (!orb.collected) {
        orb.sprite.destroy();
      }
    }
    this.obstacles = [];
    this.orbs = [];
    this.nextId = 0;
  }

  /** Get the number of active obstacles. */
  get obstacleCount(): number {
    return this.obstacles.length;
  }

  /** Get the number of active (uncollected) orbs. */
  get orbCount(): number {
    return this.orbs.filter((o) => !o.collected).length;
  }

  // -- Private helpers ----------------------------------------------------

  /** Get bounding rectangle for an obstacle. */
  private getObstacleBounds(obs: Obstacle): Phaser.Geom.Rectangle {
    const obstW = this.laneWidth * this.OBSTACLE_WIDTH_FRACTION;
    const obstH = obs.isLow ? this.OBSTACLE_LOW_HEIGHT : this.OBSTACLE_TALL_HEIGHT;
    return new Phaser.Geom.Rectangle(
      obs.sprite.x - obstW / 2,
      obs.sprite.y - obstH,
      obstW,
      obstH,
    );
  }

  /** Remove obstacles and orbs that have scrolled off the bottom of the screen. */
  private removeOffscreen(): void {
    const screenH = this.scene.scale.height;
    const cutoff = screenH + 100;

    this.obstacles = this.obstacles.filter((obs) => {
      if (obs.sprite.y > cutoff) {
        obs.sprite.destroy();
        return false;
      }
      return true;
    });

    this.orbs = this.orbs.filter((orb) => {
      if (orb.collected) return false;
      if (orb.sprite.y > cutoff) {
        orb.sprite.destroy();
        return false;
      }
      return true;
    });
  }
}
