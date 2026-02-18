/** Maximum number of active game sessions a user can have simultaneously */
export const MAX_CONCURRENT_SESSIONS = 1;

/** Time window in milliseconds for API rate limiting (1 minute) */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Maximum number of API requests allowed per rate limit window */
export const RATE_LIMIT_MAX_REQUESTS = 100;

/** Maximum size of a compressed replay payload in bytes (500 KB) */
export const MAX_REPLAY_SIZE_BYTES = 512_000;

/** Maximum allowed game session duration in milliseconds (5 minutes) */
export const MAX_GAME_DURATION_MS = 300_000;

/** Minimum required game session duration in milliseconds (3 seconds) */
export const MIN_GAME_DURATION_MS = 3_000;

/** Timeout for server-side score verification in milliseconds (30 seconds) */
export const SCORE_VERIFICATION_TIMEOUT_MS = 30_000;

/** Number of entries returned per leaderboard page */
export const LEADERBOARD_PAGE_SIZE = 50;

/** Maximum number of members allowed in a single clan */
export const MAX_CLAN_MEMBERS = 50;

/** Maximum number of daily missions available to a user */
export const MAX_DAILY_MISSIONS = 3;

/** JWT access token expiry duration in seconds (24 hours) */
export const JWT_EXPIRY_SECONDS = 86_400;
