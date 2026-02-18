import Phaser from 'phaser';
import { Block } from './Block';

/**
 * Result of attempting to place a block on the tower.
 */
export interface PlaceResult {
  /** Whether the placement was successful (any overlap at all) */
  success: boolean;

  /** Whether it was a "perfect" placement (overlap >= 95% of block width) */
  perfect: boolean;

  /** Width of the overlap region that remains */
  overlapWidth: number;

  /** Width of the sliced-off overhang (0 if perfect) */
  overhangWidth: number;

  /** Which side the overhang was on: 'left', 'right', or 'none' */
  overhangSide: 'left' | 'right' | 'none';

  /** Center X of the overhang piece (for animation) */
  overhangCenterX: number;
}

/**
 * Manages block spawning, placement, slicing, and tower state.
 *
 * Maintains the ordered stack of placed blocks and the currently
 * active (swinging) block. Handles overlap calculation, slicing
 * logic, and difficulty ramping.
 */
export class BlockManager {
  /** All placed blocks in the tower (index 0 = foundation) */
  private tower: Block[] = [];

  /** The currently active (swinging) block, or null if none */
  private activeBlock: Block | null = null;

  /** Reference to the parent scene */
  private scene: Phaser.Scene;

  /** Monotonically increasing block ID counter */
  private nextId: number = 0;

  // ── Configuration ────────────────────────────────────────────────────
  /** Height of each block in pixels */
  public readonly BLOCK_HEIGHT = 28;

  /** Starting width of the first block */
  public readonly INITIAL_WIDTH = 180;

  /** Base swing speed in px/s */
  private readonly BASE_SWING_SPEED = 180;

  /** Speed increment per block placed */
  private readonly SPEED_INCREMENT = 6;

  /** Maximum swing speed */
  private readonly MAX_SWING_SPEED = 500;

  /** Tolerance for "perfect" placement (percentage of block width) */
  private readonly PERFECT_THRESHOLD = 0.05;

  /** Number of consecutive perfect placements */
  public perfectStreak: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Get the currently active (swinging) block.
   */
  getActiveBlock(): Block | null {
    return this.activeBlock;
  }

  /**
   * Get the top block of the tower (the last placed block).
   */
  getTopBlock(): Block | null {
    if (this.tower.length === 0) return null;
    return this.tower[this.tower.length - 1];
  }

  /**
   * Get all placed blocks in the tower.
   */
  getTower(): Block[] {
    return this.tower;
  }

  /**
   * Get the number of blocks placed (excluding foundation).
   */
  get stackCount(): number {
    // The first block is the foundation, so placed blocks = tower.length - 1
    return Math.max(0, this.tower.length - 1);
  }

  /**
   * Get the current swing speed based on how many blocks have been placed.
   */
  getCurrentSwingSpeed(): number {
    const speed = this.BASE_SWING_SPEED + this.stackCount * this.SPEED_INCREMENT;
    return Math.min(speed, this.MAX_SWING_SPEED);
  }

  /**
   * Generate an HSL color that cycles through the rainbow based on block index.
   *
   * @param index - Block index for color cycling
   * @returns A numeric color value
   */
  getBlockColor(index: number): number {
    // Cycle hue through 360 degrees, shifting by 25 degrees per block
    const hue = (index * 25) % 360;
    const saturation = 0.7;
    const lightness = 0.55;
    const color = Phaser.Display.Color.HSLToColor(hue / 360, saturation, lightness);
    return color.color;
  }

  /**
   * Spawn the foundation block (the base of the tower).
   * This block is pre-placed and never swings.
   *
   * @param centerX - X center of the foundation
   * @param y - Y position of the foundation
   */
  spawnFoundation(centerX: number, y: number): Block {
    const id = this.nextId++;
    const color = this.getBlockColor(id);
    const block = new Block(
      this.scene,
      id,
      centerX,
      y,
      this.INITIAL_WIDTH,
      this.BLOCK_HEIGHT,
      color,
      0,
    );
    block.place();
    this.tower.push(block);
    return block;
  }

