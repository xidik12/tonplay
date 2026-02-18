import Phaser from 'phaser';

/**
 * Represents a single pair of top/bottom asteroid obstacles
 * that the rocket must fly between.
 */
export interface ObstaclePair {
  /** Unique identifier for this pair (used for score tracking) */
  id: string;

  /** Top asteroid sprite */
  top: Phaser.GameObjects.Rectangle;

  /** Bottom asteroid sprite */
  bottom: Phaser.GameObjects.Rectangle;

  /** Decorative edge sprite on the top asteroid (inner face) */
  topEdge: Phaser.GameObjects.Rectangle;

  /** Decorative edge sprite on the bottom asteroid (inner face) */
  bottomEdge: Phaser.GameObjects.Rectangle;

  /** Whether the rocket has already passed this pair (score counted) */
  scored: boolean;
}

/**
 * Manages the lifecycle of asteroid obstacle pairs:
 * spawning, scrolling, pass-detection, cleanup, and difficulty scaling.
 *
 * Uses simple Phaser rectangles (no textures) for crisp placeholder visuals
 * that read well on any screen size.
 */
export class ObstacleManager {
  /** Active obstacle pairs currently on screen */
  private pairs: ObstaclePair[] = [];

  /** Reference to the parent scene */
  private scene: Phaser.Scene;

  /** Monotonically increasing ID counter for pair identification */
  private nextId: number = 0;

  /** Width of each asteroid column in pixels */
  private readonly OBSTACLE_WIDTH = 60;

  /** Color of the asteroid body */
  private readonly BODY_COLOR = 0x4a4a6a;

  /** Color of the inner-edge highlight strip */
  private readonly EDGE_COLOR = 0x6a6a8a;

  /** Width of the decorative edge strip */
  private readonly EDGE_WIDTH = 60;

  /** Height of the decorative edge strip */
  private readonly EDGE_HEIGHT = 6;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Spawn a new pair of asteroids at the right edge of the screen.
   *
   * @param gapCenterY - Vertical center of the gap between the two asteroids
   * @param gapSize    - Total height of the gap in pixels
   * @returns The pair ID (for replay logging)
   */
  spawnPair(gapCenterY: number, gapSize: number): string {
    const { width, height } = this.scene.scale;
    const id = `pair_${this.nextId++}`;
    const spawnX = width + this.OBSTACLE_WIDTH / 2 + 10;

    // ── Top asteroid ──────────────────────────────────────────────────────
    const topHeight = gapCenterY - gapSize / 2;
    const top = this.scene.add.rectangle(
      spawnX,
      topHeight / 2,
      this.OBSTACLE_WIDTH,
      topHeight,
      this.BODY_COLOR,
    );
    top.setOrigin(0.5, 0.5);
    top.setDepth(5);

    // Top inner-edge highlight (at the bottom of the top asteroid)
    const topEdge = this.scene.add.rectangle(
      spawnX,
      topHeight - this.EDGE_HEIGHT / 2,
      this.EDGE_WIDTH,
      this.EDGE_HEIGHT,
      this.EDGE_COLOR,
    );
    topEdge.setOrigin(0.5, 0.5);
    topEdge.setDepth(6);

    // ── Bottom asteroid ───────────────────────────────────────────────────
    const bottomY = gapCenterY + gapSize / 2;
    const bottomHeight = height - bottomY;
    const bot = this.scene.add.rectangle(
      spawnX,
      bottomY + bottomHeight / 2,
      this.OBSTACLE_WIDTH,
      bottomHeight,
      this.BODY_COLOR,
    );
    bot.setOrigin(0.5, 0.5);
    bot.setDepth(5);

    // Bottom inner-edge highlight (at the top of the bottom asteroid)
    const bottomEdge = this.scene.add.rectangle(
      spawnX,
      bottomY + this.EDGE_HEIGHT / 2,
      this.EDGE_WIDTH,
      this.EDGE_HEIGHT,
      this.EDGE_COLOR,
    );
    bottomEdge.setOrigin(0.5, 0.5);
    bottomEdge.setDepth(6);

    const pair: ObstaclePair = {
      id,
      top,
      bottom,
      topEdge,
      bottomEdge,
      scored: false,
    };

    this.pairs.push(pair);
    return id;
  }

  /**
   * Scroll all obstacles to the left and remove any that have gone off-screen.
   *
   * @param dt         - Delta time in seconds
   * @param scrollSpeed - Horizontal scroll speed in px/s
   */
  updateAll(dt: number, scrollSpeed: number): void {
    const dx = scrollSpeed * dt;

    for (const pair of this.pairs) {
      pair.top.x -= dx;
      pair.bottom.x -= dx;
      pair.topEdge.x -= dx;
      pair.bottomEdge.x -= dx;
    }

    this.removeOffscreen();
  }

  /**
   * Check which obstacle pairs the rocket has just flown past.
   * Returns an array of pair IDs that were newly scored.
   *
   * @param rocketX - Current X position of the rocket
   */
  checkPassing(rocketX: number): string[] {
    const newlyPassed: string[] = [];

    for (const pair of this.pairs) {
      if (pair.scored) continue;

      // The rocket passes a pair when its center is beyond the right edge of the obstacle
      const obstacleRightEdge = pair.top.x + this.OBSTACLE_WIDTH / 2;
      if (rocketX > obstacleRightEdge) {
        pair.scored = true;
        newlyPassed.push(pair.id);
      }
    }

    return newlyPassed;
  }

  /**
   * AABB collision check between the rocket bounds and all obstacle rectangles.
   *
   * @param rocketBounds - Bounding rectangle of the rocket
   * @returns `true` if a collision is detected
   */
  checkCollision(rocketBounds: Phaser.Geom.Rectangle): boolean {
    for (const pair of this.pairs) {
      if (this.rectOverlap(rocketBounds, pair.top) || this.rectOverlap(rocketBounds, pair.bottom)) {
        return true;
      }
    }
    return false;
  }

  /** Destroy all obstacle game objects and clear the pairs array. */
  clear(): void {
    for (const pair of this.pairs) {
      pair.top.destroy();
      pair.bottom.destroy();
      pair.topEdge.destroy();
      pair.bottomEdge.destroy();
    }
    this.pairs = [];
    this.nextId = 0;
  }

  /** Get the number of currently active pairs. */
  get count(): number {
    return this.pairs.length;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /** Remove pairs whose sprites have scrolled fully off the left edge. */
  private removeOffscreen(): void {
    const cutoff = -(this.OBSTACLE_WIDTH / 2) - 20;

    this.pairs = this.pairs.filter((pair) => {
      if (pair.top.x < cutoff) {
        pair.top.destroy();
        pair.bottom.destroy();
        pair.topEdge.destroy();
        pair.bottomEdge.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * Simple AABB overlap test between a `Phaser.Geom.Rectangle` and
   * a `Phaser.GameObjects.Rectangle`.
   */
  private rectOverlap(
    bounds: Phaser.Geom.Rectangle,
    rect: Phaser.GameObjects.Rectangle,
  ): boolean {
    const hw = rect.width / 2;
    const hh = rect.height / 2;
    const rx = rect.x - hw;
    const ry = rect.y - hh;
    const rw = rect.width;
    const rh = rect.height;

    return (
      bounds.x < rx + rw &&
      bounds.x + bounds.width > rx &&
      bounds.y < ry + rh &&
      bounds.y + bounds.height > ry
    );
  }
}
