# Prevent Render Free Tier from Sleeping

## Problem
Render free tier sleeps after 15 minutes of inactivity, causing:
- 30-50 second cold starts
- Connection timeouts
- Poor user experience

## Solutions

### Option 1: UptimeRobot (Recommended - Free & Easy)

1. **Create Free Account**
   - Go to [uptimerobot.com](https://uptimerobot.com)
   - Sign up for free account

2. **Add Monitor**
   - Click "Add New Monitor"
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: UNI-X Socket Server
   - **URL**: `https://your-render-url.onrender.com/health`
   - **Monitoring Interval**: 5 minutes (free tier)
   - Click "Create Monitor"

3. **Done!**
   - UptimeRobot will ping your server every 5 minutes
   - Server stays awake 24/7
   - You get uptime monitoring for free

### Option 2: Cron-Job.org (Alternative Free Service)

1. Go to [cron-job.org](https://cron-job.org)
2. Create free account
3. Add new cron job:
   - URL: `https://your-render-url.onrender.com/health`
   - Interval: Every 10 minutes
4. Enable the job

### Option 3: Run Keep-Alive Script Locally

If you have a computer that's always on:

```bash
cd socket-server
SOCKET_URL=https://your-render-url.onrender.com node keep-alive.js
```

Keep this running in the background.

### Option 4: Deploy Keep-Alive to GitHub Actions

Create `.github/workflows/keep-alive.yml`:

```yaml
name: Keep Socket Server Alive

on:
  schedule:
    # Run every 14 minutes
    - cron: '*/14 * * * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Socket Server
        run: |
          curl -f https://your-render-url.onrender.com/health || exit 1
```

### Option 5: Upgrade to Render Paid Plan ($7/mo)

- Always on, no sleep
- No need for keep-alive
- Better performance
- More resources

## Recommendation

**Use UptimeRobot (Option 1)** - It's:
- ✅ Free forever
- ✅ No code needed
- ✅ Provides monitoring
- ✅ Email alerts if server goes down
- ✅ No maintenance required

## Testing

After setting up, test cold start time:

1. Wait 20 minutes (let server sleep)
2. Open your app and check connection time
3. Should connect within 3-5 seconds (instead of 30-50s)

## Current Configuration

Your SocketContext is already optimized for cold starts:
- ✅ 60 second timeout
- ✅ 10 reconnection attempts
- ✅ Progressive backoff (2s → 10s)
- ✅ Polling fallback
