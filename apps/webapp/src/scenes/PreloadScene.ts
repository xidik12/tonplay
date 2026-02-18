import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';

/**
 * PreloadScene: Loads all shared and game-specific assets.
 * Displays a progress bar during loading, then transitions to the game scene.
 */
export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Image;
  private progressBarBg!: Phaser.GameObjects.Image;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background
    this.cameras.main.setBackgroundColor('#060612');

    // Logo
    const logo = this.add.image(centerX, centerY - 80, 'boot-logo');
    logo.setScale(1.2);
    this.tweens.add({
      targets: logo,
      scale: { from: 0, to: 1.2 },
      duration: 400,
      ease: 'Back.easeOut',
    });

    // Title text
    this.add
      .text(centerX, centerY - 30, 'TONPLAY', {
        fontSize: '24px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#6C5CE7',
      })
      .setOrigin(0.5);

    // Loading bar background
    this.progressBarBg = this.add.image(centerX, centerY + 30, 'loading-bar-bg');
    this.progressBarBg.setOrigin(0.5);

    // Loading bar fill (cropped to show progress)
    this.progressBar = this.add.image(
      centerX - 118,
      centerY + 30,
      'loading-bar-fill',
    );
    this.progressBar.setOrigin(0, 0.5);
    this.progressBar.setCrop(0, 0, 0, 8);

    // Loading text
    this.loadingText = this.add
      .text(centerX, centerY + 55, 'Loading assets...', {
        fontSize: '11px',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#666666',
      })
      .setOrigin(0.5);

    // Percent text
    this.percentText = this.add
      .text(centerX, centerY + 30, '0%', {
        fontSize: '9px',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#999999',
      })
      .setOrigin(0.5);

    // Start loading assets
    this.loadAssets();
  }

  private loadAssets(): void {
    const gameSlug = this.registry.get('gameSlug') as GameSlug | undefined;

    // Track loading progress
    this.load.on('progress', (value: number) => {
      this.updateProgress(value);
    });

    this.load.on('complete', () => {
      this.onLoadComplete();
    });

    // Load shared assets
    this.loadSharedAssets();

    // Load game-specific assets
    if (gameSlug) {
      this.loadGameAssets(gameSlug);
    }

    // If nothing to load, immediately complete
    if (this.load.totalToLoad === 0) {
      // Simulate brief loading for UX
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 600,
        onUpdate: (tween) => {
          this.updateProgress(tween.getValue());
        },
        onComplete: () => {
          this.onLoadComplete();
        },
      });
    } else {
      this.load.start();
    }
  }

  private loadSharedAssets(): void {
    const basePath = '/assets/shared';

    // UI sounds (load if they exist)
    this.load.audio('sfx-tap', `${basePath}/tap.mp3`);
    this.load.audio('sfx-success', `${basePath}/success.mp3`);
    this.load.audio('sfx-fail', `${basePath}/fail.mp3`);
    this.load.audio('sfx-coin', `${basePath}/coin.mp3`);

    // Handle load errors gracefully (assets may not exist yet)
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[PreloadScene] Failed to load: ${file.key} (${file.url})`);
    });
  }

  private loadGameAssets(slug: GameSlug): void {
    const basePath = `/assets/${slug}`;

    switch (slug) {
      case 'flappy-rocket':
        this.load.image('rocket', `${basePath}/rocket.png`);
        this.load.image('asteroid', `${basePath}/asteroid.png`);
        this.load.image('star-bg', `${basePath}/star-bg.png`);
        this.load.audio('bgm-flappy', `${basePath}/bgm.mp3`);
        this.load.audio('sfx-thrust', `${basePath}/thrust.mp3`);
        this.load.audio('sfx-explosion', `${basePath}/explosion.mp3`);
        break;

      case 'neon-runner':
        this.load.image('runner', `${basePath}/runner.png`);
        this.load.image('obstacle', `${basePath}/obstacle.png`);
        this.load.audio('bgm-runner', `${basePath}/bgm.mp3`);
        break;

      case 'tower-stack':
        this.load.image('block', `${basePath}/block.png`);
        this.load.audio('sfx-stack', `${basePath}/stack.mp3`);
        break;

      // Other games load their specific assets here
      default:
        break;
    }
  }

  private updateProgress(value: number): void {
    const fillWidth = Math.round(236 * value);
    this.progressBar.setCrop(0, 0, fillWidth, 8);
    this.percentText.setText(`${Math.round(value * 100)}%`);
  }

  private onLoadComplete(): void {
    this.updateProgress(1);
    this.loadingText.setText('Ready!');
    this.percentText.setColor('#6C5CE7');

    // Brief delay before transitioning
    this.time.delayedCall(400, () => {
      const gameSlug = this.registry.get('gameSlug') as GameSlug | undefined;

      if (gameSlug) {
        // Dynamically start the game scene
        // For now, emit an event that the game is starting
        this.game.events.emit('game:started');

        // The game scene would be registered dynamically
        // For the MVP, we use a placeholder
        if (this.scene.get('GameScene')) {
          this.scene.start('GameScene');
        } else {
          console.log(`[PreloadScene] Game scene for '${gameSlug}' not yet implemented.`);
          // Emit a dummy game over for testing
          this.time.delayedCall(2000, () => {
            this.game.events.emit('game:over', {
              sessionId: 'demo-session',
              score: Math.floor(Math.random() * 100) + 10,
              payout: Math.floor(Math.random() * 200),
              payoutCurrency: 'TICKET',
              multiplier: 1.0 + Math.random() * 2,
              serverSeed: 'demo-seed-' + Date.now().toString(36),
              isVerified: true,
            });
          });
        }
      }
    });
  }
}
