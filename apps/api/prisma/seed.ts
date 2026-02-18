import { PrismaClient } from '@prisma/client';
import { GAME_LIST } from '@tonplay/shared';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // ── Seed Games ──────────────────────────────────────────────────────────────
  console.log(`Seeding ${GAME_LIST.length} games...`);

  for (const game of GAME_LIST) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {
        name: game.name,
        description: game.description,
        thumbnailUrl: game.thumbnailUrl,
        category: game.category,
        entryCostMin: game.minWager,
        entryCostMax: game.maxWager,
        maxScore: game.maxScore,
        enabled: game.enabled,
      },
      create: {
        slug: game.slug,
        name: game.name,
        description: game.description,
        thumbnailUrl: game.thumbnailUrl,
        category: game.category,
        entryCostMin: game.minWager,
        entryCostMax: game.maxWager,
        maxScore: game.maxScore,
        maxDurationMs: 300000, // 5 minutes
        minDurationMs: 3000,   // 3 seconds
        enabled: game.enabled,
      },
    });
  }

  console.log(`Seeded ${GAME_LIST.length} games`);

  // ── Seed Daily Missions ─────────────────────────────────────────────────────
  const missions = [
    {
      slug: 'daily-play-3',
      title: 'Play 3 Games',
      description: 'Complete 3 games today',
      type: 'PLAY_GAMES',
      targetValue: 3,
      rewardType: 'TICKET',
      rewardAmount: 50,
      isDaily: true,
    },
    {
      slug: 'daily-win-1',
      title: 'Win a Game',
      description: 'Win at least 1 game today',
      type: 'WIN_GAMES',
      targetValue: 1,
      rewardType: 'TICKET',
      rewardAmount: 75,
      isDaily: true,
    },
    {
      slug: 'daily-score-500',
      title: 'Score Hunter',
      description: 'Accumulate a total score of 500 across all games today',
      type: 'SCORE_TOTAL',
      targetValue: 500,
      rewardType: 'TICKET',
      rewardAmount: 100,
      isDaily: true,
    },
  ];

  console.log(`Seeding ${missions.length} daily missions...`);

  for (const mission of missions) {
    await prisma.mission.upsert({
      where: { slug: mission.slug },
      update: {
        title: mission.title,
        description: mission.description,
        type: mission.type,
        targetValue: mission.targetValue,
        rewardType: mission.rewardType,
        rewardAmount: mission.rewardAmount,
        isDaily: mission.isDaily,
      },
      create: mission,
    });
  }

  console.log(`Seeded ${missions.length} daily missions`);

  // ── Seed Sample Tournament ──────────────────────────────────────────────────
  console.log('Seeding sample tournament...');

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const flappyGame = await prisma.game.findUnique({ where: { slug: 'flappy-rocket' } });
  if (flappyGame) {
    await prisma.tournament.upsert({
      where: { id: 'sample-tournament-001' },
      update: {},
      create: {
        id: 'sample-tournament-001',
        name: 'Weekly Flappy Showdown',
        gameId: flappyGame.id,
        entryFee: 50,
        prizePool: 5000,
        maxEntries: 100,
        startTime: now,
        endTime: weekFromNow,
        status: 'active',
      },
    });
    console.log('Seeded sample tournament');
  }

  // ── Seed Sample Season + Rewards ────────────────────────────────────────────
  console.log('Seeding sample season...');

  const seasonEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const season = await prisma.season.upsert({
    where: { id: 'season-001' },
    update: {},
    create: {
      id: 'season-001',
      name: 'Season 1: Genesis',
      startDate: now,
      endDate: seasonEnd,
      maxLevel: 50,
      premiumPrice: 1000,
      isActive: true,
    },
  });

  // Add some season rewards
  const seasonRewards = [
    { level: 1, rewardType: 'TICKET', rewardAmount: 100, isPremium: false },
    { level: 5, rewardType: 'TICKET', rewardAmount: 250, isPremium: false },
    { level: 5, rewardType: 'TICKET', rewardAmount: 500, isPremium: true },
    { level: 10, rewardType: 'TICKET', rewardAmount: 500, isPremium: false },
    { level: 10, rewardType: 'TPLAY', rewardAmount: 50, isPremium: true },
    { level: 25, rewardType: 'TICKET', rewardAmount: 1000, isPremium: false },
    { level: 25, rewardType: 'TPLAY', rewardAmount: 200, isPremium: true },
    { level: 50, rewardType: 'TPLAY', rewardAmount: 500, isPremium: false },
    { level: 50, rewardType: 'TPLAY', rewardAmount: 1000, isPremium: true },
  ];

  for (const reward of seasonRewards) {
    await prisma.seasonReward.upsert({
      where: {
        seasonId_level_isPremium: {
          seasonId: season.id,
          level: reward.level,
          isPremium: reward.isPremium,
        },
      },
      update: {},
      create: {
        seasonId: season.id,
        level: reward.level,
        rewardType: reward.rewardType,
        rewardAmount: reward.rewardAmount,
        isPremium: reward.isPremium,
      },
    });
  }

  console.log(`Seeded season with ${seasonRewards.length} rewards`);

  // ── Seed Sample NFT Collection ──────────────────────────────────────────────
  console.log('Seeding sample NFT collection...');

  const collection = await prisma.nftCollection.upsert({
    where: { id: 'collection-001' },
    update: {},
    create: {
      id: 'collection-001',
      name: 'Genesis Avatars',
      maxSupply: 1000,
      metadata: { description: 'The first TONPLAY avatar collection. OG players only.', mintPrice: 100, mintCurrency: 'TPLAY' },
    },
  });

  const nftItems = [
    { tokenIndex: 1, name: 'Pixel Pilot', rarity: 'COMMON', imageUrl: '/nft/pixel-pilot.webp', metadata: { boost: 'none' } },
    { tokenIndex: 2, name: 'Neon Ninja', rarity: 'RARE', imageUrl: '/nft/neon-ninja.webp', metadata: { boost: '+5% XP' } },
    { tokenIndex: 3, name: 'Crystal Knight', rarity: 'EPIC', imageUrl: '/nft/crystal-knight.webp', metadata: { boost: '+10% XP' } },
    { tokenIndex: 4, name: 'TON Titan', rarity: 'LEGENDARY', imageUrl: '/nft/ton-titan.webp', metadata: { boost: '+20% XP' } },
  ];

  for (const item of nftItems) {
    await prisma.nftItem.upsert({
      where: {
        collectionId_tokenIndex: {
          collectionId: collection.id,
          tokenIndex: item.tokenIndex,
        },
      },
      update: {},
      create: {
        collectionId: collection.id,
        tokenIndex: item.tokenIndex,
        name: item.name,
        rarity: item.rarity,
        imageUrl: item.imageUrl,
        metadata: item.metadata,
      },
    });
  }

  console.log(`Seeded NFT collection with ${nftItems.length} items`);
  console.log('Database seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
