import Phaser from 'phaser';
import type { ReplayEvent, GameResult, GameSlug, GameInfo } from '@tonplay/shared';
import { api } from '@/utils/api';
import { FairnessEngine } from '@/core/FairnessEngine';

/**
 * Abstract base class for all TONPLAY Phaser game scenes.
 *
 * Provides the shared session lifecycle (wager, replay recording, scoring,
 * provable-fairness hooks) so each concrete game only implements gameplay.
 *
 * Lifecycle:
 *   1. Scene `create()` runs  ->  game emits 'game:ready'
 *   2. React UI calls `startWager()` after player confirms wager
 *   3. `startGame()` is called once the session is activated
 *   4. `endGame()` is called when the game finishes  ->  submits to server
 *
 * Communication with the React overlay is done via `emitToUI()` which fires
 * events on the Phaser game's global event emitter.
 */
export abstract class BaseGame extends Phaser.Scene {
  // -- Session state ----------------------------------------------------------

  /** Unique session UUID, set during wager flow */
  public sessionId: string = '';

  /** Current score, managed by the concrete game class */
  public score: number = 0;

  /** Amount the player wagered on this session (in tickets) */
  public wagerAmount: number = 0;

  /** SHA-256 hash of the server seed, received before gameplay begins */
  public serverSeedHash: string = '';

  /** Client-generated seed for provable fairness */
  public clientSeed: string = '';

  /** Ordered list of replay events for server-side verification */
  public replayEvents: ReplayEvent[] = [];

  /** Epoch ms when the game actually started (after `startGame()`) */
  public startTime: number = 0;

  /** True once the game has ended (collision, timeout, etc.) */
  public isGameOver: boolean = false;

  /** Prevents double-submission of game results */
  private _hasSubmitted: boolean = false;

  /** Game info from the registry */
  protected gameInfo: GameInfo | null = null;

  /** Internal frame counter used for replay event timestamps */
  private _frameCount: number = 0;

  // -- Seeded PRNG (provably fair randomness) ---------------------------------

  /**
   * Deterministic PRNG seeded from combined server+client seed.
   * Games MUST use this instead of Math.random() for any gameplay-affecting
   * randomness so the server can reproduce all outcomes during verification.
   * Falls back to Math.random in dev/local mode.
   */
  protected rng: () => number = Math.random;

