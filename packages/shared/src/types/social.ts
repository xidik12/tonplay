/**
 * Referral tier levels. The platform supports two-tier referrals:
 * - Tier 1: Direct referral (higher reward percentage)
 * - Tier 2: Referral of a referral (lower reward percentage)
 */
export type ReferralTier = 1 | 2;

/**
 * A referral relationship between two users.
 * The referrer earns a percentage of the referred user's game entry fees.
 */
export interface Referral {
  /** Unique referral record UUID */
  id: string;
  /** User ID of the referrer (the one who shared the link) */
  referrerId: string;
  /** User ID of the referred user (the one who joined) */
  referredId: string;
  /** Referral tier (1 = direct, 2 = indirect) */
  tier: ReferralTier;
  /** Total earnings accumulated from this referral relationship */
  totalEarnings: number;
  /** ISO 8601 timestamp when the referral was created */
  createdAt: string;
}

/**
 * A player clan (guild/team) for social gameplay and group competitions.
 */
export interface Clan {
  /** Unique clan UUID */
  id: string;
  /** Display name of the clan */
  name: string;
  /** Short tag displayed next to member names (e.g., "[ABC]") */
  tag: string;
  /** Username of the clan leader */
  leaderUsername: string;
  /** Total XP contributed by all clan members */
  totalXp: number;
  /** Current number of members in the clan */
  memberCount: number;
  /** Global clan ranking position (null if unranked) */
  rank?: number;
}

/**
 * Role of a user within a clan, determining their permissions.
 *
 * - `LEADER`  — Full control: manage members, edit settings, disband
 * - `OFFICER` — Can invite/kick members, manage clan activities
 * - `MEMBER`  — Standard member with no management permissions
 */
export type ClanRole = 'LEADER' | 'OFFICER' | 'MEMBER';

/**
 * A user's membership record within a clan.
 */
export interface ClanMember {
  /** User ID of the clan member */
  userId: string;
  /** Display username */
  username: string;
  /** Role within the clan */
  role: ClanRole;
  /** Total XP this member has contributed to the clan */
  xpContributed: number;
  /** ISO 8601 timestamp when the member joined the clan */
  joinedAt: string;
}

/**
 * Types of missions/quests available in the platform.
 * Each type defines what activity the user must perform to progress.
 */
export type MissionType =
  | 'PLAY_GAMES'
  | 'WIN_GAMES'
  | 'SCORE_TOTAL'
  | 'SPEND_TICKETS'
  | 'INVITE_FRIENDS'
  | 'DAILY_LOGIN';

/**
 * A mission (quest) definition. Missions reward players for
 * completing specific gameplay objectives.
 */
export interface Mission {
  /** Unique mission UUID */
  id: string;
  /** URL-friendly identifier for the mission */
  slug: string;
  /** Display title shown to the user */
  title: string;
  /** Detailed description of what the user needs to do */
  description: string;
  /** Type of activity required */
  type: MissionType;
  /** Target value to reach for completion (e.g., 10 games, 500 score) */
  targetValue: number;
  /** Currency/type of the reward (e.g., 'TICKET', 'XP') */
  rewardType: string;
  /** Amount of the reward */
  rewardAmount: number;
  /** Whether this mission resets daily */
  isDaily: boolean;
}

/**
 * A user's progress on a specific mission.
 */
export interface UserMission {
  /** Unique user-mission record UUID */
  id: string;
  /** ID of the mission being tracked */
  missionId: string;
  /** Full mission definition (populated via join) */
  mission: Mission;
  /** Current progress toward the target value */
  progress: number;
  /** Whether the mission objective has been completed */
  isCompleted: boolean;
  /** ISO 8601 timestamp when the reward was claimed (null if unclaimed) */
  claimedAt?: string;
}

/**
 * A user's daily login streak tracking data.
 * Consecutive daily logins earn escalating rewards.
 */
export interface UserStreak {
  /** Number of consecutive days the user has logged in */
  currentStreak: number;
  /** Highest streak ever achieved by this user */
  longestStreak: number;
  /** ISO 8601 date string (YYYY-MM-DD) of the last streak claim */
  lastClaimDate: string;
  /** Ticket reward amount for the next streak claim */
  nextReward: number;
}

/**
 * A seasonal battle pass / season definition.
 * Seasons run for a fixed duration and offer tiered rewards.
 */
export interface Season {
  /** Unique season UUID */
  id: string;
  /** Display name of the season (e.g., "Season 1: Genesis") */
  name: string;
  /** ISO 8601 timestamp when the season starts */
  startDate: string;
  /** ISO 8601 timestamp when the season ends */
  endDate: string;
  /** Cost of the premium battle pass in TPLAY tokens */
  premiumPrice: number;
  /** Maximum level achievable in this season's battle pass */
  maxLevel: number;
  /** Whether this season is currently active */
  isActive: boolean;
}

/**
 * Lifecycle status of a tournament.
 *
 * Flow: UPCOMING -> REGISTRATION -> ACTIVE -> COMPLETED
 *
 * - `UPCOMING`     — Announced but registration has not opened
 * - `REGISTRATION` — Accepting player entries
 * - `ACTIVE`       — Tournament gameplay is in progress
 * - `COMPLETED`    — Tournament has ended, prizes distributed
 */
export type TournamentStatus = 'UPCOMING' | 'REGISTRATION' | 'ACTIVE' | 'COMPLETED';

/**
 * A competitive tournament event where players compete for prizes.
 */
export interface Tournament {
  /** Unique tournament UUID */
  id: string;
  /** Display name of the tournament */
  name: string;
  /** Slug of the game being played in this tournament */
  gameSlug: string;
  /** Current tournament lifecycle status */
  status: TournamentStatus;
  /** Entry fee amount required to participate */
  entryFee: number;
  /** Currency used for the entry fee */
  entryCurrency: string;
  /** Total prize pool (may grow with entries) */
  prizePool: number;
  /** ISO 8601 timestamp when the tournament starts */
  startTime: string;
  /** ISO 8601 timestamp when the tournament ends */
  endTime: string;
  /** Maximum number of entries allowed */
  maxEntries: number;
  /** Current number of entries registered */
  currentEntries: number;
}
