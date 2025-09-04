# Deployment Guide

## Environment Variables Setup

Diese App verwendet unterschiedliche Konfigurationen für lokale Entwicklung und Production.

### 1. Frontend (React Dashboard)

#### Lokale Entwicklung
Verwende die `.env` Datei im `react-dashboard` Ordner:
```bash
VITE_API_URL=http://localhost:3001/api
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_SUPABASE_URL=https://dev-projekt.supabase.co
# ... weitere Test-Keys
```

#### Production
Setze diese Environment Variables in deinem Hosting-Provider (Vercel, Netlify, etc.):
```bash
VITE_API_URL=https://deine-live-domain.de/api
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx  
VITE_SUPABASE_URL=https://prod-projekt.supabase.co
# ... weitere Production-Keys
```

### 2. Backend (API Server)

#### Lokale Entwicklung
`api-server/.env`:
```bash
# Lokale MySQL Datenbank
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=dein_lokales_passwort
DB_NAME=versicherungs_app_dev
DB_PORT=3306

PORT=3001
JWT_SECRET=dein-entwicklungs-secret
```

#### Production
Setze diese Variables auf deinem Server:
```bash
# Production MySQL Datenbank
DB_HOST=deine-db-host.com
DB_USER=prod_user
DB_PASSWORD=sicheres_production_passwort
DB_NAME=versicherungs_app_prod
DB_PORT=3306

PORT=3001
JWT_SECRET=sehr-sicheres-production-secret
```

## Deployment Steps

### Frontend Deployment (z.B. Vercel)

1. Push Code zu GitHub
2. Vercel mit GitHub verbinden
3. Environment Variables in Vercel Dashboard setzen:
   - Gehe zu Settings → Environment Variables
   - Füge alle `VITE_*` Variables für Production hinzu
   - Deploy

### Backend Deployment

1. Server vorbereiten (Node.js, MySQL installieren)
2. Code deployen
3. Environment Variables setzen (`.env.production` oder System Variables)
4. PM2 für Process Management:
   ```bash
   pm2 start api-server/server.js --name api-server
   ```

## Wichtige Hinweise

⚠️ **NIEMALS .env Dateien committen!** Diese sind in `.gitignore` aufgelistet.

✅ **Environment Variables Checklist:**
- [ ] Alle API Keys sind in Environment Variables
- [ ] Unterschiedliche Keys für Dev/Prod
- [ ] Datenbank-Credentials sind sicher
- [ ] JWT Secret ist stark und einzigartig

## Testing

Nach dem Deployment:
1. Teste die API-Verbindung
2. Prüfe Clerk Authentication
3. Teste Datenbankverbindung
4. Verifiziere alle externen APIs