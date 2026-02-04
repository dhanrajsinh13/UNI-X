# Socket.IO Deployment Guide (Render)

This guide will help you deploy the Socket.IO backend separately to Render.

## Why Separate Socket.IO Backend?

Vercel's serverless architecture doesn't support persistent WebSocket connections, causing Socket.IO errors. Deploying to Render (or similar) provides a persistent server for real-time features.

## Step-by-Step Deployment

### 1. Prepare Socket Server

The socket server code is in the `socket-server/` folder. This is a standalone Express + Socket.IO server.

### 2. Deploy to Render

#### Option A: Deploy from GitHub

1. **Push socket-server to GitHub** (can be same repo, different folder or separate repo)
   ```bash
   cd socket-server
   git init
   git add .
   git commit -m "Add socket.io server"
   git push
   ```

2. **Create Render Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `uni-x-socket-server`
     - **Root Directory**: `socket-server` (if in same repo)
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free (or paid for better performance)

3. **Add Environment Variables** in Render:
   ```
   JWT_SECRET=<same-as-your-vercel-app>
   FRONTEND_URL=https://your-app.vercel.app
   API_BASE_URL=https://your-app.vercel.app
   ```

4. **Deploy** - Render will automatically deploy

5. **Copy your Render URL**: `https://uni-x-0u99.onrender.com`

#### Option B: Deploy with Render.yaml

Create `render.yaml` in socket-server folder:

```yaml
services:
  - type: web
    name: uni-x-socket-server
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: JWT_SECRET
        sync: false
      - key: FRONTEND_URL
        value: https://your-app.vercel.app
      - key: API_BASE_URL
        value: https://your-app.vercel.app
```

### 3. Update Vercel Environment Variables

Add to your Vercel project:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `NEXT_PUBLIC_SOCKET_URL`
   - **Value**: `https://uni-x-0u99.onrender.com`
   - **Environment**: All (Production, Preview, Development)
3. Redeploy your Vercel app

### 4. Update Local Development

For local development, add to your `.env.local`:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

Then run socket server locally:
```bash
cd socket-server
npm install
npm run dev
```

### 5. Test Connection

1. Check socket server health:
   ```bash
   curl https://uni-x-0u99.onrender.com/health
   ```

2. Open your Vercel app and check browser console for:
   ```
   ✅ Connected to Socket.io server
   ```

## Troubleshooting

### Socket keeps disconnecting
- **Cause**: Render free tier sleeps after inactivity
- **Solution**: 
  - Upgrade to paid Render plan, OR
  - Use a service like UptimeRobot to ping your socket server every 5 minutes

### CORS errors
- Check `FRONTEND_URL` environment variable matches your Vercel URL
- Add additional domains in `socket-server/server.js` cors configuration:
  ```javascript
  cors: {
    origin: [
      FRONTEND_URL, 
      'https://uni-x.vercel.app',
      'https://uni-x-zeta.vercel.app',
      'https://your-custom-domain.com'
    ],
    credentials: true
  }
  ```

### Authentication errors
- Ensure `JWT_SECRET` is EXACTLY the same in both Vercel and Render
- Check token is being sent in socket connection

### Messages not saving
- Verify `API_BASE_URL` points to your Vercel app
- Check Vercel logs for API errors
- Ensure MongoDB connection is working

## Performance Tips

1. **Render Plan**: Free tier sleeps, paid tier ($7/mo) is always on
2. **Region**: Choose region closest to your users
3. **Health Checks**: Set up in Render settings
4. **Monitoring**: Use Render metrics or add logging service

## Alternative Hosts

If Render doesn't work, try:
- **Railway**: Similar to Render, good for Node.js
- **Fly.io**: Global edge deployment
- **DigitalOcean App Platform**: Reliable, slightly more expensive
- **Heroku**: Classic option, paid only now

## Cost Comparison

| Service | Free Tier | Always On | WebSocket Support |
|---------|-----------|-----------|-------------------|
| Render | ✅ (sleeps) | $7/mo | ✅ |
| Railway | $5 credit/mo | $5/mo+ | ✅ |
| Fly.io | Limited | $1.94/mo+ | ✅ |
| Vercel | ✅ | N/A | ❌ |

## Security Checklist

- ✅ JWT authentication implemented
- ✅ CORS restricted to your domains
- ✅ Environment variables secured
- ✅ No hardcoded secrets
- ✅ HTTPS only in production
- ⚠️ Consider rate limiting for production
- ⚠️ Add request validation
- ⚠️ Implement connection limits

## Next Steps

1. Deploy socket server to Render
2. Add `NEXT_PUBLIC_SOCKET_URL` to Vercel
3. Redeploy Vercel app
4. Test messaging functionality
5. Monitor for 24 hours
6. (Optional) Set up UptimeRobot if using free tier

## Support

If you encounter issues:
1. Check Render logs: Dashboard → Your Service → Logs
2. Check Vercel logs: Dashboard → Your Project → Deployments → View Function Logs
3. Check browser console for connection errors
4. Verify all environment variables are set correctly
