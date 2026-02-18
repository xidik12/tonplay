/**
 * Union type of all available game slugs in the TONPLAY platform.
 * Each slug uniquely identifies a game and is used in URLs, API routes, and database records.
 */
export type GameSlug =
  | 'flappy-rocket'
  | 'neon-runner'
  | 'snake-arena'
  | 'pixel-blaster'
  | 'fruit-slash'
  | 'slot-spin'
  | 'dice-duel'
  | 'coin-train'
  | 'coin-dropper'
  | 'plinko-drop'
  | 'tower-stack'
  | 'bubble-pop'
  | 'block-crush'
  | 'memory-cards'
  | 'rhythm-tap';

/**
 * Lifecycle status of a game session.
 *
 * Flow: pending -> active -> completed -> verified | rejected
 *
 * - `pending`   — Session created, waiting for client to start
 * - `active`    — Game is in progress
 * - `completed` — Client submitted score, awaiting server verification
 * - `verified`  — Score verified via replay validation, payout issued
 * - `rejected`  — Score failed verification (cheating detected or invalid replay)
 */
export type GameStatus = 'pending' | 'active' | 'completed' | 'verified' | 'rejected';

/**
 * Game category for UI grouping and filtering.
 */
export type GameCategory = 'arcade' | 'casino' | 'physics' | 'puzzle';

/**
 * Static metadata for a game. Used to render game cards,
 * enforce wager limits, and configure the game lobby.
 */
export interface GameInfo {
  /** Unique game identifier used in routes and DB */
  slug: GameSlug;
  /** Human-readable display name */
  name: string;
  /** Short description shown in the game lobby */
  description: string;
  /** URL to the game's thumbnail image */
  thumbnailUrl: string;
  /** Minimum wager amount in tickets */
  minWager: number;
  /** Maximum wager amount in tickets */
  maxWager: number;
  /** Maximum achievable score (used for payout curve normalization) */
  maxScore: number;
  /** Game category for UI grouping */
  category: GameCategory;
  /** Whether the game is currently playable */
  enabled: boolean;
}

/**
 * A single game session representing one play attempt.
 * Contains all data needed for wager settlement and replay verification.
 */
export interface GameSession {
  /** Unique session UUID */
  id: string;
  /** ID of the user who started the session */
  userId: string;
  /** Slug of the game being played */
  gameSlug: GameSlug;
  /** Current session lifecycle status */
  status: GameStatus;
  /** Amount wagered to enter this session */
  wagerAmount: number;
  /** Currency used for the wager */
  wagerCurrency: string;
  /**
   * SHA-256 hash of the server seed, revealed to the client before gameplay.
   * The actual server seed is disclosed after completion for provable fairness.
   */
  serverSeedHash: string;
  /** Client-provided seed for provable fairness (optional, set by player) */
  clientSeed?: string;
  /** Final score submitted by the game client */
  score?: number;
  /**
   * SHA-256 hash of the compressed replay data.
   * Used to verify that the submitted replay matches the claimed score.
   */
  replayHash?: string;
  /** Rewards issued for this session (e.g., XP, bonus tickets) */
  rewards?: Record<string, number>;
  /** ISO 8601 timestamp when the session was created */
  startedAt: string;
  /** ISO 8601 timestamp when the session was completed (score submitted) */
  completedAt?: string;
}

/**
 * A single event in a game replay recording.
 * Replays are an ordered array of these events, used for server-side score verification.
 */
export interface ReplayEvent {
  /** Frame number in the game loop when this event occurred */
  frame: number;
  /** Milliseconds elapsed since session start */
  timestamp: number;
  /** Action identifier (e.g., 'tap', 'swipe', 'move', 'collision', 'score') */
  action: string;
  /** Action-specific parameters */
  params?: Record<string, unknown>;
}

/**
 * Final result of a verified game session.
 * Returned to the client after server-side replay validation.
 */
export interface GameResult {
  /** Session UUID */
  sessionId: string;
  /** Verified final score */
  score: number;
  /** Payout amount awarded to the player */
  payout: number;
  /** Currency of the payout */
  payoutCurrency: string;
  /** Score-to-payout multiplier applied */
  multiplier: number;
  /** Revealed server seed for provable fairness verification */
  serverSeed: string;
  /** SHA-256 hash of the server seed (committed before gameplay) for client-side verification */
  serverSeedHash?: string;
  /** Whether the replay passed server-side verification */
  isVerified: boolean;
}
