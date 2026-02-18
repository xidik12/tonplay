import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';

export interface WalletInfo {
  tonAddress: string | null;
  isConnected: boolean;
}

export interface TransactionInfo {
  id: string;
  type: string;
  currency: string;
  amount: number;
  direction: string;
  status: string;
  txHash: string | null;
  memo: string | null;
  createdAt: Date;
}

export async function getWallet(userId: string): Promise<WalletInfo> {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId } });
  }
  return {
    tonAddress: wallet.tonAddress,
    isConnected: !!wallet.tonAddress,
  };
}

export async function connectWallet(userId: string, tonAddress: string, tonConnectSession?: unknown): Promise<WalletInfo> {
  const wallet = await prisma.wallet.upsert({
    where: { userId },
    create: { userId, tonAddress, tonConnectSession: tonConnectSession ? (tonConnectSession as Prisma.InputJsonValue) : Prisma.JsonNull },
    update: { tonAddress, tonConnectSession: tonConnectSession ? (tonConnectSession as Prisma.InputJsonValue) : Prisma.JsonNull },
  });
  return { tonAddress: wallet.tonAddress, isConnected: true };
}

export async function disconnectWallet(userId: string): Promise<void> {
  await prisma.wallet.updateMany({
    where: { userId },
    data: { tonAddress: null, tonConnectSession: Prisma.JsonNull },
  });
}

export async function initiateDeposit(userId: string, currency: string, amount: number): Promise<{ transactionId: string; depositAddress: string; memo: string }> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw AppError.notFound('Wallet');

  const memo = `dep_${userId.substring(0, 8)}_${Date.now().toString(36)}`;
  const tx = await prisma.pendingTransaction.create({
    data: {
      userId,
      type: 'DEPOSIT',
      currency,
      amount,
      direction: 'CREDIT',
      status: 'PENDING',
      memo,
    },
  });

  const depositAddress = process.env.TON_DEPOSIT_ADDRESS;
  if (!depositAddress) {
    throw AppError.internal('Deposit address not configured');
  }

  return {
    transactionId: tx.id,
    depositAddress,
    memo,
  };
}

export async function initiateWithdrawal(userId: string, currency: string, amount: number, toAddress: string): Promise<{ transactionId: string }> {
  if (currency !== 'TPLAY') throw AppError.badRequest('Only TPLAY withdrawals are supported');
  if (amount <= 0) throw AppError.badRequest('Amount must be positive');

  // Atomic: check balance + deduct + create pending transaction
  const tx = await prisma.$transaction(async (trx) => {
    const user = await trx.user.findUnique({ where: { id: userId }, select: { tplayBalance: true } });
    if (!user) throw AppError.notFound('User');
    if (Number(user.tplayBalance) < amount) throw AppError.insufficientBalance('TPLAY');

    await trx.user.update({
      where: { id: userId },
      data: { tplayBalance: { decrement: amount } },
    });

    return trx.pendingTransaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        currency,
        amount,
        direction: 'DEBIT',
        status: 'PENDING',
        tonAddress: toAddress,
      },
    });
  });

  return { transactionId: tx.id };
}

export async function getTransactions(userId: string, limit: number = 20): Promise<TransactionInfo[]> {
  const txs = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });
  return txs.map(t => ({
    id: t.id,
    type: t.type,
    currency: t.currency,
    amount: Number(t.amount),
    direction: t.direction,
    status: 'completed',
    txHash: t.txHash,
    memo: t.memo,
    createdAt: t.createdAt,
  }));
}
