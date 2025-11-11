'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'system';
  message: string;
  time: string;
  read: boolean;
  avatar?: string;
  action?: string;
  meta?: any;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { user } = useAuth();
  const { onNotification, onMessageNotification } = useSocket();

  // Load from localStorage for persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem('notifications');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setNotifications(parsed);
      }
    } catch {}
  }, []);

  // Subscribe to socket notifications
  useEffect(() => {
    const unsubGeneric = onNotification?.((notif: any) => {
      setNotifications(prev => {
        const next = [{
          id: notif.id || `${Date.now()}`,
          type: notif.type || 'system',
          message: notif.message || 'Notification',
          time: new Date().toISOString(),
          read: false,
          meta: notif.meta,
        } as Notification, ...prev].slice(0, 200);
        try { localStorage.setItem('notifications', JSON.stringify(next)); } catch {}
        return next;
      });
    });

    const unsubMessage = onMessageNotification?.((msg: any) => {
      setNotifications(prev => {
        const next = [{
          id: `${msg.id || Date.now()}`,
          type: 'system',
          message: `New message from ${msg.senderName || 'someone'}`,
          time: new Date().toISOString(),
          read: false,
          meta: { conversationId: msg.conversationId, senderId: msg.senderId },
        } as Notification, ...prev].slice(0, 200);
        try { localStorage.setItem('notifications', JSON.stringify(next)); } catch {}
        return next;
      });
    });

    return () => {
      if (typeof unsubGeneric === 'function') unsubGeneric();
      if (typeof unsubMessage === 'function') unsubMessage();
    };
  }, [onNotification, onMessageNotification]);

  // Move useMemo before early return to follow Rules of Hooks
  const filteredNotifications = useMemo(() => (
    filter === 'unread' 
      ? notifications.filter(n => !n.read)
      : notifications
  ), [filter, notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#02fa97] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'follow':
        return '👥';
      case 'mention':
        return '📢';
      case 'system':
        return '⚙️';
      default:
        return '🔔';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-gray-600 mt-1">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Filter */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all' 
                    ? 'bg-[#02fa97] text-black' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'unread' 
                    ? 'bg-[#02fa97] text-black' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Mark all as read */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[#02fa97] hover:text-teal-600 font-semibold text-sm"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.slice(0, 50).map((notification, index) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar or Icon */}
                    <div className="flex-shrink-0">
                      {notification.avatar ? (
                        <div className="w-12 h-12 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {notification.avatar}
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl">
                          {getNotificationIcon(notification.type)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {notification.time}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="w-2 h-2 bg-[#02fa97] rounded-full flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-gray-600">
                {filter === 'unread' 
                  ? 'You\'re all caught up!'
                  : 'Notifications about likes, comments, and follows will appear here'
                }
              </p>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-gray-700">Email notifications</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-gray-700">Push notifications</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-gray-700">Comment notifications</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-gray-700">Follow notifications</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
