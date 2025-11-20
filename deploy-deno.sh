#!/bin/bash

# Deno Deploy Build Script
echo "🚀 Preparing for Deno Deploy..."

# Backup original package.json
cp package.json package.json.backup

# Use deployment package.json
cp package.deploy.json package.json

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# Build the app
echo "🔨 Building application..."
npm run build

# Restore original package.json
mv package.json.backup package.json

echo "✅ Build complete! Ready for Deno Deploy"
