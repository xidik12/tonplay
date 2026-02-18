import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TokenManager } from '@/core/TokenManager';
import { useBalance } from '@/hooks/useBalance';
import type {
  BalanceUpdatePayload,
  NotificationPayload,
  LeaderboardUpdatePayload,
} from '@tonplay/shared';

const API_URL = import.meta.env.VITE_API_URL ?? window.location.origin;

interface UseSocketOptions {
  enabled?: boolean;
  onNotification?: (payload: NotificationPayload) => void;
  onLeaderboardUpdate?: (payload: LeaderboardUpdatePayload) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { enabled = true, onNotification, onLeaderboardUpdate } = options;
  const socketRef = useRef<Socket | null>(null);
  const setBalance = useBalance((s) => s.setBalance);

  // Store callbacks in refs so they don't cause socket reconnections
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;
  const onLeaderboardUpdateRef = useRef(onLeaderboardUpdate);
  onLeaderboardUpdateRef.current = onLeaderboardUpdate;

  useEffect(() => {
    if (!enabled) return;

    const token = TokenManager.getToken();
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    // Handle balance updates
    socket.on('balance:update', (payload: BalanceUpdatePayload) => {
      setBalance(payload.ticketBalance, payload.tplayBalance);
    });

    // Handle notifications (via ref to avoid reconnection on callback change)
    socket.on('notification', (payload: NotificationPayload) => {
      onNotificationRef.current?.(payload);
    });

    // Handle leaderboard updates (via ref to avoid reconnection on callback change)
    socket.on('leaderboard:update', (payload: LeaderboardUpdatePayload) => {
      onLeaderboardUpdateRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, setBalance]);

  const subscribe = useCallback((leaderboardId: string) => {
    socketRef.current?.emit('leaderboard:subscribe', { leaderboardId });
  }, []);

  const unsubscribe = useCallback((leaderboardId: string) => {
    socketRef.current?.emit('leaderboard:unsubscribe', { leaderboardId });
  }, []);

  return {
    socket: socketRef.current,
    subscribe,
    unsubscribe,
    isConnected: socketRef.current?.connected ?? false,
  };
}
