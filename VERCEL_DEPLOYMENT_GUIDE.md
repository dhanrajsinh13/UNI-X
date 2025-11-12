# 🚀 Vercel Deployment Guide - Fix 500 Error

## Problem
Your app is getting a 500 error on `/api/auth/login` because it's trying to connect to `mongodb://127.0.0.1:27017` which is your **local** MongoDB, not accessible from Vercel servers.

## Solution

### Step 1: Set Up MongoDB Atlas (Cloud Database)

1. **Go to MongoDB Atlas**: https://cloud.mongodb.com/
2. **Log in** with your account (eclyn / eclyn8888)
3. **Whitelist All IPs** (important for Vercel):
   - Go to **Network Access** in the left sidebar
   - Click **Add IP Address**
   - Click **Allow Access from Anywhere** (0.0.0.0/0)
   - Click **Confirm**

4. **Get Your Connection String**:
   - Go to **Database** in the left sidebar
   - Click **Connect** on your cluster
   - Choose **Connect your application**
   - Copy the connection string (it should look like):
   ```
   mongodb+srv://eclyn:eclyn8888@cluster0.4b95eyr.mongodb.net/unix?retryWrites=true&w=majority
   ```

### Step 2: Configure Environment Variables on Vercel

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project** (UNI-X)
3. **Go to Settings** → **Environment Variables**
4. **Add each of these variables ONE BY ONE**:

#### Required Variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://eclyn:eclyn8888@cluster0.4b95eyr.mongodb.net/unix?retryWrites=true&w=majority` | Production |
| `MONGODB_DB_NAME` | `unix` | Production |
| `JWT_SECRET` | `a7410aef1221c14cf62e0a8246c8bf05f815d6b4e5ce2ef721ffff0b2f8a19f1` | Production |
| `JWT_EXPIRES_IN` | `30d` | Production |
| `NODE_ENV` | `production` | Production |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` (replace with your actual domain) | Production |

#### For Email Features (Password Reset):

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | Production |
| `SMTP_PORT` | `465` | Production |
| `SMTP_USER` | `eclipse130606@gmail.com` | Production |
| `SMTP_PASS` | `ibyg cymd nmrc vxop` | Production |
| `FROM_EMAIL` | `noreply@university.edu` | Production |

#### For Cloudinary (Image Uploads):

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `CLOUDINARY_CLOUD_NAME` | `dxapgnkwp` | Production |
| `CLOUDINARY_API_KEY` | `451294316457218` | Production |
| `CLOUDINARY_API_SECRET` | `xkaW60mMIqnkUYjFsaSjBIlQpHg` | Production |
| `CLOUDINARY_DEV_FALLBACK` | `false` | Production |
| `CLOUDINARY_UPLOAD_TIMEOUT_MS` | `30000` | Production |

### Step 3: Redeploy Your Application

After adding all environment variables:

1. Go to **Deployments** tab
2. Click on the three dots (...) on your latest deployment
3. Click **Redeploy**
4. Check the **Use existing Build Cache** option
5. Click **Redeploy**

**OR** push a new commit:
```bash
git add .
git commit -m "Fix: MongoDB connection for Vercel deployment"
git push
```

### Step 4: Verify the Fix

1. Open your Vercel app URL
2. Try to log in
3. Check the **Vercel Deployment Logs**:
   - Go to your deployment
   - Click on **Functions** tab
   - Look for the login API logs
   - You should see "✅ Connected to MongoDB database: unix"

---

## Common Issues & Solutions

### Issue 1: Still Getting 500 Error
**Solution**: Check Vercel Function logs
- Go to Vercel → Your Project → Deployments → Latest Deployment
- Click on **Functions** tab
- Click on `api/auth/login`
- Look for error messages

### Issue 2: "Authentication failed" in MongoDB
**Solution**: 
- Check your MongoDB Atlas username and password
- Update the connection string in Vercel environment variables
- Make sure to URL-encode special characters in password

### Issue 3: "Network Access" error
**Solution**:
- Go to MongoDB Atlas → Network Access
- Make sure 0.0.0.0/0 is whitelisted

### Issue 4: Environment variables not updating
**Solution**:
- After changing environment variables, you MUST redeploy
- Either redeploy from Vercel dashboard or push a new commit

---

## Testing Locally with Atlas

If you want to test with MongoDB Atlas locally before deploying:

1. Update your `.env.local`:
```bash
# Comment out local MongoDB
# MONGODB_URI=mongodb://127.0.0.1:27017/unix?directConnection=true

# Use Atlas
MONGODB_URI=mongodb+srv://eclyn:eclyn8888@cluster0.4b95eyr.mongodb.net/unix?retryWrites=true&w=majority
```

2. Restart your dev server:
```bash
npm run dev
```

---

## Security Notes

⚠️ **Important**: Never commit `.env.local` or `.env.production` to Git!

These files contain sensitive information and should be in `.gitignore`.

For production, always set environment variables directly in Vercel dashboard.
