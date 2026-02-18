/**
 * Raw Telegram user data received from the Telegram Mini App init data.
 * This is the shape parsed from `WebAppInitData.user`.
 */
export interface TelegramUser {
  /** Telegram user ID */
  id: number;
  /** User's first name */
  firstName: string;
  /** User's last name (optional in Telegram) */
  lastName?: string;
  /** Telegram username without the @ prefix */
  username?: string;
  /** IETF language tag of the user's Telegram client */
  languageCode?: string;
  /** Whether the user has Telegram Premium */
  isPremium?: boolean;
}

/**
 * Internal TONPLAY user record stored in the database.
 * Created upon first authentication via Telegram Mini App.
 */
export interface User {
  /** Internal UUID */
  id: string;
  /** Telegram user ID stored as bigint to handle large IDs */
  telegramId: bigint;
  /** Telegram username (synced on each login) */
  username: string;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** IETF language tag */
  languageCode: string;
  /** Whether the user has Telegram Premium */
  isPremium: boolean;
  /** Free-play ticket balance (soft currency) */
  ticketBalance: number;
  /** TPLAY token balance (on-chain currency, stored as raw units) */
  tplayBalance: number;
  /** Total experience points earned */
  xp: number;
  /** Current level derived from XP thresholds */
  level: number;
  /** Whether the user is banned from the platform */
  isBanned: boolean;
  /** Unique referral code for sharing */
  referralCode: string;
  /** ISO 8601 timestamp of account creation */
  createdAt: string;
  /** ISO 8601 timestamp of last profile update */
  updatedAt: string;
}

/**
 * Aggregated gameplay statistics for a user.
 * Computed from historical game sessions.
 */
export interface UserStats {
  /** Total number of games played */
  totalGamesPlayed: number;
  /** Total amount wagered across all games (in tickets) */
  totalWagered: number;
  /** Total amount won across all games (in tickets) */
  totalWon: number;
  /** Win rate as a percentage (0-100) */
  winRate: number;
  /** Highest single-game score */
  highestScore: number;
  /** Current daily login/play streak */
  currentStreak: number;
  /** Longest streak ever achieved */
  longestStreak: number;
  /** Number of referred users */
  referralCount: number;
  /** Number of completed missions */
  missionsCompleted: number;
  /** Clan name if user belongs to one */
  clanName: string | null;
  /** Slug of the most frequently played game, or null if none */
  favoriteGame?: string | null;
}

/**
 * Public-facing user profile visible to other players.
 * Omits sensitive fields like balances and ban status.
 */
export interface PublicProfile {
  /** Internal UUID */
  id: string;
  /** Telegram username */
  username: string | null;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string | null;
  /** Current level */
  level: number;
  /** Total experience points */
  xp: number;
  /** Account creation date */
  createdAt: string;
}
