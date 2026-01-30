# Troubleshooting Authentication Errors (API & Socket)

## What I Fixed

I've enhanced the authentication system with better error handling for both API requests and Socket.io connections:

### 1. **Enhanced dataFetcher.ts**
- ✅ Added detailed logging for 401 errors
- ✅ Automatic token validation before requests
- ✅ Auto-clear invalid tokens from localStorage
- ✅ Dispatch custom 'unauthorized' event for session expiry

### 2. **Enhanced AuthContext.tsx**
- ✅ Token format validation on load
- ✅ Token expiration check before use
- ✅ Event listener for automatic logout on 401
- ✅ User-friendly alert when session expires

### 3. **Enhanced SocketContext.tsx** (NEW)
- ✅ Token validation before socket connection
- ✅ Handle "Token expired" errors from socket server
- ✅ Automatic logout on socket auth failures
- ✅ Prevent connection attempts with invalid tokens
- ✅ Clear and helpful error messages

## How to Debug the Current Issue

### Step 1: Check Browser Console
Open your browser console and look for these new debug messages:

**API Errors:**
```
🔒 Unauthorized request to: /api/...
Auth header present: true/false
⚠️ No token provided for request to: ...
⚠️ Stored token is invalid or expired - clearing
```

**Socket Errors:**
```
❌ Socket.io connection error: "Authentication failed: Token expired"
⚠️ Socket token has expired
💡 Authentication error - Token is invalid or expired
💡 Clearing invalid token and logging out...
❌ Cannot connect socket: Token is invalid or expired
```

### Step 2: Check Your Token
1. Open browser DevTools (F12)
2. Go to **Application** → **Local Storage**
3. Check if `token` exists
4. If it exists, copy it and paste into [jwt.io](https://jwt.io) to check:
   - Is it expired? (exp claim)
   - Is it properly formatted?

### Step 3: Check Network Tab
1. Open DevTools → **Network** tab
2. Reproduce the error
3. Look for the failed request (status 401)
4. Click on it and check:
   - **Headers** tab: Is `Authorization: Bearer ...` present?
   - **Response** tab: What's the exact error message?

### Step 4: Check Server Logs
Look at your terminal where the Node server is running for any auth-related errors.

## Common Causes & Solutions

### Cause 1: Token Expired (MOST COMMON)
**Symptoms:** 
- Error after being logged in for 7+ days
- "Token expired" in console
- Socket connection fails with "Authentication failed: Token expired"

**Solution:** Log out and log back in
```javascript
// Quick fix in browser console
localStorage.clear();
window.location.href = '/landing';
```

### Cause 2: Token Not Being Sent
**Symptoms:** Console shows "No token provided for request to: ..."
**Solution:** 
- Check if you're logged in: `localStorage.getItem('token')`
- If not, log in again
- If yes, there's a bug in passing the token

### Cause 3: Invalid Token Format
**Symptoms:** Console shows "Invalid token format (too short)"
**Solution:** Clear localStorage and log in again:
```javascript
localStorage.clear();
window.location.href = '/landing';
```

### Cause 4: JWT_SECRET Mismatch
**Symptoms:** 
- All tokens fail validation
- Socket connection fails immediately
- "Generic error - Socket server might not be running or JWT_SECRET mismatch"

**Solution:** 
1. Check your `.env.local` file has `JWT_SECRET` set
2. Check `socket-server/.env` has the SAME `JWT_SECRET`
3. Restart both servers after updating .env files

## Quick Fixes

### Fix 1: Clear and Re-login (RECOMMENDED)
```javascript
// Run in browser console
localStorage.removeItem('token');
localStorage.removeItem('user');
window.location.href = '/landing';
```

### Fix 2: Check Socket Server JWT_SECRET
If socket connection fails but API works:
1. Navigate to `socket-server/.env`
2. Verify `JWT_SECRET` matches your main `.env.local`
3. Restart the socket server

### Fix 3: Check API Endpoint Auth
If a specific endpoint keeps failing:
1. Find the endpoint in `pages/api/...`
2. Check if it uses `getUserFromRequest(req)` or similar
3. Verify the endpoint requires authentication

### Fix 4: Test Token Manually
```javascript
// Run in browser console
const token = localStorage.getItem('token');
fetch('/api/users/me', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## New Features Added

### Automatic Session Expiry Handling
The app now automatically:
1. Detects when your session expires
2. Shows an alert message
3. Clears invalid token
4. Redirects to login page

### Token Validation
Before making requests, the app now:
1. Checks token format (must be valid JWT)
2. Checks expiration date
3. Warns if token is invalid
4. Prevents sending obviously bad tokens

## Next Steps

1. **Refresh the page** to load the new error handling
2. **Check the console** for the new debug messages
3. **Share the specific error** you see in console
4. If you see "Unauthorized request to: /api/..." - tell me which endpoint
5. If you see "No token provided" - your session expired, log in again

## Testing the Fix

Try these steps:
1. Log out completely
2. Clear localStorage: `localStorage.clear()`
3. Log back in
4. Try the action that was failing
5. Check console for any new error messages

---

**Need more help?** Share:
- The exact endpoint showing in console: `🔒 Unauthorized request to: ...`
- Whether auth header is present (true/false)
- What page/action triggers the error
