#!/bin/bash

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 PRODUCTION DEPLOYMENT SCRIPT${NC}"
echo "=================================="

# Exit bei Fehlern
set -e

# Cleanup Funktion
cleanup() {
    echo -e "\n${YELLOW}⚠️  Deployment abgebrochen${NC}"
    exit 1
}

# Trap für Cleanup
trap cleanup ERR

# =====================================
# SCHRITT 1: GIT PULL
# =====================================
echo -e "\n${BLUE}📥 SCHRITT 1: Aktualisiere Code...${NC}"
git pull origin main
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Git pull erfolgreich${NC}"
else
    echo -e "${RED}❌ Git pull fehlgeschlagen${NC}"
    exit 1
fi

# =====================================
# SCHRITT 2: BACKEND DEPENDENCIES
# =====================================
echo -e "\n${BLUE}📦 SCHRITT 2: Installiere Backend Dependencies...${NC}"
cd api-server

# Prüfe ob package.json sich geändert hat
if [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null || [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}🔄 Dependencies aktualisieren...${NC}"
    npm install --production --silent
    echo -e "${GREEN}✅ Backend Dependencies installiert${NC}"
else
    echo -e "${GREEN}✅ Backend Dependencies bereits aktuell${NC}"
fi

# =====================================
# SCHRITT 3: FRONTEND BUILD
# =====================================
echo -e "\n${BLUE}🏗️  SCHRITT 3: Frontend Build...${NC}"
cd ../react-dashboard

# Dependencies installieren wenn nötig
if [ package.json -nt node_modules/.bin/vite ] 2>/dev/null || [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}🔄 Frontend Dependencies aktualisieren...${NC}"
    bun install --silent
fi

# Production Build
echo -e "${YELLOW}🔨 Erstelle Production Build...${NC}"
bun run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend Build erfolgreich${NC}"
else
    echo -e "${RED}❌ Frontend Build fehlgeschlagen${NC}"
    exit 1
fi

# =====================================
# SCHRITT 4: BACKEND NEUSTARTEN
# =====================================
echo -e "\n${BLUE}🔄 SCHRITT 4: Starte Backend neu...${NC}"
cd ../api-server

# Prüfe ob PM2 installiert ist
if command -v pm2 >/dev/null 2>&1; then
    echo -e "${YELLOW}🔄 Nutze PM2...${NC}"
    
    # Stoppe alte Instanz falls vorhanden
    pm2 delete dashboard-api 2>/dev/null || true
    
    # Starte neue Instanz
    NODE_ENV=production pm2 start server.js --name "dashboard-api" --time
    pm2 save
    
    echo -e "${GREEN}✅ Backend mit PM2 gestartet${NC}"
    
elif [ -f "server.pid" ]; then
    echo -e "${YELLOW}🔄 Stoppe alten Server...${NC}"
    
    # Stoppe alte Instanz
    if [ -f "server.pid" ]; then
        OLD_PID=$(cat server.pid)
        if ps -p $OLD_PID > /dev/null 2>&1; then
            kill $OLD_PID
            echo -e "${GREEN}✅ Alter Server gestoppt (PID: $OLD_PID)${NC}"
        fi
        rm -f server.pid
    fi
    
    # Starte neue Instanz im Hintergrund
    echo -e "${YELLOW}🚀 Starte neuen Server...${NC}"
    NODE_ENV=production nohup node server.js > ../server.log 2>&1 & 
    echo $! > server.pid
    
    # Kurz warten und prüfen
    sleep 2
    if ps -p $(cat server.pid) > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend gestartet (PID: $(cat server.pid))${NC}"
    else
        echo -e "${RED}❌ Backend start fehlgeschlagen${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}🚀 Starte Server erstmalig...${NC}"
    NODE_ENV=production nohup node server.js > ../server.log 2>&1 & 
    echo $! > server.pid
    
    # Kurz warten und prüfen
    sleep 2
    if ps -p $(cat server.pid) > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend gestartet (PID: $(cat server.pid))${NC}"
    else
        echo -e "${RED}❌ Backend start fehlgeschlagen${NC}"
        exit 1
    fi
fi

# =====================================
# SCHRITT 5: NGINX RELOAD (falls vorhanden)
# =====================================
echo -e "\n${BLUE}🌐 SCHRITT 5: Webserver aktualisieren...${NC}"

# Prüfe ob nginx läuft
if pgrep nginx > /dev/null; then
    echo -e "${YELLOW}🔄 Nginx neu laden...${NC}"
    sudo nginx -t && sudo nginx -s reload
    echo -e "${GREEN}✅ Nginx aktualisiert${NC}"
elif pgrep apache2 > /dev/null; then
    echo -e "${YELLOW}🔄 Apache neu laden...${NC}"
    sudo systemctl reload apache2
    echo -e "${GREEN}✅ Apache aktualisiert${NC}"
else
    echo -e "${YELLOW}ℹ️  Kein Webserver gefunden (nginx/apache)${NC}"
fi

# =====================================
# SCHRITT 6: HEALTH CHECK
# =====================================
echo -e "\n${BLUE}🏥 SCHRITT 6: Health Check...${NC}"
cd ..

# Warte kurz bis Server hochgefahren ist
sleep 3

# Teste API
if curl -f -s "http://localhost:3001/api/health" > /dev/null; then
    echo -e "${GREEN}✅ API läuft korrekt${NC}"
else
    echo -e "${RED}❌ API nicht erreichbar${NC}"
    echo -e "${YELLOW}ℹ️  Prüfe Logs: tail -f server.log${NC}"
    exit 1
fi

# Teste Frontend Files
if [ -f "react-dashboard/dist/index.html" ]; then
    echo -e "${GREEN}✅ Frontend Build vorhanden${NC}"
else
    echo -e "${RED}❌ Frontend Build fehlt${NC}"
    exit 1
fi

# =====================================
# FERTIG!
# =====================================
echo -e "\n${GREEN}🎉 DEPLOYMENT ERFOLGREICH!${NC}"
echo "=================================="
echo -e "${BLUE}📊 Status:${NC}"

# Zeige PM2 Status falls verfügbar
if command -v pm2 >/dev/null 2>&1; then
    pm2 list dashboard-api
else
    echo -e "Backend PID: $(cat api-server/server.pid 2>/dev/null || echo 'Nicht gefunden')"
fi

echo ""
echo -e "${BLUE}📁 Frontend:${NC} react-dashboard/dist/"
echo -e "${BLUE}🌐 API:${NC} http://localhost:3001"
echo -e "${BLUE}📋 Logs:${NC} tail -f server.log"
echo ""
echo -e "${YELLOW}🔧 Bei Problemen:${NC}"
echo -e "  • Logs prüfen: tail -f server.log"
echo -e "  • API testen: curl http://localhost:3001/api/health"
echo -e "  • PM2 status: pm2 logs dashboard-api"
echo ""
echo -e "${GREEN}✅ Deployment abgeschlossen!${NC}"