#!/bin/bash

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting COMPLETE Development Environment${NC}"
echo "=============================================="

# Cleanup bei Exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all processes...${NC}"
    
    # Kill backend
    if [ -f "api-server/dev-api.pid" ]; then
        BACKEND_PID=$(cat api-server/dev-api.pid)
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            kill $BACKEND_PID 2>/dev/null
            echo -e "${GREEN}✅ Backend stopped (PID: ${BACKEND_PID})${NC}"
        fi
        rm -f api-server/dev-api.pid
    fi
    
    # Kill frontend
    if [ -f "react-dashboard/dev-frontend.pid" ]; then
        FRONTEND_PID=$(cat react-dashboard/dev-frontend.pid)
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            kill $FRONTEND_PID 2>/dev/null
            echo -e "${GREEN}✅ Frontend stopped (PID: ${FRONTEND_PID})${NC}"
        fi
        rm -f react-dashboard/dev-frontend.pid
    fi
    
    # Kill alle Node.js Prozesse auf den Ports
    lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}🧹 Cleanup complete${NC}"
    exit 0
}

# Trap für Cleanup
trap cleanup EXIT INT TERM

# =====================================
# ENVIRONMENT CHECK
# =====================================
echo -e "${BLUE}🔧 Checking environment...${NC}"

# Node.js Check
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo -e "${YELLOW}   Install with: brew install node${NC}"
    exit 1
fi

# Bun Check
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun not found${NC}"
    echo -e "${YELLOW}   Install with: curl -fsSL https://bun.sh/install | bash${NC}"
    exit 1
fi

# MySQL Check
if ! command -v mysql &> /dev/null; then
    echo -e "${YELLOW}⚠️  MySQL client not found - database tests may fail${NC}"
fi

echo -e "${GREEN}✅ Environment ready${NC}"

# =====================================
# STOP OLD PROCESSES
# =====================================
echo -e "${BLUE}⏹️  Stopping old processes...${NC}"

# Stop processes on ports
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true

sleep 2

# =====================================
# CHECK ENVIRONMENT FILES
# =====================================
echo -e "${BLUE}📋 Checking environment files...${NC}"

if [ ! -f "react-dashboard/.env" ]; then
    echo -e "${RED}❌ Frontend .env missing${NC}"
    exit 1
fi

if [ ! -f "api-server/.env" ]; then
    echo -e "${RED}❌ Backend .env missing${NC}"
    exit 1
fi

API_URL=$(grep "^VITE_API_URL=" react-dashboard/.env | cut -d'=' -f2)
DB_HOST=$(grep "^DB_HOST=" api-server/.env | cut -d'=' -f2)

echo -e "${GREEN}✅ Frontend API URL: ${API_URL}${NC}"
echo -e "${GREEN}✅ Backend DB Host: ${DB_HOST}${NC}"

# =====================================
# INSTALL DEPENDENCIES
# =====================================
echo -e "${BLUE}📦 Installing dependencies...${NC}"

# Backend Dependencies
cd api-server
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo -e "${YELLOW}   Installing backend dependencies...${NC}"
    npm install --silent
fi
cd ..

# Frontend Dependencies  
cd react-dashboard
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo -e "${YELLOW}   Installing frontend dependencies...${NC}"
    bun install --silent
fi
cd ..

echo -e "${GREEN}✅ Dependencies installed${NC}"

# =====================================
# START BACKEND
# =====================================
echo -e "${BLUE}🌐 Starting Backend Server...${NC}"

cd api-server

# Start backend in background
nohup node server.js > dev-api.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > dev-api.pid

cd ..

# Wait for backend to start
echo -e "${YELLOW}   Waiting for backend...${NC}"
for i in {1..15}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend running (PID: ${BACKEND_PID}) - http://localhost:3001${NC}"
        break
    elif [ $i -eq 15 ]; then
        echo -e "${RED}❌ Backend failed to start${NC}"
        echo -e "${YELLOW}   Check logs: tail -f api-server/dev-api.log${NC}"
        exit 1
    else
        sleep 1
    fi
done

# =====================================  
# START FRONTEND
# =====================================
echo -e "${BLUE}🎨 Starting Frontend Dev Server...${NC}"

cd react-dashboard

# Start frontend in background
nohup bun run dev > dev-frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > dev-frontend.pid

cd ..

# Wait for frontend to start
echo -e "${YELLOW}   Waiting for frontend...${NC}"
for i in {1..20}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend running (PID: ${FRONTEND_PID}) - http://localhost:5173${NC}"
        break
    elif [ $i -eq 20 ]; then
        echo -e "${RED}❌ Frontend failed to start${NC}"
        echo -e "${YELLOW}   Check logs: tail -f react-dashboard/dev-frontend.log${NC}"
        exit 1
    else
        sleep 1
    fi
done

# =====================================
# API TESTS
# =====================================
echo -e "${BLUE}🔌 Testing API endpoints...${NC}"

# Health Check
if curl -s http://localhost:3001/health | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✅ /health endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  /health endpoint issues${NC}"
fi

# API Health Check
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ /api/health endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  /api/health endpoint issues${NC}"
fi

# Akten API
if curl -s http://localhost:3001/api/akten > /dev/null 2>&1; then
    echo -e "${GREEN}✅ /api/akten endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  /api/akten endpoint issues${NC}"
fi

# =====================================
# OPEN BROWSER
# =====================================
echo -e "${BLUE}🌍 Opening browser...${NC}"

# macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5173
# Linux
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:5173 &
# Windows/WSL
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    start http://localhost:5173
fi

# =====================================
# RUNNING STATUS
# =====================================
echo
echo -e "${GREEN}🎉 DEVELOPMENT ENVIRONMENT READY!${NC}"
echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}🌍 Frontend:${NC} http://localhost:5173"
echo -e "${GREEN}🔗 Backend:${NC}  http://localhost:3001"
echo -e "${GREEN}📊 API Health:${NC} http://localhost:3001/api/health"
echo
echo -e "${BLUE}📋 Process Status:${NC}"
echo -e "   Backend PID:  ${BACKEND_PID} (logs: api-server/dev-api.log)"
echo -e "   Frontend PID: ${FRONTEND_PID} (logs: react-dashboard/dev-frontend.log)"
echo
echo -e "${BLUE}📜 Useful Commands:${NC}"
echo -e "   View Backend Logs:  ${YELLOW}tail -f api-server/dev-api.log${NC}"
echo -e "   View Frontend Logs: ${YELLOW}tail -f react-dashboard/dev-frontend.log${NC}"
echo -e "   API Health Check:   ${YELLOW}curl http://localhost:3001/api/health${NC}"
echo -e "   Stop Everything:    ${YELLOW}Ctrl+C${NC}"
echo
echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}🚀 Happy Coding! Press Ctrl+C to stop everything.${NC}"

# =====================================
# KEEP RUNNING & MONITOR
# =====================================

# Monitor both processes
while true; do
    # Check if backend is still running
    if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${RED}❌ Backend process died!${NC}"
        echo -e "${YELLOW}   Check logs: tail api-server/dev-api.log${NC}"
        break
    fi
    
    # Check if frontend is still running  
    if ! ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "${RED}❌ Frontend process died!${NC}"
        echo -e "${YELLOW}   Check logs: tail react-dashboard/dev-frontend.log${NC}"
        break
    fi
    
    sleep 5
done

echo -e "${RED}🛑 One or more processes stopped. Exiting...${NC}"