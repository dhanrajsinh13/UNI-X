# 🚀 Deployment Checklist

Use this checklist to ensure everything is set up correctly.

## ✅ Pre-Deployment Checklist

### Local Setup
- [ ] Socket server folder created: `socket-server/`
- [ ] Dependencies installed: `cd socket-server && npm install`
- [ ] `.env` file created from `.env.example`
- [ ] `JWT_SECRET` copied from main app to socket server `.env`
- [ ] Socket server runs locally: `npm run dev`
- [ ] Health check passes: `npm run health`
- [ ] Main app has `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001` in `.env.local`
- [ ] Both servers running simultaneously (main on :3000, socket on :3001)
- [ ] Messages work in local development

### Code Repository
- [ ] Socket server code committed to Git
- [ ] `.gitignore` prevents `.env` from being committed
- [ ] Code pushed to GitHub
- [ ] Repository is public or Render has access

## 🌐 Render Deployment Checklist

### Render Setup
- [ ] Created account on render.com
- [ ] Connected GitHub account
- [ ] Created new Web Service
- [ ] Selected correct repository
- [ ] Set Root Directory (if socket-server is in subfolder)
- [ ] Build Command: `npm install`
- [ ] Start Command: `npm start`
- [ ] Selected region (closest to users)
- [ ] Choose plan (Free or Starter)

### Environment Variables (Render)
- [ ] `JWT_SECRET` - Copied exactly from Vercel
- [ ] `FRONTEND_URL` - Your Vercel app URL
- [ ] `API_BASE_URL` - Your Vercel app URL
- [ ] `NODE_ENV` - Set to `production`
- [ ] All values saved without extra spaces

### Deployment
- [ ] Manual deploy triggered (or auto-deploy enabled)
- [ ] Build succeeded (check logs)
- [ ] Service started successfully
- [ ] Render URL copied (e.g., https://uni-x-socket-server.onrender.com)
- [ ] Health endpoint accessible: `https://your-service.onrender.com/health`

## 📱 Vercel Update Checklist

### Environment Variables
- [ ] Opened Vercel Dashboard
- [ ] Navigated to Settings → Environment Variables
- [ ] Added `NEXT_PUBLIC_SOCKET_URL`
- [ ] Value is your Render URL
- [ ] Applied to all environments (Production, Preview, Development)
- [ ] Saved changes

### Redeployment
- [ ] Triggered new deployment (or wait for auto-deploy)
- [ ] Deployment succeeded
- [ ] Production URL accessible
- [ ] No build errors

## 🧪 Testing Checklist

### Server Health
- [ ] Render URL loads: `https://your-service.onrender.com/`
- [ ] Health endpoint works: `https://your-service.onrender.com/health`
- [ ] Returns valid JSON with status

### Frontend Connection
- [ ] Opened Vercel app in browser
- [ ] Opened browser DevTools (F12)
- [ ] Checked Console tab
- [ ] Saw "✅ Connected to Socket.io server"
- [ ] Saw Socket ID logged

### Functionality Tests
- [ ] Login works
- [ ] Navigate to Messages page
- [ ] Can see conversation list
- [ ] Can open a conversation
- [ ] Can send a message
- [ ] Message appears in real-time
- [ ] Refresh page - messages persist
- [ ] Typing indicators work (if implemented)
- [ ] Notifications work (if implemented)

### Cross-Browser Testing
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile Safari
- [ ] Mobile Chrome

## 🔧 Troubleshooting Checklist

If something doesn't work:

### Check Environment Variables
- [ ] Vercel has `NEXT_PUBLIC_SOCKET_URL` set
- [ ] Render has all required env vars
- [ ] `JWT_SECRET` is EXACTLY the same in both
- [ ] URLs don't have trailing slashes
- [ ] No typos in variable names

### Check Logs
- [ ] Render logs: Dashboard → Service → Logs tab
- [ ] Vercel logs: Dashboard → Deployment → View Function Logs
- [ ] Browser console: F12 → Console tab
- [ ] No red errors in any logs

### Check CORS
- [ ] `FRONTEND_URL` in Render matches your Vercel URL
- [ ] All Vercel deployment URLs added to CORS in `server.js`
- [ ] Custom domain (if any) added to CORS

### Check Connections
- [ ] Render service is not sleeping (check status)
- [ ] No firewall blocking WebSocket connections
- [ ] HTTPS is used (not HTTP) in production

## 📊 Monitoring Checklist

### First 24 Hours
- [ ] Check Render metrics every few hours
- [ ] Monitor Vercel error rate
- [ ] Test messaging multiple times
- [ ] Check with real users (if available)
- [ ] Note any intermittent issues

### Free Tier Considerations
- [ ] Render service may sleep after 15 min inactivity
- [ ] First connection after sleep takes 30-60 seconds
- [ ] Consider UptimeRobot pinger (ping every 5 minutes)
- [ ] Or upgrade to Starter plan for 24/7 uptime

## 🎉 Success Criteria

You're done when:
- ✅ Socket server is deployed and accessible
- ✅ Vercel app connects to socket server
- ✅ Messages send and receive in real-time
- ✅ No errors in console
- ✅ Works consistently for 24 hours
- ✅ Multiple users can message each other

## 🆘 Emergency Rollback

If something breaks in production:

1. **Revert Socket Connection**
   - Go to Vercel → Environment Variables
   - Delete `NEXT_PUBLIC_SOCKET_URL`
   - Redeploy
   - This will disable real-time features but keep site working

2. **Check Old Deployment**
   - Vercel keeps previous deployments
   - Can promote old deployment to production
   - Dashboard → Deployments → "..." → Promote to Production

3. **Debug Locally**
   - Pull code
   - Run both servers locally
   - Fix issues
   - Test thoroughly
   - Redeploy

## 📝 Notes

**Date Deployed:** _______________

**Render URL:** _______________

**Issues Encountered:** 
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

**Resolution:** 
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

**Performance Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
