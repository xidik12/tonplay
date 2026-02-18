import Phaser from 'phaser';

/**
 * Runner entity -- the player-controlled character.
 *
 * The runner exists in one of three lanes (0=left, 1=center, 2=right)
 * and can jump over obstacles. All movement is manual (no Arcade physics)
 * for deterministic replay verification.
 */
export class Runner {
  /** The visual sprite rendered on screen */
  public sprite: Phaser.GameObjects.Container;

  /** Current lane index: 0=left, 1=center, 2=right */
  public lane: number = 1;

  /** Vertical velocity for jump physics (positive = downward) */
  public jumpVelocity: number = 0;

  /** Whether the runner is currently airborne */
  public isJumping: boolean = false;

  /** X positions of each lane */
  private lanePositions: number[];

  /** Reference to the parent scene */
  private scene: Phaser.Scene;

  /** Ground Y position */
  private groundY: number;

  /** The body sprite (rectangle) */
  private body: Phaser.GameObjects.Rectangle;

  /** The head sprite (rectangle) */
  private head: Phaser.GameObjects.Rectangle;

  /** Neon glow effect */
  private glow: Phaser.GameObjects.Rectangle;

  /** Leg animation sprites */
  private leftLeg: Phaser.GameObjects.Rectangle;
  private rightLeg: Phaser.GameObjects.Rectangle;

  /** Leg animation timer */
  private legTimer: number = 0;

  // -- Tuning constants ---------------------------------------------------
  private readonly JUMP_STRENGTH = -550;
  private readonly GRAVITY = 1400;
  private readonly LANE_SWITCH_DURATION = 120; // ms for lane-change tween

  constructor(
    scene: Phaser.Scene,
    lanePositions: number[],
    groundY: number,
  ) {
    this.scene = scene;
    this.lanePositions = lanePositions;
    this.groundY = groundY;

    const startX = lanePositions[1];
    const startY = groundY;

    // Build the runner from simple shapes inside a container
    this.glow = scene.add.rectangle(0, -20, 30, 44, 0x00ffff, 0.15);
    this.glow.setOrigin(0.5, 1);

    this.body = scene.add.rectangle(0, -22, 18, 30, 0x00ffff);
    this.body.setOrigin(0.5, 1);

    this.head = scene.add.rectangle(0, -52, 14, 14, 0xff00ff);
    this.head.setOrigin(0.5, 1);

    // Visor
    const visor = scene.add.rectangle(0, -44, 10, 4, 0xffff00);
    visor.setOrigin(0.5, 0.5);

    // Legs
    this.leftLeg = scene.add.rectangle(-4, -4, 5, 14, 0x00ffcc);
    this.leftLeg.setOrigin(0.5, 1);

    this.rightLeg = scene.add.rectangle(4, -4, 5, 14, 0x00ffcc);
    this.rightLeg.setOrigin(0.5, 1);

    this.sprite = scene.add.container(startX, startY, [
      this.glow,
      this.leftLeg,
      this.rightLeg,
      this.body,
      this.head,
      visor,
    ]);
    this.sprite.setDepth(10);
    this.sprite.setSize(18, 52);
  }

  // -- Public API ---------------------------------------------------------

  /** Move runner to the specified lane with a tween. Returns the new lane. */
  switchLane(newLane: number): number {
    const clamped = Phaser.Math.Clamp(newLane, 0, 2);
    if (clamped === this.lane) return this.lane;

    this.lane = clamped;
    const targetX = this.lanePositions[clamped];

    this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      duration: this.LANE_SWITCH_DURATION,
      ease: 'Quad.easeOut',
    });

    return clamped;
  }

  /** Move one lane to the left. Returns new lane index. */
  moveLeft(): number {
    return this.switchLane(this.lane - 1);
  }

  /** Move one lane to the right. Returns new lane index. */
  moveRight(): number {
    return this.switchLane(this.lane + 1);
  }

  /** Initiate a jump if on the ground. Returns true if jump started. */
  jump(): boolean {
    if (this.isJumping) return false;

    this.isJumping = true;
    this.jumpVelocity = this.JUMP_STRENGTH;
    return true;
  }

  /**
   * Update the runner physics. Must be called every frame.
   * @param dt - delta time in seconds
   */
  update(dt: number): void {
    // Jump physics
    if (this.isJumping) {
      this.jumpVelocity += this.GRAVITY * dt;
      this.sprite.y += this.jumpVelocity * dt;

      // Land on ground
      if (this.sprite.y >= this.groundY) {
        this.sprite.y = this.groundY;
        this.jumpVelocity = 0;
        this.isJumping = false;
      }
    }

    // Animate legs (running cycle)
    if (!this.isJumping) {
      this.legTimer += dt * 12;
      const legOffset = Math.sin(this.legTimer) * 5;
      this.leftLeg.y = -4 + legOffset;
      this.rightLeg.y = -4 - legOffset;
    } else {
      // Tuck legs while jumping
      this.leftLeg.y = -10;
      this.rightLeg.y = -10;
    }

    // Pulse the glow
    const pulse = 0.1 + Math.sin(Date.now() * 0.005) * 0.05;
    this.glow.setAlpha(pulse);
  }

  /** Reset the runner to starting state. */
  reset(): void {
    this.lane = 1;
    this.sprite.x = this.lanePositions[1];
    this.sprite.y = this.groundY;
    this.jumpVelocity = 0;
    this.isJumping = false;
    this.legTimer = 0;
  }

  /**
   * Get the bounding rectangle for collision detection.
   * Uses a tighter hitbox than the visual for fair gameplay.
   */
  getBounds(): Phaser.Geom.Rectangle {
    const w = 16;
    const h = 46;
    return new Phaser.Geom.Rectangle(
      this.sprite.x - w / 2,
      this.sprite.y - h,
      w,
      h,
    );
  }

  /** Current X position. */
  get x(): number {
    return this.sprite.x;
  }

  /** Current Y position. */
  get y(): number {
    return this.sprite.y;
  }

  /** Stop the runner (used on game over). */
  stop(): void {
    this.jumpVelocity = 0;
    this.isJumping = false;
  }

  /** Clean up game objects. */
  destroy(): void {
    this.sprite.destroy();
  }
}
