const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const express = require('express');

const app = express();
const port = process.env.SOCKET_PORT || process.env.PORT || 3001;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);

// Initialize Socket.io with CORS for your Next.js app
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.CORS_ORIGIN,
  process.env.NEXT_PUBLIC_APP_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list or if we're using wildcard in development
      if (allowedOrigins.includes(origin) || (process.env.NODE_ENV === 'development' && !process.env.CORS_ORIGIN)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('No token provided'));
    }

    // Validate JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('❌ CRITICAL: JWT_SECRET not configured in socket server');
      return next(new Error('Server configuration error'));
    }

    // Enhanced JWT verification matching lib/auth.ts
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'unix-social',
      audience: 'unix-api'
    });
    
    if (!decoded || !decoded.userId) {
      return next(new Error('Invalid token'));
    }

    socket.userId = decoded.userId;
    socket.userName = decoded.name || `User ${decoded.userId}`;
    socket.tokenJti = decoded.jti; // Store token ID for potential revocation
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    
    // Provide specific error messages
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
        console.error('Invalid message data:', messageData);
        socket.emit('message-error', { 
          message: 'Invalid message data',
          clientId 
        });
        return;
      }

      // Call your Next.js API to store message
      const apiUrl = process.env.NEXTJS_API_URL || 'http://localhost:3000';
      console.log(`📤 Sending message to API: ${apiUrl}/api/messages`);
      
      const response = await fetch(`${apiUrl}/api/messages`, {
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
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Failed to save message: ${response.status} ${errorText}`);
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
        postId: savedMessage.post_id || null,
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

  // Typing indicators
  socket.on('typing', ({ otherUserId, userId, userName }) => {
    io.to(`user-${otherUserId}`).emit('user-typing', { userId, userName });
  });

  socket.on('stop-typing', ({ otherUserId, userId }) => {
    io.to(`user-${otherUserId}`).emit('user-stopped-typing', { userId });
  });

  // User status
  socket.on('user-online', () => {
    socket.broadcast.emit('user-status', { userId: socket.userId, status: 'online' });
  });

  socket.on('user-offline', (userId) => {
    socket.broadcast.emit('user-status', { userId, status: 'offline' });
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 User ${socket.userId} disconnected:`, reason);
    socket.broadcast.emit('user-status', { userId: socket.userId, status: 'offline' });
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

server.listen(port, () => {
  console.log(`🚀 Socket.IO server running on port ${port}`);
  console.log(`📡 Accepting connections from: ${process.env.CORS_ORIGIN || '*'}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
