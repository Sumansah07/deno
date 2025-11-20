@echo off
REM Deno Deploy Build Script for Windows

echo 🚀 Preparing for Deno Deploy...

REM Backup original package.json
copy package.json package.json.backup

REM Use deployment package.json
copy package.deploy.json package.json

REM Install dependencies
echo 📦 Installing dependencies...
npm install --legacy-peer-deps

REM Build the app
echo 🔨 Building application...
npm run build

REM Restore original package.json
move /Y package.json.backup package.json

echo ✅ Build complete! Ready for Deno Deploy
