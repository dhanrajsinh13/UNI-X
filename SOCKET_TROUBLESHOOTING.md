# Socket.io Connection Troubleshooting

## ❌ Error: "xhr poll error"

This error means the Socket.io client cannot connect to the server.

## ✅ Solutions (in order):

### 1. **Make Sure You're Logged In**
The Socket.io server requires authentication. You MUST be logged in for the WebSocket connection to work.

**Steps:**
1. Open browser to `http://localhost:3000`
2. If you see a login page, login with:
   - Email: `brad@gmail.com`
   - Password: (the password you used)
3. If you're already logged in, try logging out and back in to refresh the JWT token

### 2. **Check Server is Running**
```powershell
# Check if server is running on port 3000
netstat -ano | Select-String "3000" | Select-String "LISTENING"

# If nothing shows, start the server:
npm run dev
```

### 3. **Verify Server Health**
```powershell
# Test if server is responding
curl.exe http://localhost:3000/api/health
```

You should see:
```json
{"status":"healthy","database":"connected","timestamp":"..."}
```

### 4. **Clear Browser Cache**
Sometimes old tokens get stuck:
1. Open DevTools (F12)
2. Go to Application tab → Storage → Clear site data
3. Refresh page
4. Login again

### 5. **Check Browser Console**
Open browser DevTools (F12) and look for:
- ✅ "Connected to Socket.io server" = Good!
- ❌ "No token provided" = Need to login
- ❌ "Authentication failed" = Need to logout and login again
- ❌ "xhr poll error" = Server not running or firewall blocking

## 🔍 Current Status Check:

**Server Status:** ✅ Running on port 3000 (PID 6964)  
**MongoDB Status:** ✅ Connected to localhost:27017  
**Health Check:** ✅ Database connected

**What You Need to Do:**
1. Open `http://localhost:3000` in your browser
2. **Login** with your credentials
3. Socket.io should connect automatically after login
4. Check console for "✅ Connected to Socket.io server"

## 🐛 Still Having Issues?

Check these logs in browser console:
- "Initializing new socket connection..." (Socket starting)
- "✅ Connected to Socket.io server" (Success!)
- "🔗 Socket ID: ..." (Connection ID)

If you see authentication errors, the JWT token is invalid or expired. **Solution: Logout and login again.**
