/**
 * Events emitted by the server to connected WebSocket clients.
 */
export type ServerEvent =
  | 'leaderboard:update'
  | 'balance:update'
  | 'notification'
  | 'tournament:update'
  | 'game:verified';

/**
 * Events emitted by WebSocket clients to the server.
 */
export type ClientEvent =
  | 'leaderboard:subscribe'
  | 'leaderboard:unsubscribe';

// ---------------------------------------------------------------------------
// Server event payloads
// ---------------------------------------------------------------------------

/** Payload for `leaderboard:update` — a snapshot of the top entries. */
export interface LeaderboardUpdatePayload {
  /** Which leaderboard was updated (e.g., game slug or 'global') */
  leaderboardId: string;
  /** Ordered list of leaderboard entries */
  entries: LeaderboardEntry[];
}

/** A single row in a leaderboard. */
export interface LeaderboardEntry {
  /** Rank position (1-based) */
  rank: number;
  /** User ID */
  userId: string;
  /** Display username */
  username: string;
  /** Score or metric value */
  score: number;
}

/** Payload for `balance:update` — pushed when a user's balance changes. */
export interface BalanceUpdatePayload {
  /** User ID whose balance changed */
  userId: string;
  /** Updated ticket balance */
  ticketBalance: number;
  /** Updated TPLAY balance */
  tplayBalance: number;
}

/** Payload for `notification` — generic in-app notification. */
export interface NotificationPayload {
  /** Notification type for client-side routing */
  type: 'info' | 'success' | 'warning' | 'error';
  /** Notification title */
  title: string;
  /** Notification body text */
  message: string;
  /** Optional deep-link or action URL */
  actionUrl?: string;
}

/** Payload for `tournament:update` — tournament state change. */
export interface TournamentUpdatePayload {
  /** Tournament ID */
  tournamentId: string;
  /** New status of the tournament */
  status: string;
  /** Current number of entries */
  currentEntries: number;
  /** Updated leaderboard entries (top players) */
  leaderboard?: LeaderboardEntry[];
}

/** Payload for `game:verified` — pushed when a game session is verified. */
export interface GameVerifiedPayload {
  /** Session UUID */
  sessionId: string;
  /** Verified score */
  score: number;
  /** Payout amount */
  payout: number;
  /** Payout currency */
  payoutCurrency: string;
  /** Whether verification passed */
  isVerified: boolean;
}

// ---------------------------------------------------------------------------
// Client event payloads
// ---------------------------------------------------------------------------

/** Payload for `leaderboard:subscribe` — subscribe to live leaderboard updates. */
export interface LeaderboardSubscribePayload {
  /** Which leaderboard to subscribe to (e.g., game slug or 'global') */
  leaderboardId: string;
}

/** Payload for `leaderboard:unsubscribe` — stop receiving leaderboard updates. */
export interface LeaderboardUnsubscribePayload {
  /** Which leaderboard to unsubscribe from */
  leaderboardId: string;
}

// ---------------------------------------------------------------------------
// Type-safe event payload maps
// ---------------------------------------------------------------------------

/**
 * Maps each server event name to its payload type.
 * Use with generic event handlers for full type safety:
 *
 * ```ts
 * function onServerEvent<E extends ServerEvent>(
 *   event: E,
 *   payload: ServerEventPayloads[E]
 * ): void { ... }
 * ```
 */
export interface ServerEventPayloads {
  'leaderboard:update': LeaderboardUpdatePayload;
  'balance:update': BalanceUpdatePayload;
  'notification': NotificationPayload;
  'tournament:update': TournamentUpdatePayload;
  'game:verified': GameVerifiedPayload;
}

/**
 * Maps each client event name to its payload type.
 * Use with generic event emitters for full type safety:
 *
 * ```ts
 * function emitClientEvent<E extends ClientEvent>(
 *   event: E,
 *   payload: ClientEventPayloads[E]
 * ): void { ... }
 * ```
 */
export interface ClientEventPayloads {
  'leaderboard:subscribe': LeaderboardSubscribePayload;
  'leaderboard:unsubscribe': LeaderboardUnsubscribePayload;
}
