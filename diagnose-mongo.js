// Comprehensive MongoDB Connection Diagnostics
const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')
const dns = require('dns').promises

// Read .env.local file
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

console.log('🔍 MongoDB Connection Diagnostics\n')
console.log('=' .repeat(60))

async function diagnose() {
  // 1. Check URI
  console.log('\n✓ Connection URI is set')
  const maskedUri = uri?.replace(/:[^:@]*@/, ':****@')
  console.log('  URI:', maskedUri)
  
  // 2. Extract hostname
  const hostMatch = uri.match(/@([^/]+)/)
  if (!hostMatch) {
    console.error('❌ Cannot extract hostname from URI')
    process.exit(1)
  }
  
  const hostname = hostMatch[1].split('/')[0].split('?')[0]
  console.log('\n✓ Extracted hostname:', hostname)
  
  // 3. Test DNS resolution
  console.log('\n⏳ Testing DNS resolution...')
  try {
    const addresses = await dns.resolve(hostname)
    console.log('✓ DNS resolved successfully!')
    console.log('  IP addresses:', addresses.join(', '))
  } catch (dnsError) {
    console.error('❌ DNS resolution failed:', dnsError.message)
    console.error('💡 Try:')
    console.error('   1. Check internet connection')
    console.error('   2. Flush DNS: ipconfig /flushdns')
    console.error('   3. Use Google DNS (8.8.8.8)')
    process.exit(1)
  }
  
  // 4. Try different connection options
  const connectionOptions = [
    {
      name: 'Option 1: Standard with TLS',
      options: {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        tls: true,
      }
    },
    {
      name: 'Option 2: With tlsAllowInvalidCertificates',
      options: {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        tls: true,
        tlsAllowInvalidCertificates: true,
      }
    },
    {
      name: 'Option 3: With tlsAllowInvalidHostnames',
      options: {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        tls: true,
        tlsAllowInvalidCertificates: true,
        tlsAllowInvalidHostnames: true,
      }
    },
    {
      name: 'Option 4: Force IPv4',
      options: {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        tls: true,
        tlsAllowInvalidCertificates: true,
        tlsAllowInvalidHostnames: true,
        family: 4,
      }
    },
  ]
  
  let connected = false
  
  for (const config of connectionOptions) {
    console.log(`\n⏳ Trying ${config.name}...`)
    try {
      const client = await MongoClient.connect(uri, config.options)
      console.log(`✅ SUCCESS with ${config.name}!`)
      
      // Test database access
      const db = client.db('unix')
      await db.admin().ping()
      console.log('✅ Database ping successful!')
      
      // List collections
      const collections = await db.listCollections().toArray()
      console.log(`✅ Found ${collections.length} collections`)
      
      await client.close()
      connected = true
      
      console.log('\n' + '='.repeat(60))
      console.log('✅ CONNECTION SUCCESSFUL!')
      console.log('='.repeat(60))
      console.log('\nRecommended configuration:')
      console.log(JSON.stringify(config.options, null, 2))
      break
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message.split('\n')[0]}`)
    }
  }
  
  if (!connected) {
    console.log('\n' + '='.repeat(60))
    console.error('❌ ALL CONNECTION ATTEMPTS FAILED')
    console.log('='.repeat(60))
    console.error('\n💡 Possible causes:')
    console.error('   1. IP not whitelisted in MongoDB Atlas')
    console.error('   2. Cluster is paused or stopped')
    console.error('   3. Invalid credentials (username/password)')
    console.error('   4. Windows Firewall blocking connection')
    console.error('   5. Network/VPN interference')
    console.error('\n📋 Action items:')
    console.error('   1. Go to MongoDB Atlas → Network Access')
    console.error('   2. Add IP: 152.58.63.178 OR Allow 0.0.0.0/0')
    console.error('   3. Go to Database → Clusters')
    console.error('   4. Verify cluster is ACTIVE (not paused)')
    console.error('   5. Verify credentials: eclyn / eclyn8888')
    process.exit(1)
  }
}

diagnose().catch(err => {
  console.error('\n❌ Diagnostic failed:', err.message)
  process.exit(1)
})
