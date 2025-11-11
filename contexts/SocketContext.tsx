'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinConversation: (otherUserId: number) => void
  leaveConversation: (otherUserId: number) => void
  sendMessage: (messageData: { receiverId: number; messageText?: string; mediaUrl?: string | null; clientId?: string; replyToId?: number | null }) => void
  onNewMessage: (callback: (message: any) => void) => () => void
  onMessageNotification: (callback: (notification: any) => void) => () => void
  onNotification: (callback: (notification: any) => void) => () => void
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
  const { user, token, setSocketDisconnect } = useAuth()

  const disconnect = useCallback(() => {
    if (socket) {
      socket.emit('user-offline', user?.id)
      socket.disconnect()
      setSocket(null)
      setIsConnected(false)
    }
  }, [socket, user?.id])

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

    // Prevent multiple connections
    if (socket) {
      console.log('Socket already exists, skipping initialization');
      return;
    }

    console.log('Initializing new socket connection...');

    // Initialize single Socket.IO connection to Node.js server
    let newSocket: Socket | null = null

    const baseUrl = (typeof window !== 'undefined' && window.location.origin) || ''
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || baseUrl

    try {
      newSocket = io(url, {
        forceNew: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        upgrade: true,
        auth: { token },
        withCredentials: true,
      })

      newSocket.on('connect', () => {
        console.log('✅ Connected to Socket.io server')
        console.log('🔗 Socket ID:', newSocket!.id)
        setIsConnected(true)

        // Announce online status
        newSocket!.emit('user-online')
      })

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from Socket.io server:', reason)
        setIsConnected(false)
      })

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket.io connection error:', error.message)
        
        // Provide helpful error messages
        if (error.message.includes('No token') || error.message.includes('Authentication')) {
          console.error('💡 Authentication error - Please logout and login again')
        } else if (error.message.includes('xhr poll error')) {
          console.error('💡 Cannot reach server - Please check if server is running on http://localhost:3000')
        }
        
        setIsConnected(false)
      })

      // Handle auth errors
      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      setSocket(newSocket)
    } catch (error) {
      console.error('Failed to initialize socket:', error);
    }

    return () => {
      try {
        newSocket?.close()
      } catch (error) {
        console.warn('Error closing socket:', error);
      }
    }
  }, [user?.id, token])

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
      console.warn('Cannot send message: socket not connected');
      throw new Error('Socket not connected');
    }

    if (!user?.id) {
      console.warn('Cannot send message: user not authenticated');
      throw new Error('User not authenticated');
    }

    // Validate message data
    if (!messageData.receiverId) {
      throw new Error('Receiver ID is required');
    }

    if (!messageData.messageText?.trim() && !messageData.mediaUrl) {
      throw new Error('Message content is required');
    }

    try {
      const conversationId = [user.id, messageData.receiverId].sort((a, b) => a - b).join('-')
      socket.emit('send-message', {
        ...messageData,
        conversationId,
        senderId: user.id,
        senderName: user.name,
        createdAt: new Date().toISOString(),
      })
      console.log(`Sending message to conversation: ${conversationId}`)
    } catch (error) {
      console.error('Failed to send message via socket:', error);
      throw error;
    }
  }, [socket, user])

  const onNewMessage = (callback: (message: any) => void) => {
    if (!socket) return () => { }
    const handler = (msg: any) => callback(msg)
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

  const value: SocketContextType = {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    onNewMessage,
    onMessageNotification,
    onNotification,
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