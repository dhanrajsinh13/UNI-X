const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Database connection keeper to prevent Neon hibernation
function startDatabaseKeeper() {
  const keepAliveInterval = 4 * 60 * 1000; // 4 minutes
  
  setInterval(async () => {
    try {
      // Use health endpoint to keep database alive
      const response = await fetch(`http://localhost:${port}/api/health`, {
        method: 'GET',
        headers: { 'Connection': 'keep-alive' }
      }).catch(() => null);
      
      if (response?.ok) {
        console.log('🔄 Database connection keep-alive successful');
      } else {
        console.warn('⚠️ Database keep-alive failed - server response:', response?.status);
      }
    } catch (error) {
      console.warn('⚠️ Database keep-alive error:', error.message);
    }
  }, keepAliveInterval);
  
  console.log('🚀 Database connection keeper started (4min intervals)');
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  // Initialize Socket.io with authentication
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        const response = await fetch(`http://localhost:${port}/api/messages`, {
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
      // payload: { userId, type, message, meta }
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

    socket.on('disconnect', () => {
      console.log(`User ${socket.userName} (${socket.userId}) disconnected:`, socket.id);
      // Handle user going offline
      socket.broadcast.emit('user-status-change', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date()
      });
    });
  });

  // Make io available globally for API routes
  global.io = io;

  // Start database connection keeper
  setTimeout(() => {
    startDatabaseKeeper();
  }, 10000); // Wait 10 seconds after server start

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log('> Socket.io server initialized');
    });
});