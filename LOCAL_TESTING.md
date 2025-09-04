# 🧪 Lokales Testing Guide

## Prerequisites

- Node.js (über Plesk: `/opt/plesk/node/22/bin/node`)
- Bun (für Frontend)
- MySQL Database (lokal oder remote)
- Alle Environment Variables korrekt gesetzt

## 1. Environment Check

### Frontend (.env)
```bash
cd react-dashboard
cat .env
```
Sollte enthalten:
- `VITE_API_URL=http://localhost:3001/api`
- `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`
- Alle anderen Keys

### Backend (.env)
```bash
cd api-server
cat .env
```
Sollte enthalten:
- `DB_HOST=localhost` (oder deine DB)
- `DB_USER=root`
- `DAT_PASSWORD=VcP369ILp99!!`

## 2. Datenbank testen

### MySQL Verbindung prüfen:
```bash
# Mit lokaler MySQL
mysql -h localhost -u root -p -e "SHOW DATABASES;"

# Mit Remote MySQL (falls verwendet)
mysql -h db002756.mydbserver.com -u usr_p688461_4 -pKharai_12345 -e "SHOW DATABASES;"
```

### Test-Query ausführen:
```bash
mysql -h localhost -u root -p usr_p688461_4 -e "SELECT 1 as test;"
```

## 3. Backend Server testen

### Server starten:
```bash
cd api-server
/opt/plesk/node/22/bin/node server.js
```

### In separatem Terminal testen:

#### Health Check:
```bash
curl http://localhost:3001/health
```
Erwartete Antwort:
```json
{
  "uptime": 0.123,
  "message": "OK",
  "timestamp": "2024-01-XX...",
  "environment": "development",
  "port": 3001,
  "memory": {...}
}
```

#### API Health Check (mit DB):
```bash
curl http://localhost:3001/api/health
```
Erwartete Antwort:
```json
{
  "status": "OK",
  "timestamp": "...",
  "services": {
    "database": { "status": "OK" }
  }
}
```

#### DAT Token testen:
```bash
curl -X POST http://localhost:3001/api/dat/token
```
Sollte Token zurückgeben oder Fehler bei ungültigen Credentials.

#### Akten API testen:
```bash
# Alle Akten
curl http://localhost:3001/api/akten

# Einzelne Akte (falls vorhanden)
curl http://localhost:3001/api/akten/1
```

## 4. Frontend testen

### Development Server starten:
```bash
cd react-dashboard
bun install
bun run dev
```

### Öffne Browser:
- **URL**: http://localhost:5173
- **Erwartung**: Login-Seite sollte laden

### Frontend Tests:

#### 1. Clerk Authentication:
- Login-Formular sollte sichtbar sein
- Bei gültigem Test-Account sollte Login funktionieren

#### 2. API-Verbindung:
- Nach Login: Dashboard sollte laden
- Browser DevTools öffnen (F12) → Network Tab
- API-Calls zu `http://localhost:3001/api/akten` sollten erfolgreich sein

#### 3. Fahrzeugschein Scanner:
- Neue Akte erstellen
- Fahrzeugschein hochladen
- API-Call sollte an richtige URL gehen (Environment Variable)

## 5. Build-Test (lokal)

### Frontend Build testen:
```bash
cd react-dashboard
bun run build
ls -la dist/  # sollte index.html, assets/ etc. enthalten
```

### Production Build lokal testen:
```bash
# Statischer Server für Build
cd react-dashboard
npx serve dist -p 4000
# Öffne http://localhost:4000
```

## 6. Deployment Script testen

### Dry-Run (ohne echtes Deployment):
```bash
# Script bearbeiten: am Anfang hinzufügen
# set -n  # Syntax check only
./deployment.sh
```

### Lokales "Production" Setup:
```bash
# .env.production erstellen (mit lokalen Werten)
cd react-dashboard
cp .env .env.production
# VITE_API_URL auf localhost lassen

cd ../api-server
cp .env .env.production
# DB_HOST auf localhost lassen

# Deployment testen
./deployment.sh
```

## 7. End-to-End Test

### Kompletter Workflow:
1. **Backend starten**: `cd api-server && node server.js`
2. **Frontend Dev starten**: `cd react-dashboard && bun run dev`
3. **Browser öffnen**: http://localhost:5173
4. **Login testen**
5. **Akte erstellen**
6. **Bilder hochladen**
7. **DAT Integration testen**
8. **PDF generieren**

## 8. Error Testing

### Häufige Probleme testen:

#### DB Connection Fehler:
```bash
# Falsches Passwort setzen
cd api-server
sed -i 's/DB_PASS=.*/DB_PASS=wrong/' .env
node server.js
curl http://localhost:3001/api/health  # sollte DB-Fehler zeigen
```

#### API URL Fehler:
```bash
# Falsche API URL im Frontend
cd react-dashboard
sed -i 's/VITE_API_URL=.*/VITE_API_URL=http:\/\/localhost:9999\/api/' .env
bun run dev
# Frontend sollte API-Fehler in Console zeigen
```

#### Missing Environment Variables:
```bash
cd api-server
mv .env .env.backup
node server.js  # sollte Fehler wegen fehlender DB-Configs zeigen
mv .env.backup .env
```

## 9. Performance Testing

### API Load Test:
```bash
# Mehrere gleichzeitige Requests
for i in {1..10}; do
  curl http://localhost:3001/health &
done
wait
```

### Memory Usage:
```bash
# Server starten und Memory tracking
/opt/plesk/node/22/bin/node server.js &
PID=$!

# Memory Usage verfolgen
while true; do
  ps -p $PID -o pid,vsz,rss,pcpu,pmem,comm
  sleep 5
done
```

## 10. Debug Tools

### Backend Debug:
```bash
# Debug Logs aktivieren
cd api-server
DEBUG=* node server.js
```

### Frontend Debug:
```bash
cd react-dashboard
# Browser DevTools nutzen:
# - Console für JavaScript Errors
# - Network für API Calls
# - Application für LocalStorage/Session
```

### Database Debug:
```bash
# Query Logs aktivieren (MySQL)
mysql -u root -p -e "SET GLOBAL general_log = 'ON';"
mysql -u root -p -e "SET GLOBAL general_log_file = '/tmp/mysql.log';"

# Logs verfolgen
tail -f /tmp/mysql.log
```

## Erfolgreiche Test-Checkliste:

- [ ] ✅ Backend startet ohne Fehler
- [ ] ✅ Health Checks funktionieren (`/health`, `/api/health`)
- [ ] ✅ Datenbank-Verbindung OK
- [ ] ✅ DAT Token API funktioniert
- [ ] ✅ Frontend lädt (Development)
- [ ] ✅ Clerk Authentication funktioniert
- [ ] ✅ API-Calls vom Frontend zum Backend
- [ ] ✅ Build-Prozess funktioniert
- [ ] ✅ Deployment Script läuft durch
- [ ] ✅ Production Build funktioniert lokal

## Bei Problemen:

1. **Logs checken**: `tail -f api-server/logs/api.log`
2. **Browser Console**: F12 → Console Tab
3. **Network Calls**: F12 → Network Tab
4. **Environment Variables**: `printenv | grep VITE`
5. **Ports prüfen**: `netstat -tlnp | grep 3001`