  /** Create a Mulberry32 PRNG from a 32-bit integer seed */
  private createMulberry32(seed: number): () => number {
    let state = seed | 0;
    return () => {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Initialize the seeded PRNG from server and client seeds */
  private async initSeededRng(): Promise<void> {
    if (!this.serverSeedHash || !this.clientSeed) return;
    const combined = await FairnessEngine.combinedSeed(this.serverSeedHash, this.clientSeed);
    const seed = parseInt(combined.substring(0, 8), 16);
    this.rng = this.createMulberry32(seed);
  }

  /** Seeded random integer between min and max (inclusive) */
  protected rngBetween(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  /** Seeded random float between min and max */
  protected rngFloat(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  /** Pick a random element from an array using seeded PRNG */
  protected rngPick<T>(arr: T[]): T {
    return arr[Math.floor(this.rng() * arr.length)];
  }

  /** Fisher-Yates shuffle using seeded PRNG (returns new array) */
  protected rngShuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // -- Abstract methods every game must implement -----------------------------

  /** Return the URL-safe slug that identifies this game (e.g. 'flappy-rocket') */
  abstract getGameSlug(): GameSlug;

  /** Called when the session is activated. Resets state and starts gameplay. */
  abstract startGame(): void;

  /**
   * Return the payout multiplier for the current score.
   * The server uses the same function for verification, so this must be deterministic.
   * Examples: 0 = lose wager, 1.0 = break even, 2.0 = double, etc.
   */
  abstract calculateMultiplier(): number;

  // -- Initialization ---------------------------------------------------------

  /**
   * Initialize scene. Reads wager data from the Phaser registry.
   */
  init(): void {
    this.wagerAmount = this.registry.get('wagerAmount') ?? 0;
    this.gameInfo = this.registry.get('gameInfo') ?? null;
    this.score = 0;
    this.isGameOver = false;
    this._hasSubmitted = false;
    this.replayEvents = [];
    this.sessionId = '';
    this.serverSeedHash = '';
    this.clientSeed = '';
    this._frameCount = 0;
    this.startTime = 0;
    this.rng = Math.random;
  }

  // -- Wager lifecycle --------------------------------------------------------

  /**
   * Start the wager flow: create session on server, activate, then start gameplay.
   * Can be called from the React UI layer or from `startWagerConfig()` for simpler usage.
   */
  async startWager(amount: number): Promise<void> {
    this.wagerAmount = amount;
    this.isGameOver = false;
    this._hasSubmitted = false;

    try {
      // Step 1: Create a game session on the server
      const sessionResponse = await api.post<{
        sessionId: string;
        serverSeedHash: string;
      }>('/game/session/start', {
        gameSlug: this.getGameSlug(),
        wagerAmount: amount,
      });

      this.sessionId = sessionResponse.sessionId;
      this.serverSeedHash = sessionResponse.serverSeedHash;

      // Step 2: Generate a client seed for provable fairness
      this.clientSeed = FairnessEngine.generateClientSeed();

      // Step 3: Activate the session (commits the client seed)
      await api.post(`/game/session/${this.sessionId}/activate`, {
        clientSeed: this.clientSeed,
      });

      // Step 4: Initialize seeded PRNG for provably fair randomness
      await this.initSeededRng();

      // Step 5: Start the game
      this.startTime = Date.now();
      this.recordEvent('game_start', { wager: amount });
      this.startGame();
    } catch (err) {
      console.error('[BaseGame] Failed to start wager flow:', err);
      this.emitToUI('game:error', {
        message: 'Failed to start game session. Please try again.',
      });
    }
  }

  /**
   * Simplified wager configuration (called by the React wrapper
   * when the session is already created server-side).
   */
  startWagerConfig(config: {
    sessionId: string;
    wagerAmount: number;
    serverSeedHash: string;
  }): void {
    this.sessionId = config.sessionId;
    this.wagerAmount = config.wagerAmount;
    this.serverSeedHash = config.serverSeedHash;
  }

  // -- Replay recording -------------------------------------------------------

  /**
   * Record a game event into the replay log.
   * Called by the concrete game class whenever a meaningful action occurs
   * (tap, collision, score change, obstacle spawn, etc.).
   */
  recordEvent(action: string, params?: Record<string, unknown>): void {
    const elapsed = this.startTime ? Date.now() - this.startTime : 0;
    this.replayEvents.push({
      frame: this._frameCount,
      timestamp: elapsed,
      action,
      params,
    });
  }

  // -- Score management -------------------------------------------------------

  /**
   * Update the score and notify the React UI.
   */
  protected updateScore(newScore: number): void {
    this.score = newScore;
    this.game.events.emit('game:score-update', newScore);
  }

  /**
   * Add to the current score and notify the React UI.
   */
  protected addScore(points: number): void {
    this.updateScore(this.score + points);
  }

  // -- UI communication -------------------------------------------------------

  /**
   * Emit an event to the React overlay layer via Phaser's global event system.
   * The React `<GamePage>` component listens on `game.events`.
   */
  emitToUI(event: string, data: unknown): void {
    this.game.events.emit(event, data);
  }

  // -- Game end ---------------------------------------------------------------

  /**
   * Finalize the game session: compute multiplier, submit score and replay
   * to the server, and emit the result to the React layer.
   */
  async endGame(): Promise<GameResult | null> {
    if (this._hasSubmitted) return null;
    this._hasSubmitted = true;
    this.isGameOver = true;

    const multiplier = this.calculateMultiplier();
    const payout = Math.floor(this.wagerAmount * multiplier);

    this.recordEvent('game_end', {
      score: this.score,
      multiplier,
      payout,
    });

    // If no server session (dev mode), return a local result
    if (!this.sessionId || this.sessionId.startsWith('local')) {
      const mockResult: GameResult = {
        sessionId: 'local-' + Date.now(),
        score: this.score,
        payout,
        payoutCurrency: 'TICKET',
        multiplier,
        serverSeed: 'local-seed-' + Date.now().toString(36),
        serverSeedHash: this.serverSeedHash,
        isVerified: false,
      };
      this.emitToUI('game:over', mockResult);
      return mockResult;
    }

    try {
      // Compress replay data to base64 for transport
      const replayJson = JSON.stringify(this.replayEvents);
      const replayData = btoa(replayJson);

      // Generate replay hash from the raw JSON
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(replayJson));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const replayHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      // Submit score and replay to the server
      const result = await api.post<GameResult>(
        `/game/session/${this.sessionId}/complete`,
        {
          score: this.score,
          replayHash,
          replayData,
          duration: Date.now() - this.startTime,
        },
      );

      // Enrich result with serverSeedHash for client-side verification
      const enrichedResult = { ...result, serverSeedHash: this.serverSeedHash };
      this.emitToUI('game:over', enrichedResult);
      return enrichedResult;
    } catch (err) {
      console.error('[BaseGame] Failed to submit game result:', err);

      // Return a fallback result so the player sees something
      const fallbackResult: GameResult = {
        sessionId: this.sessionId,
        score: this.score,
        payout: 0,
        payoutCurrency: 'TICKET',
        multiplier: 0,
        serverSeed: '',
        serverSeedHash: this.serverSeedHash,
        isVerified: false,
      };

      this.emitToUI('game:over', fallbackResult);
      return fallbackResult;
    }
  }

  // -- Utility ----------------------------------------------------------------

  /**
   * Clamp a value between min and max.
   */
  protected clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Get elapsed time in seconds since game start.
   */
  protected getElapsedSeconds(): number {
    if (this.startTime === 0) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  // -- Phaser lifecycle hooks -------------------------------------------------

  /**
   * Increment the internal frame counter every update tick.
   * Concrete games should call `super.update(time, delta)` if they override `update()`.
   */
  update(_time: number, _delta: number): void {
    if (!this.isGameOver && this.startTime) {
      this._frameCount++;
    }
  }

  /**
   * Cleanup when the scene is shut down (e.g. game destroyed).
   * Removes input listeners and timers to prevent memory leaks
   * and errors from async operations referencing destroyed objects.
   */
  shutdown(): void {
    this.input.removeAllListeners();
    if (this.input.keyboard) {
      this.input.keyboard.removeAllListeners();
    }
    this.tweens.killAll();
    this.time.removeAllEvents();
  }
}
