'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  isConnecting: boolean
  joinConversation: (otherUserId: number) => void
  leaveConversation: (otherUserId: number) => void
  sendMessage: (messageData: { receiverId: number; messageText?: string; mediaUrl?: string | null; clientId?: string; replyToId?: number | null }) => void
  onNewMessage: (callback: (message: any) => void) => () => void
  onMessageNotification: (callback: (notification: any) => void) => () => void
  onNotification: (callback: (notification: any) => void) => () => void
  onMessageUnsent: (callback: (data: { messageId: number }) => void) => () => void
  onMessageDeleted: (callback: (data: { messageId: number }) => void) => () => void
  // New: Message status acknowledgment handlers
  onMessageAck: (callback: (data: { clientId: string; messageId: number; status: string; sentAt: string }) => void) => () => void
  onMessageDelivered: (callback: (data: { messageId: number; clientId?: string; deliveredTo: number; deliveredAt: string }) => void) => () => void
  onMessagesRead: (callback: (data: { messageIds: number[]; readBy: number; readAt: string }) => void) => () => void
  // New: Methods for acknowledgment
  markMessagesRead: (otherUserId: number, messageIds: number[], senderId?: number) => void
  confirmMessageReceived: (messageId: number, senderId: number) => void
  startTyping: (otherUserId: number, userId: number, userName: string) => void
  stopTyping: (otherUserId: number, userId: number) => void
  onTyping: (callback: (data: any) => void) => () => void
  onStoppedTyping: (callback: (data: any) => void) => () => void
  disconnect: () => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

interface SocketProviderProps {
  children: React.ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const { user, token, setSocketDisconnect, logout } = useAuth()
  const isInitializing = useRef(false)

