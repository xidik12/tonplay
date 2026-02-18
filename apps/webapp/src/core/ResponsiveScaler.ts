/**
 * Responsive scaler for Phaser games.
 * Targets 9:16 portrait aspect ratio with FIT scaling and letterboxing.
 */

export interface GameDimensions {
  /** Logical game width */
  width: number;
  /** Logical game height */
  height: number;
  /** Scale factor applied to fit the screen */
  scaleFactor: number;
  /** Horizontal offset for centering (letterbox) */
  offsetX: number;
  /** Vertical offset for centering (letterbox/pillarbox) */
  offsetY: number;
}

// Logical game resolution (9:16 portrait)
const GAME_WIDTH = 360;
const GAME_HEIGHT = 640;
const TARGET_ASPECT = GAME_WIDTH / GAME_HEIGHT; // 0.5625

export class ResponsiveScaler {
  private static currentDimensions: GameDimensions | null = null;

  /**
   * Calculate game dimensions to fit within the available screen space
   * while maintaining 9:16 aspect ratio.
   */
  static calculate(containerWidth: number, containerHeight: number): GameDimensions {
    const screenAspect = containerWidth / containerHeight;

    let scaleFactor: number;
    let offsetX = 0;
    let offsetY = 0;

    if (screenAspect > TARGET_ASPECT) {
      // Screen is wider than target: fit by height, pillarbox sides
      scaleFactor = containerHeight / GAME_HEIGHT;
      offsetX = (containerWidth - GAME_WIDTH * scaleFactor) / 2;
    } else {
      // Screen is taller/narrower: fit by width, letterbox top/bottom
      scaleFactor = containerWidth / GAME_WIDTH;
      offsetY = (containerHeight - GAME_HEIGHT * scaleFactor) / 2;
    }

    const dims: GameDimensions = {
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      scaleFactor,
      offsetX,
      offsetY,
    };

    ResponsiveScaler.currentDimensions = dims;
    return dims;
  }

  /**
   * Get the Phaser game configuration for responsive scaling.
   */
  static getPhaserScaleConfig(): Phaser.Types.Core.ScaleConfig {
    return {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      min: {
        width: GAME_WIDTH * 0.5,
        height: GAME_HEIGHT * 0.5,
      },
      max: {
        width: GAME_WIDTH * 2,
        height: GAME_HEIGHT * 2,
      },
    };
  }

  /**
   * Convert a world (game) coordinate to screen coordinate.
   */
  static worldToScreen(
    worldX: number,
    worldY: number,
  ): { x: number; y: number } {
    const dims = ResponsiveScaler.currentDimensions;
    if (!dims) return { x: worldX, y: worldY };

    return {
      x: worldX * dims.scaleFactor + dims.offsetX,
      y: worldY * dims.scaleFactor + dims.offsetY,
    };
  }

  /**
   * Convert a screen coordinate to world (game) coordinate.
   */
  static screenToWorld(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } {
    const dims = ResponsiveScaler.currentDimensions;
    if (!dims) return { x: screenX, y: screenY };

    return {
      x: (screenX - dims.offsetX) / dims.scaleFactor,
      y: (screenY - dims.offsetY) / dims.scaleFactor,
    };
  }

  /**
   * Get the logical game width.
   */
  static get gameWidth(): number {
    return GAME_WIDTH;
  }

  /**
   * Get the logical game height.
   */
  static get gameHeight(): number {
    return GAME_HEIGHT;
  }

  /**
   * Get current dimensions or recalculate from window.
   */
  static getDimensions(): GameDimensions {
    if (ResponsiveScaler.currentDimensions) {
      return ResponsiveScaler.currentDimensions;
    }
    return ResponsiveScaler.calculate(window.innerWidth, window.innerHeight);
  }
}