  /**
   * Spawn a new swinging block above the current tower top.
   * The block starts from the left or right edge alternately.
   *
   * @param y - Y position for the new block
   * @param screenWidth - Screen width for positioning
   * @returns The spawned Block, or null if there's no tower base
   */
  spawnNextBlock(y: number, screenWidth: number): Block | null {
    const topBlock = this.getTopBlock();
    if (!topBlock) return null;

    const id = this.nextId++;
    const color = this.getBlockColor(id);
    const speed = this.getCurrentSwingSpeed();

    // Alternate starting side
    const startFromRight = id % 2 === 0;
    const startX = startFromRight
      ? screenWidth - topBlock.width / 2 - 10
      : topBlock.width / 2 + 10;

    const block = new Block(
      this.scene,
      id,
      startX,
      y,
      topBlock.width,
      this.BLOCK_HEIGHT,
      color,
      speed,
    );

    this.activeBlock = block;
    return block;
  }

  /**
   * Attempt to place the active block on top of the tower.
   * Calculates overlap, slices the overhang, and returns the result.
   *
   * @returns PlaceResult describing the outcome, or null if no active block
   */
  placeActiveBlock(): PlaceResult | null {
    if (!this.activeBlock) return null;

    const active = this.activeBlock;
    const top = this.getTopBlock();
    if (!top) return null;

    // Calculate overlap region
    const overlapLeft = Math.max(active.left, top.left);
    const overlapRight = Math.min(active.right, top.right);
    const overlapWidth = overlapRight - overlapLeft;

    // No overlap at all -- game over
    if (overlapWidth <= 0) {
      active.place();
      // Animate the block falling
      this.scene.tweens.add({
        targets: [active.rect, active.highlight],
        y: active.y + 600,
        alpha: 0,
        duration: 800,
        ease: 'Quad.easeIn',
      });

      this.activeBlock = null;
      return {
        success: false,
        perfect: false,
        overlapWidth: 0,
        overhangWidth: active.width,
        overhangSide: 'none',
        overhangCenterX: active.x,
      };
    }

    // Check for perfect placement
    const isPerfect = overlapWidth >= active.width * (1 - this.PERFECT_THRESHOLD);

    if (isPerfect) {
      // Perfect -- snap to the top block's center X with full width
      this.perfectStreak++;
      active.place();
      active.resize(top.width, top.x);
      active.flashPerfect();
      this.tower.push(active);
      this.activeBlock = null;

      return {
        success: true,
        perfect: true,
        overlapWidth: top.width,
        overhangWidth: 0,
        overhangSide: 'none',
        overhangCenterX: 0,
      };
    }

    // Partial overlap -- slice off the overhang
    this.perfectStreak = 0;

    const overlapCenterX = (overlapLeft + overlapRight) / 2;

    // Determine overhang side and dimensions
    let overhangSide: 'left' | 'right';
    let overhangWidth: number;
    let overhangCenterX: number;

    if (active.left < top.left) {
      // Block is hanging off the left
      overhangSide = 'left';
      overhangWidth = top.left - active.left;
      overhangCenterX = active.left + overhangWidth / 2;
    } else {
      // Block is hanging off the right
      overhangSide = 'right';
      overhangWidth = active.right - top.right;
      overhangCenterX = active.right - overhangWidth / 2;
    }

    // Animate the sliced piece falling
    active.animateSliceFall(overhangCenterX, overhangWidth);

    // Resize the active block to the overlap portion
    active.place();
    active.resize(overlapWidth, overlapCenterX);
    this.tower.push(active);
    this.activeBlock = null;

    return {
      success: true,
      perfect: false,
      overlapWidth,
      overhangWidth,
      overhangSide,
      overhangCenterX,
    };
  }

  /**
   * Update the active block's swing movement.
   *
   * @param dt - Delta time in seconds
   * @param screenWidth - Screen width for bounce boundaries
   */
  update(dt: number, screenWidth: number): void {
    if (this.activeBlock && !this.activeBlock.placed) {
      this.activeBlock.updateSwing(dt, screenWidth);
    }
  }

  /**
   * Destroy all blocks and reset state.
   */
  clear(): void {
    for (const block of this.tower) {
      block.destroy();
    }
    if (this.activeBlock) {
      this.activeBlock.destroy();
      this.activeBlock = null;
    }
    this.tower = [];
    this.nextId = 0;
    this.perfectStreak = 0;
  }
}
