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

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, 'https://uni-x.vercel.app', 'https://uni-x-zeta.vercel.app'],
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
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('No token provided'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return next(new Error('Invalid token'));
    }

    socket.userId = decoded.userId;
    socket.userName = decoded.name || `User ${decoded.userId}`;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`✅ User ${socket.userName} (${socket.userId}) connected:`, socket.id);

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
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save message: ${errorText}`);
      }

      const result = await response.json();
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

      console.log(`Message sent from ${socket.userId} to ${receiverId}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
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

  // Handle message read status
  socket.on('mark-messages-read', (data) => {
    socket.to(`conversation-${data.conversationId}`).emit('messages-marked-read', {
      conversationId: data.conversationId,
      userId: data.userId,
      readAt: new Date()
    });
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
    socket.broadcast.emit('user-status-change', {
      userId: socket.userId,
      status: 'offline',
      lastSeen: new Date()
    });
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
