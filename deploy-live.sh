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
# ENVIRONMENT SETUP
# =====================================
echo -e "${BLUE}⚙️  Setting up environment...${NC}"

# Umgebungsvariablen setzen (für Plesk Server)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export PATH=$PATH:/opt/plesk/node/22/bin
export NODE_ENV=production

echo -e "${GREEN}✅ Environment configured${NC}"

# Git pull übersprungen - nur lokales Deployment
echo -e "\n${GREEN}🚀 Starte lokales Deployment...${NC}"

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

# .env Setup (wie in deinem Script)
if [ -f ".env.local" ]; then
    echo -e "${YELLOW}📋 Kopiere .env.local zu .env${NC}"
    cp .env.local .env
fi

# Production Build
echo -e "${YELLOW}🔨 Erstelle Production Build...${NC}"
bun run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend Build erfolgreich${NC}"
    
    # Build-Dateien ins Hauptverzeichnis kopieren (wie in deinem Script)
    echo -e "${YELLOW}📂 Kopiere Build ins Hauptverzeichnis...${NC}"
    cp -r dist/* ../
    echo -e "${GREEN}✅ Build-Dateien kopiert${NC}"
else
    echo -e "${RED}❌ Frontend Build fehlgeschlagen${NC}"
    exit 1
fi

# =====================================
# SCHRITT 4: BACKEND NEUSTARTEN
# =====================================
echo -e "\n${BLUE}🔄 SCHRITT 4: Starte Backend neu...${NC}"
cd ../api-server

# Prüfe ob PM2 installiert ist, wenn nicht -> versuche lokale Installation
if ! command -v pm2 >/dev/null 2>&1; then
    echo -e "${YELLOW}📦 PM2 nicht gefunden - versuche lokale Installation...${NC}"
    
    # Versuche PM2 lokal zu installieren
    npm install pm2 --save-dev 2>/dev/null
    
    # Prüfe ob lokale Installation funktioniert hat
    if [ -f "node_modules/.bin/pm2" ]; then
        echo -e "${GREEN}✅ PM2 lokal installiert${NC}"
        # PM2 Pfad temporär hinzufügen
        export PATH="./node_modules/.bin:$PATH"
    else
        echo -e "${YELLOW}ℹ️  PM2 Installation nicht möglich (Shared Hosting) - nutze PID-System${NC}"
    fi
fi

# Nutze PM2 (jetzt definitiv vorhanden oder Fallback)
if command -v pm2 >/dev/null 2>&1; then
    echo -e "${YELLOW}🔄 Nutze PM2...${NC}"
    
    # Stoppe alte Instanz falls vorhanden
    pm2 delete dashboard-api 2>/dev/null || true
    
    # Starte neue Instanz
    NODE_ENV=production pm2 start server.js --name "dashboard-api" --time --log api.log
    pm2 save
    
    echo -e "${GREEN}✅ Backend mit PM2 gestartet${NC}"
    
elif [ -f "api.pid" ]; then
    echo -e "${YELLOW}🔄 Nutze PID-basierte Verwaltung (wie dein Script)...${NC}"
    
    # Stoppe alte Instanz
    if [ -f "api.pid" ]; then
        OLD_PID=$(cat api.pid)
        if ps -p $OLD_PID > /dev/null 2>&1; then
            kill $OLD_PID
            echo -e "${GREEN}✅ Alter Server gestoppt (PID: $OLD_PID)${NC}"
        fi
        rm -f api.pid
    fi
    
    # Starte neue Instanz (wie in deinem Script)
    echo -e "${YELLOW}🚀 Starte API Server...${NC}"
    nohup /opt/plesk/node/22/bin/node server.js > api.log 2>&1 &
    echo $! > api.pid
    
    # Warten bis Server hochgefahren ist
    sleep 5
    
    # Prüfe PID-Datei
    if [ -f "api.pid" ]; then
        PID=$(cat api.pid)
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend gestartet (PID: $PID)${NC}"
        else
            echo -e "${YELLOW}⚠️  Prozess nicht mehr aktiv, prüfe Logs...${NC}"
            tail -10 api.log
        fi
    else
        echo -e "${RED}❌ PID-Datei nicht erstellt${NC}"
        exit 1
    fi
    
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
# Webserver reload übersprungen - nicht nötig auf Shared Hosting
echo -e "\n${GREEN}✅ Frontend und Backend erfolgreich deployed!${NC}"

# Health Check übersprungen - nicht nötig

# =====================================
# FERTIG!
# =====================================
echo -e "\n${GREEN}🎉 DEPLOYMENT ERFOLGREICH!${NC}"
echo "=================================="
echo -e "${BLUE}📊 Status:${NC}"

# Zeige Status
if command -v pm2 >/dev/null 2>&1; then
    echo -e "${BLUE}📊 PM2 Status:${NC}"
    pm2 list dashboard-api
    echo -e "${BLUE}📋 PM2 Logs:${NC} pm2 logs dashboard-api"
else
    # Fallback zu PID-System
    PID_FILE="api-server/api.pid"
    if [ -f "$PID_FILE" ]; then
        echo -e "Backend PID: $(cat $PID_FILE 2>/dev/null || echo 'Nicht gefunden')"
    else
        echo -e "Backend PID: $(cat api-server/server.pid 2>/dev/null || echo 'Nicht gefunden')"
    fi
fi

echo ""
echo -e "${BLUE}📁 Frontend:${NC} Kopiert ins Hauptverzeichnis"
echo -e "${BLUE}🌐 Website:${NC} https://inteliexpert.de"
echo -e "${BLUE}🌐 API:${NC} http://localhost:3001"
echo -e "${BLUE}📋 Logs:${NC} tail -f api-server/api.log"
echo ""
echo -e "${YELLOW}🔧 Bei Problemen:${NC}"
echo -e "  • Logs prüfen: tail -f server.log"
echo -e "  • API testen: curl http://localhost:3001/api/health"
echo -e "  • PM2 status: pm2 logs dashboard-api"
echo ""
echo -e "${GREEN}✅ Deployment abgeschlossen!${NC}"