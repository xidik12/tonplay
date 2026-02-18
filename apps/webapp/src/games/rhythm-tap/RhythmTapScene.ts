import Phaser from 'phaser';
import type { GameSlug } from '@tonplay/shared';
import { BaseGame } from '../BaseGame';

const LANE_COUNT = 4;
const LANE_COLORS = [0xff4444, 0x4466ff, 0x44ff44, 0xffdd00];
const NOTE_COUNT = 100;
const HIT_Y_OFFSET = 100; // from bottom

interface Note {
  lane: number;
  targetTime: number; // ms from start
  sprite: Phaser.GameObjects.Rectangle | null;
  hit: boolean;
}

export class RhythmTapScene extends BaseGame {
  private notes: Note[] = [];
  private laneX: number[] = [];
  private hitY: number = 0;
  private noteSpeed: number = 300;
  private isWaitingToStart: boolean = true;
  private timerText!: Phaser.GameObjects.Text;
  private judgmentText!: Phaser.GameObjects.Text;
  private laneWidth: number = 0;
  private hitZone!: Phaser.GameObjects.Rectangle;

  constructor() { super({ key: 'RhythmTapScene' }); }
  getGameSlug(): GameSlug { return 'rhythm-tap'; }

  calculateMultiplier(): number {
    if (this.score >= 300) return 10;
    if (this.score >= 275) return 5;
    if (this.score >= 225) return 3;
    if (this.score >= 175) return 2;
    if (this.score >= 125) return 1.5;
    if (this.score >= 75) return 1;
    if (this.score >= 30) return 0.5;
    return 0;
  }

  preload(): void {}

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0a18');

    this.laneWidth = Math.floor((width - 40) / LANE_COUNT);
    const lanesStartX = (width - this.laneWidth * LANE_COUNT) / 2;
    this.hitY = height - HIT_Y_OFFSET;

    // Draw lanes
    const laneGfx = this.add.graphics();
    this.laneX = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      const x = lanesStartX + i * this.laneWidth + this.laneWidth / 2;
      this.laneX.push(x);
      laneGfx.lineStyle(1, LANE_COLORS[i], 0.15);
      laneGfx.moveTo(x, 0);
      laneGfx.lineTo(x, height);
      laneGfx.strokePath();
    }

    // Hit zone
    this.hitZone = this.add.rectangle(width / 2, this.hitY, width - 30, 6, 0xffffff, 0.2);

    // Lane tap zones
    for (let i = 0; i < LANE_COUNT; i++) {
      const zone = this.add.rectangle(this.laneX[i], this.hitY, this.laneWidth - 4, 60, LANE_COLORS[i], 0.1);
      zone.setInteractive();
      zone.on('pointerdown', () => this.tapLane(i));
    }

    this.timerText = this.add.text(width - 10, 10, '60s', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(1, 0).setDepth(20);

    this.judgmentText = this.add.text(width / 2, this.hitY - 40, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);

    this.isWaitingToStart = true;
    this.emitToUI('game:ready', { slug: this.getGameSlug() });
  }

  startGame(): void {
    this.score = 0;
    this.isGameOver = false;
    this.isWaitingToStart = false;
    this.replayEvents = [];
    this.startTime = Date.now();

    // Clean old notes
    this.notes.forEach(n => n.sprite?.destroy());
    this.notes = [];

    // Generate note pattern from serverSeedHash
    const seed = this.serverSeedHash || 'default';
    for (let i = 0; i < NOTE_COUNT; i++) {
      const charCode = seed.charCodeAt(i % seed.length) + i;
      const lane = charCode % LANE_COUNT;
      const targetTime = 2000 + i * (58000 / NOTE_COUNT); // Spread over 60s with 2s warmup
      this.notes.push({ lane, targetTime, sprite: null, hit: false });
    }

    this.emitToUI('game:started', {});
    this.recordEvent('game_start', { noteCount: NOTE_COUNT });
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.isWaitingToStart || this.isGameOver || !this.startTime) return;

    const elapsed = Date.now() - this.startTime;
    const { height } = this.scale;

    // Timer
    const timeLeft = Math.max(0, 60 - elapsed / 1000);
    this.timerText.setText(`${Math.ceil(timeLeft)}s`);

    if (elapsed >= 62000) {
      this.onTimeUp();
      return;
    }

    // Spawn and move notes
    const travelTime = (height - 40) / this.noteSpeed * 1000;

    for (const note of this.notes) {
      if (note.hit) continue;

      const spawnTime = note.targetTime - travelTime;

      // Create sprite when visible
      if (!note.sprite && elapsed >= spawnTime && elapsed < note.targetTime + 1000) {
        note.sprite = this.add.rectangle(
          this.laneX[note.lane], -20,
          this.laneWidth * 0.6, 16,
          LANE_COLORS[note.lane]
        ).setDepth(5);
      }

      // Move
      if (note.sprite) {
        const progress = (elapsed - spawnTime) / travelTime;
        note.sprite.y = -20 + progress * (this.hitY + 20);

        // Auto-miss if passed too far
        if (note.sprite.y > this.hitY + 80) {
          note.hit = true;
          note.sprite.destroy();
          note.sprite = null;
        }
      }
    }
  }

  private tapLane(lane: number): void {
    if (this.isGameOver || this.isWaitingToStart) return;

    // Find closest unhit note in this lane near the hit zone
    let closestNote: Note | null = null;
    let closestDist = Infinity;

    for (const note of this.notes) {
      if (note.hit || note.lane !== lane || !note.sprite) continue;
      const dist = Math.abs(note.sprite.y - this.hitY);
      if (dist < closestDist) {
        closestDist = dist;
        closestNote = note;
      }
    }

    if (closestNote && closestDist < 60) {
      closestNote.hit = true;
      let judgment: string;
      let points: number;
      let color: string;

      if (closestDist < 30) {
        judgment = 'PERFECT'; points = 3; color = '#ffdd00';
      } else {
        judgment = 'GOOD'; points = 2; color = '#44ff44';
      }

      this.addScore(points);
      this.recordEvent('tap', { lane, judgment, points, score: this.score });

      this.judgmentText.setText(judgment).setColor(color);
      this.tweens.add({ targets: this.judgmentText, alpha: { from: 1, to: 0 }, duration: 400 });

      // Flash effect
      if (closestNote.sprite) {
        this.tweens.add({
          targets: closestNote.sprite,
          scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 150,
          onComplete: () => { closestNote!.sprite?.destroy(); closestNote!.sprite = null; },
        });
      }
    }
  }

  private async onTimeUp(): Promise<void> {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.recordEvent('time_up', { score: this.score });
    await new Promise<void>(resolve => this.time.delayedCall(500, resolve));
    await this.endGame();
  }
}
