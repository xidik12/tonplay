/**
 * Currencies supported by the TONPLAY platform.
 *
 * - `TICKET` — Free-play soft currency, earned daily and through missions
 * - `TPLAY`  — Platform utility token (TON-based jetton)
 * - `TON`    — Native TON blockchain currency for deposits/withdrawals
 */
export type Currency = 'TICKET' | 'TPLAY' | 'TON';

/**
 * Categorization of all possible transaction types in the economy.
 * Used for ledger entries, analytics, and audit trails.
 */
export type TransactionType =
  | 'GAME_ENTRY'
  | 'GAME_WIN'
  | 'MISSION_REWARD'
  | 'STREAK_REWARD'
  | 'REFERRAL_BONUS'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'NFT_PURCHASE'
  | 'TOURNAMENT_ENTRY'
  | 'TOURNAMENT_PRIZE'
  | 'BATTLE_PASS'
  | 'ADMIN';

/**
 * Direction of a transaction relative to the user's balance.
 *
 * - `CREDIT` — Funds added to the user's balance
 * - `DEBIT`  — Funds deducted from the user's balance
 */
export type TransactionDirection = 'CREDIT' | 'DEBIT';

/**
 * Immutable ledger entry representing a single balance change.
 * Every balance mutation in the system produces exactly one Transaction record.
 */
export interface Transaction {
  /** Unique transaction UUID */
  id: string;
  /** ID of the user whose balance was affected */
  userId: string;
  /** Category of the transaction */
  type: TransactionType;
  /** Currency involved in this transaction */
  currency: Currency;
  /** Absolute amount (always positive; direction indicates credit/debit) */
  amount: number;
  /** Whether funds were added or removed */
  direction: TransactionDirection;
  /** User's balance in this currency before the transaction */
  balanceBefore: number;
  /** User's balance in this currency after the transaction */
  balanceAfter: number;
  /** On-chain transaction hash for blockchain-related transactions */
  txHash?: string;
  /** Human-readable memo or reason for the transaction */
  memo?: string;
  /** ISO 8601 timestamp when the transaction was recorded */
  createdAt: string;
}

/**
 * Status of a TON/TPLAY deposit transaction.
 *
 * Flow: PENDING -> CONFIRMING -> CONFIRMED | FAILED
 *
 * - `PENDING`    — Deposit address generated, awaiting incoming transaction
 * - `CONFIRMING` — Transaction detected, waiting for required confirmations
 * - `CONFIRMED`  — Sufficient confirmations reached, balance credited
 * - `FAILED`     — Transaction failed or was not received within timeout
 */
export type DepositStatus = 'PENDING' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED';

/**
 * Status of a TON/TPLAY withdrawal transaction.
 *
 * Flow: PENDING -> PROCESSING -> COMPLETED | FAILED
 *
 * - `PENDING`    — Withdrawal requested, awaiting processing
 * - `PROCESSING` — Transaction submitted to the blockchain
 * - `COMPLETED`  — Transaction confirmed on-chain
 * - `FAILED`     — Transaction failed (insufficient gas, network error, etc.)
 */
export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
