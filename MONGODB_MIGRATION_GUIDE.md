# MongoDB Migration Complete Guide

## Overview
This project has been migrated from Prisma/PostgreSQL to native MongoDB driver.

## Key Changes

### 1. Database Connection
- **Old**: `lib/prisma.ts` and `lib/prisma-enhanced.ts` with PrismaClient
- **New**: `lib/mongodb.ts` with native MongoDB driver

### 2. Collection Structure
MongoDB collections match the previous Prisma schema:
- `users` - User accounts
- `posts` - Wall posts
- `auras` - Post likes
- `comments` - Post comments
- `comment_likes` - Comment likes
- `followers` - Follow relationships
- `follow_requests` - Pending follow requests for private accounts
- `messages` - Direct messages
- `password_resets` - Password reset tokens
- `clubs` - Club information
- `club_members` - Club membership
- `club_discussions` - Club posts
- `club_comments` - Comments on club posts
- `counters` - Sequential ID generation

### 3. ID Strategy
MongoDB uses `_id` (ObjectId) internally, but we maintain `id` (number) fields for compatibility:
- Sequential numeric IDs are generated using the `counters` collection
- Helper functions `toNumber()` and `serializeDoc()` handle conversions
- All API responses maintain the same format

### 4. Common Query Patterns

#### Finding Documents
```typescript
// Old Prisma
const user = await prisma.user.findUnique({ where: { id: userId } })

// New MongoDB
const users = await getCollection<User>(Collections.USERS)
const user = await users.findOne({ id: userId })
```

#### Creating Documents
```typescript
// Old Prisma
const post = await prisma.post.create({
  data: { user_id: userId, caption: 'Hello', ... }
})

// New MongoDB
const posts = await getCollection<Post>(Collections.POSTS)
const postId = await getNextSequenceValue('posts')
await posts.insertOne({
  id: postId,
  user_id: userId,
  caption: 'Hello',
  created_at: new Date(),
  ...
})
```

#### Updating Documents
```typescript
// Old Prisma
await prisma.user.update({
  where: { id: userId },
  data: { name: 'New Name' }
})

// New MongoDB
const users = await getCollection<User>(Collections.USERS)
await users.updateOne(
  { id: userId },
  { $set: { name: 'New Name' } }
)
```

#### Counting and Aggregation
```typescript
// Old Prisma
const count = await prisma.follower.count({ where: { following_id: userId } })

// New MongoDB
const followers = await getCollection<Follower>(Collections.FOLLOWERS)
const count = await followers.countDocuments({ following_id: userId })
```

#### Complex Queries with Joins
MongoDB doesn't have joins like SQL. Use aggregation pipelines:

```typescript
// Get user with posts
const users = await getCollection(Collections.USERS)
const result = await users.aggregate([
  { $match: { id: userId } },
  {
    $lookup: {
      from: 'posts',
      localField: 'id',
      foreignField: 'user_id',
      as: 'posts'
    }
  }
]).toArray()
```

### 5. Environment Variables
Update your `.env` file:
```env
# Remove old PostgreSQL connection
# DATABASE_URL=postgresql://...

# Add MongoDB connection
MONGODB_URI=mongodb://localhost:27017
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/

# Database name
MONGODB_DB_NAME=unix
```

### 6. Indexes
Indexes are automatically created on first connection via `initializeIndexes()`:
- Unique indexes on `college_id`, `username`, `email`
- Performance indexes on foreign keys and frequently queried fields
- Text indexes for search functionality

### 7. Migration Status

#### ✅ Completed
- [x] MongoDB connection library (`lib/mongodb.ts`)
- [x] Package.json updated (removed Prisma, added MongoDB)
- [x] Auth endpoints (login, register, forgot-password)

#### ⏳ Remaining Files to Update
All files in `pages/api/` need to be updated to use MongoDB. Pattern:
1. Replace `import { prisma } from '...lib/prisma...'`
2. With `import { getCollection, Collections, ... } from '...lib/mongodb'`
3. Update query syntax to MongoDB operations
4. Use `withRetry()` for reliability
5. Use `serializeDoc()` for API responses

**Priority Files:**
- `pages/api/users/me.ts` - Current user profile
- `pages/api/users/[userId].ts` - User profile by ID
- `pages/api/posts/index.ts` - Create and fetch posts
- `pages/api/posts/[postId].ts` - Individual post operations
- `pages/api/posts/aura.ts` - Like/unlike posts
- `pages/api/comments.ts` - Comment operations
- `pages/api/messages/**` - Messaging system
- `pages/api/users/follow.ts` - Follow operations
- `pages/api/search/index.ts` - Search users and posts

### 8. Testing
After migration:
1. Test user registration and login
2. Test profile viewing and editing
3. Test post creation, viewing, liking
4. Test commenting
5. Test messaging
6. Test follow/unfollow
7. Test search functionality

### 9. Deployment Notes
For production deployment:
1. Set up MongoDB Atlas cluster or your MongoDB instance
2. Update `MONGODB_URI` in environment variables
3. Ensure MongoDB allows connections from your deployment platform
4. Run `initializeIndexes()` on first deployment
5. Monitor connection pooling and performance

### 10. Removed Files
After full migration, remove:
- `lib/prisma.ts`
- `lib/prisma-enhanced.ts`
- `prisma/` folder (schema.prisma, migrations)
- `scripts/migrate-categories.ts` (Prisma-specific)
