require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testFullMessageFlow() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    console.log('🧪 TESTING FULL MESSAGE FLOW\n');
    console.log('================================\n');
    
    // Step 1: Login as user john (ID 2)
    console.log('1️⃣ Logging in as john...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ college_id: '11111111', password: 'test123' })
    });
    
    const loginData = await loginResponse.json();
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    console.log(`✅ Logged in as: ${loginData.user.name} (ID: ${loginData.user.id})`);
    const token = loginData.token;
    const userId = loginData.user.id;
    
    // Step 2: Check existing messages before sending
    await client.connect();
    const db = client.db('unix');
    const messages = db.collection('messages');
    
    const beforeCount = await messages.countDocuments();
    console.log(`\n2️⃣ Messages in DB before: ${beforeCount}`);
    
    // Step 3: Send a test message via API
    console.log('\n3️⃣ Sending test message via API...');
    const testMessage = `Test message at ${new Date().toISOString()}`;
    const sendResponse = await fetch('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receiverId: 3, // Send to Jonny
        messageText: testMessage
      })
    });
    
    const sendData = await sendResponse.json();
    if (!sendResponse.ok) {
      console.error('❌ Send failed:', sendData);
      return;
    }
    console.log(`✅ Message sent! ID: ${sendData.message?.id || sendData.data?.id}`);
    
    // Step 4: Verify message was saved to DB
    console.log('\n4️⃣ Verifying message in database...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit
    const afterCount = await messages.countDocuments();
    console.log(`   Messages in DB after: ${afterCount}`);
    
    if (afterCount > beforeCount) {
      console.log('✅ Message saved to database!');
      
      // Get the latest message
      const latestMsg = await messages.findOne({}, { sort: { created_at: -1 } });
      console.log(`   Latest message: "${latestMsg.message_text}" (ID: ${latestMsg.id})`);
    } else {
      console.log('❌ Message NOT saved to database!');
    }
    
    // Step 5: Fetch conversations via API
    console.log('\n5️⃣ Fetching conversations...');
    const convResponse = await fetch('http://localhost:3000/api/messages/conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const convData = await convResponse.json();
    if (!convResponse.ok) {
      console.error('❌ Fetch conversations failed:', convData);
      return;
    }
    
    console.log(`✅ Conversations returned: ${convData.conversations.length}`);
    convData.conversations.forEach((conv, idx) => {
      console.log(`   ${idx + 1}. ${conv.otherUser.name}: "${conv.lastMessage.text.substring(0, 40)}..."`);
    });
    
    // Step 6: Fetch specific conversation messages
    console.log('\n6️⃣ Fetching conversation with Jonny (ID: 3)...');
    const msgResponse = await fetch('http://localhost:3000/api/messages/conversation/3', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const msgData = await msgResponse.json();
    if (!msgResponse.ok) {
      console.error('❌ Fetch messages failed:', msgData);
      return;
    }
    
    console.log(`✅ Messages in conversation: ${msgData.messages.length}`);
    console.log('   Last 3 messages:');
    msgData.messages.slice(-3).forEach((msg, idx) => {
      const from = msg.senderId === userId ? 'You' : msg.sender?.name;
      console.log(`   ${idx + 1}. ${from}: "${msg.messageText}"`);
    });
    
    console.log('\n================================');
    console.log('✅ FULL MESSAGE FLOW TEST COMPLETE!');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testFullMessageFlow();
