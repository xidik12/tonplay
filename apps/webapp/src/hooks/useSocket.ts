import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TokenManager } from '@/core/TokenManager';
import { useBalance } from '@/hooks/useBalance';
import type {
  BalanceUpdatePayload,
  NotificationPayload,
  LeaderboardUpdatePayload,
} from '@tonplay/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface UseSocketOptions {
  enabled?: boolean;
  onNotification?: (payload: NotificationPayload) => void;
  onLeaderboardUpdate?: (payload: LeaderboardUpdatePayload) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { enabled = true, onNotification, onLeaderboardUpdate } = options;
  const socketRef = useRef<Socket | null>(null);
  const setBalance = useBalance((s) => s.setBalance);

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

    // Handle notifications
    socket.on('notification', (payload: NotificationPayload) => {
      onNotification?.(payload);
    });

    // Handle leaderboard updates
    socket.on('leaderboard:update', (payload: LeaderboardUpdatePayload) => {
      onLeaderboardUpdate?.(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, setBalance, onNotification, onLeaderboardUpdate]);

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
