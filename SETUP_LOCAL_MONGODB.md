# 🗄️ Setup Local MongoDB for Development

## Option 1: Quick Install with MongoDB Community Server (Recommended)

### Step 1: Download MongoDB
1. Go to: https://www.mongodb.com/try/download/community
2. Select:
   - **Version**: 7.0 or latest
   - **Platform**: Windows
   - **Package**: MSI
3. Click **Download**

### Step 2: Install MongoDB
1. Run the downloaded `.msi` file
2. Choose **Complete** installation
3. **Important**: Check "Install MongoDB as a Service"
4. Keep default paths:
   - Data Directory: `C:\Program Files\MongoDB\Server\7.0\data`
   - Log Directory: `C:\Program Files\MongoDB\Server\7.0\log`

### Step 3: Verify Installation
Open **PowerShell** and run:
```powershell
mongod --version
```

If you see version info, MongoDB is installed! ✅

### Step 4: Start MongoDB Service
```powershell
# Start MongoDB service
net start MongoDB

# Check if it's running
Get-Service MongoDB
```

### Step 5: Update Your .env.local
Update the `MONGODB_URI` in your `.env.local` file:
```bash
MONGODB_URI=mongodb://localhost:27017/unix
```

### Step 6: Test Connection
```powershell
node test-mongo-connection.js
```

### Step 7: Restart Your Dev Server
```powershell
npm run dev
```

---

## Option 2: Docker (If you have Docker installed)

### Step 1: Pull MongoDB Image
```powershell
docker pull mongodb/mongodb-community-server:latest
```

### Step 2: Run MongoDB Container
```powershell
docker run -d `
  --name mongodb-unix `
  -p 27017:27017 `
  -e MONGO_INITDB_DATABASE=unix `
  mongodb/mongodb-community-server:latest
```

### Step 3: Update .env.local
```bash
MONGODB_URI=mongodb://localhost:27017/unix
```

### Step 4: Test Connection
```powershell
node test-mongo-connection.js
```

---

## Option 3: MongoDB Atlas Fix (Original Cloud Solution)

If you want to fix your MongoDB Atlas connection instead:

### Step 1: Check Cluster Status
1. Go to: https://cloud.mongodb.com/
2. Navigate to **Database** → **Clusters**
3. Check if **Cluster0** exists and is **ACTIVE**
4. If paused, click **Resume**

### Step 2: Whitelist Your IP
1. Go to **Network Access** (left sidebar)
2. Click **Add IP Address**
3. Add: `152.58.63.178` (your current IP)
4. Or click **"Allow Access from Anywhere"** (0.0.0.0/0) for testing

### Step 3: Get Fresh Connection String
1. Go to **Database** → **Clusters**
2. Click **Connect** on your cluster
3. Choose **Drivers**
4. Copy the connection string
5. Replace `<password>` with your actual password

### Step 4: Update .env.local
```bash
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/unix?retryWrites=true&w=majority
```

---

## Troubleshooting

### MongoDB won't start locally?
```powershell
# Create data directory manually
New-Item -Path "C:\data\db" -ItemType Directory -Force

# Start MongoDB manually
mongod --dbpath "C:\data\db"
```

### Can't connect to localhost?
```powershell
# Check if MongoDB is running
Get-Process mongod

# Check if port 27017 is open
Test-NetConnection -ComputerName localhost -Port 27017
```

### Need MongoDB Shell (mongosh)?
Download from: https://www.mongodb.com/try/download/shell

---

## ✅ Quick Test Script

After installation, run:
```powershell
node test-mongo-connection.js
```

Expected output:
```
✅ Successfully connected to MongoDB!
✅ Database ping successful!
📦 Found X collections
```

---

## 🚀 Next Steps

After MongoDB is running:
1. Restart your dev server: `npm run dev`
2. Try registering a user
3. Your data will be stored locally in MongoDB

**Note**: Local MongoDB data is stored on your machine. You won't lose data between restarts (unlike MongoDB Atlas which might pause).
