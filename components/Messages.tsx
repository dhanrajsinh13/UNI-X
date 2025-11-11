"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  messageText: string;
  mediaUrl: string | null;
  createdAt: string;
  sender: {
    id: number;
    name: string;
    profile_image: string | null;
  };
  receiver: {
    id: number;
    name: string;
    profile_image: string | null;
  };
  clientId?: string;
}

interface MessagesProps {
  otherUserId: number;
  otherUserName: string;
  onClose: () => void;
}

const Messages: React.FC<MessagesProps> = ({ otherUserId, otherUserName, onClose }) => {
  const { user, token } = useAuth();
  const { socket, isConnected, joinConversation, leaveConversation, startTyping, stopTyping, onNewMessage, onTyping, onStoppedTyping, sendMessage } = useSocket();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: number; userName: string }[]>([]);
  const [conversationId, setConversationId] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user && token) {
      const convId = [user.id, otherUserId].sort().join('-');
      setConversationId(convId);
      
      // Join conversation room via other user's ID
      joinConversation(otherUserId);
      loadInitialMessages();

      return () => {
        leaveConversation(otherUserId);
      };
    }
  }, [otherUserId, user, token]);

  useEffect(() => {
    if (!socket) return;

    // Use context helpers to handle both snake_case and kebab-case events
    const offNewMessage = onNewMessage((messageData: any) => {
      setMessages(prev => {
        // 1) exact id dedupe
        if (prev.some(m => m.id === messageData.id)) return prev;

        // 2) clientId reconciliation
        if (messageData.clientId) {
          const idxByClient = prev.findIndex(m => (m as any).clientId && (m as any).clientId === messageData.clientId);
          if (idxByClient !== -1) {
            const copy = [...prev];
            copy[idxByClient] = { ...messageData };
            return copy;
          }
        }

        // 3) fallback: if this is my own echo and last optimistic matches content/time, replace it
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
    });

    const offTyping = onTyping((data: { userId: number; userName: string }) => {
        setTypingUsers(prev => {
          const exists = prev.find(u => u.userId === data.userId);
          if (!exists) {
            return [...prev, data];
          }
          return prev;
        });
    });

    const offStopped = onStoppedTyping((data: { userId: number }) => {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
    });

      return () => {
      offNewMessage && offNewMessage();
      offTyping && offTyping();
      offStopped && offStopped();
    };
  }, [socket]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    scrollToBottom();
  }, [messages]);

  const loadInitialMessages = async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/messages/conversation/${otherUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load messages' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !Array.isArray(data.messages)) {
        throw new Error('Invalid response format');
      }

      const fetched: any[] = data.messages;
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
          // Fallback: replace last optimistic if it looks like the same message
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
    } catch (error) {
      console.error('Error loading messages:', error);
      // Show user-friendly error message  
      setMessages(prev => [...(prev || []), {
        id: -Date.now(),
        senderId: 0,
        receiverId: otherUserId,
        messageText: 'Failed to load messages. Please try again.',
        mediaUrl: null,
        createdAt: new Date().toISOString(),
        sender: { id: 0, name: 'System', profile_image: null },
        receiver: { id: otherUserId, name: '', profile_image: null }
      } as any]);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    const messageText = newMessage.trim();
    
    const clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: any = {
      id: -Date.now(),
      senderId: user.id,
      receiverId: otherUserId,
      messageText: messageText,
      mediaUrl: null,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, profile_image: null },
      receiver: { id: otherUserId, name: '', profile_image: null },
      clientId,
    };
    
    // Clear input immediately
    setNewMessage('');
    
    setMessages(prev => {
      const now = Date.now();
      const last = prev[prev.length - 1] as any;
      const sameContent = last?.messageText === optimistic.messageText && last?.receiverId === optimistic.receiverId && last?.senderId === optimistic.senderId;
      const recent = Math.abs(now - new Date(last?.createdAt || 0).getTime()) < 2000;
      if (sameContent && recent) {
        setIsSending(false);
        return prev;
      }
      return [...prev, optimistic];
    });
    
    try {
      sendMessage({ receiverId: otherUserId, messageText: optimistic.messageText, clientId });
      stopTyping(otherUserId, user.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => (m as any).clientId !== clientId));
      
      // Show error message
      setMessages(prev => [...prev, {
        id: -Date.now(),
        senderId: 0,
        receiverId: otherUserId,
        messageText: 'Failed to send message. Please try again.',
        mediaUrl: null,
        createdAt: new Date().toISOString(),
        sender: { id: 0, name: 'System', profile_image: null },
        receiver: { id: otherUserId, name: '', profile_image: null }
      } as any]);
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (!user) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing indicator
    if (value.trim()) {
      startTyping(otherUserId, user.id, user.name);
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(otherUserId, user.id);
      }, 2000);
    } else {
      stopTyping(otherUserId, user.id);
    }
  };

  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const isTyping = typingUsers.some(u => u.userId === otherUserId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02fa97]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-[600px] bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-[#02fa97] to-teal-400">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#02fa97] font-bold">
            {otherUserName.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-white">{otherUserName}</h3>
            <p className="text-xs text-white/80">
              {isConnected ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-white/80 text-xl"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-2">💬</div>
            <p>Start a conversation with {otherUserName}</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = user ? message.senderId === user.id : false;
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwn
                      ? 'bg-[#02fa97] text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.mediaUrl && (
                    <div className="mb-2">
                      {message.mediaUrl.includes('image') ? (
                        <img
                          src={message.mediaUrl}
                          alt="Shared image"
                          className="rounded max-w-full h-auto"
                        />
                      ) : (
                        <video
                          src={message.mediaUrl}
                          controls
                          className="rounded max-w-full h-auto"
                        />
                      )}
                    </div>
                  )}
                  {message.messageText && (
                    <p className="text-sm">{message.messageText}</p>
                  )}
                  <p
                    className={`text-xs mt-1 ${
                      isOwn ? 'text-white/80' : 'text-gray-500'
                    }`}
                  >
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-200"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder={`Message ${otherUserName}...`}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent"
            disabled={!isConnected}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected || isSending}
            className="bg-[#02fa97] text-white px-6 py-2 rounded-full hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {!isConnected && (
          <p className="text-xs text-red-500 mt-1">
            Connection lost. Trying to reconnect...
          </p>
        )}
      </form>
    </div>
  );
};

export default Messages;