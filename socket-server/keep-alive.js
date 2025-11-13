#!/usr/bin/env node

/**
 * Keep-Alive Service
 * 
 * This script pings your Render socket server every 14 minutes
 * to prevent it from going to sleep (free tier sleeps after 15 min inactivity)
 * 
 * Usage:
 *   node keep-alive.js
 * 
 * Or add to package.json:
 *   "keep-alive": "node keep-alive.js"
 */

const https = require('https');
const http = require('http');

// Your Render socket server URL
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds

console.log('🔥 Keep-Alive Service Started');
console.log(`📡 Target: ${SOCKET_URL}`);
console.log(`⏱️  Interval: 14 minutes\n`);

function ping() {
  const url = new URL(`${SOCKET_URL}/health`);
  const protocol = url.protocol === 'https:' ? https : http;
  
  const startTime = Date.now();
  
  protocol.get(url.toString(), (res) => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode === 200) {
      console.log(`✅ [${new Date().toLocaleTimeString()}] Ping successful (${duration}ms)`);
    } else {
      console.log(`⚠️  [${new Date().toLocaleTimeString()}] Ping returned ${res.statusCode}`);
    }
  }).on('error', (err) => {
    console.error(`❌ [${new Date().toLocaleTimeString()}] Ping failed:`, err.message);
  });
}

// First ping immediately
ping();

// Then ping every 14 minutes
setInterval(ping, PING_INTERVAL);

console.log('🚀 First ping sent. Will ping every 14 minutes...\n');
