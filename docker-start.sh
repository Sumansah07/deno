#!/bin/sh
cd /app
export HOST=0.0.0.0
export PORT=5173
NODE_ENV=production node_modules/.bin/remix-serve ./build/server/index.js
