import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';

const BLOCKED_WORDS = ['fuck', 'shit', 'dick', 'ass', 'nigger', 'faggot', 'cunt', 'bitch', 'whore', 'slut', 'porn', 'nazi', 'hitler'];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some(word => lower.includes(word));
}

export interface ClanInfo {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  leaderId: string;
  totalXp: number;
  memberCount: number;
  maxMembers: number;
}

export interface ClanMemberInfo {
  userId: string;
  role: string;
  xpContributed: number;
  joinedAt: Date;
}

export async function listClans(limit: number = 20): Promise<ClanInfo[]> {
  const clans = await prisma.clan.findMany({
    orderBy: { totalXp: 'desc' },
    take: Math.min(limit, 50),
  });
  return clans;
}

export async function createClan(userId: string, name: string, tag: string, description?: string): Promise<ClanInfo> {
  // Content moderation
  if (containsProfanity(name) || containsProfanity(tag) || (description && containsProfanity(description))) {
    throw AppError.badRequest('Clan name contains prohibited content');
  }

  const existing = await prisma.clanMember.findUnique({ where: { userId } });
  if (existing) throw AppError.conflict('You are already in a clan');

  const clan = await prisma.clan.create({
    data: { name, tag: tag.toUpperCase(), description: description ?? null, leaderId: userId },
  });

  await prisma.clanMember.create({
    data: { clanId: clan.id, userId, role: 'LEADER' },
  });

  return clan;
}

export async function getClan(clanId: string): Promise<ClanInfo & { members: ClanMemberInfo[] }> {
  const clan = await prisma.clan.findUnique({
    where: { id: clanId },
    include: {
      members: {
        select: { userId: true, role: true, xpContributed: true, joinedAt: true },
        orderBy: { xpContributed: 'desc' },
      },
    },
  });
  if (!clan) throw AppError.notFound('Clan');
  return { ...clan, members: clan.members };
}

export async function joinClan(userId: string, clanId: string): Promise<void> {
  const existing = await prisma.clanMember.findUnique({ where: { userId } });
  if (existing) throw AppError.conflict('You are already in a clan');

  const clan = await prisma.clan.findUnique({ where: { id: clanId } });
  if (!clan) throw AppError.notFound('Clan');
  if (clan.memberCount >= clan.maxMembers) throw AppError.conflict('Clan is full');

  await prisma.$transaction([
    prisma.clanMember.create({ data: { clanId, userId, role: 'MEMBER' } }),
    prisma.clan.update({ where: { id: clanId }, data: { memberCount: { increment: 1 } } }),
  ]);
}

export async function leaveClan(userId: string, clanId: string): Promise<void> {
  const clan = await prisma.clan.findUnique({ where: { id: clanId } });
  if (!clan) throw AppError.notFound('Clan');
  if (clan.leaderId === userId) throw AppError.badRequest('Leader cannot leave. Transfer leadership first.');

  const member = await prisma.clanMember.findFirst({ where: { clanId, userId } });
  if (!member) throw AppError.notFound('Membership');

  await prisma.$transaction([
    prisma.clanMember.delete({ where: { id: member.id } }),
    prisma.clan.update({ where: { id: clanId }, data: { memberCount: { decrement: 1 } } }),
  ]);
}

export async function kickMember(requesterId: string, clanId: string, targetUserId: string): Promise<void> {
  const clan = await prisma.clan.findUnique({ where: { id: clanId } });
  if (!clan) throw AppError.notFound('Clan');

  const requester = await prisma.clanMember.findFirst({ where: { clanId, userId: requesterId } });
  if (!requester || !['LEADER', 'OFFICER'].includes(requester.role)) throw AppError.forbidden('Only leaders/officers can kick');

  const target = await prisma.clanMember.findFirst({ where: { clanId, userId: targetUserId } });
  if (!target) throw AppError.notFound('Member');
  if (target.role === 'LEADER') throw AppError.forbidden('Cannot kick the leader');

  await prisma.$transaction([
    prisma.clanMember.delete({ where: { id: target.id } }),
    prisma.clan.update({ where: { id: clanId }, data: { memberCount: { decrement: 1 } } }),
  ]);
}

export async function promoteMember(requesterId: string, clanId: string, targetUserId: string): Promise<void> {
  const clan = await prisma.clan.findUnique({ where: { id: clanId } });
  if (!clan) throw AppError.notFound('Clan');
  if (clan.leaderId !== requesterId) throw AppError.forbidden('Only the leader can promote');

  await prisma.clanMember.updateMany({
    where: { clanId, userId: targetUserId },
    data: { role: 'OFFICER' },
  });
}

export async function getClanLeaderboard(limit: number = 20): Promise<ClanInfo[]> {
  return prisma.clan.findMany({
    orderBy: { totalXp: 'desc' },
    take: Math.min(limit, 50),
  });
}

export async function addXpToClan(userId: string, xp: number): Promise<void> {
  const member = await prisma.clanMember.findUnique({ where: { userId } });
  if (!member) return;

  await prisma.$transaction([
    prisma.clanMember.update({ where: { id: member.id }, data: { xpContributed: { increment: xp } } }),
    prisma.clan.update({ where: { id: member.clanId }, data: { totalXp: { increment: xp } } }),
  ]);
}
