require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkUserMessages() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('unix');
    const messages = db.collection('messages');
    const users = db.collection('users');
    
    // Check messages for various users
    for (let userId of [2, 3, 13]) {
      const user = await users.findOne({ id: userId });
      const sentCount = await messages.countDocuments({ sender_id: userId });
      const receivedCount = await messages.countDocuments({ receiver_id: userId });
      
      console.log(`\n👤 User ${userId} (${user?.name || 'Not found'}):`);
      console.log(`   Sent: ${sentCount}, Received: ${receivedCount}`);
      
      if (sentCount + receivedCount > 0) {
        const msgs = await messages.find({
          $or: [{ sender_id: userId }, { receiver_id: userId }]
        }).limit(3).toArray();
        
        console.log('   Recent messages:');
        msgs.forEach(m => {
          console.log(`   - ID: ${m.id}, From: ${m.sender_id} → To: ${m.receiver_id}, Text: "${m.message_text?.substring(0, 30)}"`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkUserMessages();
