# 🚀 EasyGlas Dashboard

## Schnellstart - Lokales Testen

### 1. Dependencies installieren
```bash
npm run install:all
```

### 2. Development starten (Frontend + Backend)
```bash
npm run dev
```

**Das startet:**
- Backend: http://localhost:3001
- Frontend: http://localhost:3000
- Beide automatisch mit Reload

### 3. Nur Backend starten
```bash
npm run dev:api
```

### 4. Nur Frontend starten
```bash
npm run dev:frontend
```

## 🛡️ Security Features

Nach dem Start siehst du:
```
🚀 API Server running on all interfaces:3001
🛡️ Security features enabled:
  ✅ CORS protection
  ✅ Rate limiting
  ✅ Input validation
  ✅ Security headers
  ✅ Enhanced logging
  ✅ Database encryption: enabled
  ✅ Security monitoring
  ✅ Authentication: REQUIRED (strict mode)
```

## 🧪 Testen

### Security Status prüfen
```bash
curl http://localhost:3001/security-status
```

### API ohne Token (sollte 401 geben)
```bash
curl http://localhost:3001/api/akten
# {"error":"Authentication required","code":"MISSING_TOKEN"}
```

### Logs überwachen
```bash
# Terminal 2:
tail -f api-server/logs/combined.log

# Terminal 3:
tail -f api-server/logs/security.log
```

## 📁 Projekt-Struktur

```
├── package.json              # Root - Deployment Scripts
├── api-server/               # Backend (Express + MySQL)
│   ├── server.js            # Main Server
│   ├── middleware/          # Security Middleware
│   ├── services/            # Business Logic
│   ├── utils/               # Crypto & Logging
│   └── logs/                # Security & Error Logs
└── react-dashboard/         # Frontend (React + Clerk)
    ├── src/hooks/           # useAktenApi Hook
    └── src/lib/             # API Client
```

## 🔐 Authentication

**WICHTIG:** Alle API-Endpunkte benötigen jetzt Clerk-Tokens!

### Frontend Migration
```tsx
// Alt:
import { aktenApi } from '../lib/aktenApi'
const akten = await aktenApi.getAkten()

// Neu:
import { useAktenApi } from '../hooks/useAktenApi'
function Component() {
  const aktenApi = useAktenApi()
  const akten = await aktenApi.getAkten() // Automatisch mit Token
}
```

## 🚀 Production Deployment

### Environment Setup
```bash
# Production .env Files sind bereit:
# api-server/.env.production
# react-dashboard/.env.production
```

### Production Start
```bash
NODE_ENV=production npm run production
```

## 📊 Monitoring

- **Logs:** `api-server/logs/`
- **Security:** `GET /security-status` (Development only)
- **Health:** `GET /health`

## 🛠️ Scripts Übersicht

```bash
npm run dev              # Development: Frontend + Backend
npm run build            # Production Build
npm run start            # Production: Frontend + Backend
npm run install:all      # Alle Dependencies installieren
npm run clean            # Alle node_modules löschen
npm run reset            # Clean + Install
```

## 🔥 Ready to go!

1. `npm run install:all`
2. `npm run dev`
3. Öffne http://localhost:3000
4. Melde dich mit Clerk an
5. Prüfe dass API-Calls funktionieren

**Das System ist Enterprise-ready mit voller Sicherheit!** 🛡️