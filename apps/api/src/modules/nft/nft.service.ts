import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';

export interface CollectionInfo {
  id: string;
  name: string;
  contractAddress: string | null;
  maxSupply: number;
  currentSupply: number;
  metadata: unknown;
}

export interface NftItemInfo {
  id: string;
  collectionId: string;
  tokenIndex: number;
  name: string;
  imageUrl: string | null;
  rarity: string;
  level: number;
  xp: number;
  gameBonus: unknown;
}

export interface OwnedNft {
  id: string;
  nftItemId: string;
  isEquipped: boolean;
  acquiredAt: Date;
  item: NftItemInfo;
}

export async function getCollections(): Promise<CollectionInfo[]> {
  return prisma.nftCollection.findMany({ orderBy: { name: 'asc' } });
}

export async function getCollectionItems(collectionId: string, limit: number = 20): Promise<NftItemInfo[]> {
  const items = await prisma.nftItem.findMany({
    where: { collectionId },
    orderBy: { tokenIndex: 'asc' },
    take: Math.min(limit, 100),
  });
  return items.map(i => ({
    id: i.id,
    collectionId: i.collectionId,
    tokenIndex: i.tokenIndex,
    name: i.name,
    imageUrl: i.imageUrl,
    rarity: i.rarity,
    level: i.level,
    xp: i.xp,
    gameBonus: i.gameBonus,
  }));
}

export async function getOwnedNfts(userId: string): Promise<OwnedNft[]> {
  const userNfts = await prisma.userNft.findMany({
    where: { userId },
    include: { nftItem: true },
    orderBy: { acquiredAt: 'desc' },
  });
  return userNfts.map(un => ({
    id: un.id,
    nftItemId: un.nftItemId,
    isEquipped: un.isEquipped,
    acquiredAt: un.acquiredAt,
    item: {
      id: un.nftItem.id,
      collectionId: un.nftItem.collectionId,
      tokenIndex: un.nftItem.tokenIndex,
      name: un.nftItem.name,
      imageUrl: un.nftItem.imageUrl,
      rarity: un.nftItem.rarity,
      level: un.nftItem.level,
      xp: un.nftItem.xp,
      gameBonus: un.nftItem.gameBonus,
    },
  }));
}

export async function equipNft(userId: string, nftId: string): Promise<void> {
  const userNft = await prisma.userNft.findFirst({ where: { id: nftId, userId } });
  if (!userNft) throw AppError.notFound('NFT');
  await prisma.userNft.update({ where: { id: nftId }, data: { isEquipped: true, equippedAt: new Date() } });
}

export async function unequipNft(userId: string, nftId: string): Promise<void> {
  const userNft = await prisma.userNft.findFirst({ where: { id: nftId, userId } });
  if (!userNft) throw AppError.notFound('NFT');
  await prisma.userNft.update({ where: { id: nftId }, data: { isEquipped: false, equippedAt: null } });
}
