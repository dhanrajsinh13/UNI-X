require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkCollegeIds() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('unix');
    const users = db.collection('users');
    
    const allUsers = await users.find().limit(5).toArray();
    
    console.log('📋 User credentials:');
    allUsers.forEach(user => {
      console.log(`  ID: ${user.id}, Name: ${user.name}`);
      console.log(`  College ID: ${user.college_id}`);
      console.log(`  Email: ${user.email}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkCollegeIds();
