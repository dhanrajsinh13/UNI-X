# 🎓 UNI-X - College Social Network Platform

> A modern, full-stack social networking platform built for college students with real-time messaging, posts, follow system, notifications, and Meta AI chatbot integration.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Core Features](#core-features)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Socket Events](#socket-events)
- [Frontend Components](#frontend-components)
- [Context Management](#context-management)
- [Authentication & Security](#authentication--security)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Code Explanations](#code-explanations)

---

## 🎯 Overview

**UNI-X** is a comprehensive social networking platform designed specifically for college students. It combines traditional social media features (posts, profiles, followers) with real-time communication (messaging, notifications) and modern AI integration (Meta chatbot).

### Key Highlights
- ✅ **Real-time Messaging** - Instant DMs with typing indicators and read receipts
- ✅ **Social Feed** - Post creation with media upload, likes, comments
- ✅ **Follow System** - Connect with students across departments
- ✅ **Live Notifications** - Real-time updates for interactions
- ✅ **Privacy Controls** - Block users, manage visibility
- ✅ **AI Assistant** - Integrated Meta chatbot for help
- ✅ **Responsive Design** - Mobile-first UI with TailwindCSS
- ✅ **Secure** - JWT authentication, password hashing, input validation

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15.5.3 (React 19.1.0)
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 3.4
- **State Management**: React Context API
- **Real-time**: Socket.IO Client 4.8.1

### Backend
- **Runtime**: Node.js 18.17+
- **Framework**: Next.js API Routes + Express.js (Socket Server)
- **Real-time**: Socket.IO Server 4.8.1
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs

### Database
- **Primary DB**: MongoDB 6.20
- **ODM**: Native MongoDB Driver
- **Connection**: Connection pooling with retry logic

### Infrastructure
- **Frontend Hosting**: Vercel
- **Socket Server**: Render (or similar Node.js hosting)
- **Media Storage**: Cloudinary (optional)
- **Email**: Nodemailer

### Development Tools
- **Linting**: ESLint 9
- **Package Manager**: npm 9.6.7+

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                          │
│                                                                 │
│  ┌──────────────────┐                  ┌──────────────────┐   │
│  │   React/Next.js  │                  │   Socket.IO      │   │
│  │   Frontend       │                  │   Client         │   │
│  │   (UI/UX)        │                  │   (Real-time)    │   │
│  └────────┬─────────┘                  └─────────┬────────┘   │
│           │                                      │             │
└───────────┼──────────────────────────────────────┼─────────────┘
            │                                      │
            │ HTTPS                                │ WSS/HTTPS
            │                                      │
            ▼                                      ▼
┌───────────────────────┐            ┌───────────────────────┐
│                       │            │                       │
│  VERCEL (Frontend)    │            │  RENDER (Backend)     │
│                       │            │                       │
│  ┌─────────────────┐  │            │  ┌─────────────────┐ │
│  │  Next.js Pages  │  │            │  │  Socket.IO      │ │
│  │  - Landing      │  │            │  │  Server         │ │
│  │  - Messages UI  │  │            │  │                 │ │
│  │  - Profile      │  │            │  │  Features:      │ │
│  │  - Settings     │  │            │  │  - Messaging    │ │
│  └─────────────────┘  │            │  │  - Typing       │ │
│                       │            │  │  - Notifications│ │
│  ┌─────────────────┐  │            │  │  - User Status  │ │
│  │  API Routes     │◄─┼────────────┼──┤                 │ │
│  │  - /api/posts   │  │  Fetch API │  └─────────────────┘ │
│  │  - /api/users   │  │            │                       │
│  │  - /api/messages│  │            │  Port: 3001/10000     │
│  └────────┬────────┘  │            └───────────────────────┘
│           │           │
└───────────┼───────────┘
            │
            ▼
┌───────────────────────┐
│   MONGODB (Database)  │
│                       │
│  Collections:         │
│  - users              │
│  - posts              │
│  - messages           │
│  - comments           │
│  - followers          │
│  - blocks             │
│  - notifications      │
└───────────────────────┘
```

### Data Flow

#### Regular API Request Flow
```
User Browser → HTTPS Request → Vercel Next.js → API Route Handler 
→ MongoDB Query → Response to Browser
```

#### Real-time Message Flow
```
User A Browser → Socket Emit: send-message → Render Socket Server
→ HTTP POST to Vercel API (save to DB) → MongoDB (message saved)
→ Socket Emit: new-message → User B Browser (real-time update)
```

---

## 📁 Project Structure

```
UNI-X/
│
├── app/                          # Next.js 13+ App Directory
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Home page (redirects based on auth)
│   ├── landing/                 # Public landing page
│   ├── uniwall/                 # Main feed/wall
│   ├── connect/                 # Social connections page
│   ├── messages/                # Direct messages interface
│   ├── notifications/           # Notifications center
│   ├── profile/[userId]/       # User profile pages
│   ├── settings/                # User settings & preferences
│   ├── suggestions/             # User suggestions
│   └── create-post/             # Post creation page
│
├── pages/                        # Next.js Pages (API Routes)
│   ├── _app.tsx                 # App wrapper with providers
│   ├── _document.tsx            # HTML document structure
│   └── api/                     # Backend API endpoints
│       ├── auth/                # Authentication endpoints
│       │   ├── login.ts         # User login
│       │   ├── register.ts      # User registration
│       │   └── verify.ts        # Token verification
│       ├── users/               # User management
│       │   ├── index.ts         # List users
│       │   ├── [userId].ts      # Get/update user by ID
│       │   ├── me.ts            # Current user info
│       │   ├── follow.ts        # Follow/unfollow
│       │   ├── blocked.ts       # Block management
│       │   ├── suggestions.ts   # User suggestions
│       │   └── upload-profile-pic.ts
│       ├── posts/               # Post management
│       │   ├── index.ts         # Create/list posts
│       │   ├── [postId].ts      # Get/delete/update post
│       │   ├── aura.ts          # Like/unlike posts
│       │   └── upload.ts        # Media upload
│       ├── messages/            # Messaging system
│       │   ├── index.ts         # Get messages
│       │   ├── send.ts          # Send message
│       │   ├── conversations.ts # List conversations
│       │   └── [messageId].ts   # Delete/unsend message
│       ├── comments/            # Comment management
│       │   └── [postId].ts      # Post comments
│       ├── search/              # Search functionality
│       │   └── index.ts         # Search users/posts
│       └── health.ts            # Health check endpoint
│
├── components/                   # Reusable React components
│   ├── Navbar.tsx               # Navigation bar
│   ├── AuthModal.tsx            # Login/register modal
│   ├── CreatePostModal.tsx      # Post creation modal
│   ├── PostCard.tsx             # Individual post display
│   ├── PostModal.tsx            # Post detail modal
│   ├── Messages.tsx             # Main messages component
│   ├── MessagesSimple.tsx       # Simplified messages view
│   ├── ContactsList.tsx         # Contacts sidebar
│   ├── MiniChatWindow.tsx       # Floating chat window
│   ├── FollowButton.tsx         # Follow/unfollow button
│   ├── FollowersListModal.tsx   # Followers/following modal
│   ├── SuggestedUsers.tsx       # User suggestions component
│   ├── SearchModal.tsx          # Search interface
│   ├── MetaChatbot.tsx          # Meta AI chatbot
│   ├── ConditionalChatbot.tsx   # Conditional chatbot wrapper
│   ├── SocketStatus.tsx         # Socket connection indicator
│   ├── Toast.tsx                # Toast notifications
│   ├── MainContainer.tsx        # Main layout container
│   ├── MasonryTile.tsx          # Masonry grid tile
│   └── ClientProviders.tsx      # Client-side context providers
│
├── contexts/                     # React Context providers
│   ├── AuthContext.tsx          # Authentication state
│   ├── SocketContext.tsx        # Socket.IO connection
│   └── ToastContext.tsx         # Toast notifications
│
├── hooks/                        # Custom React hooks
│   ├── useInfiniteScroll.ts     # Infinite scroll pagination
│   ├── useIsMobile.ts           # Mobile detection
│   ├── usePosts.ts              # Posts data management
│   ├── useSearch.ts             # Search functionality
│   └── useUserProfile.ts        # User profile data
│
├── lib/                          # Utility libraries
│   ├── mongodb.ts               # MongoDB connection & helpers
│   ├── auth.ts                  # JWT authentication utilities
│   ├── validation.ts            # Input validation schemas
│   ├── upload.ts                # File upload handling
│   └── dataFetcher.ts           # API data fetching utilities
│
├── socket-server/                # Standalone Socket.IO server
│   ├── server.js                # Main socket server
│   ├── package.json             # Socket server dependencies
│   ├── .env.example             # Environment template
│   ├── render.yaml              # Render deployment config
│   ├── health-check.js          # Health check script
│   ├── keep-alive.js            # Keep server alive
│   └── README.md                # Socket server documentation
│
├── public/                       # Static assets
│   ├── icons/                   # Icon files
│   ├── SVG/                     # SVG graphics
│   └── uploads/                 # User uploaded files
│
├── styles/                       # Global styles
│   └── globals.css              # Global CSS with Tailwind
│
├── scripts/                      # Utility scripts
│   ├── test-mongodb-connection.js
│   ├── migrate-categories.ts
│   └── migration-helper.js
│
├── middleware.ts                 # Next.js middleware
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind CSS config
├── tsconfig.json                # TypeScript configuration
├── eslint.config.mjs            # ESLint configuration
├── package.json                 # Main dependencies
├── server.js                    # Custom Next.js server
├── vercel.json                  # Vercel deployment config
│
└── Documentation/                # Project documentation
    ├── ARCHITECTURE.md
    ├── START_HERE.md
    ├── DEPLOYMENT_CHECKLIST.md
    ├── SECURITY.md
    ├── SOCKET_DEPLOYMENT.md
    └── Various migration guides
```

---

## 🚀 Core Features

### 1. **User Authentication**
- **Registration**: Email verification, college ID validation
- **Login**: JWT-based authentication with secure token storage
- **Session Management**: Auto-refresh tokens, persistent sessions
- **Security**: bcrypt password hashing, CSRF protection

### 2. **Social Feed (UniWall)**
- **Post Creation**: Text posts with optional media
- **Media Upload**: Images via Cloudinary or local storage
- **Interactions**: Like (aura), comment, share
- **Categories**: Department-based post filtering
- **Infinite Scroll**: Paginated feed loading
- **Real-time Updates**: New posts appear instantly

### 3. **User Profiles**
- **Profile Viewing**: Bio, stats (followers, following, posts)
- **Profile Editing**: Update bio, profile picture, settings
- **Privacy Settings**: Control who can follow/message
- **Activity Feed**: User's posts and interactions
- **Tagged Posts**: View posts where user is tagged

### 4. **Follow System**
- **Follow/Unfollow**: Connect with other students
- **Followers List**: View who follows you
- **Following List**: See who you follow
- **Follow Requests**: For private accounts
- **Mutual Connections**: Highlight mutual followers

### 5. **Direct Messaging**
- **Real-time Chat**: Instant message delivery via Socket.IO
- **Typing Indicators**: See when someone is typing
- **Read Receipts**: Know when messages are read
- **Message Actions**: Unsend, delete messages
- **Media Sharing**: Send images in messages
- **Conversations List**: All active chats
- **Mini Chat Window**: Floating chat interface
- **Online Status**: See who's online

### 6. **Notifications**
- **Real-time Alerts**: Instant notifications via Socket.IO
- **Types**: Likes, comments, follows, mentions, messages
- **Mark as Read**: Track read/unread status
- **Notification Center**: View all notifications
- **In-app Toasts**: Non-intrusive alerts

### 7. **Search**
- **User Search**: Find students by name, username, college ID
- **Department Filter**: Search within departments
- **Post Search**: Find posts by content (planned)
- **Instant Results**: Real-time search updates

### 8. **Privacy & Safety**
- **Block Users**: Prevent interaction with specific users
- **Unblock**: Manage blocked users list
- **Report Content**: Flag inappropriate posts/users (planned)
- **Privacy Controls**: Account visibility settings

### 9. **Meta AI Chatbot**
- **Contextual Help**: Answer questions about platform
- **Student Support**: Academic assistance
- **Interactive**: Natural language conversations
- **Conditional Display**: Shows on specific pages

### 10. **Suggestions**
- **User Recommendations**: Discover new connections
- **Based on**: Department, year, mutual connections
- **Smart Filtering**: Excludes already followed users

---

## 🗄️ Database Schema

### Collections Overview

#### **users**
```typescript
{
  _id: ObjectId,
  user_id: number (unique),
  name: string,
  username: string (unique),
  email: string (unique),
  college_id: string (unique),
  password: string (hashed),
  department: string,
  year: number,
  role: string ('student' | 'faculty'),
  bio?: string,
  profile_image?: string,
  privacy_settings: {
    profileVisibility: 'public' | 'friends' | 'private',
    messageSettings: 'everyone' | 'following' | 'none',
    showOnlineStatus: boolean
  },
  created_at: Date,
  updated_at: Date
}
```

#### **posts**
```typescript
{
  _id: ObjectId,
  post_id: number (unique),
  user_id: number,
  content: string,
  media_url?: string,
  category?: string,
  likes: number[],  // Array of user_ids
  comments_count: number,
  created_at: Date,
  updated_at: Date
}
```

#### **messages**
```typescript
{
  _id: ObjectId,
  message_id: number (unique),
  sender_id: number,
  receiver_id: number,
  message_text?: string,
  media_url?: string,
  is_read: boolean,
  is_unsent: boolean,
  deleted_for: number[],  // Array of user_ids
  reply_to_id?: number,
  created_at: Date
}
```

#### **comments**
```typescript
{
  _id: ObjectId,
  comment_id: number (unique),
  post_id: number,
  user_id: number,
  comment_text: string,
  created_at: Date
}
```

#### **followers**
```typescript
{
  _id: ObjectId,
  follower_id: number (unique),
  follower_user_id: number,  // Who is following
  following_user_id: number, // Who is being followed
  created_at: Date
}
```

#### **blocks**
```typescript
{
  _id: ObjectId,
  block_id: number (unique),
  blocker_user_id: number,  // Who blocked
  blocked_user_id: number,  // Who is blocked
  created_at: Date
}
```

#### **notifications**
```typescript
{
  _id: ObjectId,
  notification_id: number (unique),
  user_id: number,          // Recipient
  from_user_id: number,     // Who triggered it
  type: 'like' | 'comment' | 'follow' | 'mention' | 'message',
  post_id?: number,
  comment_id?: number,
  message_id?: number,
  is_read: boolean,
  created_at: Date
}
```

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | ❌ |
| POST | `/api/auth/login` | User login | ❌ |
| GET | `/api/auth/verify` | Verify JWT token | ✅ |

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | List all users with filtering | ✅ |
| GET | `/api/users/me` | Get current user info | ✅ |
| GET | `/api/users/[userId]` | Get user by ID | ✅ |
| PUT | `/api/users/[userId]` | Update user profile | ✅ |
| POST | `/api/users/upload-profile-pic` | Upload profile picture | ✅ |
| GET | `/api/users/suggestions` | Get user suggestions | ✅ |
| GET | `/api/users/blocked` | List blocked users | ✅ |
| POST | `/api/users/follow` | Follow/unfollow user | ✅ |
| GET | `/api/users/[userId]/followers` | Get user's followers | ✅ |
| GET | `/api/users/[userId]/following` | Get user's following | ✅ |

### Posts

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/posts` | Get feed posts (paginated) | ✅ |
| POST | `/api/posts` | Create new post | ✅ |
| GET | `/api/posts/[postId]` | Get single post | ✅ |
| PUT | `/api/posts/[postId]` | Update post | ✅ |
| DELETE | `/api/posts/[postId]` | Delete post | ✅ |
| POST | `/api/posts/aura` | Like/unlike post | ✅ |
| POST | `/api/posts/upload` | Upload post media | ✅ |

### Messages

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/messages` | Get messages with user | ✅ |
| POST | `/api/messages/send` | Send message | ✅ |
| GET | `/api/messages/conversations` | List all conversations | ✅ |
| DELETE | `/api/messages/[messageId]` | Delete message | ✅ |
| POST | `/api/messages/[messageId]/unsend` | Unsend message | ✅ |

### Comments

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/comments/[postId]` | Get post comments | ✅ |
| POST | `/api/comments/[postId]` | Add comment | ✅ |
| DELETE | `/api/comments/[commentId]` | Delete comment | ✅ |

### Search

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/search` | Search users/posts | ✅ |

### System

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Health check | ❌ |

---

## 🔄 Socket Events

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `user-online` | `userId` | User comes online |
| `user-offline` | `userId` | User goes offline |
| `join-conversation` | `{ userId, otherUserId }` | Join chat room |
| `leave-conversation` | `{ userId, otherUserId }` | Leave chat room |
| `send-message` | `{ senderId, receiverId, messageText, mediaUrl, clientId, replyToId }` | Send message |
| `typing` | `{ userId, otherUserId, userName }` | User starts typing |
| `stop-typing` | `{ userId, otherUserId }` | User stops typing |
| `mark-read` | `{ senderId, receiverId }` | Mark messages as read |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `new-message` | `message` | New message received |
| `message-notification` | `{ from, preview, timestamp }` | Message notification |
| `notification` | `notification` | General notification |
| `typing` | `{ userId, userName }` | Someone is typing |
| `stopped-typing` | `{ userId }` | Typing stopped |
| `message-unsent` | `{ messageId }` | Message was unsent |
| `message-deleted` | `{ messageId }` | Message was deleted |
| `user-status` | `{ userId, status }` | User online/offline status |

---

## 🎨 Frontend Components

### Core Components

#### **Navbar.tsx**
- Navigation bar with logo, search, notifications
- Create post button
- User menu with profile/logout
- Responsive mobile menu

#### **AuthModal.tsx**
- Login/Register forms
- Form validation
- Error handling
- Smooth transitions between modes

#### **CreatePostModal.tsx**
- Rich text post creation
- Media upload with preview
- Category selection
- Character counter

#### **PostCard.tsx**
- Individual post display
- Like/comment actions
- User avatar and info
- Timestamp formatting
- Media display

#### **Messages.tsx / MessagesSimple.tsx**
- Full messages interface
- Conversation list
- Message thread display
- Real-time updates
- Typing indicators

#### **ContactsList.tsx**
- Sidebar with contacts
- Online status indicators
- Unread message badges
- Quick chat access

#### **MiniChatWindow.tsx**
- Floating chat window
- Minimizable/expandable
- Quick replies
- Notification sounds

#### **FollowButton.tsx**
- Dynamic follow/unfollow button
- Loading states
- Optimistic updates

#### **SearchModal.tsx**
- User search interface
- Real-time search
- Department filters
- Results list

#### **SocketStatus.tsx**
- Visual connection indicator
- Reconnection handling
- Debug information

### Utility Components

- **Toast.tsx**: Non-intrusive notifications
- **MainContainer.tsx**: Layout wrapper
- **MasonryTile.tsx**: Grid layout tile
- **ClientProviders.tsx**: Context wrappers

---

## 🌐 Context Management

### AuthContext
**File**: `contexts/AuthContext.tsx`

**State**:
```typescript
{
  user: User | null,
  token: string | null,
  isLoading: boolean
}
```

**Methods**:
- `login(college_id, password)`: Authenticate user
- `register(data)`: Create new account
- `logout()`: Clear session
- `setSocketDisconnect()`: Register socket disconnect handler

**Usage**: Provides authentication state throughout the app

### SocketContext
**File**: `contexts/SocketContext.tsx`

**State**:
```typescript
{
  socket: Socket | null,
  isConnected: boolean,
  isConnecting: boolean
}
```

**Methods**:
- `joinConversation(otherUserId)`: Enter chat room
- `leaveConversation(otherUserId)`: Exit chat room
- `sendMessage(data)`: Send message via socket
- `onNewMessage(callback)`: Listen for new messages
- `startTyping() / stopTyping()`: Typing indicators
- `onNotification(callback)`: Listen for notifications

**Features**:
- Auto-reconnection logic
- Connection pooling
- Event listeners management
- User online/offline tracking

### ToastContext
**File**: `contexts/ToastContext.tsx`

**Methods**:
- `showToast(message, type, duration)`: Display toast notification
- `hideToast()`: Dismiss toast

**Types**: `success`, `error`, `info`, `warning`

---

## 🔐 Authentication & Security

### Authentication Flow

1. **Registration**:
   - User submits registration form
   - Backend validates input (email, college ID, password strength)
   - Password is hashed with bcrypt (10 salt rounds)
   - User stored in database
   - JWT token generated and returned

2. **Login**:
   - User submits credentials
   - Backend verifies college ID/password
   - bcrypt compares hashed passwords
   - JWT token generated with user payload
   - Token stored in localStorage and memory

3. **Token Verification**:
   - Every API request includes JWT in Authorization header
   - `getUserFromRequest()` middleware verifies token
   - Expired tokens return 401 Unauthorized
   - Frontend redirects to login

### Security Measures

**Password Security**:
```typescript
// Hashing on registration
const hashedPassword = await bcrypt.hash(password, 10)

// Verification on login
const isValid = await bcrypt.compare(password, user.password)
```

**JWT Configuration**:
```typescript
const token = jwt.sign(
  { userId: user.user_id, college_id: user.college_id },
  JWT_SECRET,
  { expiresIn: '7d', algorithm: 'HS256' }
)
```

**Input Validation**:
- Email format validation
- Password strength requirements (8+ chars, special chars)
- SQL/NoSQL injection prevention
- XSS protection with content sanitization

**MongoDB Security**:
- Connection string validation
- Parameterized queries (no string concatenation)
- Connection pooling with limits
- Retry logic for failed connections

**Socket Authentication**:
```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  const decoded = jwt.verify(token, JWT_SECRET)
  socket.userId = decoded.userId
  next()
})
```

**Privacy Controls**:
- Block users feature
- Profile visibility settings
- Message permission controls
- Online status visibility toggle

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js >= 18.17.0
- npm >= 9.6.7
- MongoDB instance (local or Atlas)
- Git

### Local Development Setup

#### 1. Clone Repository
```powershell
git clone <repository-url>
cd UNI-X
```

#### 2. Install Main App Dependencies
```powershell
npm install
```

#### 3. Install Socket Server Dependencies
```powershell
cd socket-server
npm install
cd ..
```

#### 4. Configure Environment Variables

**Main App** - Create `.env.local` in root:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/unix
MONGODB_DB_NAME=unix

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here

# Socket Server
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Optional
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Socket Server** - Create `socket-server/.env`:
```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-here
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000
NODE_ENV=development
```

#### 5. Start MongoDB
```powershell
# If using local MongoDB
mongod --dbpath="C:\data\db"

# Or use MongoDB Atlas connection string
```

#### 6. Start Development Servers

**Terminal 1** - Main App:
```powershell
npm run dev
# Runs on http://localhost:3000
```

**Terminal 2** - Socket Server:
```powershell
cd socket-server
npm run dev
# Runs on http://localhost:3001
```

#### 7. Access Application
- Frontend: http://localhost:3000
- Socket Server: http://localhost:3001
- Health Check: http://localhost:3001/health

---

## 🌍 Environment Variables

### Main Application

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | ✅ | - |
| `MONGODB_DB_NAME` | Database name | ✅ | `unix` |
| `JWT_SECRET` | Secret for JWT signing | ✅ | - |
| `NEXT_PUBLIC_SOCKET_URL` | Socket server URL | ✅ | `http://localhost:3001` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | ❌ | - |
| `CLOUDINARY_API_KEY` | Cloudinary API key | ❌ | - |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | ❌ | - |
| `SMTP_HOST` | Email server host | ❌ | - |
| `SMTP_PORT` | Email server port | ❌ | `587` |
| `SMTP_USER` | Email username | ❌ | - |
| `SMTP_PASS` | Email password | ❌ | - |

### Socket Server

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | ❌ | `3001` |
| `JWT_SECRET` | Same as main app | ✅ | - |
| `FRONTEND_URL` | Frontend URL for CORS | ✅ | `http://localhost:3000` |
| `API_BASE_URL` | API base URL | ✅ | `http://localhost:3000` |
| `NODE_ENV` | Environment | ❌ | `development` |

---

## 🚀 Deployment

### Vercel (Frontend)

1. **Push to GitHub**:
```powershell
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. **Connect to Vercel**:
   - Go to https://vercel.com
   - Import GitHub repository
   - Select `UNI-X` project

3. **Configure Environment Variables**:
   - Add all variables from `.env.local`
   - Ensure `NEXT_PUBLIC_SOCKET_URL` points to production socket server

4. **Deploy**:
   - Vercel auto-deploys on push
   - Custom domain configuration available

### Render (Socket Server)

1. **Create Web Service**:
   - Go to https://dashboard.render.com
   - New → Web Service
   - Connect GitHub repo

2. **Configuration**:
   - **Root Directory**: `socket-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter

3. **Environment Variables**:
   ```
   PORT=10000
   JWT_SECRET=<same-as-vercel>
   FRONTEND_URL=https://your-vercel-app.vercel.app
   API_BASE_URL=https://your-vercel-app.vercel.app
   NODE_ENV=production
   ```

4. **Deploy**:
   - Auto-deploy on push
   - Copy service URL for Vercel

5. **Update Vercel**:
   - Set `NEXT_PUBLIC_SOCKET_URL` to Render socket URL
   - Redeploy frontend

### MongoDB Atlas

1. **Create Cluster**: https://cloud.mongodb.com
2. **Whitelist IPs**: Add `0.0.0.0/0` for Vercel/Render
3. **Create User**: Database access with read/write permissions
4. **Get Connection String**: Use in `MONGODB_URI`

---

## 📚 Code Explanations

### Key Code Sections

#### 1. MongoDB Connection (`lib/mongodb.ts`)

```typescript
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // Return cached connection if available
  if (cachedClient && cachedDb && !isConnecting) {
    return { client: cachedClient, db: cachedDb }
  }

  // Prevent multiple simultaneous connections
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (cachedClient && cachedDb) {
      return { client: cachedClient, db: cachedDb }
    }
  }

  isConnecting = true

  // Retry logic for robust connections
  while (connectionAttempts < MAX_RETRY_ATTEMPTS) {
    try {
      const client = await MongoClient.connect(MONGODB_URI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
      })
      
      const db = client.db(DB_NAME)
      cachedClient = client
      cachedDb = db
      connectionAttempts = 0
      isConnecting = false
      
      return { client, db }
    } catch (error) {
      connectionAttempts++
      if (connectionAttempts >= MAX_RETRY_ATTEMPTS) throw error
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}
```

**Why it's important**:
- Prevents connection overhead by caching
- Handles connection failures gracefully with retries
- Connection pooling for performance
- Prevents race conditions with `isConnecting` flag

#### 2. Socket.IO Server (`socket-server/server.js`)

```javascript
// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error('No token provided'))

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
    socket.userId = decoded.userId
    socket.collegeId = decoded.college_id
    next()
  } catch (error) {
    next(new Error('Authentication failed'))
  }
})

// Connection handling
io.on('connection', (socket) => {
  console.log(`✅ User ${socket.userId} connected`)
  
  // Join user's personal room for notifications
  socket.join(`user-${socket.userId}`)
  
  // Handle incoming events
  socket.on('send-message', async (data) => {
    try {
      // Save to database via API
      const response = await fetch(`${API_BASE_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const message = await response.json()
      
      // Emit to receiver
      io.to(`user-${data.receiverId}`).emit('new-message', message)
      io.to(`user-${data.senderId}`).emit('new-message', message)
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' })
    }
  })
})
```

**Why it's separated**:
- Vercel doesn't support long-lived WebSocket connections (serverless)
- Dedicated server ensures 24/7 socket availability
- Independent scaling from frontend
- Better error handling and logging

#### 3. Authentication Helper (`lib/auth.ts`)

```typescript
export function getUserFromRequest(req: NextApiRequest): { userId: number; collegeId: string } | null {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload
    
    return {
      userId: decoded.userId,
      collegeId: decoded.college_id
    }
  } catch (error) {
    return null
  }
}
```

**Usage in API routes**:
```typescript
export default async function handler(req, res) {
  const auth = getUserFromRequest(req)
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  // User is authenticated, proceed
  const { userId } = auth
  // ...
}
```

#### 4. Socket Context Hook (`contexts/SocketContext.tsx`)

```typescript
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const { user, token } = useAuth()

  useEffect(() => {
    if (!user || !token) return

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    newSocket.on('connect', () => {
      console.log('✅ Connected to Socket.io')
      setIsConnected(true)
      newSocket.emit('user-online', user.id)
    })

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.io')
      setIsConnected(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [user, token])

  return (
    <SocketContext.Provider value={{ socket, isConnected, ... }}>
      {children}
    </SocketContext.Provider>
  )
}
```

**Why this approach**:
- Centralized socket connection management
- Auto-reconnection on connection loss
- Ensures single socket instance per user
- Easy access throughout component tree

#### 5. Infinite Scroll Hook (`hooks/useInfiniteScroll.ts`)

```typescript
export function useInfiniteScroll(callback: () => void) {
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 100
      ) {
        callback()
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [callback])
}
```

**Usage in components**:
```typescript
const [posts, setPosts] = useState([])
const [page, setPage] = useState(1)

