require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

async function checkUsers() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('unix');
    const users = db.collection('users');
    const messages = db.collection('messages');
    
    const allUsers = await users.find().limit(10).toArray();
    console.log(`\n📊 Total users found: ${await users.countDocuments()}`);
    console.log('\n👥 Users:');
    
    for (const user of allUsers) {
      const sentCount = await messages.countDocuments({ sender_id: user.id });
      const receivedCount = await messages.countDocuments({ receiver_id: user.id });
      
      console.log(`  - ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
      console.log(`    Messages: ${sentCount} sent, ${receivedCount} received`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkUsers();
