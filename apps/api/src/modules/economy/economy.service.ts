import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import type { OffsetPagination } from '../../lib/pagination.js';
import { toOffsetPrisma } from '../../lib/pagination.js';

export interface BalanceInfo {
  ticketBalance: number;
  tplayBalance: string;
}

export interface TransactionRecord {
  id: string;
  type: string;
  currency: string;
  amount: string;
  direction: string;
  balanceBefore: string;
  balanceAfter: string;
  txHash: string | null;
  memo: string | null;
  sessionId: string | null;
  createdAt: Date;
}

/**
 * Gets a user's current balances.
 */
export async function getBalance(userId: string): Promise<BalanceInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ticketBalance: true,
      tplayBalance: true,
    },
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  return {
    ticketBalance: user.ticketBalance,
    tplayBalance: user.tplayBalance.toString(),
  };
}

/**
 * Gets paginated transaction history for a user.
 */
export async function getTransactions(
  userId: string,
  pagination: OffsetPagination,
  filters?: {
    type?: string;
    currency?: string;
    direction?: string;
  }
): Promise<{ transactions: TransactionRecord[]; total: number }> {
  const where: Prisma.TransactionWhereInput = {
    userId,
    ...(filters?.type && { type: filters.type }),
    ...(filters?.currency && { currency: filters.currency }),
    ...(filters?.direction && { direction: filters.direction }),
  };

  const { skip, take } = toOffsetPrisma(pagination);

  const [transactions, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      currency: tx.currency,
      amount: tx.amount.toString(),
      direction: tx.direction,
      balanceBefore: tx.balanceBefore.toString(),
      balanceAfter: tx.balanceAfter.toString(),
      txHash: tx.txHash,
      memo: tx.memo,
      sessionId: tx.sessionId,
      createdAt: tx.createdAt,
    })),
    total,
  };
}

/**
 * Credits tickets to a user's balance with a transaction log.
 * Uses a Prisma interactive transaction for atomicity.
 */
export async function creditTickets(
  userId: string,
  amount: number,
  type: string,
  memo?: string,
  sessionId?: string
): Promise<BalanceInfo> {
  if (amount <= 0) {
    throw AppError.badRequest('Credit amount must be positive');
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { ticketBalance: true, tplayBalance: true },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    const balanceBefore = user.ticketBalance;
    const balanceAfter = balanceBefore + amount;

    // Update balance
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { ticketBalance: { increment: amount } },
      select: { ticketBalance: true, tplayBalance: true },
    });

    // Log transaction
    await tx.transaction.create({
      data: {
        userId,
        type,
        currency: 'TICKET',
        amount,
        direction: 'CREDIT',
        balanceBefore,
        balanceAfter,
        memo: memo ?? null,
        sessionId: sessionId ?? null,
      },
    });

    return updatedUser;
  });

  return {
    ticketBalance: result.ticketBalance,
    tplayBalance: result.tplayBalance.toString(),
  };
}

/**
 * Debits tickets from a user's balance with a transaction log.
 * Checks for sufficient balance before deducting.
 */
export async function debitTickets(
  userId: string,
  amount: number,
  type: string,
  memo?: string,
  sessionId?: string
): Promise<BalanceInfo> {
  if (amount <= 0) {
    throw AppError.badRequest('Debit amount must be positive');
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { ticketBalance: true, tplayBalance: true },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    if (user.ticketBalance < amount) {
      throw AppError.insufficientBalance('TICKET');
    }

    const balanceBefore = user.ticketBalance;
    const balanceAfter = balanceBefore - amount;

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { ticketBalance: { decrement: amount } },
      select: { ticketBalance: true, tplayBalance: true },
    });

    await tx.transaction.create({
      data: {
        userId,
        type,
        currency: 'TICKET',
        amount,
        direction: 'DEBIT',
        balanceBefore,
        balanceAfter,
        memo: memo ?? null,
        sessionId: sessionId ?? null,
      },
    });

    return updatedUser;
  });

  return {
    ticketBalance: result.ticketBalance,
    tplayBalance: result.tplayBalance.toString(),
  };
}

/**
 * Credits TPLAY tokens to a user's balance with a transaction log.
 */
export async function creditTplay(
  userId: string,
  amount: number,
  type: string,
  memo?: string,
  txHash?: string
): Promise<BalanceInfo> {
  if (amount <= 0) {
    throw AppError.badRequest('Credit amount must be positive');
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { ticketBalance: true, tplayBalance: true },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    const balanceBefore = Number(user.tplayBalance);
    const balanceAfter = balanceBefore + amount;

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { tplayBalance: { increment: amount } },
      select: { ticketBalance: true, tplayBalance: true },
    });

    await tx.transaction.create({
      data: {
        userId,
        type,
        currency: 'TPLAY',
        amount,
        direction: 'CREDIT',
        balanceBefore,
        balanceAfter,
        memo: memo ?? null,
        txHash: txHash ?? null,
      },
    });

    return updatedUser;
  });

  return {
    ticketBalance: result.ticketBalance,
    tplayBalance: result.tplayBalance.toString(),
  };
}

/**
 * Debits TPLAY tokens from a user's balance with a transaction log.
 */
export async function debitTplay(
  userId: string,
  amount: number,
  type: string,
  memo?: string,
  txHash?: string
): Promise<BalanceInfo> {
  if (amount <= 0) {
    throw AppError.badRequest('Debit amount must be positive');
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { ticketBalance: true, tplayBalance: true },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    const tplayBalance = Number(user.tplayBalance);
    if (tplayBalance < amount) {
      throw AppError.insufficientBalance('TPLAY');
    }

    const balanceBefore = tplayBalance;
    const balanceAfter = balanceBefore - amount;

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { tplayBalance: { decrement: amount } },
      select: { ticketBalance: true, tplayBalance: true },
    });

    await tx.transaction.create({
      data: {
        userId,
        type,
        currency: 'TPLAY',
        amount,
        direction: 'DEBIT',
        balanceBefore,
        balanceAfter,
        memo: memo ?? null,
        txHash: txHash ?? null,
      },
    });

    return updatedUser;
  });

  return {
    ticketBalance: result.ticketBalance,
    tplayBalance: result.tplayBalance.toString(),
  };
}
