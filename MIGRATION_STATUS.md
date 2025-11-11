# 🔄 Prisma to MongoDB Migration - Complete

## ✅ What Has Been Completed

### 1. Core Infrastructure ✅
- **Created** `lib/mongodb.ts` - Native MongoDB driver with connection pooling, retry logic, and helper functions
- **Removed** all Prisma dependencies from `package.json`
- **Installed** MongoDB native driver (`mongodb@^6.3.0`)
- **Deleted** all Prisma files:
  - `lib/prisma.ts`
  - `lib/prisma-enhanced.ts`
  - `prisma/` folder (schema, migrations)
- **Updated** build scripts to remove `prisma generate`

### 2. Updated API Endpoints ✅
- `pages/api/auth/login.ts` - User authentication
- `pages/api/auth/register.ts` - User registration with MongoDB
- `pages/api/auth/forgot-password.ts` - Password reset tokens
- `pages/api/health.ts` - Database health check

### 3. Documentation Created 📚
- `MONGODB_MIGRATION_GUIDE.md` - Complete migration patterns and examples
- `scripts/check-prisma-usage.js` - Tool to identify files needing update
- `.env.example` - Environment variable template for MongoDB

---

## 🚧 What Needs To Be Done

### Remaining API Files (26 files)

You have **26 API endpoint files** that still import/use Prisma. Each needs to be converted to use MongoDB.

#### Priority Order:

**CRITICAL (Do These First):**
1. `pages/api/users/me.ts` - Current user profile (heavily used)
2. `pages/api/posts/index.ts` - Post creation and listing
3. `pages/api/posts/aura.ts` - Post likes/unlikes
4. `pages/api/users/[userId].ts` - User profile viewing
5. `pages/api/comments.ts` - Comment system

**HIGH PRIORITY:**
6. `pages/api/users/follow.ts` - Follow functionality
7. `pages/api/users/[userId]/follow.ts` - User follow actions
8. `pages/api/messages/send.ts` - Send messages
9. `pages/api/messages/index.ts` - Message inbox
10. `pages/api/search/index.ts` - Search functionality

**MEDIUM PRIORITY:**
11. `pages/api/posts/[postId].ts` - Individual post operations
12. `pages/api/messages/conversations.ts` - Conversation list
13. `pages/api/messages/conversation/[userId].ts` - User conversations
14. `pages/api/users/requests.ts` - Follow requests
15. `pages/api/users/[userId]/followers.ts` - Follower list
16. `pages/api/users/[userId]/following.ts` - Following list
17. `pages/api/comments/like.ts` - Comment likes

**LOW PRIORITY (Features/Debug):**
18. `pages/api/users/me/tagged.ts` - Tagged posts
19. `pages/api/users.ts` - User listing
20. `pages/api/messages/conversations/[id]/*.ts` - Message actions (archive, block, delete, unread)
21. `pages/api/db/test.ts` - Database test endpoint
22. `pages/api/debug/test-*.ts` - Debug endpoints

---

## 📋 Step-by-Step Migration Process

### Step 1: Setup Environment
Update your `.env` file with MongoDB connection:
```bash
MONGODB_URI=mongodb://localhost:27017  # or your MongoDB Atlas connection string
MONGODB_DB_NAME=unix
JWT_SECRET=your-secret-key
```

### Step 2: Start MongoDB
**Option A - Local MongoDB:**
```bash
mongod --dbpath /path/to/data
```

**Option B - Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option C - MongoDB Atlas:**
1. Create free cluster at https://www.mongodb.com/cloud/atlas
2. Get connection string
3. Add to `.env` as `MONGODB_URI`

### Step 3: Update Remaining Files

For each file, follow this pattern:

**Before (Prisma):**
```typescript
import { prisma, withRetry } from '../../../lib/prisma-enhanced'

const user = await withRetry(async () => {
  return prisma.user.findUnique({
    where: { id: userId }
  })
})
```

**After (MongoDB):**
```typescript
import { getCollection, Collections, withRetry, User, serializeDoc } from '../../../lib/mongodb'

const users = await getCollection<User>(Collections.USERS)
const user = await withRetry(async () => {
  return users.findOne({ id: userId })
})
const serializedUser = serializeDoc(user) // For API response
```

