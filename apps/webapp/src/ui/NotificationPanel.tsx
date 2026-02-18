import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
  }, []);

  const loadUnreadCount = async () => {
    try {
      const res = await api.get<{ data: { count: number } }>('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch {
      // ignore
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await api.get<{ data: Notification[] }>('/notifications');
      setNotifications(res.data);
    } catch {
      // ignore
    }
  };

  const handleToggle = () => {
    if (!isOpen) loadNotifications();
    setIsOpen(!isOpen);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all', {});
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.post(`/notifications/read/${id}`, {});
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button onClick={handleToggle} className="relative p-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute right-0 top-10 w-72 max-h-80 bg-dark border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <span className="text-white text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-primary text-xs">
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-64">
            {notifications.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  className={`p-3 border-b border-gray-800 last:border-0 cursor-pointer ${
                    n.isRead ? 'opacity-60' : 'bg-primary/5'
                  }`}
                >
                  <p className="text-white text-sm font-medium">{n.title}</p>
                  <p className="text-gray-400 text-xs mt-1">{n.body}</p>
                  <p className="text-gray-600 text-xs mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
