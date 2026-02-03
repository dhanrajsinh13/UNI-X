require('dotenv').config({ path: '.env.local' });
const { getCollection, Collections, connectToDatabase } = require('./lib/mongodb.ts');
const jwt = require('jsonwebtoken');

async function testConversationsAPI() {
  try {
    // Connect to database
    await connectToDatabase();
    console.log('✅ Connected to MongoDB');
    
    const messages = await getCollection(Collections.MESSAGES);
    const users = await getCollection(Collections.USERS);
    
    // Get all users with messages
    const allMessages = await messages.find().toArray();
    console.log(`\n📊 Total messages: ${allMessages.length}`);
    
    if (allMessages.length > 0) {
      // Get unique user IDs that have sent or received messages
      const userIdsSet = new Set();
      allMessages.forEach(m => {
        userIdsSet.add(m.sender_id);
        userIdsSet.add(m.receiver_id);
      });
      
      console.log(`\n👥 Users involved in messages: ${Array.from(userIdsSet).join(', ')}`);
      
      // For each user, show their conversations
      for (const userId of userIdsSet) {
        const user = await users.findOne({ id: userId });
        console.log(`\n📱 User ${userId} (${user?.name || 'Unknown'}):`);
        
        const userMessages = await messages.find({
          $or: [
            { sender_id: userId },
            { receiver_id: userId }
          ]
        }).sort({ created_at: -1 }).limit(3).toArray();
        
        console.log(`   - Has ${userMessages.length} messages (showing recent 3)`);
        userMessages.forEach((msg, idx) => {
          const isFromUser = msg.sender_id === userId;
          const otherUserId = isFromUser ? msg.receiver_id : msg.sender_id;
          console.log(`   ${idx + 1}. ${isFromUser ? 'To' : 'From'} User ${otherUserId}: "${msg.message_text?.substring(0, 30)}..."`);
        });
      }
      
      // Test the actual API logic for user ID 2
      console.log('\n\n🧪 Testing API logic for User ID 2:');
      const testUserId = 2;
      
      const conversations = await messages.find({
        $or: [
          { sender_id: testUserId },
          { receiver_id: testUserId }
        ]
      }).sort({ created_at: -1 }).toArray();
      
      console.log(`   Found ${conversations.length} messages involving user ${testUserId}`);
      
      // Get unique user IDs
      const userIds = new Set();
      conversations.forEach(m => {
        userIds.add(m.sender_id);
        userIds.add(m.receiver_id);
      });
      
      const messageUsers = await users.find({ id: { $in: Array.from(userIds) } }).toArray();
      const userMap = new Map(messageUsers.map(u => [u.id, u]));
      
      // Group messages by conversation partner
      const conversationMap = new Map();
      
      conversations.forEach(message => {
        const otherUserId = message.sender_id === testUserId ? message.receiver_id : message.sender_id;
        const otherUser = userMap.get(otherUserId);
        
        if (!conversationMap.has(otherUserId) && otherUser) {
          const conversationId = [testUserId, otherUserId].sort().join('-');
          
          conversationMap.set(otherUserId, {
            conversationId: conversationId,
            otherUser: {
              id: otherUser.id,
              name: otherUser.name,
              profile_image: otherUser.profile_image
            },
            lastMessage: {
              id: message.id,
              text: message.message_text || '',
              mediaUrl: message.media_url,
              createdAt: message.created_at.toISOString(),
              senderId: message.sender_id,
              isFromMe: message.sender_id === testUserId
            },
            unreadCount: 0
          });
        }
      });
      
      const conversationList = Array.from(conversationMap.values());
      console.log(`\n   API would return ${conversationList.length} conversations:`);
      conversationList.forEach((conv, idx) => {
        console.log(`   ${idx + 1}. With ${conv.otherUser.name} (ID: ${conv.otherUser.id})`);
        console.log(`      Last: "${conv.lastMessage.text.substring(0, 40)}..."`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testConversationsAPI();
