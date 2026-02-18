import Phaser from 'phaser';

/**
 * Represents a single block in the tower stack.
 *
 * Each block is a colored rectangle that can swing horizontally,
 * be placed (dropped), and sliced when it overhangs the previous block.
 *
 * Blocks use procedural Phaser graphics -- no external assets required.
 */
export class Block {
  /** The main visual rectangle for this block */
  public rect: Phaser.GameObjects.Rectangle;

  /** Optional highlight strip on top of the block for a 3D bevel effect */
  public highlight: Phaser.GameObjects.Rectangle;

  /** Width of this block (shrinks after slicing) */
  public width: number;

  /** Height of every block (constant) */
  public readonly height: number;

  /** Whether this block has been placed (no longer swinging) */
  public placed: boolean = false;

  /** Unique sequential ID for replay logging */
  public id: number;

  /** The fill color of this block */
  public color: number;

  /** Reference to the parent scene */
  private scene: Phaser.Scene;

  // ── Swing state ────────────────────────────────────────────────────────
  /** Current horizontal swing direction: 1 = right, -1 = left */
  private swingDirection: number = 1;

  /** Current swing speed in px/s (increases with difficulty) */
  private swingSpeed: number = 200;

  constructor(
    scene: Phaser.Scene,
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    swingSpeed: number,
  ) {
    this.scene = scene;
    this.id = id;
    this.width = width;
    this.height = height;
    this.color = color;
    this.swingSpeed = swingSpeed;

    // Main block rectangle
    this.rect = scene.add.rectangle(x, y, width, height, color);
    this.rect.setOrigin(0.5, 0.5);
    this.rect.setDepth(10);

    // Top highlight for bevel effect (slightly lighter)
    const highlightColor = Phaser.Display.Color.ValueToColor(color);
    highlightColor.lighten(25);
    this.highlight = scene.add.rectangle(
      x,
      y - height / 2 + 2,
      width,
      4,
      highlightColor.color,
    );
    this.highlight.setOrigin(0.5, 0.5);
    this.highlight.setDepth(11);
    this.highlight.setAlpha(0.5);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Get the current X position (center) of this block */
  get x(): number {
    return this.rect.x;
  }

  /** Get the current Y position (center) of this block */
  get y(): number {
    return this.rect.y;
  }

  /** Get the left edge X coordinate */
  get left(): number {
    return this.rect.x - this.width / 2;
  }

  /** Get the right edge X coordinate */
  get right(): number {
    return this.rect.x + this.width / 2;
  }

  /**
   * Update the block's horizontal swing position.
   * Only called while the block is still active (not yet placed).
   *
   * @param dt - Delta time in seconds
   * @param screenWidth - Width of the game screen for bounce boundaries
   */
  updateSwing(dt: number, screenWidth: number): void {
    if (this.placed) return;

    const dx = this.swingSpeed * this.swingDirection * dt;
    this.rect.x += dx;
    this.highlight.x += dx;

    // Bounce off screen edges (with some margin)
    const margin = 10;
    if (this.right >= screenWidth - margin) {
      this.swingDirection = -1;
      // Clamp to prevent going off screen
      const overflow = this.right - (screenWidth - margin);
      this.rect.x -= overflow;
      this.highlight.x -= overflow;
    } else if (this.left <= margin) {
      this.swingDirection = 1;
      const overflow = margin - this.left;
      this.rect.x += overflow;
      this.highlight.x += overflow;
    }
  }

  /**
   * Place (drop) this block in position. Stops all swinging.
   */
  place(): void {
    this.placed = true;
  }

  /**
   * Resize this block after slicing off the overhang.
   * Adjusts the visual rectangle and repositions to the new center.
   *
   * @param newWidth - The new width after slicing
   * @param newCenterX - The new center X position
   */
  resize(newWidth: number, newCenterX: number): void {
    this.width = newWidth;
    this.rect.setSize(newWidth, this.height);
    this.rect.x = newCenterX;
    this.highlight.setSize(newWidth, 4);
    this.highlight.x = newCenterX;
  }

  /**
   * Set the Y position of this block.
   */
  setY(y: number): void {
    this.rect.y = y;
    this.highlight.y = y - this.height / 2 + 2;
  }

  /**
   * Animate the sliced-off overhang portion falling away.
   * Creates a temporary rectangle that drops and fades out.
   *
   * @param sliceX - Center X of the sliced piece
   * @param sliceWidth - Width of the sliced piece
   */
  animateSliceFall(sliceX: number, sliceWidth: number): void {
    const slicePiece = this.scene.add.rectangle(
      sliceX,
      this.rect.y,
      sliceWidth,
      this.height,
      this.color,
    );
    slicePiece.setOrigin(0.5, 0.5);
    slicePiece.setDepth(9);
    slicePiece.setAlpha(0.8);

    // Animate falling + rotating + fading
    this.scene.tweens.add({
      targets: slicePiece,
      y: slicePiece.y + 400,
      alpha: 0,
      angle: sliceX > this.rect.x ? 25 : -25,
      duration: 600,
      ease: 'Quad.easeIn',
      onComplete: () => {
        slicePiece.destroy();
      },
    });
  }

  /**
   * Flash the block white briefly (perfect placement feedback).
   */
  flashPerfect(): void {
    const originalColor = this.color;
    this.rect.setFillStyle(0xffffff);
    this.scene.time.delayedCall(100, () => {
      this.rect.setFillStyle(originalColor);
    });
  }

  /**
   * Clean up all game objects associated with this block.
   */
  destroy(): void {
    this.rect.destroy();
    this.highlight.destroy();
  }
}
