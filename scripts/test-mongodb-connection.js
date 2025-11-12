/**
 * Test MongoDB Connection
 * Run this to verify your MongoDB connection before deploying
 * 
 * Usage: node scripts/test-mongodb-connection.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'unix';

async function testConnection() {
  console.log('🔍 Testing MongoDB connection...\n');
  
  if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  // Check if using local or Atlas
  const isLocal = MONGODB_URI.includes('127.0.0.1') || MONGODB_URI.includes('localhost');
  console.log(`📍 Connection Type: ${isLocal ? 'LOCAL MongoDB' : 'MongoDB ATLAS (Cloud)'}`);
  console.log(`🔗 URI: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}\n`);

  if (isLocal) {
    console.log('⚠️  WARNING: You are using LOCAL MongoDB!');
    console.log('   This will NOT work on Vercel deployment.');
    console.log('   Please use MongoDB Atlas for production.\n');
  }

  let client;
  try {
    console.log('⏳ Connecting...');
    
    client = await MongoClient.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      ...(isLocal && { directConnection: true }),
    });

    console.log('✅ Successfully connected to MongoDB!');
    
    const db = client.db(DB_NAME);
    console.log(`📦 Database: ${DB_NAME}`);
    
    // Test database access
    await db.admin().ping();
    console.log('✅ Database ping successful!\n');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`📊 Collections (${collections.length}):`);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // Test users collection
    const users = db.collection('users');
    const userCount = await users.countDocuments();
    console.log(`\n👥 Total users: ${userCount}`);
    
    console.log('\n✅ All tests passed! Your MongoDB connection is working.\n');
    
    if (isLocal) {
      console.log('⚠️  REMINDER: Switch to MongoDB Atlas before deploying to Vercel!');
    } else {
      console.log('✅ You are using MongoDB Atlas - ready for Vercel deployment!');
    }
    
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
      console.error('\n💡 DNS resolution failed. Solutions:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify the MongoDB URI is correct');
      console.error('   3. Check if VPN/proxy is blocking MongoDB Atlas');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Connection refused. Solutions:');
      console.error('   1. Make sure MongoDB is running (if local)');
      console.error('   2. Check if MongoDB Atlas cluster is running');
      console.error('   3. Verify your IP is whitelisted (0.0.0.0/0)');
    } else if (error.message.includes('Authentication failed')) {
      console.error('\n💡 Authentication failed. Solutions:');
      console.error('   1. Check your MongoDB username and password');
      console.error('   2. Make sure the user has proper permissions');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Connection closed.');
    }
  }
}

testConnection();
