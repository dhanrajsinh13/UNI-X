# 🏗️ UNI-X Architecture

## System Architecture

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
│           │ SQL       │
└───────────┼───────────┘
            │
            ▼
┌───────────────────────┐
│                       │
│  MONGODB/NEON         │
│  (Database)           │
│                       │
│  Collections:         │
│  - users              │
│  - posts              │
│  - messages           │
│  - comments           │
│  - followers          │
│  - blocks             │
│  - notifications      │
│                       │
└───────────────────────┘
```

## Data Flow

### Regular API Request (Posts, Profile, etc.)
```
User Browser
    │
    ├─► HTTPS Request
    │
    ▼
Vercel Next.js
    │
    ├─► API Route Handler
    │
    ▼
MongoDB
    │
    ├─► Query/Insert
    │
    ▼
Response to Browser
```

### Real-time Message Flow
```
User A Browser                          User B Browser
    │                                       ▲
    ├─► Socket Emit: send-message          │
    │                                       │
    ▼                                       │
Render Socket Server ─────────────────────┤
    │                                       │
    ├─► HTTP POST to Vercel API            │
    │   (save message to DB)               │
    │                                       │
    ▼                                       │
MongoDB (message saved)                    │
    │                                       │
    └─► Emit: new-message ─────────────────┘
        to conversation room
```

### Authentication Flow
```
User Login
    │
    ├─► POST /api/auth/login
    │
    ▼
Vercel API
    │
    ├─► Check credentials
    ├─► Generate JWT with userId
    │
    ▼
Browser stores JWT
    │
    ├─► Included in all API requests (Authorization header)
    ├─► Included in Socket.IO connection (auth.token)
    │
    ▼
Both services validate JWT
```

## Deployment Architecture

### Development Environment
```
Localhost:3000              Localhost:3001
┌──────────────┐           ┌──────────────┐
│   Next.js    │ ◄────────►│  Socket.IO   │
│   Dev Server │  WebSocket│  Dev Server  │
└──────────────┘           └──────────────┘
       │                          │
       └──────────┬───────────────┘
                  │
                  ▼
           MongoDB (Cloud)
```

### Production Environment
```
Vercel                    Render
(Serverless)              (Always On)
┌──────────────┐          ┌──────────────┐
│   Next.js    │ ◄───────►│  Socket.IO   │
│   Frontend   │ WebSocket│   Backend    │
│   + API      │          │              │
└──────────────┘          └──────────────┘
       │                         │
       └──────────┬──────────────┘
                  │
                  ▼
          MongoDB (Cloud)
```

## Why Separate Socket.IO?

### Problem: Vercel Serverless Architecture
```
Traditional Server:           Vercel Serverless:
┌──────────────┐             ┌──────────────┐
│   Process    │             │   Function   │
│   Always On  │             │   Starts     │
│   Port 3000  │             │   On Request │
│              │             │   Dies After │
│   WebSocket  │             │   Response   │
│   Kept Open  │             └──────────────┘
└──────────────┘                    ❌
       ✅                    No persistent
  Persistent                  connections!
  connections
```

### Solution: Dedicated Socket Server
```
Vercel (Handles):              Render (Handles):
- HTTP Requests               - WebSocket Connections
- Server-Side Rendering       - Persistent Connections
- API Routes                  - Real-time Events
- Static Files                - Broadcasting
```

## Component Communication

### Frontend Components
```
App Layout
    │
    ├─► AuthContext (user, token, login/logout)
    │       │
    │       └─► All pages need authentication
    │
    ├─► SocketContext (socket, isConnected, send/receive)
    │       │
    │       └─► Messages, Notifications need socket
    │
    └─► ToastContext (show notifications)
            │
            └─► All components can show toasts
```

### Backend Services
```
API Routes (/pages/api/)
    │
    ├─► Database Operations
    │   (Direct MongoDB queries)
    │
    └─► Call Socket Server
        (for real-time events)

Socket Server (Render)
    │
    ├─► Receive Events from Clients
    │   (send-message, typing-start, etc.)
    │
    ├─► Call API Routes
    │   (to save data to database)
    │
    └─► Broadcast to Connected Clients
        (new-message, notification, etc.)
```

## Security Layers

### 1. Authentication
```
JWT Token → Validated by both:
              ├─► Vercel API Routes
              └─► Render Socket Server
```

### 2. Authorization
```
User ID from JWT → Checked against:
                    ├─► Database records
                    ├─► Privacy settings
                    └─► Block status
```

### 3. CORS
```
Socket Server CORS:
  ├─► Only allow Vercel domains
  └─► Reject other origins
```

## Scaling Considerations

### Current Setup (1 user - 1000 users)
```
Vercel: Auto-scales
Render: Single instance
MongoDB: 512MB free tier
Status: ✅ Works fine
```

### Medium Scale (1000 - 10000 users)
```
Vercel: Auto-scales
Render: Upgrade to Starter ($7/mo)
MongoDB: Upgrade to M2 ($9/mo)
Status: ✅ Should work
```

### Large Scale (10000+ users)
```
Vercel: Pro plan
Render: Multiple instances with load balancer
MongoDB: M10+ with replicas
Redis: For Socket.IO adapter (multi-instance)
Status: 🔨 Requires architecture changes
```

## Environment Variables Flow

```
Development:
├─► .env.local (Next.js)
│   └─► NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
└─► socket-server/.env
    └─► JWT_SECRET, FRONTEND_URL, API_BASE_URL

Production:
├─► Vercel Environment Variables
│   └─► NEXT_PUBLIC_SOCKET_URL=https://socket.onrender.com
└─► Render Environment Variables
    └─► JWT_SECRET, FRONTEND_URL, API_BASE_URL
```

## Cost Breakdown

### Free Tier (Hobby Projects)
```
Vercel: Free
├─► Bandwidth: 100GB/month
├─► Builds: Unlimited
└─► Functions: 100GB-hrs

Render: Free
├─► Sleeps after 15min inactivity
├─► 750 hours/month
└─► First request slow (cold start)

MongoDB: Free
├─► 512MB storage
├─► Shared cluster
└─► Limited connections

Total: $0/month
Limitations: Socket server sleeps, slow cold starts
```

### Production Tier (Real Apps)
```
Vercel: Pro ($20/month)
├─► Priority support
├─► Better performance
└─► Team features

Render: Starter ($7/month)
├─► Always on
├─► No cold starts
└─► Better performance

MongoDB: M2 ($9/month)
├─► 2GB storage
├─► Better performance
└─► More connections

Total: $36/month
Benefits: Always on, fast, reliable
```

## Monitoring Points

### What to Monitor
```
Vercel:
├─► Function errors
├─► Response times
└─► Build times

Render:
├─► CPU usage
├─► Memory usage
├─► Active connections
└─► Response times

MongoDB:
├─► Connection count
├─► Query performance
└─► Storage usage

Client:
├─► Socket connection status
├─► API response times
└─► Error rates
```

## Backup Strategy

### Data Backups
```
MongoDB:
├─► Automatic daily backups (paid tiers)
├─► Manual exports (free tier)
└─► Point-in-time recovery (Atlas)

User Content:
├─► Cloudinary stores images
└─► Periodic database exports
```

### Code Backups
```
Git Repository:
├─► GitHub (primary)
├─► Automatic via Vercel/Render deployments
└─► Branch protection on main
```
