'use client';

import React, { useState, useRef, useEffect, useMemo, Suspense, useCallback, memo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { fetchAPI, dataFetcher } from '../../lib/dataFetcher';

interface Conversation {
  conversationId: string;
  otherUser: {
    id: number;
    name: string;
    profile_image: string | null;
  };
  lastMessage: {
    id: number;
    text: string;
    mediaUrl: string | null;
    createdAt: string;
    senderId: number;
    isFromMe: boolean;
  };
  unreadCount: number;
}

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
  reaction?: string | null;
  replyTo?: {
    id: number;
    text: string;
    senderName: string;
  } | null;
  deleted_for?: number[];
}

const MessagesPageInner = () => {
  const { user, token } = useAuth();
  const { socket, isConnected, joinConversation, leaveConversation, startTyping, stopTyping, onNewMessage, onMessageUnsent, onMessageDeleted, onTyping, onStoppedTyping, sendMessage } = useSocket();
  const searchParams = useSearchParams();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [activeOtherUser, setActiveOtherUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showConversations, setShowConversations] = useState(true);
  const [typingUsers, setTypingUsers] = useState<{ userId: number; userName: string }[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: number; text: string; senderName: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ [key: number]: 'top' | 'bottom' }>({});
  const convFetchControllerRef = useRef<AbortController | null>(null);
  const msgsFetchControllerRef = useRef<AbortController | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshAtRef = useRef<number>(0);
  const messageActionsRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    isOpen: boolean;
    action: 'delete' | 'block' | null;
    conversationId: string | null;
    otherUserName: string;
  }>({
    isOpen: false,
    action: null,
    conversationId: null,
    otherUserName: ''
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find current conversation data
  const currentConversation = useMemo(() => conversations.find(conv => conv.conversationId === activeConversation), [conversations, activeConversation]);

  // Load conversations on mount
  useEffect(() => {
    if (user && token) {
      loadConversations();
    }
    
    // Cleanup function
    return () => {
      if (convFetchControllerRef.current) {
        convFetchControllerRef.current.abort();
      }
      if (msgsFetchControllerRef.current) {
        msgsFetchControllerRef.current.abort();
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user, token]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;
    const offNew = onNewMessage((messageData: Message) => {
      const convId = [messageData.senderId, messageData.receiverId].sort().join('-');
      if (activeConversation && convId === activeConversation) {
        setMessages(prev => {
          // 1) exact id dedupe
          if (prev.some(m => m.id === messageData.id)) return prev;
          // 2) clientId reconciliation
          if (messageData.clientId) {
            const idx = prev.findIndex(m => (m as any).clientId && (m as any).clientId === messageData.clientId);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = { ...messageData };
              return copy;
            }
          }
          // 3) fallback for my own last optimistic
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
      setConversations(prev => {
        const idx = prev.findIndex(c => c.conversationId === convId);
        const updated: Conversation = {
          conversationId: convId,
          otherUser: idx >= 0 ? prev[idx].otherUser : {
            id: messageData.senderId === user?.id ? messageData.receiver.id : messageData.sender.id,
            name: messageData.senderId === user?.id ? messageData.receiver.name : messageData.sender.name,
            profile_image: messageData.senderId === user?.id ? messageData.receiver.profile_image : messageData.sender.profile_image,
          },
          lastMessage: {
            id: messageData.id,
            text: messageData.messageText,
            mediaUrl: messageData.mediaUrl,
            createdAt: messageData.createdAt,
            senderId: messageData.senderId,
            isFromMe: messageData.senderId === user?.id,
          },
          unreadCount: (activeConversation && convId === activeConversation) ? 0 : (idx >= 0 ? (prev[idx].unreadCount + 1) : 1),
        };
        
        // Only update if conversation doesn't exist or last message changed
        if (idx === -1) {
          return [updated, ...prev];
        }
        
        const existing = prev[idx];
        if (existing.lastMessage?.id === messageData.id && 
            existing.lastMessage?.text === messageData.messageText) {
          return prev; // No change needed
        }
        
        const copy = [...prev];
        copy.splice(idx, 1);
        return [updated, ...copy];
      });
      
      // No need to refresh conversations - we're updating them in real-time above
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
    
    // Listen for message unsent events
    const offUnsent = onMessageUnsent((data: { messageId: number }) => {
      console.log('Message unsent event received:', data.messageId);
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
      
      // Update conversation last message if needed
      setConversations(prev => prev.map(conv => {
        if (conv.lastMessage?.id === data.messageId) {
          return {
            ...conv,
            lastMessage: {
              ...conv.lastMessage,
              text: 'This message was unsent',
              mediaUrl: null
            }
          };
        }
        return conv;
      }));
    });
    
    // Listen for message deleted events (for current user only)
    const offDeleted = onMessageDeleted((data: { messageId: number }) => {
      console.log('Message deleted event received:', data.messageId);
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, deleted_for: [...(msg.deleted_for || []), user?.id || 0] }
          : msg
      ));
    });
    
    return () => {
      offNew && offNew();
      offTyping && offTyping();
      offStopped && offStopped();
      offUnsent && offUnsent();
      offDeleted && offDeleted();
    };
  }, [socket, activeConversation, user?.id, onNewMessage, onTyping, onStoppedTyping, onMessageUnsent, onMessageDeleted]);
  
  // Scroll to bottom of messages (only for new messages)
  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);
  
  // Check if mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (messageActionsRef.current && !messageActionsRef.current.contains(event.target as Node)) {
        // Don't close if clicking inside emoji picker
        if (emojiPickerRef.current && emojiPickerRef.current.contains(event.target as Node)) {
          return;
        }
        setSelectedMessageId(null);
        setShowEmojiPicker(null);
      }
      // Close emoji picker if clicking outside
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle user query parameter (from profile message button)
  // Accept either ?user=<id> or ?userId=<id> so calls work consistently
  useEffect(() => {
    const rawUserId = searchParams?.get('user') || searchParams?.get('userId');
    if (rawUserId && user) {
      const otherUserId = parseInt(rawUserId);
      if (isNaN(otherUserId) || otherUserId === user.id) return;

      const conversationId = [user.id, otherUserId].sort().join('-');

      // Check if conversation already exists
      const existingConversation = conversations.find(conv => conv.conversationId === conversationId);

      if (existingConversation) {
        // Open existing conversation
        handleConversationClick(existingConversation);
      } else {
        // Start new conversation - we'll need to fetch user details first
        startNewConversation(otherUserId);
      }

      // Hide conversations panel on mobile when a conversation is opened
      if (isMobileView) {
        setShowConversations(false);
      }
    }
  }, [searchParams, user, conversations, isMobileView]);

  const loadConversations = useCallback(async (isBackground: boolean = false) => {
    if (!token) return;
    if (convFetchControllerRef.current) {
      try { convFetchControllerRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    convFetchControllerRef.current = controller;
    try {
      const data = await fetchAPI('/api/messages/conversations', {
        token,
        cacheTTL: 10000, // 10 seconds cache for conversations
        signal: controller.signal
      }) as { conversations: Conversation[] };

      setConversations(data.conversations || []);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error loading conversations:', error);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [token]);

  const loadMessages = useCallback(async (otherUserId: number) => {
    if (!token) return;
    if (msgsFetchControllerRef.current) {
      try { msgsFetchControllerRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    msgsFetchControllerRef.current = controller;
    setMessagesLoading(true);
    try {
      const data = await fetchAPI(`/api/messages/conversation/${otherUserId}`, {
        token,
        cacheTTL: 5000, // 5 seconds cache for messages
        signal: controller.signal
      }) as { messages: Message[]; otherUser: any };

      const fetched: any[] = data.messages || [];
      setMessages(prev => {
        if (!prev || prev.length === 0) return fetched;
        const byClientId = new Map<string, any>();
        const byId = new Map<number, any>();
        
        for (const m of prev as any[]) {
          if ((m as any).clientId) byClientId.set((m as any).clientId, m);
          byId.set(m.id, m);
        }
        
        const merged = [...prev];
        for (const fm of fetched) {
          if (byId.has(fm.id)) continue;
          if (fm.clientId && byClientId.has(fm.clientId)) {
            const idx = merged.findIndex((m: any) => (m as any).clientId === fm.clientId);
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
      setActiveOtherUser(data.otherUser);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error loading messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, [token]);
  
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !activeOtherUser || !user) return;
    
    // Capture the current input value before any state updates
    const messageText = input.trim();
    const clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    console.log('Sending message:', messageText); // Debug log
    
    const optimistic: any = {
      id: -Date.now(),
      senderId: user.id,
      receiverId: activeOtherUser.id,
      messageText,
      mediaUrl: null,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, profile_image: null },
      receiver: { id: activeOtherUser.id, name: activeOtherUser.name, profile_image: activeOtherUser.profile_image || null },
      clientId,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName
      } : null,
    };
    
    // Clear input immediately to prevent double-send
    setInput('');
    setReplyingTo(null);
    
    setMessages(prev => {
      const now = Date.now();
      const last = prev[prev.length - 1] as any;
      const sameContent = last?.messageText === messageText && last?.receiverId === activeOtherUser.id && last?.senderId === user.id;
      const recent = Math.abs(now - new Date(last?.createdAt || 0).getTime()) < 2000;
      if (sameContent && recent) return prev;
      return [...prev, optimistic];
    });
    
    sendMessage({ 
      receiverId: activeOtherUser.id, 
      messageText, 
      clientId,
      replyToId: replyingTo?.id || null
    });
    
    stopTyping(activeOtherUser.id, user.id);
  }, [input, activeOtherUser, user, replyingTo, sendMessage, stopTyping]);
  
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleTyping = useCallback((value: string) => {
    console.log('Input changed to:', value); // Debug log
    setInput(value);

    if (!user || !activeOtherUser) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing indicator
    if (value.trim()) {
      startTyping(activeOtherUser.id, user.id, user.name);
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(activeOtherUser.id, user.id);
      }, 2000);
    } else {
      stopTyping(activeOtherUser.id, user.id);
    }
  }, [user, activeOtherUser, startTyping, stopTyping]);
  
  const formatTimestamp = useCallback((dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Less than 15 seconds
    if (diffInSeconds < 15) {
      return 'now';
    }
    // 15-59 seconds: show seconds in 5-second increments
    else if (diffInSeconds < 60) {
      const seconds = Math.floor(diffInSeconds / 5) * 5; // Round down to nearest 5
      return `${seconds}s`;
    }
    // 1-59 minutes: show minutes
    else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m`;
    }
    // 1-23 hours: show hours
    else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h`;
    }
    // 1+ days: show days
    else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d`;
    }
  }, []);
  
  const handleConversationClick = useCallback((conversation: Conversation) => {
    const convId = conversation.conversationId;
    
    // Clear old messages immediately to prevent showing wrong conversation
    setMessages([]);
    setActiveConversation(convId);
    setActiveOtherUser(conversation.otherUser);
    
    // Join the conversation room
    joinConversation(conversation.otherUser.id);
    
    // Load messages for this conversation
    loadMessages(conversation.otherUser.id);
    
    if (isMobileView) {
      setShowConversations(false);
    }
  }, [joinConversation, loadMessages, isMobileView]);

  const startNewConversation = useCallback(async (otherUserId: number) => {
    if (!user || !token) return;
    
    try {
      // Fetch user details for the new conversation
      const data = await fetchAPI(`/api/users/${otherUserId}`, {
        token: token || '',
        cacheTTL: 60000 // 60 seconds cache for user details
      }) as { user: any };

      const otherUser = data.user;
      
      // Create conversation ID
      const conversationId = [user.id, otherUserId].sort().join('-');
      
      // Set up the conversation
      setActiveConversation(conversationId);
      setActiveOtherUser(otherUser);
      setMessages([]); // Start with empty messages
      
      // Join the conversation room
      joinConversation(otherUserId);
      
      if (isMobileView) {
        setShowConversations(false);
      }
    } catch (error) {
      console.error('Error starting new conversation:', error);
    }
  }, [user, token, joinConversation, isMobileView]);

  const isTyping = activeOtherUser && typingUsers.some(u => u.userId === activeOtherUser.id);

  // Conversation CRUD Actions
  const handleConversationAction = (action: 'delete' | 'archive' | 'unread' | 'block', conversationId: string, otherUserName: string) => {
    setOpenDropdown(null);
    
    if (action === 'delete' || action === 'block') {
      setShowConfirmModal({
        isOpen: true,
        action,
        conversationId,
        otherUserName
      });
    } else if (action === 'archive') {
      handleArchiveConversation(conversationId);
    } else if (action === 'unread') {
      handleMarkAsUnread(conversationId);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!token) return;
    
    try {
      await fetchAPI(`/api/messages/conversations/${conversationId}/delete`, {
        method: 'DELETE',
        token,
        skipCache: true
      });

      // Remove from conversations list
      setConversations(prev => prev.filter(conv => conv.conversationId !== conversationId));
      
      // Clear active conversation if it was deleted
      if (activeConversation === conversationId) {
        setActiveConversation(null);
        setActiveOtherUser(null);
        setMessages([]);
      }
      
      // Clear cache
      dataFetcher.clearCache('/api/messages/conversations');
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (!token) return;
    
    try {
      await fetchAPI(`/api/messages/conversations/${conversationId}/archive`, {
        method: 'POST',
        token,
        skipCache: true
      });

      // Remove from conversations list (archived conversations can be shown separately later)
      setConversations(prev => prev.filter(conv => conv.conversationId !== conversationId));
      
      // Clear active conversation if it was archived
      if (activeConversation === conversationId) {
        setActiveConversation(null);
        setActiveOtherUser(null);
        setMessages([]);
      }
      
      // Clear cache
      dataFetcher.clearCache('/api/messages/conversations');
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  const handleMarkAsUnread = async (conversationId: string) => {
    if (!token) return;
    
    try {
      await fetchAPI(`/api/messages/conversations/${conversationId}/unread`, {
        method: 'POST',
        token,
        skipCache: true
      });

      // Update conversation to show as unread
      setConversations(prev => prev.map(conv => 
        conv.conversationId === conversationId 
          ? { ...conv, unreadCount: conv.unreadCount || 1 }
          : conv
      ));
      
      // Clear cache
      dataFetcher.clearCache('/api/messages/conversations');
    } catch (error) {
      console.error('Error marking as unread:', error);
    }
  };

  const handleBlockUser = async (conversationId: string) => {
    if (!token) return;
    
    try {
      await fetchAPI(`/api/messages/conversations/${conversationId}/block`, {
        method: 'POST',
        token,
        skipCache: true
      });

      // Remove from conversations list
      setConversations(prev => prev.filter(conv => conv.conversationId !== conversationId));
      
      // Clear active conversation if user was blocked
      if (activeConversation === conversationId) {
        setActiveConversation(null);
        setActiveOtherUser(null);
        setMessages([]);
      }
      
      // Clear cache
      dataFetcher.clearCache('/api/messages/conversations');
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const confirmAction = () => {
    if (!showConfirmModal.conversationId || !showConfirmModal.action) return;
    
    if (showConfirmModal.action === 'delete') {
      handleDeleteConversation(showConfirmModal.conversationId);
    } else if (showConfirmModal.action === 'block') {
      handleBlockUser(showConfirmModal.conversationId);
    }
    
    setShowConfirmModal({
      isOpen: false,
      action: null,
      conversationId: null,
      otherUserName: ''
    });
  };

  // Message Actions
  const handleUnsendMessage = async (messageId: number) => {
    console.log('Unsending message:', messageId);
    if (!token) {
      console.error('No token available');
      return;
    }
    
    try {
      const response = await fetchAPI(`/api/messages/${messageId}/unsend`, {
        method: 'POST',
        token,
        skipCache: true
      });

      console.log('Message unsent successfully:', response);
      
      // Remove from local state immediately (socket will handle other user)
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setSelectedMessageId(null);
      
      // Clear message cache
      if (activeOtherUser) {
        dataFetcher.clearCache(`/api/messages/conversation/${activeOtherUser.id}`);
      }
    } catch (error: any) {
      console.error('Error unsending message:', error);
      
      // Even if API fails, try to remove from UI (might already be deleted)
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setSelectedMessageId(null);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    console.log('Deleting message for me:', messageId);
    if (!token) {
      console.error('No token available');
      return;
    }
    
    try {
      await fetchAPI(`/api/messages/${messageId}`, {
        method: 'DELETE',
        token,
        skipCache: true
      });

      console.log('Message deleted for me successfully');
      // Mark message as deleted for current user (add to deleted_for array)
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, deleted_for: [...(msg.deleted_for || []), user?.id || 0] }
          : msg
      ));
      setSelectedMessageId(null);
      
      // Clear message cache
      if (activeOtherUser) {
        dataFetcher.clearCache(`/api/messages/conversation/${activeOtherUser.id}`);
      }
    } catch (error: any) {
      console.error('Error deleting message:', error);
    }
  };

  const handleReactToMessage = async (messageId: number, emoji: string) => {
    console.log('Reacting to message:', messageId, 'with emoji:', emoji);
    if (!token) {
      console.error('No token available');
      return;
    }

    // Close pickers immediately for better UX
    setShowEmojiPicker(null);
    setSelectedMessageId(null);

    // Optimistically update UI
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, reaction: emoji } : msg
    ));
    
    try {
      await fetchAPI(`/api/messages/${messageId}/react`, {
        method: 'POST',
        token,
        body: JSON.stringify({ emoji }),
        skipCache: true
      });

      console.log('Reaction added successfully');
    } catch (error: any) {
      console.error('Error reacting to message:', error);
      // Revert on failure
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, reaction: null } : msg
      ));
    }
  };

  const handleRemoveReaction = async (messageId: number) => {
    console.log('Removing reaction from message:', messageId);
    if (!token) {
      console.error('No token available');
      return;
    }

    // Optimistically remove UI
    const previousReaction = messages.find(msg => msg.id === messageId)?.reaction;
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, reaction: null } : msg
    ));
    
    try {
      await fetchAPI(`/api/messages/${messageId}/react`, {
        method: 'POST',
        token,
        body: JSON.stringify({ emoji: null }),
        skipCache: true
      });

      console.log('Reaction removed successfully');
    } catch (error: any) {
      console.error('Error removing reaction:', error);
      // Revert on error
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, reaction: previousReaction } : msg
      ));
    }
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast notification here
      console.log('Message copied to clipboard');
      setSelectedMessageId(null);
    }).catch(err => {
      console.error('Failed to copy message:', err);
    });
  };

  const handleReplyToMessage = (message: Message) => {
    setReplyingTo({
      id: message.id,
      text: message.messageText,
      senderName: message.sender.name
    });
    setSelectedMessageId(null);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Memoize filtered messages to prevent unnecessary re-renders
  const displayedMessages = useMemo(() => {
    return messages.filter(message => !message.deleted_for?.includes(user?.id || 0));
  }, [messages, user?.id]);

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar - Conversations */}
      {(!isMobileView || showConversations) && (
        <div className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col pb-16 md:pb-0 shadow-sm">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Messages</h1>
                <p className="text-sm text-gray-500">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
              </div>
              <button className="p-2.5 hover:bg-green-50 text-gray-600 hover:text-green-600 rounded-xl transition-all hover:shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                  <path d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19S2 15.194 2 10.5 5.806 2 10.5 2 19 5.806 19 10.5Z" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <input
                id="conversation-search"
                name="search"
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>
          
          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-semibold mb-1">No conversations yet</p>
                <p className="text-sm text-gray-500">Start messaging someone to see conversations here</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.conversationId}
                  className={`relative group cursor-pointer transition-all border-b border-gray-100 ${
                    activeConversation === conversation.conversationId 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-500' 
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div 
                    onClick={() => handleConversationClick(conversation)}
                    className="p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={`w-14 h-14 rounded-full overflow-hidden ring-2 shadow-sm transition-all ${
                          activeConversation === conversation.conversationId 
                            ? 'ring-green-500' 
                            : 'ring-white group-hover:ring-gray-200'
                        }`}>
                          <img 
                            src={conversation.otherUser.profile_image || '/uploads/DefaultProfile.jpg'} 
                            alt={conversation.otherUser.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
                          />
                        </div>
                        {/* Online status indicator - can be added later */}
                        {/* <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div> */}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm truncate pr-2">
                            {conversation.otherUser.name}
                          </h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(conversation.lastMessage.createdAt)}
                            </span>
                            {conversation.unreadCount > 0 && (
                              <div className="min-w-[20px] h-5 px-1.5 bg-green-600 rounded-full flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-white">{conversation.unreadCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className={`text-sm truncate ${
                          conversation.unreadCount > 0 
                            ? 'font-medium text-gray-900' 
                            : 'text-gray-600'
                        }`}>
                          {conversation.lastMessage.isFromMe ? (
                            <span className="text-gray-500">You: </span>
                          ) : null}
                          {conversation.lastMessage.text || 'No message content'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Three-dot menu */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdown(openDropdown === conversation.conversationId ? null : conversation.conversationId);
                      }}
                      className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openDropdown === conversation.conversationId && (
                      <div 
                        ref={dropdownRef}
                        className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50"
                      >
                        <button
                          onClick={() => handleConversationAction('unread', conversation.conversationId, conversation.otherUser.name)}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21.99 6.86C21.99 6.86 22 7.75 22 12C22 16.25 21.99 17.14 21.99 17.14C21.99 18.24 21.31 19.19 20.24 19.5C19.17 19.81 17.99 19.5 17.17 18.68L16 17.51C15.59 17.1 14.99 16.86 14.35 16.86H6C3.79 16.86 2 15.07 2 12.86V6.86C2 4.65 3.79 2.86 6 2.86H18C20.21 2.86 22 4.65 22 6.86Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="7" cy="9.86" r="1.5" fill="currentColor"/>
                            <circle cx="12" cy="9.86" r="1.5" fill="currentColor"/>
                            <circle cx="17" cy="9.86" r="1.5" fill="currentColor"/>
                          </svg>
                          Mark as unread
                        </button>
                        
                        <button
                          onClick={() => handleConversationAction('archive', conversation.conversationId, conversation.otherUser.name)}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 8V21H3V8M1 3H23L21 8H3L1 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Archive
                        </button>
                        
                        <div className="border-t border-gray-100 my-1.5"></div>
                        
                        <button
                          onClick={() => handleConversationAction('block', conversation.conversationId, conversation.otherUser.name)}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M4.93 4.93L19.07 19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Block user
                        </button>
                        
                        <button
                          onClick={() => handleConversationAction('delete', conversation.conversationId, conversation.otherUser.name)}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6H5H21M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 11V17M14 11V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Delete chat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Chat Area */}
      {(!isMobileView || !showConversations) && activeConversation ? (
        <div className="flex-1 flex flex-col h-full bg-white rounded-tl-3xl shadow-lg">
          {/* Chat Header */}
          <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isMobileView && (
                  <button
                    onClick={() => setShowConversations(true)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-green-500 shadow-sm">
                    <img 
                      src={currentConversation?.otherUser?.profile_image || '/uploads/DefaultProfile.jpg'} 
                      alt={currentConversation?.otherUser?.name || 'User'}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
                    />
                  </div>
                  {/* Online status indicator */}
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {currentConversation?.otherUser?.name}
                  </h3>
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    Active now
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 16.92V20C22 20.5304 21.7893 21.0391 21.4142 21.4142C21.0391 21.7893 20.5304 22 20 22C17.9289 21.9972 15.8799 21.5641 14 20.73C12.2719 19.9686 10.7419 18.8187 9.51 17.36C8.05128 16.1281 6.90145 14.5981 6.14 12.87C5.30593 10.9901 4.87284 8.94107 4.87 6.87C4.87 6.33956 5.08071 5.83086 5.45578 5.45578C5.83086 5.08071 6.33956 4.87 6.87 4.87H10.05C10.5625 4.86511 11.056 5.0365 11.4432 5.35235C11.8303 5.6682 12.0839 6.10842 12.16 6.6C12.3034 7.68107 12.5857 8.73007 13 9.72C13.1397 10.0156 13.187 10.3467 13.1358 10.6699C13.0847 10.9932 12.9379 11.2934 12.72 11.53L11.26 12.99C12.2774 14.8075 13.7325 16.2626 15.55 17.28L17.01 15.82C17.2466 15.6021 17.5468 15.4553 17.8701 15.4042C18.1933 15.353 18.5244 15.4003 18.82 15.54C19.8099 15.9543 20.8589 16.2366 21.94 16.38C22.4416 16.4561 22.8918 16.7197 23.2077 17.1168C23.5235 17.514 23.6849 18.0175 23.67 18.53L22 16.92Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.75 10.5V6C15.75 5.20435 15.4339 4.44129 14.8713 3.87868C14.3087 3.31607 13.5456 3 12.75 3H5.25C4.45435 3 3.69129 3.31607 3.12868 3.87868C2.56607 4.44129 2.25 5.20435 2.25 6V15C2.25 15.7956 2.56607 16.5587 3.12868 17.1213C3.69129 17.6839 4.45435 18 5.25 18H8.25M15.75 10.5L21.75 4.5M15.75 10.5V15C15.75 15.7956 16.0661 16.5587 16.6287 17.1213C17.1913 17.6839 17.9544 18 18.75 18H21.75V4.5H18.75C17.9544 4.5 17.1913 4.81607 16.6287 5.37868C16.0661 5.94129 15.75 6.70435 15.75 7.5V10.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.25 11.25L4.5 6V19.5L11.25 11.25ZM11.25 11.25L19.5 6V19.5L11.25 11.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-white pb-32 md:pb-4 will-change-scroll">
            <div className="max-w-2xl mx-auto space-y-4">
              {displayedMessages.map((message, index) => {
                const isFromMe = message.senderId === user?.id;
                // Use a more unique key that handles both real and optimistic messages
                const messageKey = message.id > 0 ? `msg-${message.id}` : `temp-${message.id}-${message.createdAt}`;
                return (
                  <div
                    key={messageKey}
                    className={`group flex ${isFromMe ? 'justify-end' : 'justify-start'} relative`}
                  >
                    <div className={`flex ${isFromMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-[70%]`}>
                      {/* Message Bubble */}
                      <div className="relative">
                        {/* Reply Preview */}
                        {message.replyTo && (
                          <div className={`text-xs px-3 py-1.5 mb-1 rounded-lg border-l-2 ${
                            isFromMe 
                              ? 'bg-white/20 border-white/40' 
                              : 'bg-gray-200 border-gray-400'
                          }`}>
                            <div className="font-semibold opacity-80">{message.replyTo.senderName}</div>
                            <div className="opacity-60 truncate">{message.replyTo.text}</div>
                          </div>
                        )}
                        
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            isFromMe
                              ? 'bg-[#02fa97] text-black'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.messageText}</p>
                          <p className="text-xs mt-1 opacity-70">
                            {formatTimestamp(message.createdAt)}
                          </p>
                        </div>

                        {/* Reaction */}
                        {message.reaction && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveReaction(message.id);
                            }}
                            className="absolute -bottom-2 -right-2 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-xs shadow-sm hover:bg-gray-50 hover:scale-110 transition-all cursor-pointer active:scale-95"
                            title="Tap to remove reaction"
                          >
                            {message.reaction}
                          </button>
                        )}
                      </div>

                      {/* Three-dot Menu Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const button = e.currentTarget;
                            const rect = button.getBoundingClientRect();
                            const windowHeight = window.innerHeight;
                            const spaceBelow = windowHeight - rect.bottom;
                            const dropdownHeight = 280; // Approximate dropdown height
                            
                            // Show dropdown above if not enough space below
                            const position = spaceBelow < dropdownHeight ? 'top' : 'bottom';
                            setDropdownPosition(prev => ({ ...prev, [message.id]: position }));
                            setSelectedMessageId(selectedMessageId === message.id ? null : message.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-200 rounded-full transition-all"
                          title="More actions"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {selectedMessageId === message.id && (
                          <div 
                            ref={messageActionsRef}
                            className={`absolute ${isFromMe ? 'right-0' : 'left-0'} ${
                              dropdownPosition[message.id] === 'top' ? 'bottom-8' : 'top-8'
                            } w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[100]`}
                          >
                            {/* React Option */}
                            <button
                              onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            >
                              <span className="text-base">😊</span>
                              <span>React</span>
                            </button>

                            {/* Reply Option */}
                            <button
                              onClick={() => handleReplyToMessage(message)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 10H15M9 14H12M3 18V6C3 5.46957 3.21071 4.96086 3.58579 4.58579C3.96086 4.21071 4.46957 4 5 4H19C19.5304 4 20.0391 4.21071 20.4142 4.58579C20.7893 4.96086 21 5.46957 21 6V14C21 14.5304 20.7893 15.0391 20.4142 15.4142C20.0391 15.7893 19.5304 16 19 16H7L3 18Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span>Reply</span>
                            </button>

                            {/* Copy Option */}
                            <button
                              onClick={() => handleCopyMessage(message.messageText)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 16H6C5.46957 16 4.96086 15.7893 4.58579 15.4142C4.21071 15.0391 4 14.5304 4 14V6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H14C14.5304 4 15.0391 4.21071 15.4142 4.58579C15.7893 4.96086 16 5.46957 16 6V8M10 20H18C18.5304 20 19.0391 19.7893 19.4142 19.4142C19.7893 19.0391 20 18.5304 20 18V10C20 9.46957 19.7893 8.96086 19.4142 8.58579C19.0391 8.21071 18.5304 8 18 8H10C9.46957 8 8.96086 8.21071 8.58579 8.58579C8.21071 8.96086 8 9.46957 8 10V18C8 18.5304 8.21071 19.0391 8.58579 19.4142C8.96086 19.7893 9.46957 20 10 20Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span>Copy</span>
                            </button>

                            <div className="border-t border-gray-100 my-1"></div>

                            {/* Unsend Option - Only for own messages */}
                            {isFromMe && (
                              <button
                                onClick={() => handleUnsendMessage(message.id)}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M9 13L15 7M15 13L9 7M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span>Unsend</span>
                              </button>
                            )}

                            {/* Delete Option */}
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H5H21M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span>Delete for me</span>
                            </button>
                          </div>
                        )}

                        {/* Emoji Picker */}
                        {showEmojiPicker === message.id && (
                          <div 
                            ref={emojiPickerRef}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute ${isFromMe ? 'right-0' : 'left-0'} ${
                              dropdownPosition[message.id] === 'top' ? 'bottom-8' : 'top-8'
                            } bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1 z-[100]`}>
                            {['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🔥'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReactToMessage(message.id, emoji);
                                }}
                                className="hover:bg-gray-100 rounded p-1 transition-colors text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          
          {/* Input */}
          <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0 fixed md:relative bottom-16 md:bottom-auto left-0 right-0 md:left-auto md:right-auto z-[60]">
            <div className="max-w-2xl mx-auto">
              {/* Reply Preview */}
              {replyingTo && (
                <div className="mb-2 bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 10H15M9 14H12M3 18V6C3 5.46957 3.21071 4.96086 3.58579 4.58579C3.96086 4.21071 4.46957 4 5 4H19C19.5304 4 20.0391 4.21071 20.4142 4.58579C20.7893 4.96086 21 5.46957 21 6V14C21 14.5304 20.7893 15.0391 20.4142 15.4142C20.0391 15.7893 19.5304 16 19 16H7L3 18Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="font-semibold">Replying to {replyingTo.senderName}</span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{replyingTo.text}</p>
                  </div>
                  <button
                    onClick={cancelReply}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 md:gap-3">
                {/* Hide extra buttons on mobile, show only on desktop */}
                <button className="hidden md:block p-2 text-gray-600 hover:text-gray-900 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                <div className="flex-1 relative">
                  <textarea
                    id="message-input"
                    name="message"
                    value={input}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Message..."
                    className="w-full px-4 py-3 bg-gray-100 rounded-2xl border-0 focus:outline-none focus:ring-2 focus:ring-[#02fa97]/20 focus:bg-white transition-all text-gray-900 text-sm resize-none max-h-32"
                    rows={1}
                    style={{ minHeight: '44px' }}
                  />
                  {isTyping && (
                    <div className="absolute -top-7 left-0 text-xs text-gray-500 italic flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                      <span className="ml-1">{activeOtherUser.name} is typing...</span>
                    </div>
                  )}
                </div>
                
                {/* Hide extra buttons on mobile, show only on desktop */}
                <button className="hidden md:block p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.44 11.05L12.25 6.77C11.91 6.58 11.5 6.58 11.16 6.77L1.97 11.05C1.55 11.27 1.55 11.73 1.97 11.95L11.16 16.23C11.5 16.42 11.91 16.42 12.25 16.23L21.44 11.95C21.86 11.73 21.86 11.27 21.44 11.05Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                <button className="hidden md:block p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.182 15.182C13.556 16.808 11.926 18.434 9.879 18.434C7.832 18.434 6.202 16.808 6.202 14.761C6.202 12.714 7.832 11.088 9.879 11.088C11.926 11.088 13.556 12.714 13.556 14.761M15.182 15.182L22 22M15.182 15.182C16.808 13.556 18.434 11.926 18.434 9.879C18.434 7.832 16.808 6.202 14.761 6.202C12.714 6.202 11.088 7.832 11.088 9.879C11.088 11.926 12.714 13.556 14.761 13.556" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {input.trim() ? (
                  <button
                    onClick={handleSendMessage}
                    className="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-sm hover:shadow text-sm flex-shrink-0 flex items-center gap-2"
                  >
                    <span>Send</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ) : (
                  <button className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 14C20.49 12.54 22 10.79 22 8.5C22 7.04131 21.4205 5.64236 20.3891 4.61091C19.3576 3.57946 17.9587 3 16.5 3C14.74 3 13.5 3.5 12 5C10.5 3.5 9.26 3 7.5 3C6.04131 3 4.64236 3.57946 3.61091 4.61091C2.57946 5.64236 2 7.04131 2 8.5C2 10.79 3.51 12.54 5 14L12 21L19 14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        !activeConversation && !isMobileView && (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center">
              <div className="w-28 h-28 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-600">
                  <path d="M8.5 12H8.51M12 12H12.01M15.5 12H15.51M21 12C21 16.418 16.97 20 12 20C10.89 20 9.84 19.79 8.88 19.42L3 21L4.58 15.12C4.21 14.16 4 13.11 4 12C4 7.582 8.03 4 12 4C16.97 4 21 7.582 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Your Messages</h3>
              <p className="text-gray-600">Select a conversation to start messaging</p>
            </div>
          </div>
        )
      )}
      
      {/* Confirmation Modal */}
      {showConfirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-xs bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                showConfirmModal.action === 'delete' ? 'bg-red-100' : 'bg-orange-100'
              }`}>
                {showConfirmModal.action === 'delete' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6H5H21M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="text-orange-600"/>
                    <path d="M4.93 4.93L19.07 19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-orange-600"/>
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {showConfirmModal.action === 'delete' ? 'Delete conversation' : 'Block user'}
                </h3>
                <p className="text-sm text-gray-600">
                  {showConfirmModal.action === 'delete' 
                    ? `Are you sure you want to delete your conversation with ${showConfirmModal.otherUserName}? This action cannot be undone.`
                    : `Are you sure you want to block ${showConfirmModal.otherUserName}? They won't be able to message you anymore.`
                  }
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal({ isOpen: false, action: null, conversationId: null, otherUserName: '' })}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  showConfirmModal.action === 'delete' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {showConfirmModal.action === 'delete' ? 'Delete' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MessagesPage = () => {
  return (
    <Suspense fallback={<div className="h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02fa97]"></div></div>}>
      <MessagesPageInner />
    </Suspense>
  );
};

export default MessagesPage;
