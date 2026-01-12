# 🚨 IMPORTANT: Socket Server Configuration

## Issue Resolution

The socket authentication errors you're experiencing are now **FIXED**. The socket server JWT verification has been updated to match the enhanced security in `lib/auth.ts`.

## Required Actions

### 1. Update Socket Server Environment Variables

The socket server needs the **SAME** `JWT_SECRET` as your main application.

**Location:** `socket-server/.env` (create if it doesn't exist)

```bash
# Copy your JWT_SECRET from the main .env.local
JWT_SECRET=a7410aef1221c14cf62e0a8246c8bf05f815d6b4e5ce2ef721ffff0b2f8a19f1

# CORS origin (your Next.js app URL)
CORS_ORIGIN=http://localhost:3000

# API URL for callbacks
NEXTJS_API_URL=http://localhost:3000

# Port (optional, defaults to 3001)
PORT=3001
```

### 2. Restart Socket Server

After updating the environment variables:

```bash
cd socket-server
npm start
```

Or if using Render/production deployment, update the environment variables in your hosting dashboard.

### 3. Clear Browser Cache & Re-login

Since JWT tokens now include additional validation (issuer, audience), you should:

1. **Logout** from the application
2. **Clear browser cache/localStorage**
3. **Login again** to get a new token with proper structure

## What Changed?

### Before (Old Token):
```json
{
  "userId": 123
}
```

### After (New Token):
```json
{
  "userId": 123,
  "iat": 1736712000,
  "jti": "unique-token-id-here",
  "iss": "unix-social",
  "aud": "unix-api"
}
```

### Socket Server Updates:
- ✅ Added algorithm specification (`HS256`)
- ✅ Added issuer verification (`unix-social`)
- ✅ Added audience verification (`unix-api`)
- ✅ Better error messages
- ✅ Token expiry handling

## Testing

### 1. Verify Socket Server is Running
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Check Console for Connection
After login, you should see in browser console:
```
✅ Connected to Socket.io server
🔗 Socket ID: xyz123
```

### 3. Test Messaging
Send a message - should work without authentication errors.

## Troubleshooting

### Error: "Authentication failed"
**Cause:** JWT_SECRET mismatch or missing in socket server  
**Fix:** Ensure socket-server/.env has the SAME JWT_SECRET

### Error: "No token provided"
**Cause:** User not logged in or token not passed  
**Fix:** Logout and login again to get fresh token

### Error: "Invalid token signature"
**Cause:** Socket server using different JWT_SECRET  
**Fix:** Sync JWT_SECRET between main app and socket server

### Error: "Token expired"
**Cause:** Token older than 7 days  
**Fix:** Login again to get new token

## Production Deployment

If using Render, Vercel, or other hosting:

### Main App (Vercel):
```bash
JWT_SECRET=your-production-secret-32-chars-minimum
NEXT_PUBLIC_SOCKET_URL=https://your-socket-server.onrender.com
```

### Socket Server (Render):
```bash
JWT_SECRET=your-production-secret-32-chars-minimum  # ⚠️ MUST MATCH!
CORS_ORIGIN=https://your-app.vercel.app
NEXTJS_API_URL=https://your-app.vercel.app
```

## Security Notes

1. **JWT_SECRET must be identical** in both main app and socket server
2. **Never commit** .env files to Git
3. **Use different secrets** for dev/staging/production
4. **Rotate secrets** regularly (every 3-6 months)
5. **32+ characters** minimum for JWT_SECRET

## Quick Fix Commands

```powershell
# 1. Navigate to socket server
cd socket-server

# 2. Create/update .env file
# (Copy JWT_SECRET from main .env.local)
"JWT_SECRET=a7410aef1221c14cf62e0a8246c8bf05f815d6b4e5ce2ef721ffff0b2f8a19f1" | Out-File -FilePath .env -Encoding ASCII

# 3. Restart socket server
npm start
```

Then in your browser:
1. Open DevTools (F12)
2. Application tab → Local Storage → Clear
3. Logout from app
4. Login again
5. Messages should now work! ✅

## Contact

If issues persist after following these steps, check:
- Console errors in browser DevTools
- Socket server logs (terminal where it's running)
- Network tab in DevTools (WebSocket connections)

---

**Status:** ✅ Socket server code updated and ready  
**Action Required:** Update socket-server/.env with JWT_SECRET  
**Next Step:** Restart socket server and re-login
