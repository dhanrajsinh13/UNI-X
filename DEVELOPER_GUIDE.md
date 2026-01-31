# 🚀 UNI-X Quick Start Guide

## Setup (First Time)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
```bash
# Copy template
cp .env.template .env.local

# Edit .env.local and set:
# - JWT_SECRET (generate: openssl rand -hex 32)
# - MONGODB_URI (Atlas or local)
# - CLOUDINARY_* credentials
# - Other required variables
```

### 3. Sync Environment (Socket Server)
```bash
npm run sync:env
```

### 4. Run Tests
```bash
npm test
```

---

## Development

### Run Main Application
```bash
npm run dev
# Opens on http://localhost:3000
```

### Run Socket Server
```bash
npm run socket:dev
# Runs on port 3001
```

### Run Both (Recommended)
```powershell
# Terminal 1
npm run dev

# Terminal 2
npm run socket:dev
```

---

## Testing

### Run All Tests
```bash
npm test
```

### Watch Mode (Auto-rerun on changes)
```bash
npm test:watch
```

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] All tests passing (`npm test`)
- [ ] No type errors (`npm run typecheck`)
- [ ] Environment variables set in Vercel
- [ ] MongoDB Atlas configured (not local)
- [ ] Redis configured (optional but recommended)
- [ ] Socket server deployed to Render
- [ ] JWT_SECRET synced between main and socket server
- [ ] CORS origins configured

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Deploy Socket Server to Render
1. Create new Web Service on Render
2. Connect your GitHub repo
3. Set root directory: `socket-server`
4. Build command: `npm install`
5. Start command: `node socket-server.js`
6. Add environment variables:
   - `JWT_SECRET` (same as main app!)
   - `CORS_ORIGIN` (your Vercel URL)
   - `MONGODB_URI` (if needed)

---

## Environment Variables Reference

### Required (Main App)
- `JWT_SECRET` - 32+ character secret
- `MONGODB_URI` - MongoDB connection string
- `CLOUDINARY_CLOUD_NAME` - Cloudinary account
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary secret
- `SOCKET_SERVER_URL` - Backend socket URL
- `NEXT_PUBLIC_SOCKET_URL` - Frontend socket URL

### Optional (Recommended for Production)
- `REDIS_URL` - Redis for distributed rate limiting
- `ALLOWED_ORIGINS` - CORS whitelist (comma-separated)
- `SMTP_*` - Email configuration

### Socket Server Required
- `JWT_SECRET` - **MUST MATCH main app exactly**
- `CORS_ORIGIN` - Main app URL
- `PORT` - Server port (default 3001)

---

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run typecheck` | Type check TypeScript |
| `npm run sync:env` | Sync JWT_SECRET to socket server |
| `npm run socket:dev` | Run socket server (dev) |
| `npm run socket:prod` | Run socket server (prod) |

---

## Troubleshooting

### Socket Authentication Failures
```bash
# Sync JWT_SECRET
npm run sync:env

# Restart socket server
```

### MongoDB Connection Issues
- Check `MONGODB_URI` format
- Verify IP whitelist in Atlas (0.0.0.0/0 for testing)
- Check network/firewall settings
- See [SETUP_LOCAL_MONGODB.md](SETUP_LOCAL_MONGODB.md)

### Build Errors
```bash
# Type errors now block builds (intentional)
npm run typecheck

# Fix all reported errors before deploying
```

### Rate Limiting Not Working
- Install Redis for production
- Set `REDIS_URL` environment variable
- Falls back to in-memory (not recommended)

---

## New Features Implemented

### Privacy Settings API
```typescript
// GET /api/users/privacy
// PUT /api/users/privacy
{
  is_private: boolean,
  show_online_status: boolean,
  show_read_receipts: boolean,
  who_can_message: 'everyone' | 'followers',
  who_can_comment: 'everyone' | 'followers'
}
```

### Account Management
```typescript
// POST /api/users/deactivate
// DELETE /api/users/delete
// GET /api/users/export-data (GDPR compliance)
```

---

## Project Structure

```
UNI-X/
├── lib/               # Core utilities
│   ├── auth.ts        # Authentication & rate limiting
│   ├── mongodb.ts     # Database connection
│   ├── redis.ts       # Redis client & caching
│   └── validation.ts  # Input validation
├── pages/api/         # API endpoints
│   └── users/         # User APIs
│       ├── privacy.ts      # Privacy settings
│       ├── deactivate.ts   # Account deactivation
│       ├── delete.ts       # Account deletion
│       └── export-data.ts  # Data export
├── __tests__/         # Test files
├── socket-server/     # Standalone socket server
├── .env.local         # Local environment (DO NOT COMMIT)
├── .env.template      # Environment template
└── sync-env.ps1       # JWT sync script
```

---

## Security Notes

⚠️ **Never commit `.env.local` to git**

✅ **Always use the `.env.template` for setup**

✅ **JWT_SECRET must be 32+ characters**

✅ **Sync JWT_SECRET between main app and socket server**

✅ **Use HTTPS in production**

✅ **Configure CORS properly (no wildcards in production)**

---

## Support

- **Documentation**: [IMPROVEMENTS_SUMMARY.md](IMPROVEMENTS_SUMMARY.md)
- **Socket Issues**: [SOCKET_TROUBLESHOOTING.md](SOCKET_TROUBLESHOOTING.md)
- **Security**: [SECURITY.md](SECURITY.md)
- **Deployment**: [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md)

---

**Last Updated**: January 2026  
**Version**: 2.0 (Post-Improvements)
