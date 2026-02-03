// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const server = createServer(app);

// Environment variables
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Debug: Log environment configuration at startup
console.log('🔧 Environment Configuration:');
console.log('   PORT:', PORT);
console.log('   JWT_SECRET:', JWT_SECRET ? `${JWT_SECRET.substring(0, 10)}...` : '❌ NOT SET');
console.log('   FRONTEND_URL:', FRONTEND_URL);
console.log('   API_BASE_URL:', API_BASE_URL);

// CORS configuration
app.use(cors({
  origin: [FRONTEND_URL, 'https://uni-x.vercel.app', 'https://uni-x-zeta.vercel.app'],
  credentials: true
}));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Socket.IO server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    connections: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

// Endpoint to emit message unsend event
app.post('/emit-message-unsend', express.json(), (req, res) => {
  try {
    const { messageId, senderId, receiverId } = req.body;

    // Notify both users
    io.to(`user-${senderId}`).emit('message-unsent', { messageId });
    io.to(`user-${receiverId}`).emit('message-unsent', { messageId });

    console.log(`📤 Message ${messageId} unsent notification sent`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error emitting message unsend:', error);
    res.status(500).json({ error: 'Failed to emit event' });
  }
});

// Endpoint to emit message delete event
app.post('/emit-message-delete', express.json(), (req, res) => {
  try {
    const { messageId, userId, senderId, receiverId } = req.body;

    // Only notify the user who deleted it (for their other devices)
    io.to(`user-${userId}`).emit('message-deleted', { messageId });

    console.log(`🗑️ Message ${messageId} delete notification sent to user ${userId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error emitting message delete:', error);
    res.status(500).json({ error: 'Failed to emit event' });
  }
});

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

// Helper to check if user is online
const isUserOnline = (userId) => onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;

// Helper to get online user IDs
const getOnlineUserIds = () => Array.from(onlineUsers.keys());

// Endpoint to get online users
app.get('/online-users', (req, res) => {
  res.json({
    onlineUsers: getOnlineUserIds(),
    count: onlineUsers.size
  });
});

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, 'https://uni-x-zeta.vercel.app'],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Authentication middleware
io.use(async (socket, next) => {
  console.log('🔐 Authentication attempt from:', socket.handshake.address);
  try {
    const token = socket.handshake.auth.token;
    console.log('📝 Token received:', token ? `${token.substring(0, 20)}...` : 'NONE');
    
    if (!token) {
      console.error('❌ No token provided');
      return next(new Error('No token provided'));
    }

    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key') {
      console.error('❌ CRITICAL: JWT_SECRET not configured properly!');
      return next(new Error('Server configuration error'));
    }

    console.log('🔍 Verifying token with issuer/audience checks...');
    // Enhanced JWT verification matching lib/auth.ts
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'unix-social',
      audience: 'unix-api'
    });
    console.log('✅ Token verified, userId:', decoded.userId);

    if (!decoded || !decoded.userId) {
      return next(new Error('Invalid token'));
    }

    socket.userId = decoded.userId;
    socket.userName = decoded.name || `User ${decoded.userId}`;
    socket.tokenJti = decoded.jti; // Store token ID
    next();
  } catch (error) {
    console.error('❌ Socket authentication error:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication failed: Invalid token signature'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication failed: Token expired'));
    } else if (error.name === 'NotBeforeError') {
      return next(new Error('Authentication failed: Token not active'));
    }

    next(new Error('Authentication failed'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`✅ User ${socket.userName} (${socket.userId}) connected:`, socket.id);

  // Track user as online
  if (!onlineUsers.has(socket.userId)) {
    onlineUsers.set(socket.userId, new Set());
  }
  onlineUsers.get(socket.userId).add(socket.id);

  // Broadcast online status
  socket.broadcast.emit('user-status-change', {
    userId: socket.userId,
    status: 'online',
    lastSeen: new Date()
  });

  // Auto-join user to their personal room
  socket.join(`user-${socket.userId}`);
  console.log(`👤 User ${socket.userId} auto-joined room user-${socket.userId}`);

  // Join conversation room
  socket.on('join-conversation', (conversationId) => {
    socket.join(`conversation-${conversationId}`);
    console.log(`Socket ${socket.id} joined conversation-${conversationId}`);
  });

  // Leave conversation room
  socket.on('leave-conversation', (conversationId) => {
    socket.leave(`conversation-${conversationId}`);
    console.log(`Socket ${socket.id} left conversation-${conversationId}`);
  });

  // Handle new message with database storage
  socket.on('send-message', async (messageData) => {
    try {
      const { receiverId, messageText, mediaUrl, clientId, replyToId } = messageData;

      if (!receiverId || (!messageText?.trim() && !mediaUrl)) {
        console.error('❌ Invalid message data:', messageData);
        socket.emit('message-error', {
          message: 'Invalid message data',
          clientId
        });
        return;
      }

      console.log(`📤 Sending message from ${socket.userId} to ${receiverId}`);
      console.log(`📡 API URL: ${API_BASE_URL}/api/messages`);
      console.log(`📝 Message data:`, { receiverId: parseInt(receiverId), messageText: messageText?.trim()?.substring(0, 50) });

      // Store message in database via API
      const response = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${socket.handshake.auth.token}`
        },
        body: JSON.stringify({
          receiverId: parseInt(receiverId),
          messageText: messageText?.trim(),
          replyToId: replyToId || null
        })
      });

      console.log(`📊 API Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error (${response.status}):`, errorText);
        throw new Error(`Failed to save message: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Message saved to DB with ID: ${result.message?.id}`);
      const savedMessage = result.message;

      // Format for frontend
      const formattedMessage = {
        id: savedMessage.id,
        senderId: savedMessage.sender_id,
        receiverId: savedMessage.receiver_id,
        messageText: savedMessage.message_text,
        mediaUrl: savedMessage.media_url,
        createdAt: savedMessage.created_at,
        sender: savedMessage.sender,
        receiver: savedMessage.receiver,
        replyTo: savedMessage.replyTo || null,
        clientId: clientId || undefined
      };

      // Emit to conversation room
      const conversationId = [socket.userId, parseInt(receiverId)].sort().join('-');
      io.to(`conversation-${conversationId}`).emit('new-message', formattedMessage);

      // Also emit to receiver's personal room
      io.to(`user-${receiverId}`).emit('message-notification', {
        message: formattedMessage,
        from: { id: socket.userId, name: socket.userName }
      });

      // Send acknowledgment to sender (message saved successfully)
      socket.emit('message-ack', {
        clientId,
        messageId: savedMessage.id,
        status: 'sent',
        sentAt: new Date().toISOString()
      });

      // If receiver is online, it will be delivered immediately
      if (isUserOnline(parseInt(receiverId))) {
        socket.emit('message-delivered', {
          messageId: savedMessage.id,
          clientId,
          deliveredTo: parseInt(receiverId),
          deliveredAt: new Date().toISOString()
        });
      }

      console.log(`✅ Message sent from ${socket.userId} to ${receiverId}`);
    } catch (error) {
      console.error('❌ Error sending message:', error.message);
      console.error('Stack:', error.stack);
      socket.emit('message-error', {
        message: error.message || 'Failed to send message',
        clientId: messageData?.clientId
      });
    }
  });

  // Generic notifications (likes, comments, follows)
  socket.on('notify', (payload) => {
    const { userId, type, message, meta } = payload || {}
    if (!userId || !type) return
    io.to(`user-${userId}`).emit('notification', {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message,
      time: new Date().toISOString(),
      read: false,
      ...meta
    })
  })

  // Handle typing indicators
  socket.on('typing-start', (data) => {
    socket.to(`conversation-${data.conversationId}`).emit('user-typing', {
      userId: data.userId,
      userName: data.userName
    });
  });

  socket.on('typing-stop', (data) => {
    socket.to(`conversation-${data.conversationId}`).emit('user-stopped-typing', {
      userId: data.userId
    });
  });

  // Handle message received acknowledgment (for delivery status)
  socket.on('message-received', (data) => {
    const { messageId, senderId } = data;
    if (!messageId || !senderId) return;

    // Notify sender that message was delivered
    io.to(`user-${senderId}`).emit('message-delivered', {
      messageId,
      deliveredTo: socket.userId,
      deliveredAt: new Date().toISOString()
    });
    console.log(`📬 Message ${messageId} delivered to user ${socket.userId}`);
  });

  // Handle message read status (for read receipts)
  socket.on('mark-messages-read', (data) => {
    const { conversationId, messageIds, senderId } = data;

    // Notify conversation participants
    socket.to(`conversation-${conversationId}`).emit('messages-marked-read', {
      conversationId,
      messageIds: messageIds || [],
      readBy: socket.userId,
      readAt: new Date().toISOString()
    });

    // Also notify sender's personal room for multi-device sync
    if (senderId) {
      io.to(`user-${senderId}`).emit('messages-read', {
        messageIds: messageIds || [],
        readBy: socket.userId,
        readAt: new Date().toISOString()
      });
    }

    console.log(`👁️ Messages marked read by user ${socket.userId}`);
  });

  // Handle user online status
  socket.on('user-online', () => {
    socket.broadcast.emit('user-status-change', {
      userId: socket.userId,
      status: 'online',
      lastSeen: new Date()
    });
  });

  socket.on('user-offline', (userId) => {
    socket.broadcast.emit('user-status-change', {
      userId: userId || socket.userId,
      status: 'offline',
      lastSeen: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log(`❌ User ${socket.userName} (${socket.userId}) disconnected:`, socket.id);

    // Remove socket from online tracking
    if (onlineUsers.has(socket.userId)) {
      onlineUsers.get(socket.userId).delete(socket.id);
      // If no more sockets for this user, remove from map and broadcast offline
      if (onlineUsers.get(socket.userId).size === 0) {
        onlineUsers.delete(socket.userId);
        socket.broadcast.emit('user-status-change', {
          userId: socket.userId,
          status: 'offline',
          lastSeen: new Date()
        });
      }
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
  console.log(`📡 Accepting connections from: ${FRONTEND_URL}`);
  console.log(`🔗 API Base URL: ${API_BASE_URL}`);
});
