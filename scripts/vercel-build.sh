#!/bin/bash

echo "🔄 Starting Vercel build process..."

# Generate Prisma client first
echo "📦 Generating Prisma client..."
npx prisma generate

# Only run migrations if DATABASE_URL is available
if [ -n "$DATABASE_URL" ]; then
    echo "🗄️ Running database migrations..."
    npx prisma migrate deploy
else
    echo "⚠️ DATABASE_URL not found, skipping migrations (will run at runtime)"
fi

# Build Next.js
echo "🏗️ Building Next.js application..."
npx next build

echo "✅ Build completed successfully!"