const loadMore = useCallback(() => {
  if (!isLoading && hasMore) {
    setPage(p => p + 1)
  }
}, [isLoading, hasMore])

useInfiniteScroll(loadMore)
```

#### 6. Post Creation API (`pages/api/posts/index.ts`)

```typescript
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const auth = getUserFromRequest(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })

    const { content, media_url, category } = req.body

    // Validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content required' })
    }

    const postsCollection = await getCollection('posts')
    
    // Generate unique post_id
    const maxPost = await postsCollection
      .find({})
      .sort({ post_id: -1 })
      .limit(1)
      .toArray()
    
    const newPostId = (maxPost[0]?.post_id || 0) + 1

    const newPost = {
      post_id: newPostId,
      user_id: auth.userId,
      content: content.trim(),
      media_url,
      category,
      likes: [],
      comments_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    }

    await postsCollection.insertOne(newPost)
    
    // Fetch post with user info for response
    const postWithUser = await postsCollection
      .aggregate([
        { $match: { post_id: newPostId } },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: 'user_id',
            as: 'user'
          }
        },
        { $unwind: '$user' }
      ])
      .toArray()

    res.status(201).json(postWithUser[0])
  }
}
```

**Why aggregation pipeline**:
- Efficiently joins user data with post
- Reduces number of database queries
- Returns complete post object ready for display
- MongoDB optimization

---

## 🐛 Debugging & Troubleshooting

### Common Issues

#### 1. Socket Connection Failed
**Symptoms**: "Socket connection failed" in console

**Solutions**:
- Check `NEXT_PUBLIC_SOCKET_URL` in environment variables
- Verify socket server is running
- Check CORS settings in socket server
- Ensure JWT_SECRET matches between apps

#### 2. MongoDB Connection Timeout
**Symptoms**: "MongoServerError: connection timeout"

**Solutions**:
- Verify `MONGODB_URI` format
- Check network connectivity
- Whitelist IP in MongoDB Atlas
- Check firewall settings

#### 3. JWT Verification Failed
**Symptoms**: 401 Unauthorized on API requests

**Solutions**:
- Check token expiration
- Verify JWT_SECRET matches
- Clear localStorage and re-login
- Check Authorization header format

#### 4. Real-time Messages Not Working
**Symptoms**: Messages don't appear instantly

**Solutions**:
- Check socket connection status
- Verify user is in correct room
- Check socket server logs
- Test with `socket-server/test.html`

---

## 📈 Performance Optimizations

### Implemented Optimizations

1. **Connection Pooling**: MongoDB connection caching
2. **Pagination**: All list endpoints support pagination
3. **Infinite Scroll**: Load posts as needed
4. **Image Optimization**: Next.js Image component
5. **Code Splitting**: Route-based lazy loading
6. **Caching**: React hooks memoization
7. **Debouncing**: Search input debouncing
8. **Socket Rooms**: Targeted event emissions

---

## 🔮 Future Enhancements

- [ ] Video posts support
- [ ] Story/Status feature
- [ ] Group chats
- [ ] Voice/Video calls
- [ ] Advanced search (posts, hashtags)
- [ ] Content moderation
- [ ] Analytics dashboard
- [ ] Email notifications
- [ ] Mobile app (React Native)
- [ ] PWA support
- [ ] Dark mode
- [ ] Multi-language support

---

## 📄 License

This project is private and proprietary.

---

## 👥 Contributors

Developed with ❤️ for college students

---

## 📞 Support

For issues or questions:
- Check documentation in `ARCHITECTURE.md`, `START_HERE.md`
- Review deployment guides
- Check socket troubleshooting docs

---

**Last Updated**: January 2026
