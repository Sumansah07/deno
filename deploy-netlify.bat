@echo off
echo 🚀 Deploying to Netlify...
echo.

REM Check if Netlify CLI is installed
where netlify >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Netlify CLI not found. Installing...
    npm install -g netlify-cli
)

echo ✅ Netlify CLI ready
echo.

REM Build the project
echo 📦 Building project...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed!
    exit /b 1
)

echo ✅ Build successful
echo.

REM Deploy to Netlify
echo 🌐 Deploying to Netlify...
netlify deploy --prod

echo.
echo ✅ Deployment complete!
