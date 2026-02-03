'use client';

import Image from 'next/image'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface MiniChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  otherUser: {
    id: number;
    name: string;
    profile_image?: string | null;
    department?: string;
    year?: number;
  };
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  messageText: string;
  createdAt: string;
  sender: {
    id: number;
    name: string;
    profile_image: string | null;
  };
  clientId?: string;
}

const MiniChatWindow: React.FC<MiniChatWindowProps> = ({ isOpen, onClose, otherUser }) => {
  const { user, token } = useAuth();
  const { socket, joinConversation, leaveConversation, onNewMessage, sendMessage } = useSocket();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create conversation ID
  useEffect(() => {
    if (user && otherUser) {
      const convId = [user.id, otherUser.id].sort().join('-');
      setConversationId(convId);
    }
  }, [user, otherUser]);

  const loadMessages = useCallback(async () => {
    if (!token || !otherUser) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/messages/conversation/${otherUser.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const fetched: any[] = data.messages || [];
        setMessages(prev => {
          if (!prev || prev.length === 0) return fetched;
          const byClientId = new Map<string, any>();
          for (const m of prev as any[]) {
            if ((m as any).clientId) byClientId.set((m as any).clientId, m);
          }
          const byId = new Map<number, any>();
          for (const m of prev as any[]) byId.set(m.id, m);
          const merged = [...prev];
          for (const fm of fetched) {
            if (byId.has(fm.id)) continue;
            if (fm.clientId && byClientId.has(fm.clientId)) {
              const idx = merged.findIndex((m: any) => m.clientId === fm.clientId);
              if (idx !== -1) { merged[idx] = fm; continue; }
            }
            const last = merged[merged.length - 1] as any;
            const sameContent = last?.messageText === fm.messageText && last?.receiverId === fm.receiverId;
            const looksOptimistic = !!last?.clientId || (typeof last?.id === 'number' && last.id < 0);
            const recent = Math.abs(new Date(fm.createdAt).getTime() - new Date(last?.createdAt || 0).getTime()) < 5000;
            if (sameContent && looksOptimistic && recent) {
              merged[merged.length - 1] = fm;
            } else {
              merged.push(fm);
            }
          }
          return merged;
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [token, otherUser]);

  // Load messages when window opens
  useEffect(() => {
    if (isOpen && conversationId && token && otherUser) {
      loadMessages();
      joinConversation(otherUser.id);
    }

    return () => {
      if (otherUser) {
        leaveConversation(otherUser.id);
      }
    };
  }, [isOpen, conversationId, token, otherUser, loadMessages, joinConversation, leaveConversation]);

  // Socket listeners for real-time messages
  useEffect(() => {
    if (!socket || !conversationId) return;
    const off = onNewMessage((messageData: Message) => {
      if ([messageData.senderId, messageData.receiverId].sort().join('-') === conversationId) {
        setMessages(prev => {
          if (prev.some(m => m.id === messageData.id)) return prev;
          if (messageData.clientId) {
            const idx = prev.findIndex(m => (m as any).clientId && (m as any).clientId === messageData.clientId);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = { ...messageData };
              return copy;
            }
          }
          if (user && messageData.senderId === user.id && prev.length > 0) {
            const last = prev[prev.length - 1] as any;
            const sameContent = last?.messageText === messageData.messageText && last?.receiverId === messageData.receiverId;
            const recent = Math.abs(new Date(messageData.createdAt).getTime() - new Date(last?.createdAt || 0).getTime()) < 5000;
            const looksOptimistic = !!last?.clientId || (typeof last?.id === 'number' && last.id < 0);
            if (sameContent && recent && looksOptimistic) {
              const copy = [...prev];
              copy[copy.length - 1] = { ...messageData };
              return copy;
            }
          }
          return [...prev, messageData];
        });
      }
    });
    return () => { off && off(); };
  }, [socket, conversationId, onNewMessage, user]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !otherUser || !user) return;
    const messageText = input.trim();
    const clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: any = {
      id: -Date.now(),
      senderId: user.id,
      receiverId: otherUser.id,
      messageText,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, profile_image: null },
      clientId,
    };
    setMessages(prev => {
      const now = Date.now();
      const last = prev[prev.length - 1] as any;
      const sameContent = last?.messageText === optimistic.messageText && last?.receiverId === optimistic.receiverId && last?.senderId === optimistic.senderId;
      const recent = Math.abs(now - new Date(last?.createdAt || 0).getTime()) < 2000;
      if (sameContent && recent) return prev;
      return [...prev, optimistic];
    });
    setInput('');
    sendMessage({ receiverId: otherUser.id, messageText, clientId });
  }, [input, otherUser, user, sendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const expandToFullChat = useCallback(() => {
    onClose();
    // Use userId in URL to ensure it works even without previous conversation
    router.push(`/messages?userId=${otherUser.id}`);
  }, [onClose, router, otherUser.id]);

  const formatTimestamp = useCallback((timestamp: string) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  }, []);

  const toggleMinimized = useCallback(() => {
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-transparent bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Mini Chat Window */}
      <div className={`fixed bottom-4 right-4 bg-white rounded-lg shadow-xl z-50 flex flex-col border border-gray-200 animate-in slide-in-from-bottom-2 duration-300 ${isMinimized ? 'w-80 h-12' : 'w-80 h-96'
        }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
              <Image
                src={otherUser.profile_image || '/uploads/DefaultProfile.jpg'}
                alt={otherUser.name}
                className="w-full h-full object-cover rounded-full"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
              />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900">{otherUser.name}</h3>
              {otherUser.department && !isMinimized && (
                <p className="text-xs text-gray-500">{otherUser.department} • {otherUser.year}rd Year</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Minimize/Maximize Button */}
            <button
              onClick={toggleMinimized}
              className="p-1.5 text-gray-600 hover:text-[#02fa97] hover:bg-teal-50 rounded-md transition-colors"
              title={isMinimized ? "Expand chat" : "Minimize chat"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {isMinimized ? (
                  <path d="M18 15L12 9L6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>

            {/* Expand Button */}
            {!isMinimized && (
              <button
                onClick={expandToFullChat}
                className="p-1.5 text-gray-600 hover:text-[#02fa97] hover:bg-teal-50 rounded-md transition-colors"
                title="Open full chat"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3H5C3.89543 3 3 3.89543 3 5V8M21 8V5C21 3.89543 20.1046 3 19 3H16M16 21H19C20.1046 21 21 20.1046 21 19V16M3 16V19C3 20.1046 3.89543 21 5 21H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages Area - only show when not minimized */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-[#02fa97] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8.5 19H8C4 19 2 17 2 13V8C2 4 4 2 8 2H16C20 2 22 4 22 8V13C22 17 20 19 16 19H15.5C15.19 19 14.89 19.15 14.7 19.4L13.2 21.4C12.54 22.28 11.46 22.28 10.8 21.4L9.3 19.4C9.14 19.18 8.77 19 8.5 19Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500">Start a conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isFromMe = message.senderId === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 ${isFromMe
                          ? 'bg-[#02fa97] text-black'
                          : 'bg-gray-100 text-gray-900'
                          }`}
                      >
                        <p className="text-sm leading-relaxed">{message.messageText}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {formatTimestamp(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - only show when not minimized */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message ${otherUser.name}...`}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim()}
                  className="w-8 h-8 bg-[#02fa97] hover:bg-teal-400 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default MiniChatWindow;