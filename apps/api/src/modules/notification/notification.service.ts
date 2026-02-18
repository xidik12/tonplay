import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { emitNotification } from '../../websocket/handler.js';

export interface NotificationInfo {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Creates a notification and emits it via WebSocket.
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: unknown
): Promise<NotificationInfo> {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data: data !== undefined ? (data as Prisma.InputJsonValue) : Prisma.JsonNull },
  });

  emitNotification(userId, {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
  });

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

/**
 * Gets paginated notifications for a user.
 */
export async function getNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<NotificationInfo[]> {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
    skip: offset,
  });

  return notifications.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data,
    isRead: n.isRead,
    createdAt: n.createdAt,
  }));
}

/**
 * Marks a single notification as read.
 */
export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

/**
 * Marks all notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

/**
 * Gets the count of unread notifications.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
