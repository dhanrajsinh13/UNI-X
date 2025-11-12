'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { fetchAPI, dataFetcher } from '../../lib/dataFetcher';

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

interface FollowRequest {
  id: number;
  requester_id: number;
  requester: {
    id: number;
    name: string;
    username?: string;
    profile_image?: string;
  };
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { user, token } = useAuth();
  const { onNotification, onMessageNotification } = useSocket();
  
  // Follow requests state
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

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

  // Load follow requests
  useEffect(() => {
    const loadRequests = async () => {
      if (!token) return;
      setLoadingRequests(true);
      try {
        const data = await fetchAPI<{ requests: FollowRequest[] }>(
          '/api/users/requests',
          { token, cacheTTL: 10000 } // Cache for 10 seconds
        );
        setFollowRequests(data.requests || []);
      } catch (err: any) {
        console.error('Failed to load follow requests:', err);
      } finally {
        setLoadingRequests(false);
      }
    };
    loadRequests();
  }, [token]);

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

  const handleFollowRequest = async (requestId: number, action: 'approve' | 'reject') => {
    if (!token) return;
    try {
      await fetchAPI('/api/users/requests', {
        method: 'POST',
        token,
        body: JSON.stringify({ requestId, action }),
        skipCache: true
      });
      
      setFollowRequests(prev => prev.filter(req => req.id !== requestId));
      
      // Clear cache after approval/rejection
      dataFetcher.clearCache('/api/users/requests');
    } catch (err: any) {
      console.error('Error handling follow request:', err);
      alert(err.message || 'Failed to handle request');
    }
  };

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

        {/* Follow Requests Section */}
        {followRequests.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Follow Requests
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                  {followRequests.length}
                </span>
              </h2>
            </div>
            
            <div className="divide-y divide-gray-100">
              {followRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img 
                        src={request.requester?.profile_image || '/uploads/DefaultProfile.jpg'}
                        alt={request.requester?.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 truncate">{request.requester?.name}</div>
                        {request.requester?.username && (
                          <div className="text-sm text-gray-500 truncate">@{request.requester.username}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(request.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleFollowRequest(request.id, 'approve')}
                        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleFollowRequest(request.id, 'reject')}
                        className="px-5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors border border-gray-300 shadow-sm"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