  // Helper function to validate token format and expiration
  const isTokenValid = useCallback((token: string | null): boolean => {
    if (!token || token.length < 20) return false;

    // Basic JWT format check (should have 3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    try {
      // Decode the payload (middle part) to check expiration
      const payload = JSON.parse(atob(parts[1]));

      // Check if token has expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.warn('⚠️ Socket token has expired');
        return false;
      }

      return true;
    } catch (e) {
      console.error('❌ Invalid socket token format:', e);
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('🔌 Manually disconnecting socket...');
      socket.emit('user-offline', user?.id)
      socket.disconnect()
      setSocket(null)
      setIsConnected(false)
      isInitializing.current = false;
    }
  }, [socket, user?.id, isInitializing])

  // Register disconnect function with AuthContext
  useEffect(() => {
    if (setSocketDisconnect) {
      setSocketDisconnect(disconnect);
    }
  }, [setSocketDisconnect, disconnect]);

  useEffect(() => {
    if (!user || !token) {
      // Clear socket if user is not authenticated
      if (socket) {
        disconnect();
      }
      return;
    }

    // Validate token before attempting connection
    if (!isTokenValid(token)) {
      console.error('❌ Cannot connect socket: Token is invalid or expired');
      console.error('💡 Triggering logout to clear invalid token');

      // Clear socket if it exists
      if (socket) {
        disconnect();
      }

      // Trigger logout to clear invalid token
      if (typeof window !== 'undefined') {
        alert('Your session has expired. Please log in again.');
        logout();
      }

      return;
    }

    // Prevent multiple connections - use ref to avoid dependency loop
    if (socket || isInitializing.current) {
      console.log('Socket already exists or initializing, skipping initialization');
      return;
    }

    isInitializing.current = true;
    console.log('Initializing new socket connection...');
    setIsConnecting(true);

    // Initialize single Socket.IO connection to Node.js server
    let newSocket: Socket | null = null

    const baseUrl = (typeof window !== 'undefined' && window.location.origin) || ''
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || baseUrl

    console.log('🔌 Socket URL config:');
    console.log('   NEXT_PUBLIC_SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL);
    console.log('   baseUrl:', baseUrl);
    console.log('   Using URL:', url);

    try {
      newSocket = io(url, {
        forceNew: true,
        timeout: 60000, // 60 seconds for Render cold starts
        reconnection: true,
        reconnectionAttempts: 10, // More attempts for sleeping servers
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        transports: ['polling', 'websocket'], // Start with polling for better Render compatibility
        upgrade: true, // Upgrade to WebSocket after initial connection
        auth: { token },
        withCredentials: true,
      })

      newSocket.on('connect', () => {
        console.log('✅ Connected to Socket.io server')
        console.log('🔗 Socket ID:', newSocket!.id)
        setIsConnected(true)
        setIsConnecting(false)

        // Announce online status
        newSocket!.emit('user-online')
      })

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from Socket.io server:', reason)
        setIsConnected(false)
        setIsConnecting(false)
      })

      newSocket.on('connect_error', (error: any) => {
        setIsConnecting(false)
        setIsConnected(false)

        // Handle authentication errors
        const isAuthError = error.message?.includes('No token') ||
          error.message?.includes('Authentication') ||
          error.message?.includes('Token expired') ||
          error.message?.includes('Invalid token');

        if (isAuthError) {
          console.error('🔐 Socket authentication failed - Session expired')

          // Disconnect socket
          if (newSocket) {
            newSocket.close();
          }

          // Clear socket state
          setSocket(null);

          // Trigger logout
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              alert('Your session has expired. Please log in again.');
              logout();
            }, 100);
          }
        } else if (error.message?.includes('xhr poll error')) {
          console.warn('🔌 Socket server unreachable at:', url)
          console.warn('💡 Start local socket server with: node socket-server.js')
        } else {
          console.warn('🔌 Socket connection failed:', error.message || 'Unknown error')
        }
      })

      // Handle socket errors
      newSocket.on('error', (error) => {
        console.error('❌ Socket error:', error?.message || error || 'Unknown error')
        if (error) {
          console.error('Error details:', JSON.stringify(error, null, 2))
        }
      })

      // Handle message-specific errors
      newSocket.on('message-error', (error) => {
        console.error('❌ Message send failed:', error.message || 'Unknown error')
        if (error.clientId) {
          console.error('Failed message clientId:', error.clientId)
        }
      })

      setSocket(newSocket)
      isInitializing.current = false
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      isInitializing.current = false
    }

    return () => {
      // Only cleanup if we're unmounting or user/token changed
      // Don't cleanup on socket state change to prevent disconnect loop
      if (isInitializing.current) {
        isInitializing.current = false;
      }
    }
  }, [user?.id, token, disconnect, isTokenValid, logout])

  const joinConversation = useCallback((otherUserId: number) => {
    if (socket && user?.id) {
      const conversationId = [user.id, otherUserId].sort((a, b) => a - b).join('-')
      socket.emit('join-conversation', conversationId)
      console.log(`Joined conversation: ${conversationId}`)
    }
  }, [socket, user?.id])

  const leaveConversation = useCallback((otherUserId: number) => {
    if (socket && user?.id) {
      const conversationId = [user.id, otherUserId].sort((a, b) => a - b).join('-')
      socket.emit('leave-conversation', conversationId)
      console.log(`Left conversation: ${conversationId}`)
    }
  }, [socket, user?.id])

  const sendMessage = useCallback((messageData: { receiverId: number; messageText?: string; mediaUrl?: string | null; clientId?: string; replyToId?: number | null }) => {
    if (!socket || !socket.connected) {
      console.warn('⚠️ Cannot send message: socket not connected. Please wait for connection to be established.');
      // Don't throw - let the UI handle this gracefully with optimistic updates
      return false;
    }

    if (!user?.id) {
      console.warn('⚠️ Cannot send message: user not authenticated');
      return false;
    }

    // Validate message data
    if (!messageData.receiverId) {
      console.error('❌ Receiver ID is required');
      return false;
    }

    if (!messageData.messageText?.trim() && !messageData.mediaUrl) {
      console.error('❌ Message content is required');
      return false;
    }

    try {
      const conversationId = [user.id, messageData.receiverId].sort((a, b) => a - b).join('-')
      console.log('📤 [Socket] Sending message:', { 
        receiverId: messageData.receiverId, 
        messageText: messageData.messageText?.substring(0, 30), 
        conversationId 
      });
      socket.emit('send-message', {
        ...messageData,
        conversationId,
        senderId: user.id,
        senderName: user.name,
        createdAt: new Date().toISOString(),
      })
      console.log(`✅ [Socket] Message emitted to conversation: ${conversationId}`)
      return true;
    } catch (error) {
      console.error('❌ [Socket] Failed to send message:', error);
      return false;
    }
  }, [socket, user])

  const onNewMessage = (callback: (message: any) => void) => {
    if (!socket) return () => { }
    const handler = (msg: any) => {
      console.log('📨 [Socket] Received new-message event:', msg);
      callback(msg);
    }
    socket.on('new-message', handler)
    return () => socket.off('new-message', handler)
  }

  const onMessageNotification = (callback: (notification: any) => void) => {
    if (!socket) return () => { }
    const handler = (n: any) => callback(n)
    socket.on('message-notification', handler)
    return () => socket.off('message-notification', handler)
  }

  const onNotification = (callback: (notification: any) => void) => {
    if (!socket) return () => { }
    socket.on('notification', callback)
    return () => socket.off('notification', callback)
  }

  const onMessageUnsent = (callback: (data: { messageId: number }) => void) => {
    if (!socket) return () => { }
    const handler = (data: { messageId: number }) => callback(data)
    socket.on('message-unsent', handler)
    return () => socket.off('message-unsent', handler)
  }

  const onMessageDeleted = (callback: (data: { messageId: number }) => void) => {
    if (!socket) return () => { }
    const handler = (data: { messageId: number }) => callback(data)
    socket.on('message-deleted', handler)
    return () => socket.off('message-deleted', handler)
  }

  const startTyping = (otherUserId: number, userId: number, userName: string) => {
    if (socket && user?.id) {
      const conversationId = [user.id, otherUserId].sort((a, b) => a - b).join('-')
      socket.emit('typing-start', { conversationId, userId, userName })
    }
  }

  const stopTyping = (otherUserId: number, userId: number) => {
    if (socket && user?.id) {
      const conversationId = [user.id, otherUserId].sort((a, b) => a - b).join('-')
      socket.emit('typing-stop', { conversationId, userId })
    }
  }

  const onTyping = (callback: (data: any) => void) => {
    if (!socket) return () => { }
    const handler = (d: any) => callback(d)
    socket.on('user-typing', handler)
    return () => socket.off('user-typing', handler)
  }

  const onStoppedTyping = (callback: (data: any) => void) => {
    if (!socket) return () => { }
    const handler = (d: any) => callback(d)
    socket.on('user-stopped-typing', handler)
    return () => socket.off('user-stopped-typing', handler)
  }

  // New: Message acknowledgment handler (confirms message saved on server)
  const onMessageAck = (callback: (data: { clientId: string; messageId: number; status: string; sentAt: string }) => void) => {
    if (!socket) return () => { }
    const handler = (d: any) => callback(d)
    socket.on('message-ack', handler)
    return () => socket.off('message-ack', handler)
  }

  // New: Message delivered handler (confirms recipient received message)
  const onMessageDelivered = (callback: (data: { messageId: number; clientId?: string; deliveredTo: number; deliveredAt: string }) => void) => {
    if (!socket) return () => { }
    const handler = (d: any) => callback(d)
    socket.on('message-delivered', handler)
    return () => socket.off('message-delivered', handler)
  }

  // New: Messages read handler (confirms recipient read messages)
  const onMessagesRead = (callback: (data: { messageIds: number[]; readBy: number; readAt: string }) => void) => {
    if (!socket) return () => { }
    const handler = (d: any) => callback(d)
    socket.on('messages-read', handler)
    return () => socket.off('messages-read', handler)
  }

  // New: Mark messages as read
  const markMessagesRead = useCallback((otherUserId: number, messageIds: number[], senderId?: number) => {
    if (socket && user?.id) {
      const conversationId = [user.id, otherUserId].sort((a, b) => a - b).join('-')
      socket.emit('mark-messages-read', { conversationId, messageIds, senderId })
    }
  }, [socket, user?.id])

  // New: Confirm message was received (for delivery status)
  const confirmMessageReceived = useCallback((messageId: number, senderId: number) => {
    if (socket) {
      socket.emit('message-received', { messageId, senderId })
    }
  }, [socket])

  const value: SocketContextType = {
    socket,
    isConnected,
    isConnecting,
    joinConversation,
    leaveConversation,
    sendMessage,
    onNewMessage,
    onMessageNotification,
    onNotification,
    onMessageUnsent,
    onMessageDeleted,
    onMessageAck,
    onMessageDelivered,
    onMessagesRead,
    markMessagesRead,
    confirmMessageReceived,
    startTyping,
    stopTyping,
    onTyping,
    onStoppedTyping,
    disconnect
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}