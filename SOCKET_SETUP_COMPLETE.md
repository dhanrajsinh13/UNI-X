# 🚀 Socket.IO Deployment Setup - Complete

## What We Created

### 1. Standalone Socket.IO Server (`socket-server/`)
   - **server.js** - Main Socket.IO server with all real-time features
   - **package.json** - Dependencies and scripts
   - **README.md** - Server documentation
   - **.env.example** - Environment variable template
   - **render.yaml** - Render deployment configuration
   - **test.html** - Browser-based testing tool
   - **start.bat/start.sh** - Quick start scripts

### 2. Documentation
   - **SOCKET_DEPLOYMENT.md** - Complete deployment guide

## Quick Start

### For Local Development (Right Now!)

1. **Open Terminal in socket-server folder:**
   ```bash
   cd socket-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create .env file:**
   ```bash
   cp .env.example .env
   ```

4. **Edit .env with your values:**
   ```env
   PORT=3001
   JWT_SECRET=<your-jwt-secret-from-main-app>
   FRONTEND_URL=http://localhost:3000
   API_BASE_URL=http://localhost:3000
   ```

5. **Start the server:**
   ```bash
   npm run dev
   ```
   Or use the quick start:
   - Windows: Double-click `start.bat`
   - Mac/Linux: `./start.sh`

6. **Test it:**
   - Open `test.html` in browser
   - Enter server URL: `http://localhost:3001`
   - Paste your JWT token
   - Click Connect

7. **Update your main app:**
   Add to `.env.local`:
   ```env
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   ```

### For Production Deployment to Render

#### Method 1: Via Render Dashboard (Easiest)

1. **Push to GitHub:**
   ```bash
   cd socket-server
   git init
   git add .
   git commit -m "Add socket server"
   git branch -M main
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Configure:
     - Name: `uni-x-socket-server`
     - Root Directory: `socket-server` (if in same repo as main app)
     - Environment: `Node`
     - Build Command: `npm install`
     - Start Command: `npm start`
     - Plan: Free (or Starter $7/mo for 24/7 uptime)

3. **Add Environment Variables:**
   - `JWT_SECRET`: (copy from your Vercel project)
   - `FRONTEND_URL`: `https://your-app.vercel.app`
   - `API_BASE_URL`: `https://your-app.vercel.app`

4. **Deploy** - Render will build and start automatically

5. **Copy your Render URL:**
   Example: `https://uni-x-socket-server.onrender.com`

#### Method 2: Via render.yaml (Blueprint)

1. **Already included:** `socket-server/render.yaml`

2. **On Render Dashboard:**
   - Click "New +" → "Blueprint"
   - Connect repo
   - Select `render.yaml`
   - Add environment variables when prompted
   - Deploy

### Update Vercel App

1. **Go to Vercel Dashboard:**
   - Select your project
   - Settings → Environment Variables

2. **Add new variable:**
   - Name: `NEXT_PUBLIC_SOCKET_URL`
   - Value: `https://uni-x-socket-server.onrender.com`
   - Environments: All (Production, Preview, Development)

3. **Redeploy:**
   - Go to Deployments
   - Click "..." on latest deployment
   - Click "Redeploy"

## Testing Production

1. **Check server health:**
   ```bash
   curl https://uni-x-socket-server.onrender.com/health
   ```
   Should return: `{"status":"healthy","connections":0,"uptime":123}`

2. **Test with browser:**
   - Upload `test.html` somewhere or open locally
   - Change URL to your Render URL
   - Paste your JWT token
   - Click Connect

3. **Test your app:**
   - Open your Vercel app
   - Go to Messages page
   - Check browser console for:
     ```
     ✅ Connected to Socket.io server
     🔗 Socket ID: abc123...
     ```

## Troubleshooting

### "Socket.io connection error" in browser
- ✅ Check `NEXT_PUBLIC_SOCKET_URL` is set in Vercel
- ✅ Verify Render service is running (not sleeping)
- ✅ Check browser console for detailed error

### "Authentication failed" error
- ✅ Ensure `JWT_SECRET` is EXACTLY the same in both Vercel and Render
- ✅ Copy-paste it carefully, no extra spaces
- ✅ Check your JWT token is valid

### CORS errors
- ✅ Add your Vercel URL to `FRONTEND_URL` in Render
- ✅ If using custom domain, add it to `server.js` cors array

### Render service keeps sleeping (Free tier)
- 💡 Use UptimeRobot.com to ping every 5 minutes
- 💡 Or upgrade to Render Starter plan ($7/mo)

### Messages not saving
- ✅ Check `API_BASE_URL` points to your Vercel app
- ✅ Verify MongoDB connection is working
- ✅ Check Vercel function logs

## File Structure

```
UNI-X/
├── socket-server/              # New standalone server
│   ├── server.js               # Main Socket.IO server
│   ├── package.json            # Dependencies
│   ├── .env.example            # Environment template
│   ├── .gitignore              # Git ignore rules
│   ├── render.yaml             # Render deployment config
│   ├── README.md               # Server docs
│   ├── start.bat               # Windows quick start
│   ├── start.sh                # Mac/Linux quick start
│   └── test.html               # Testing tool
├── SOCKET_DEPLOYMENT.md        # Full deployment guide
└── ... (your existing Next.js app)
```

## What Changed

### Before (Monolithic)
- Next.js server handled both web pages AND Socket.IO
- Deployed to Vercel → ❌ Serverless doesn't support WebSockets
- Socket.IO errors in production

### After (Microservices)
- Next.js on Vercel → Handles web pages & APIs ✅
- Socket.IO on Render → Handles real-time features ✅
- Frontend connects to both services

## Environment Variables Summary

### Main App (Vercel)
```env
# Existing
DATABASE_URL=...
JWT_SECRET=...
CLOUDINARY_...=...

# NEW - Add this
NEXT_PUBLIC_SOCKET_URL=https://uni-x-socket-server.onrender.com
```

### Socket Server (Render)
```env
PORT=10000
JWT_SECRET=<same-as-vercel>
FRONTEND_URL=https://your-app.vercel.app
API_BASE_URL=https://your-app.vercel.app
NODE_ENV=production
```

## Cost Breakdown

| Service | Purpose | Free Tier | Paid Option |
|---------|---------|-----------|-------------|
| Vercel | Next.js App | ✅ Generous | $20/mo Pro |
| Render | Socket.IO | ✅ (sleeps) | $7/mo 24/7 |
| MongoDB | Database | ✅ 512MB | $9/mo+ |

**Total Free:** $0/month (with some limitations)
**Total Paid:** ~$36/month (for production-ready setup)

## Next Steps

1. ✅ Install socket-server dependencies
2. ✅ Test locally with both servers running
3. ✅ Push socket-server to GitHub
4. ✅ Deploy to Render
5. ✅ Add `NEXT_PUBLIC_SOCKET_URL` to Vercel
6. ✅ Redeploy Vercel app
7. ✅ Test production messaging
8. 📊 Monitor for 24 hours
9. 🎉 Celebrate working real-time features!

## Support

If something doesn't work:
1. Check Render logs: Dashboard → Service → Logs
2. Check Vercel logs: Dashboard → Deployments → Function Logs
3. Check browser console: F12 → Console tab
4. Compare your environment variables with this guide

## Tips

- 🔒 Never commit `.env` files
- 📝 Keep `JWT_SECRET` identical in both services
- 🔄 Use UptimeRobot for free tier Render
- 📊 Monitor Render metrics for performance
- 🚀 Consider paid plan for production apps

Good luck! 🎉
