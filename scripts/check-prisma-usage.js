#!/usr/bin/env node
/**
 * Script to help update API endpoints from Prisma to MongoDB
 * Run this to see which files still need updating
 */

const fs = require('fs');
const path = require('path');

const pagesApiDir = path.join(__dirname, '..', 'pages', 'api');

// Recursively find all .ts files
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Check if file contains Prisma imports
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const hasPrismaImport = content.includes('from \'../../lib/prisma') || 
                         content.includes('from \'../../../lib/prisma') ||
                         content.includes('from \'../../../../lib/prisma') ||
                         content.includes('from \'../../../../../lib/prisma') ||
                         content.includes('from \'../../lib/prisma-enhanced') ||
                         content.includes('from \'../../../lib/prisma-enhanced') ||
                         content.includes('@prisma/client');
  
  const hasPrismaUsage = content.includes('prisma.') || content.includes('prisma ');
  
  return { hasPrismaImport, hasPrismaUsage, path: filePath };
}

console.log('🔍 Scanning API files for Prisma usage...\n');

const allFiles = findTsFiles(pagesApiDir);
const filesWithPrisma = allFiles
  .map(checkFile)
  .filter(f => f.hasPrismaImport || f.hasPrismaUsage);

console.log(`📊 Results: ${filesWithPrisma.length}/${allFiles.length} files still use Prisma\n`);

if (filesWithPrisma.length > 0) {
  console.log('📝 Files that need updating:\n');
  filesWithPrisma.forEach((file, index) => {
    const relativePath = path.relative(process.cwd(), file.path);
    console.log(`${index + 1}. ${relativePath}`);
  });
  
  console.log('\n\n📖 Quick Reference - Common Replacements:\n');
  console.log('Imports:');
  console.log('  OLD: import { prisma } from \'...lib/prisma\'');
  console.log('  NEW: import { getCollection, Collections, withRetry, serializeDoc } from \'...lib/mongodb\'\n');
  
  console.log('Find One:');
  console.log('  OLD: await prisma.user.findUnique({ where: { id: userId } })');
  console.log('  NEW: const users = await getCollection<User>(Collections.USERS)');
  console.log('       await users.findOne({ id: userId })\n');
  
  console.log('Find Many:');
  console.log('  OLD: await prisma.post.findMany({ where: { user_id: userId } })');
  console.log('  NEW: const posts = await getCollection<Post>(Collections.POSTS)');
  console.log('       await posts.find({ user_id: userId }).toArray()\n');
  
  console.log('Create:');
  console.log('  OLD: await prisma.post.create({ data: { ...data } })');
  console.log('  NEW: const posts = await getCollection<Post>(Collections.POSTS)');
  console.log('       const id = await getNextSequenceValue(\'posts\')');
  console.log('       await posts.insertOne({ id, ...data, created_at: new Date() })\n');
  
  console.log('Update:');
  console.log('  OLD: await prisma.user.update({ where: { id }, data: { name } })');
  console.log('  NEW: const users = await getCollection<User>(Collections.USERS)');
  console.log('       await users.updateOne({ id }, { $set: { name } })\n');
  
  console.log('Delete:');
  console.log('  OLD: await prisma.post.delete({ where: { id } })');
  console.log('  NEW: const posts = await getCollection<Post>(Collections.POSTS)');
  console.log('       await posts.deleteOne({ id })\n');
  
  console.log('Count:');
  console.log('  OLD: await prisma.follower.count({ where: { following_id: userId } })');
  console.log('  NEW: const followers = await getCollection(Collections.FOLLOWERS)');
  console.log('       await followers.countDocuments({ following_id: userId })\n');
  
  console.log('\n💡 See MONGODB_MIGRATION_GUIDE.md for detailed patterns and examples');
  
} else {
  console.log('✅ All API files have been migrated to MongoDB!');
}

console.log('\n\n⚙️  Next steps:');
console.log('1. Update your .env file with MONGODB_URI');
console.log('2. Update remaining API files listed above');
console.log('3. Test all endpoints');
console.log('4. Deploy with MongoDB connection string\n');
