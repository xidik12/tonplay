/** Number of free tickets granted to new users upon registration */
export const STARTING_TICKETS = 500;

/** Maximum number of tickets a user can earn per day (excluding purchases) */
export const DAILY_TICKET_CAP = 5000;

/** Percentage of game entry fees earned by Tier 1 (direct) referrers */
export const REFERRAL_TIER1_PERCENT = 10;

/** Percentage of game entry fees earned by Tier 2 (indirect) referrers */
export const REFERRAL_TIER2_PERCENT = 3;

/**
 * Daily login streak rewards in tickets.
 * Index 0 = Day 1, index 6 = Day 7.
 * After Day 7 the streak resets to Day 1.
 */
export const STREAK_REWARDS: readonly number[] = [50, 75, 100, 150, 200, 300, 500];

/** Maximum number of consecutive streak days before reset */
export const MAX_STREAK_DAYS = 7;

/** Number of decimal places for the TPLAY token (TON jetton standard) */
export const TPLAY_DECIMALS = 9;

/** Minimum TPLAY balance required to initiate a withdrawal */
export const MIN_WITHDRAWAL_TPLAY = 100;

/** Number of on-chain confirmations required before crediting a deposit */
export const DEPOSIT_CONFIRMATIONS = 3;
