#!/bin/bash
set -e  # Script stoppt bei Fehlern

# Farben für bessere Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting production deployment...${NC}"

# =====================================
# ENVIRONMENT & SAFETY CHECKS
# =====================================

# Environment Check
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}⚠️  NODE_ENV is not set to production${NC}"
    echo -e "${YELLOW}   Setting NODE_ENV=production${NC}"
    export NODE_ENV=production
fi

# Backup alte Build falls vorhanden
if [ -d "backup" ]; then
    rm -rf backup
fi
mkdir -p backup
if [ -f "index.html" ]; then
    echo -e "${BLUE}📦 Creating backup of current deployment...${NC}"
    cp -r *.html *.js *.css assets backup/ 2>/dev/null || true
fi

# =====================================
# ENVIRONMENT SETUP
# =====================================

echo -e "${BLUE}🔧 Setting up environment...${NC}"
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export PATH=$PATH:/opt/plesk/node/22/bin

# Check if tools exist
if ! command -v bun &> /dev/null; then
    echo -e "${RED}ERROR: Bun is not installed!${NC}"
    exit 1
fi

if ! command -v /opt/plesk/node/22/bin/node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not found at expected path!${NC}"
    exit 1
fi

# =====================================
# STOP OLD PROCESSES
# =====================================

echo -e "${BLUE}⏹️  Stopping old processes...${NC}"

# Stop PM2 process if exists
if command -v pm2 &> /dev/null; then
    pm2 stop api-server 2>/dev/null || true
    pm2 delete api-server 2>/dev/null || true
fi

# Stop nohup process if exists
if [ -f api-server/api.pid ]; then
    OLD_PID=$(cat api-server/api.pid)
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}   Killing old API server (PID: $OLD_PID)...${NC}"
        kill $OLD_PID 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        if ps -p $OLD_PID > /dev/null 2>&1; then
            kill -9 $OLD_PID 2>/dev/null || true
        fi
    fi
    rm -f api-server/api.pid
fi

# =====================================
# BUILD FRONTEND
# =====================================

echo -e "${BLUE}📦 Building React app...${NC}"
cd react-dashboard

# Environment file handling
if [ -f .env.production ]; then
    echo -e "${GREEN}   Using .env.production${NC}"
    cp .env.production .env
elif [ -f .env.local ]; then
    echo -e "${YELLOW}   WARNING: Using .env.local (create .env.production for production!)${NC}"
    cp .env.local .env
else
    echo -e "${RED}   ERROR: No environment file found (.env.production or .env.local)${NC}"
    exit 1
fi

# Install dependencies and build
echo -e "${BLUE}   Installing frontend dependencies...${NC}"
bun install --frozen-lockfile || {
    echo -e "${RED}Frontend dependency installation failed!${NC}"
    exit 1
}

echo -e "${BLUE}   Building frontend...${NC}"
bun run build || {
    echo -e "${RED}Frontend build failed!${NC}"
    exit 1
}

# Verify build
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}   ERROR: Build directory is missing or incomplete!${NC}"
    exit 1
fi

# =====================================
# DEPLOY FRONTEND
# =====================================

echo -e "${BLUE}📂 Deploying frontend files...${NC}"

# Clean old files (keep backup)
find .. -maxdepth 1 -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.ico" | grep -v backup | xargs rm -f 2>/dev/null || true
rm -rf ../assets 2>/dev/null || true

# Copy new build
cp -r dist/* ../
echo -e "${GREEN}   Frontend deployed successfully!${NC}"

# =====================================
# SETUP BACKEND
# =====================================

echo -e "${BLUE}🌐 Setting up API server...${NC}"
cd ../api-server

# Environment file for backend
if [ -f .env.production ]; then
    echo -e "${GREEN}   Using backend .env.production${NC}"
    cp .env.production .env
elif [ ! -f .env ]; then
    echo -e "${YELLOW}   WARNING: No backend .env file found!${NC}"
fi

# Install backend dependencies
echo -e "${BLUE}   Installing backend dependencies...${NC}"
npm install --production || {
    echo -e "${RED}Backend dependency installation failed!${NC}"
    exit 1
}

# =====================================
# START API SERVER
# =====================================

echo -e "${BLUE}🚀 Starting API server...${NC}"

# Use PM2 if available (recommended)
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}   Using PM2 process manager${NC}"
    
    # Create PM2 ecosystem file if not exists
    if [ ! -f ecosystem.config.js ]; then
        cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'api-server',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Start with PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    echo -e "${GREEN}   API server started with PM2${NC}"
    
else
    # Fallback to nohup
    echo -e "${YELLOW}   Using nohup (consider installing PM2 for better process management)${NC}"
    mkdir -p logs
    nohup /opt/plesk/node/22/bin/node server.js > logs/api.log 2>&1 &
    echo $! > api.pid
    echo -e "${GREEN}   API server started with nohup (PID: $(cat api.pid))${NC}"
fi

# =====================================
# HEALTH CHECK
# =====================================

echo -e "${BLUE}🔍 Running health checks...${NC}"

# Wait for server to start
sleep 3

# Check if API is responding
API_URL="http://localhost:3001"
for i in {1..5}; do
    if curl -f -s "${API_URL}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ API server is healthy!${NC}"
        break
    elif [ $i -eq 5 ]; then
        echo -e "${YELLOW}   ⚠️  API health check failed - server may still be starting${NC}"
        echo -e "${YELLOW}   Check logs: tail -f api-server/logs/api.log${NC}"
    else
        echo -e "${YELLOW}   Waiting for API server... (attempt $i/5)${NC}"
        sleep 2
    fi
done

# =====================================
# DEPLOYMENT SUMMARY
# =====================================

echo
echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🌍 Website:${NC} https://inteliexpert.de"
echo -e "${GREEN}🔗 API:${NC} ${API_URL}"
echo -e "${GREEN}📊 Logs:${NC} api-server/logs/"

if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}📋 Process Status:${NC} pm2 status"
    echo -e "${GREEN}📜 View Logs:${NC} pm2 logs api-server"
    echo -e "${GREEN}🔄 Restart:${NC} pm2 restart api-server"
else
    echo -e "${GREEN}📋 Process PID:${NC} $(cat api-server/api.pid 2>/dev/null || echo 'Not found')"
    echo -e "${GREEN}📜 View Logs:${NC} tail -f api-server/logs/api.log"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Deployment completed at $(date)${NC}"