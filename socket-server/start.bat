@echo off
REM Quick start script for socket server (Windows)

echo 🚀 Starting UNI-X Socket.IO Server
echo ==================================
echo.

REM Check if .env exists
if not exist .env (
    echo ⚠️  No .env file found. Creating from template...
    copy .env.example .env
    echo ✅ Created .env file. Please edit it with your actual values.
    echo.
)

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

echo 🏃 Starting server...
echo 📡 Socket server will run on port 3001
echo 🔗 Connect from: http://localhost:3000
echo.
echo Press Ctrl+C to stop
echo.

call npm run dev
