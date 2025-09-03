#!/bin/bash

echo "🚀 Starting deployment..."

# Umgebungsvariablen setzen
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export PATH=$PATH:/opt/plesk/node/22/bin

# React App builden
echo "📦 Building React app..."
cd react-dashboard
cp .env.local .env
bun install
bun run build

# Build-Dateien ins Hauptverzeichnis kopieren
echo "📂 Copying build files..."
cp -r dist/* ../

# API Server starten
echo "🌐 Starting API server..."
cd ../api-server
npm install
nohup /opt/plesk/node/22/bin/node server.js > api.log 2>&1 &
echo $! > api.pid

echo "✅ Deployment complete!"
echo "🌍 Website: https://inteliexpert.de"
echo "📊 API Server PID saved to api.pid"