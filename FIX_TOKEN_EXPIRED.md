# 🔧 Quick Fix: Token Expired Error

## Your Error
You're seeing one or both of these:
- ❌ `Unauthorized` (API error)
- ❌ `Socket.io connection error: "Authentication failed: Token expired"` (Socket error)

## The Fix (60 seconds)

### Option 1: Automatic (Recommended)
1. **Refresh the page** (F5 or Ctrl+R)
2. You should see an alert: "Your session has expired. Please log in again."
3. Click OK
4. Log back in
5. ✅ Done!

### Option 2: Manual (If automatic doesn't work)
1. Open browser console (F12)
2. Paste this code and press Enter:
```javascript
localStorage.clear();
window.location.href = '/landing';
```
3. Log back in
4. ✅ Done!

## Why This Happens

Your authentication token expires after 7 days for security. When you try to:
- Load data from the API
- Connect to the real-time messaging system (Socket.io)

...the server checks your token and rejects it if expired.

## What I've Fixed

The app now automatically:
1. ✅ Detects expired tokens BEFORE sending requests
2. ✅ Shows you a clear message
3. ✅ Logs you out and redirects to login
4. ✅ Clears the bad token so you can log in fresh

## Still Having Issues?

### Check if Socket Server is Running
The socket server needs to be running separately. Check:
```bash
# In terminal, navigate to socket-server folder
cd socket-server

# Start it
npm start
```

### Check JWT_SECRET Matches
Both servers need the same secret key:

1. **Main app** `.env.local`:
```
JWT_SECRET=your-secret-key-here
```

2. **Socket server** `socket-server/.env`:
```
JWT_SECRET=your-secret-key-here
```

They MUST match exactly!

### Verify Your Token in Browser
1. Open DevTools (F12)
2. Go to Application → Local Storage
3. Check if `token` exists
4. Copy the value and paste into https://jwt.io
5. Check the `exp` (expiration) field - if it's in the past, token is expired

## Prevent This in the Future

The app now handles this automatically, but you can:
- Log in regularly (at least once a week)
- If you see "session expired" alert, just log back in
- The app will clear bad tokens automatically

## Need More Help?

See [TROUBLESHOOTING_UNAUTHORIZED.md](TROUBLESHOOTING_UNAUTHORIZED.md) for detailed debugging steps.
