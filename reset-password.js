require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('unix');
    const users = db.collection('users');
    
    // Reset password for user john (ID 2)
    const newPasswordHash = await bcrypt.hash('test123', 10);
    
    const result = await users.updateOne(
      { id: 2 },
      { $set: { password_hash: newPasswordHash } }
    );
    
    console.log('✅ Password reset for user john (ID: 2)');
    console.log('   College ID: 11111111');
    console.log('   New password: test123');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

resetPassword();
