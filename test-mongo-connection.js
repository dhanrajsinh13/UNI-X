// Test MongoDB Connection
const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')

// Read .env.local file manually
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envLines = envContent.split('\n')

envLines.forEach(line => {
  const match = line.match(/^([^#][^=]*)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    process.env[key] = value
  }
})

const uri = process.env.MONGODB_URI

console.log('🔍 Testing MongoDB Connection...')
console.log('📍 URI:', uri?.replace(/:[^:@]*@/, ':****@')) // Hide password

async function testConnection() {
  try {
    console.log('\n⏳ Attempting to connect...')
    
    const client = await MongoClient.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      directConnection: true, // Direct connection to single server
    })
    
    console.log('✅ Successfully connected to MongoDB!')
    
    // Test database access
    const db = client.db('unix')
    await db.admin().ping()
    console.log('✅ Database ping successful!')
    
    // List collections
    const collections = await db.listCollections().toArray()
    console.log(`\n📦 Found ${collections.length} collections:`)
    collections.forEach(col => console.log(`   - ${col.name}`))
    
    await client.close()
    console.log('\n✅ Connection test completed successfully!')
    process.exit(0)
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message)
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 DNS Resolution Error - Try these fixes:')
      console.error('   1. Check your internet connection')
      console.error('   2. Flush DNS cache: ipconfig /flushdns')
      console.error('   3. Change DNS to Google (8.8.8.8) or Cloudflare (1.1.1.1)')
      console.error('   4. Disable VPN/proxy temporarily')
      console.error('   5. Check Windows Firewall settings')
    }
    
    process.exit(1)
  }
}

testConnection()
