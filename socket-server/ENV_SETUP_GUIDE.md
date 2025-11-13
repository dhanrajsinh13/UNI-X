# Environment Variables Setup for Real-Time Features

## Required Environment Variables

### Vercel (Main App)
Add these to your Vercel project settings:

```env
# Socket Server URL (Public - for frontend to connect)
NEXT_PUBLIC_SOCKET_URL=https://your-render-socket-server.onrender.com

# Socket Server URL (Internal - for API to emit events)
SOCKET_SERVER_URL=https://your-render-socket-server.onrender.com

# JWT Secret (must match socket server)
JWT_SECRET=your-secret-key-here
```

### Render (Socket Server)
Add these to your Render web service:

```env
# JWT Secret (must match Vercel)
JWT_SECRET=your-secret-key-here

# Frontend URL (for CORS)
FRONTEND_URL=https://uni-x-zeta.vercel.app

# API Base URL (for socket server to call APIs)
API_BASE_URL=https://uni-x-zeta.vercel.app
```

## How It Works

### Frontend Connection
```
Frontend (Browser)
    ↓ connects to
NEXT_PUBLIC_SOCKET_URL (wss://render-socket.onrender.com)
    ↓
Socket.IO Server on Render
```

### Backend Event Emission
```
API Route (Vercel Serverless)
    ↓ HTTP POST to
SOCKET_SERVER_URL (https://render-socket.onrender.com/emit-*)
    ↓
Socket.IO Server emits to connected clients
    ↓
Frontend receives real-time event
```

## Setup Steps

### 1. Get Your Render URL
After deploying socket server to Render:
- Go to Render Dashboard → Your Service
- Copy the URL (e.g., `https://uni-x-socket.onrender.com`)

### 2. Add to Vercel
```bash
# Go to Vercel Dashboard
# Project Settings → Environment Variables
# Add these 3 variables:

NEXT_PUBLIC_SOCKET_URL = https://uni-x-socket.onrender.com
SOCKET_SERVER_URL = https://uni-x-socket.onrender.com
JWT_SECRET = (copy from your existing JWT_SECRET)
```

### 3. Redeploy Vercel
After adding variables, redeploy your Vercel app:
- Go to Deployments
- Click "..." → Redeploy
- Or push a new commit to trigger deployment

### 4. Test
Open browser console and check for:
```
✅ Connected to Socket.io server
🔗 Socket ID: abc123...
```

## Troubleshooting

### "Cannot reach socket server"
- Check `NEXT_PUBLIC_SOCKET_URL` is set in Vercel
- Check socket server is running on Render
- Check CORS allows your Vercel domain

### "Unsend/Delete not working in real-time"
- Check `SOCKET_SERVER_URL` is set in Vercel (backend API needs this)
- Check socket server logs for incoming requests
- Check browser console for socket events

### "Authentication failed"
- Ensure `JWT_SECRET` is EXACTLY the same in Vercel and Render
- No extra spaces or line breaks

## Environment Variable Checklist

### Vercel
- [ ] `NEXT_PUBLIC_SOCKET_URL` set
- [ ] `SOCKET_SERVER_URL` set
- [ ] `JWT_SECRET` matches Render
- [ ] App redeployed after adding variables

### Render
- [ ] `JWT_SECRET` matches Vercel
- [ ] `FRONTEND_URL` points to your Vercel app
- [ ] `API_BASE_URL` points to your Vercel app
- [ ] Service is deployed and running

## Testing Commands

### Test Socket Server Health
```bash
curl https://your-render-url.onrender.com/health
```

Should return:
```json
{
  "status": "healthy",
  "connections": 0,
  "uptime": 123.45
}
```

### Test Event Emission (from terminal)
```bash
curl -X POST https://your-render-url.onrender.com/emit-message-unsend \
  -H "Content-Type: application/json" \
  -d '{"messageId": 123, "senderId": 1, "receiverId": 2}'
```

Should return:
```json
{
  "success": true
}
```

## Common Mistakes

❌ Using `NEXT_PUBLIC_SOCKET_URL` in API routes (won't work)
✅ Use `SOCKET_SERVER_URL` in API routes

❌ Forgetting to redeploy after adding env vars
✅ Always redeploy Vercel after changing environment variables

❌ Different JWT secrets between services
✅ Copy-paste the exact same JWT_SECRET to both

❌ HTTP instead of HTTPS in production
✅ Always use HTTPS URLs for production

## Quick Reference

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SOCKET_URL` | Vercel | Frontend connects to socket server |
| `SOCKET_SERVER_URL` | Vercel | Backend APIs emit events |
| `JWT_SECRET` | Both | Authenticate socket connections |
| `FRONTEND_URL` | Render | CORS configuration |
| `API_BASE_URL` | Render | Socket server calls APIs |
