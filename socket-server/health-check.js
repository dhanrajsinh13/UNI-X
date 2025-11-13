const http = require('http');
const https = require('https');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

async function checkHealth(urlString) {
  return new Promise((resolve) => {
    try {
      console.log(`${colors.blue}Checking: ${urlString}${colors.reset}`);
      
      const url = new URL(urlString);
      const protocol = url.protocol === 'https:' ? https : http;
      
      const req = protocol.get(urlString, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            if (res.statusCode === 200) {
              console.log(`${colors.green}✅ Server is healthy${colors.reset}`);
              console.log(`   Status: ${json.status}`);
              console.log(`   Connections: ${json.connections || 0}`);
              console.log(`   Uptime: ${Math.floor(json.uptime || 0)}s`);
              resolve(true);
            } else {
              console.log(`${colors.red}❌ Server returned error (${res.statusCode})${colors.reset}`);
              resolve(false);
            }
          } catch (error) {
            console.log(`${colors.red}❌ Invalid JSON response${colors.reset}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (error) => {
        console.log(`${colors.red}❌ Cannot connect: ${error.code || error.message}${colors.reset}`);
        console.log(`   Error details:`, error);
        resolve(false);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        console.log(`${colors.red}❌ Request timeout${colors.reset}`);
        resolve(false);
      });
      
    } catch (error) {
      console.log(`${colors.red}❌ Cannot connect: ${error.message}${colors.reset}`);
      resolve(false);
    }
  });
}

async function main() {
  console.log('\n🔍 Socket.IO Server Health Check\n');
  console.log('================================\n');

  const serverUrl = process.env.SOCKET_URL || 'http://localhost:3001';
  
  console.log(`Testing: ${serverUrl}\n`);

  const healthy = await checkHealth(`${serverUrl}/health`);

  console.log('\n================================\n');

  if (healthy) {
    console.log(`${colors.green}🎉 Socket server is running!${colors.reset}\n`);
    console.log('Next steps:');
    console.log('1. Make sure NEXT_PUBLIC_SOCKET_URL is set in your main app');
    console.log('2. Restart your Next.js dev server');
    console.log('3. Open your app and check browser console');
  } else {
    console.log(`${colors.red}⚠️  Socket server is not responding${colors.reset}\n`);
    console.log('Troubleshooting:');
    console.log('1. Make sure the server is running: npm run dev');
    console.log('2. Check the URL is correct');
    console.log('3. Check firewall settings');
    console.log('4. Check if port 3001 is available');
  }

  console.log('');
}

main();
