# UNI-X - College Social Network

A modern college social networking platform built with Next.js, featuring real-time messaging, posts, notifications, and more.

## 🚀 Features

- **Real-time Messaging** - Socket.IO powered chat with typing indicators
- **Social Feed** - Share posts with media, categories, and interactions
- **Notifications** - Real-time updates for likes, comments, follows
- **User Profiles** - Customizable profiles with privacy controls
- **Follow System** - Public/private accounts with follow requests
- **Privacy Controls** - Granular control over who sees your content
- **Block System** - Block users to prevent interactions
- **Responsive Design** - Works seamlessly on desktop and mobile

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB database (Neon/MongoDB Atlas)
- Cloudinary account (for media uploads)
- JWT secret key

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd UNI-X
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create `.env.local` in the root directory:

```env
# Database
DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET=your-super-secret-jwt-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Socket.IO (for local dev)
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### 4. Set up Socket.IO Server

For real-time features (messaging, notifications), you need to run the Socket.IO server:

```bash
cd socket-server
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

The socket server will run on port 3001.

## 🖥️ Development

Run both servers:

**Terminal 1 - Main App:**
```bash
npm run dev
```

**Terminal 2 - Socket Server:**
```bash
cd socket-server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 Production Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Add environment variables (see `.env.local`)
4. Add `NEXT_PUBLIC_SOCKET_URL=https://your-socket-server.onrender.com`
5. Deploy

### Backend Socket Server (Render)

1. See detailed guide: [SOCKET_DEPLOYMENT.md](./SOCKET_DEPLOYMENT.md)
2. Quick steps:
   - Push `socket-server/` to GitHub
   - Create Web Service on [Render](https://render.com)
   - Add environment variables
   - Deploy
3. Copy Render URL and add to Vercel as `NEXT_PUBLIC_SOCKET_URL`

**Full deployment checklist:** [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

## 📚 Documentation

- [Socket.IO Deployment Guide](./SOCKET_DEPLOYMENT.md) - Deploy real-time backend
- [Socket Setup Complete](./SOCKET_SETUP_COMPLETE.md) - Quick reference
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Step-by-step checklist
- [MongoDB Migration Guide](./MONGODB_MIGRATION_GUIDE.md) - Database setup
- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT_GUIDE.md) - Frontend deployment

## 🏗️ Project Structure

```
UNI-X/
├── app/                    # Next.js 13+ app directory
│   ├── landing/           # Landing/auth pages
│   ├── messages/          # Messaging interface
│   ├── notifications/     # Notifications page
│   ├── profile/          # User profiles
│   ├── settings/         # User settings
│   └── uniwall/          # Main feed
├── components/            # React components
├── contexts/             # React contexts (Auth, Socket, Toast)
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── pages/api/            # API routes
├── socket-server/        # Standalone Socket.IO server
│   ├── server.js        # Socket server code
│   ├── package.json     # Dependencies
│   └── test.html        # Testing tool
├── public/               # Static assets
└── styles/              # Global styles
```

## 🔧 Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Socket.IO (separate server)
- **Database:** MongoDB (via Neon/PostgreSQL wire protocol)
- **Authentication:** JWT
- **Media Storage:** Cloudinary
- **Deployment:** Vercel (frontend) + Render (Socket.IO)

## 🧪 Testing

### Test Socket Server
```bash
cd socket-server
npm run health
```

### Test with Browser
Open `socket-server/test.html` in browser for interactive testing.

## 🐛 Troubleshooting

### Socket.IO not connecting
- Ensure socket server is running on port 3001
- Check `NEXT_PUBLIC_SOCKET_URL` environment variable
- Verify JWT_SECRET matches between main app and socket server

### Database connection errors
- Check DATABASE_URL is correct
- Verify MongoDB connection string
- See [MONGODB_MIGRATION_GUIDE.md](./MONGODB_MIGRATION_GUIDE.md)

### Deployment issues
- Follow [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- Check Render logs for socket server
- Check Vercel logs for main app

## 📝 License

[Add your license here]

## 👥 Contributors

[Add contributors]

---

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Socket.IO Documentation](https://socket.io/docs/) - real-time communication
- [MongoDB Documentation](https://docs.mongodb.com/) - database guide
