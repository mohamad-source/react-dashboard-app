# 🚀 Production Deployment Guide

## Vor dem ersten Deployment

### 1. Environment Files einrichten

#### Frontend (.env.production)
```bash
cd react-dashboard
cp .env.production.template .env.production
# Bearbeite .env.production mit deinen LIVE-Werten
```

**Wichtige Änderungen für Production:**
- `VITE_API_URL=https://inteliexpert.de/api` (Live Domain!)
- `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...` (Live Clerk Key!)
- Supabase Production Projekt verwenden

#### Backend (.env.production)
```bash
cd api-server
cp .env.production.template .env.production
# Bearbeite .env.production mit deinen LIVE-Werten
```

**Wichtige Änderungen für Production:**
- `DB_HOST=db002756.mydbserver.com` (Live DB Server!)
- `DB_PASS=Kharai_12345` (Live DB Passwort!)
- `JWT_SECRET=...` (Sehr sicheren neuen Secret generieren!)

### 2. PM2 installieren (empfohlen)
```bash
npm install -g pm2
```

### 3. SSL/HTTPS einrichten
Stelle sicher, dass deine Domain SSL-Zertifikate hat.

## Deployment ausführen

### Automatisches Deployment
```bash
# Executable machen (nur beim ersten Mal)
chmod +x deployment.sh

# Deployment starten
./deployment.sh
```

### Was das Script macht:
1. ✅ **Safety Checks** - Überprüft Environment und Tools
2. 🛑 **Stop alte Prozesse** - PM2 oder nohup Prozesse beenden
3. 📦 **Build Frontend** - React App mit Production-Einstellungen builden
4. 🚚 **Deploy Frontend** - Statische Dateien kopieren
5. 🌐 **Start Backend** - API Server with PM2 oder nohup
6. 🔍 **Health Checks** - Überprüft ob alles läuft
7. 📋 **Summary** - Zeigt Status und nützliche Kommandos

### Manuelles Deployment (falls nötig)

#### Frontend
```bash
cd react-dashboard
cp .env.production .env
bun install
bun run build
cp -r dist/* ../
```

#### Backend
```bash
cd api-server
cp .env.production .env
npm install --production

# Mit PM2 (empfohlen)
pm2 start ecosystem.config.js

# Oder mit nohup
nohup node server.js > logs/api.log 2>&1 &
```

## Nach dem Deployment

### Status überprüfen
```bash
# PM2 Status
pm2 status
pm2 logs api-server

# Oder PID überprüfen
cat api-server/api.pid
ps aux | grep node
```

### Health Checks
```bash
# Einfacher Health Check
curl http://localhost:3001/health

# Ausführlicher Health Check mit DB-Test
curl http://localhost:3001/api/health

# Frontend testen
curl https://inteliexpert.de
```

### Logs überwachen
```bash
# PM2 Logs (live)
pm2 logs api-server --lines 100

# Oder traditionelle Logs
tail -f api-server/logs/api.log
tail -f api-server/logs/combined.log
```

## Wartung & Management

### App neu starten
```bash
# PM2
pm2 restart api-server

# Oder komplettes Redeployment
./deployment.sh
```

### App stoppen
```bash
# PM2
pm2 stop api-server
pm2 delete api-server

# Oder PID killen
kill $(cat api-server/api.pid)
```

### Backup vor Deployment
Das Script erstellt automatisch Backups im `backup/` Ordner.

### Rollback (falls nötig)
```bash
# Frontend Rollback
cp backup/* ./

# Backend Rollback (falls PM2)
pm2 stop api-server
# Restore alte server.js version
pm2 start api-server
```

## Troubleshooting

### 🔥 Deployment schlägt fehl?
1. Überprüfe `.env.production` Dateien existieren
2. Teste Datenbank-Verbindung: `mysql -h db002756.mydbserver.com -u usr_p688461_4 -p`
3. Überprüfe ob Port 3001 frei ist: `netstat -tlnp | grep 3001`
4. Schaue in die Logs: `tail -f api-server/logs/api.log`

### 🌐 API nicht erreichbar?
1. Health Check: `curl http://localhost:3001/health`
2. Process läuft?: `pm2 status` oder `ps aux | grep node`
3. Firewall prüfen
4. Nginx/Apache Konfiguration prüfen

### 🎨 Frontend zeigt Fehler?
1. JavaScript Console öffnen (F12)
2. Network Tab überprüfen - API Calls erfolgreich?
3. CORS-Fehler? Überprüfe Backend CORS-Einstellungen
4. Environment Variables richtig gesetzt?

## Sicherheits-Checkliste

- ✅ `.env.production` Dateien sind NICHT im Git
- ✅ Live Clerk Keys verwenden (`pk_live_`, `sk_live_`)
- ✅ Starkes JWT Secret (32+ Zeichen)
- ✅ Production Datenbank-Credentials
- ✅ HTTPS aktiviert
- ✅ Firewall konfiguriert
- ✅ Database Backups eingerichtet

## Support URLs

- **Website**: https://inteliexpert.de
- **API Health**: https://inteliexpert.de/api/health
- **PM2 Docs**: https://pm2.keymetrics.io/docs/