### Step 4: Test Each Endpoint
After updating each file:
1. Start the dev server: `npm run dev`
2. Test the endpoint with Postman/browser
3. Check for errors in console
4. Verify data is correctly stored in MongoDB

### Step 5: Initialize Database Indexes
On first run, MongoDB needs indexes. The `initializeIndexes()` function in `lib/mongodb.ts` will be called automatically on first connection.

---

## 🛠️ Tools & Commands

### Check Migration Progress
```bash
node scripts/check-prisma-usage.js
```
This shows which files still need updating.

### View MongoDB Data
```bash
# Connect to MongoDB shell
mongosh

# Switch to database
use unix

# View collections
show collections

# Query users
db.users.find().pretty()

# Query posts
db.posts.find().pretty()

# Check indexes
db.users.getIndexes()
```

### Start Development Server
```bash
npm run dev
```

---

## 📊 MongoDB Collections Structure

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `users` | User accounts | id, college_id, username, email, name |
| `posts` | Wall posts | id, user_id, caption, media_url, category |
| `auras` | Post likes | id, user_id, post_id |
| `comments` | Post comments | id, post_id, user_id, comment_text |
| `comment_likes` | Comment likes | id, user_id, comment_id |
| `followers` | Follow relationships | id, follower_id, following_id |
| `follow_requests` | Pending follow requests | id, requester_id, target_id |
| `messages` | Direct messages | id, sender_id, receiver_id, message_text |
| `password_resets` | Reset tokens | id, user_id, token, expires_at |
| `counters` | ID sequences | _id, sequence_value |

---

## 🔥 Common Issues & Solutions

### Issue: "Cannot find module 'mongodb'"
**Solution:** Run `npm install mongodb@^6.3.0`

### Issue: "MongoServerError: connection refused"
**Solution:** Ensure MongoDB is running. Check `MONGODB_URI` in `.env`

### Issue: "Collection not found"
**Solution:** Collections are created automatically on first insert. Just start using the API.

### Issue: "Unique index violation"
**Solution:** Check for duplicate college_id, username, or email. Indexes enforce uniqueness.

### Issue: "Sequential IDs not working"
**Solution:** The `counters` collection tracks IDs. It's created automatically on first use.

---

## 🎯 Quick Win Strategy

Want to see results fast? Update in this order:

1. **5 minutes:** Update `pages/api/users/me.ts` (just GET method)
2. **10 minutes:** Update `pages/api/posts/index.ts` (GET method only)
3. **5 minutes:** Update `pages/api/posts/aura.ts` (likes)
4. **Test:** Can you view your profile, see posts, and like them?
5. **Continue:** Move to POST methods and other endpoints

---

## 📞 Need Help?

- **MongoDB Query Help:** Check `MONGODB_MIGRATION_GUIDE.md`
- **Pattern Examples:** Look at completed auth endpoints
- **MongoDB Docs:** https://www.mongodb.com/docs/drivers/node/current/
- **Run Status Check:** `node scripts/check-prisma-usage.js`

---

## ✨ Benefits of MongoDB Migration

✅ **No more Prisma schema drift**
✅ **Direct database control**
✅ **Flexible schema changes**
✅ **Better for document-based data**
✅ **Simpler deployment** (no migrations)
✅ **Native JSON support**
✅ **Horizontal scaling ready**

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All 26 API files updated to MongoDB
- [ ] `MONGODB_URI` set in production environment
- [ ] Indexes initialized (`initializeIndexes()` runs on first connection)
- [ ] All endpoints tested
- [ ] MongoDB Atlas connection limits configured
- [ ] Error logging set up
- [ ] Database backups configured
- [ ] Old Prisma dependencies removed
- [ ] Build succeeds: `npm run build`

---

## 📝 Notes

- MongoDB uses `_id` (ObjectId) but we maintain `id` (number) for compatibility
- The `serializeDoc()` helper converts MongoDB documents to API responses
- Connection pooling is configured in `lib/mongodb.ts`
- Indexes are automatically created on first connection
- Sequential IDs use the `counters` collection

**Good luck with the migration! 🎉**
