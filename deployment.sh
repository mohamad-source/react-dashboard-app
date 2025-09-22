#!/bin/bash
echo "🚀 Starting production deployment..."

# Cleanup function
cleanup() {
    echo "🛑 Cleaning up on exit..."
    exit 0
}

# Set trap for cleanup on script exit
trap cleanup INT TERM EXIT

# Umgebungsvariablen setzen
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export PATH=$PATH:/opt/plesk/node/22/bin
export NODE_ENV="production"

# React App builden
echo "📦 Building React app for production..."
cd react-dashboard

# Stelle sicher, dass .env.production existiert
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production nicht gefunden!"
    echo "📋 Kopiere .env.production.example zu .env.production und fülle die echten Produktionswerte aus"
    exit 1
fi

# Clean build
echo "🧹 Cleaning previous build..."
rm -rf node_modules dist .vite
rm -f bun.lockb

# Fresh installation and build
echo "📦 Fresh installation for React app..."
bun install
echo "🔨 Building React app..."
bun run build --mode production

# Build-Dateien ins Hauptverzeichnis kopieren
echo "📂 Copying build files to root..."
cp -r dist/* ../

# API Server vorbereiten
echo "🌐 Preparing API server for production..."
cd ../api-server

# Clean installation
echo "🧹 Cleaning API server..."
rm -rf node_modules
rm -f package-lock.json

# Fresh installation
echo "📦 Fresh installation for API server..."
npm install

# Stelle sicher, dass .env.production existiert
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production nicht gefunden!"
    echo "📋 Kopiere .env.production.example zu .env.production und fülle die echten Werte aus"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2
fi

# PM2 Ecosystem Config erstellen
echo "⚙️ Creating PM2 ecosystem config..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: './server.js',
      cwd: './api-server',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      log_file: './api-server/logs/combined.log',
      out_file: './api-server/logs/out.log',
      error_file: './api-server/logs/error.log',
      time: true,
      max_memory_restart: '500M',
      node_args: '--max_old_space_size=512'
    },
    {
      name: 'static-server',
      script: 'serve',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      args: '-s . -l 3000',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: './logs/static-combined.log',
      out_file: './logs/static-out.log', 
      error_file: './logs/static-error.log',
      time: true,
      max_memory_restart: '200M'
    }
  ]
}
EOF

# Install serve globally if not present
if ! command -v serve &> /dev/null; then
    echo "📦 Installing serve globally for static file serving..."
    npm install -g serve
fi

# Create logs directory in root
mkdir -p ../logs

# Move ecosystem config to root
mv ecosystem.config.js ../

# Gehe zurück zum Hauptverzeichnis
cd ..

# Stoppe alle laufenden Apps
echo "🛑 Stopping existing PM2 processes..."
pm2 delete all 2>/dev/null || true

# Starte beide Server mit pm2
echo "🚀 Starting both servers with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo "⚙️ Setting up PM2 startup script..."
pm2 startup 2>/dev/null || true

# Show status
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "✅ Production deployment complete!"
echo ""
echo "🌍 Website: http://91.98.83.251/"
echo "🔗 Static Files: Served by PM2 on port 3000"
echo "📡 API Server: Running with PM2 on port 3001"
echo ""
echo "📋 Commands:"
echo "  pm2 status                 - Show status"
echo "  pm2 logs                   - Show all logs"
echo "  pm2 logs api-server        - Show API logs"
echo "  pm2 logs static-server     - Show static server logs"
echo "  pm2 restart all            - Restart both servers"
echo "  pm2 stop all               - Stop both servers"
echo "  pm2 delete all             - Delete all processes"
echo ""
echo "📁 Log Files:"
echo "  API Server: ./api-server/logs/"
echo "  Static Server: ./logs/"