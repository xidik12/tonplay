import Phaser from 'phaser';

/**
 * BootScene: First scene loaded by Phaser.
 * Sets up minimal boot assets (loading bar graphics) and transitions to PreloadScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Create a simple loading bar background (generated at runtime)
    const { width, height } = this.scale;

    // Create loading bar graphics that PreloadScene can use
    const barBg = this.make.graphics({ x: 0, y: 0, add: false });
    barBg.fillStyle(0x1a1a2e, 1);
    barBg.fillRoundedRect(0, 0, 240, 12, 6);
    barBg.generateTexture('loading-bar-bg', 240, 12);
    barBg.destroy();

    const barFill = this.make.graphics({ x: 0, y: 0, add: false });
    barFill.fillStyle(0x6c5ce7, 1);
    barFill.fillRoundedRect(0, 0, 236, 8, 4);
    barFill.generateTexture('loading-bar-fill', 236, 8);
    barFill.destroy();

    // Create a simple logo text
    const logo = this.make.graphics({ x: 0, y: 0, add: false });
    logo.fillStyle(0x6c5ce7, 1);
    logo.fillCircle(32, 32, 32);
    logo.fillStyle(0x00cec9, 0.8);
    logo.fillCircle(32, 32, 20);
    logo.generateTexture('boot-logo', 64, 64);
    logo.destroy();

    // Create particle texture for effects
    const particle = this.make.graphics({ x: 0, y: 0, add: false });
    particle.fillStyle(0xffffff, 1);
    particle.fillCircle(4, 4, 4);
    particle.generateTexture('particle', 8, 8);
    particle.destroy();
  }

  create(): void {
    // Set game-wide settings
    this.scale.on('resize', this.handleResize, this);

    // Brief fade before moving to preload
    this.cameras.main.setBackgroundColor('#060612');

    // Transition to PreloadScene
    this.time.delayedCall(200, () => {
      this.scene.start('PreloadScene');
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
  }
}
