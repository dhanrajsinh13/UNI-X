#!/usr/bin/env node
/**
 * MongoDB Migration Helper - Quick Reference for Remaining Files
 * This shows you exactly what to change in each remaining file
 */

const replacements = {
  "IMPORTS": {
    old: [
      "import { prisma } from '../../lib/prisma'",
      "import { prisma } from '../../../lib/prisma'",
      "import { prisma, withRetry } from '../../../lib/prisma-enhanced'",
      "import { prisma, withRetry, ensureDatabaseConnection } from '../../../lib/prisma-enhanced'"
    ],
    new: "import { getCollection, Collections, withRetry, getNextSequenceValue, serializeDoc, User, Post, Message, Follower } from '../../lib/mongodb'"
  },

  "FIND_UNIQUE": {
    old: "await prisma.user.findUnique({ where: { id: userId } })",
    new: `const users = await getCollection<User>(Collections.USERS)
const user = await users.findOne({ id: userId })`
  },

  "FIND_MANY": {
    old: "await prisma.post.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' } })",
    new: `const posts = await getCollection<Post>(Collections.POSTS)
const postList = await posts.find({ user_id: userId }).sort({ created_at: -1 }).toArray()`
  },

  "CREATE": {
    old: "await prisma.post.create({ data: { user_id, caption, media_url, media_type, category } })",
    new: `const posts = await getCollection<Post>(Collections.POSTS)
const postId = await getNextSequenceValue('posts')
await posts.insertOne({
  id: postId,
  user_id,
  caption,
  media_url,
  media_type,
  category,
  created_at: new Date()
})`
  },

  "UPDATE": {
    old: "await prisma.user.update({ where: { id }, data: { name, bio } })",
    new: `const users = await getCollection<User>(Collections.USERS)
await users.updateOne({ id }, { $set: { name, bio } })`
  },

  "DELETE": {
    old: "await prisma.post.delete({ where: { id: postId } })",
    new: `const posts = await getCollection<Post>(Collections.POSTS)
await posts.deleteOne({ id: postId })`
  },

  "COUNT": {
    old: "await prisma.follower.count({ where: { following_id: userId } })",
    new: `const followers = await getCollection(Collections.FOLLOWERS)
await followers.countDocuments({ following_id: userId })`
  },

  "AGGREGATE": {
    old: "Complex joins with include",
    new: `// Use aggregation pipeline for joins:
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
]).toArray()`
  }
};

console.log("═══════════════════════════════════════════════════════════════");
console.log("  MONGODB MIGRATION - QUICK REFERENCE");
console.log("═══════════════════════════════════════════════════════════════\n");

Object.entries(replacements).forEach(([key, value]) => {
  console.log(`📝 ${key}:`);
  console.log("─".repeat(60));
  if (Array.isArray(value.old)) {
    console.log("OLD (any of these):");
    value.old.forEach(o => console.log(`  ${o}`));
  } else {
    console.log("OLD:");
    console.log(`  ${value.old}`);
  }
  console.log("\nNEW:");
  console.log(`  ${value.new}`);
  console.log("\n");
});

console.log("═══════════════════════════════════════════════════════════════");
console.log("  REMAINING FILES BY PRIORITY");
console.log("═══════════════════════════════════════════════════════════════\n");

const remainingFiles = [
  { file: "pages/api/posts/index.ts", priority: "🔴 CRITICAL", notes: "Post creation and feed" },
  { file: "pages/api/posts/[postId].ts", priority: "🔴 CRITICAL", notes: "Single post operations" },
  { file: "pages/api/users/me.ts", priority: "🔴 CRITICAL", notes: "Current user profile" },
  { file: "pages/api/users/[userId].ts", priority: "🔴 CRITICAL", notes: "User profile viewing" },
  { file: "pages/api/search/index.ts", priority: "🟡 HIGH", notes: "Search functionality" },
  { file: "pages/api/messages/send.ts", priority: "🟡 HIGH", notes: "Send messages" },
  { file: "pages/api/messages/index.ts", priority: "🟡 HIGH", notes: "Message inbox" },
  { file: "pages/api/users/requests.ts", priority: "🟡 HIGH", notes: "Follow requests" },
  { file: "pages/api/users/[userId]/follow.ts", priority: "🟡 HIGH", notes: "Follow user action" },
  { file: "pages/api/comments/like.ts", priority: "🟢 MEDIUM", notes: "Like comments" },
  { file: "pages/api/messages/conversations.ts", priority: "🟢 MEDIUM", notes: "Conversation list" },
  { file: "pages/api/users/[userId]/followers.ts", priority: "🟢 MEDIUM", notes: "Followers list" },
  { file: "pages/api/users/[userId]/following.ts", priority: "🟢 MEDIUM", notes: "Following list" },
  { file: "pages/api/messages/conversation/[userId].ts", priority: "⚪ LOW", notes: "User conversation" },
  { file: "pages/api/users/me/tagged.ts", priority: "⚪ LOW", notes: "Tagged posts" },
  { file: "pages/api/messages/conversations/[id]/*.ts", priority: "⚪ LOW", notes: "Message actions" },
  { file: "pages/api/debug/*.ts", priority: "⚪ LOW", notes: "Debug endpoints" },
  { file: "pages/api/db/test.ts", priority: "⚪ LOW", notes: "Test endpoint" }
];

remainingFiles.forEach(({ file, priority, notes }) => {
  console.log(`${priority} ${file}`);
  console.log(`   ${notes}\n`);
});

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  💡 TIPS");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("1. Always get collection first:");
console.log("   const users = await getCollection<User>(Collections.USERS)\n");

console.log("2. Use $in for array queries (cast as any to avoid type issues):");
console.log("   { id: { $in: ids } } as any\n");

console.log("3. Use $regex for text search:");
console.log("   { name: { $regex: query, $options: 'i' } }\n");

console.log("4. Sort is reversed: 'desc' becomes -1, 'asc' becomes 1:");
console.log("   .sort({ created_at: -1 })\n");

console.log("5. Always call .toArray() on find():");
console.log("   const posts = await postsCollection.find({}).toArray()\n");

console.log("6. Use serializeDoc() for API responses:");
console.log("   const serialized = serializeDoc(document)\n");

console.log("7. Sequential IDs need getNextSequenceValue():");
console.log("   const id = await getNextSequenceValue('collection_name')\n");

console.log("\n📚 See MONGODB_MIGRATION_GUIDE.md for more examples!");
console.log("\n");
