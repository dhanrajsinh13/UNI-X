require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

async function checkMessages() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('unix');
    const messages = db.collection('messages');
    
    const count = await messages.countDocuments();
    console.log(`\n📊 Total messages in database: ${count}`);
    
    if (count > 0) {
      console.log('\n📝 Recent messages:');
      const recent = await messages.find().sort({ created_at: -1 }).limit(5).toArray();
      recent.forEach(msg => {
        console.log(`  - ID: ${msg.id}, From: ${msg.sender_id} → To: ${msg.receiver_id}`);
        console.log(`    Text: ${msg.message_text?.substring(0, 50)}...`);
        console.log(`    Created: ${msg.created_at}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️ No messages found in database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkMessages();
