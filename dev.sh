#!/bin/bash
echo "🔧 Starting local development with full cleanup..."

# Cleanup function
cleanup() {
    echo "🛑 Stopping servers..."
    if [ -f "api-server/api.pid" ]; then
        kill $(cat api-server/api.pid) 2>/dev/null
        rm -f api-server/api.pid
    fi
    pkill -f "node server.js" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    exit 0
}

# Set trap for cleanup on script exit
trap cleanup INT TERM EXIT

# Umgebungsvariablen setzen
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export NODE_ENV="development"

# VOLLSTÄNDIGE BEREINIGUNG
echo "🧹 Full cleanup - removing all caches and build files..."

# API Server cleanup
echo "Cleaning API server..."
cd api-server
rm -rf node_modules
rm -f package-lock.json
rm -f api.pid api.log
rm -rf logs/*.log 2>/dev/null
npm cache clean --force 2>/dev/null

# React App cleanup
echo "Cleaning React app..."
cd ../react-dashboard
rm -rf node_modules
rm -rf .vite
rm -rf dist
rm -rf build
rm -f bun.lockb
rm -f package-lock.json
rm -f yarn.lock

# Browser cache hinweis
echo "💡 Tipp: Leere auch deinen Browser-Cache (Strg+Shift+R) für beste Ergebnisse"

# API Server starten
echo "🌐 Starting API server in development mode..."
cd ../api-server

# Frische Installation
echo "📦 Fresh API server installation..."
npm install

# Stelle sicher, dass .env.development existiert
if [ ! -f ".env.development" ]; then
    echo "❌ .env.development nicht gefunden!"
    echo "📋 Kopiere .env.development.example zu .env.development und fülle die Werte aus"
    exit 1
fi

# Stoppe vorherige Instanzen
if [ -f "api.pid" ]; then
    kill $(cat api.pid) 2>/dev/null
    rm -f api.pid
fi

# Starte API Server mit development environment
NODE_ENV=development nohup node server.js > api.log 2>&1 &
echo $! > api.pid
echo "📊 API Server gestartet (PID gespeichert in api.pid)"

# Warte kurz damit API Server hochfahren kann
sleep 3

# React Development Server starten
echo "⚛️ Starting React development server..."
cd ../react-dashboard

# Stelle sicher, dass .env.development existiert
if [ ! -f ".env.development" ]; then
    echo "❌ .env.development nicht gefunden!"
    echo "📋 Kopiere .env.development.example zu .env.development"
    exit 1
fi

# Frische Installation für React
echo "📦 Fresh React installation..."
bun install

echo "🚀 Starting bun dev in development mode..."

# Starte React Server im Vordergrund (damit Script nicht beendet)
bun run dev --mode development

echo "✅ Local development setup complete!"
echo "🔗 React Dev Server läuft auf http://localhost:3000"
echo "📡 API Server läuft auf http://localhost:3001"
echo "🛑 Zum Stoppen: Ctrl+C"