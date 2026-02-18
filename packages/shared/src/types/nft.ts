/**
 * Rarity tiers for NFT items. Higher rarity provides greater in-game bonuses.
 */
export type NftRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

/**
 * An NFT collection deployed on the TON blockchain.
 * Each collection contains multiple NFT items following the TEP-62 standard.
 */
export interface NftCollection {
  /** Internal collection UUID */
  id: string;
  /** Display name of the collection */
  name: string;
  /** TON blockchain address of the collection smart contract */
  contractAddress: string;
  /** Maximum number of NFTs that can be minted in this collection */
  maxSupply: number;
  /** Number of NFTs currently minted */
  currentSupply: number;
}

/**
 * A single NFT item within a collection.
 * NFTs provide in-game bonuses such as score multipliers, XP boosts, or ticket bonuses.
 */
export interface NftItem {
  /** Internal NFT item UUID */
  id: string;
  /** ID of the parent collection */
  collectionId: string;
  /** On-chain token index within the collection (TEP-62) */
  tokenIndex: number;
  /** Display name of the NFT */
  name: string;
  /** URL to the NFT artwork/image */
  imageUrl: string;
  /** Rarity tier determining base bonus values */
  rarity: NftRarity;
  /** Current level of the NFT (levels up with XP) */
  level: number;
  /** Experience points accumulated on this NFT */
  xp: number;
  /**
   * In-game bonus percentage provided when equipped.
   * e.g., 0.05 = 5% bonus to score or rewards.
   */
  gameBonus: number;
  /** Arbitrary on-chain metadata (attributes, traits, etc.) */
  metadata: Record<string, unknown>;
}

/**
 * Junction record linking a user to an owned NFT.
 * Tracks ownership and equipped status.
 */
export interface UserNft {
  /** Unique ownership record UUID */
  id: string;
  /** ID of the owning user */
  userId: string;
  /** ID of the NFT item */
  nftItemId: string;
  /** Full NFT item data (populated via join) */
  nft: NftItem;
  /** Whether the NFT is currently equipped for in-game bonuses */
  isEquipped: boolean;
  /** ISO 8601 timestamp when the NFT was equipped (null if not equipped) */
  equippedAt?: string;
}
