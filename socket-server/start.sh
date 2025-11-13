#!/bin/bash

# Quick start script for socket server

echo "🚀 Starting UNI-X Socket.IO Server"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your actual values."
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🏃 Starting server..."
echo "📡 Socket server will run on port 3001"
echo "🔗 Connect from: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
