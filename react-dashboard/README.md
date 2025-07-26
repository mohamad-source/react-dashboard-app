# React Dashboard - Lokales Setup Tutorial

Ein modernes, responsives Dashboard mit Clerk.com Authentifizierung, Multi-Step Forms und Profilverwaltung.

## 🚀 Live Demo

**Dashboard URL:** https://same-6cnbnw4hlrd-latest.netlify.app

## ✨ Features

- 🔐 **Clerk.com Authentifizierung** - E-Mail + Passwort mit E-Mail-Verifizierung
- 👤 **Rollenbasiertes System** - Admin und User Rollen
- 📊 **Responsive Dashboard** - Mit auf-/zuklappbarer Sidebar
- 📁 **Multi-Step Form (Akten)** - 5 Schritte mit Formular-Validierung
- 🎨 **Custom Design** - Montserrat Font, #447dda Primärfarbe
- 🌍 **Deutsche Lokalisierung** - Vollständig auf Deutsch
- 📱 **Mobile Optimiert** - Responsive für alle Geräte

## 🛠️ Tech Stack

- **React 18** + TypeScript
- **Vite** als Build Tool
- **Tailwind CSS** + shadcn/ui Komponenten
- **Clerk.com** für Authentifizierung
- **React Router v7** für Navigation
- **Bun** als Package Manager

## 📋 Voraussetzungen

1. **Node.js 18+** installiert
2. **Bun** Package Manager installiert (`npm install -g bun`)
3. **Git** installiert
4. **Clerk.com Account** (kostenlos)

## 🔧 Lokales Setup

### 1. Repository klonen

```bash
git clone <your-git-repo-url>
cd react-dashboard
```

### 2. Dependencies installieren

```bash
bun install
```

### 3. Clerk.com Setup

#### a) Clerk Account erstellen
1. Gehe zu [clerk.com](https://clerk.com)
2. Erstelle ein kostenloses Konto
3. Erstelle eine neue Anwendung

#### b) Authentifizierung konfigurieren
1. **User & Authentication** → **Email, Phone, Username**
   - Aktiviere **Email address** (Required)
2. **User & Authentication** → **Authentication strategies**
   - Aktiviere **Password**
3. **User & Authentication** → **Email, Phone, Username**
   - Aktiviere **Require verification**

#### c) API-Schlüssel kopieren
1. Gehe zu **Developers** → **API Keys**
2. Kopiere **Publishable Key** und **Secret Key**

### 4. Environment Variables setzen

Erstelle eine `.env.local` Datei im Projektordner:

```env
# Clerk Configuration
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

**⚠️ Wichtig:** Ersetze die Platzhalter mit deinen echten Clerk API-Schlüsseln!

### 5. Development Server starten

```bash
bun run dev
```

Das Dashboard ist jetzt unter **http://localhost:5173** verfügbar.

### 6. Admin-Rolle einrichten (Optional)

Um Admin-Berechtigung zu erhalten:

1. Registriere dich im Dashboard
2. Gehe zu deinem Clerk Dashboard → **Users**
3. Wähle deinen Benutzer aus
4. Gehe zu **Metadata** → **Public metadata**
5. Füge hinzu:
```json
{
  "role": "admin"
}
```
6. Speichern und neu anmelden

## 📱 Features im Detail

### 🔐 Authentifizierung
- **Login/Registrierung** nur mit E-Mail + Passwort
- **E-Mail-Verifizierung** erforderlich
- **Deutsche Lokalisierung** aller Clerk-Texte
- **Rollenbasierte Zugriffskontrolle**

### 📊 Dashboard
- **Willkommensbereich** mit Benutzerinformationen
- **Statistik-Cards** mit persönlichen Daten
- **Schnellzugriff** auf alle Hauptfunktionen
- **Responsive Sidebar** mit Navigation

### 👤 Profilverwaltung
- **Profil anzeigen** - Alle Benutzerinformationen
- **Profil bearbeiten** - Name und Profilbild ändern
- **E-Mail-Status** und Verifizierung anzeigen

### 📁 Akten-System (Multi-Step Form)
- **5-Schritte-Formular:**
  1. **Kundendaten** - Persönliche Informationen
  2. **Abtretung** - Abtretungserklärung und Dokumente
  3. **Bilder** - Foto-Dokumentation
  4. **Kalkulation** - Kostenberechnung
  5. **Dokumentation** - Abschließende Berichte
- **Intelligente Validierung** - Nur ausgefüllte Schritte sind zugänglich
- **Fortschrittsanzeige** mit visueller Navigation
- **Responsive Design** für alle Geräte

## 🎨 Design-Eigenschaften

- **Montserrat Font** als primäre Schriftart
- **#447dda** als Primärfarbe mit Gradienten
- **#666** als Textfarbe für optimale Lesbarkeit
- **Card-basiertes Layout** mit Schatten und Animationen
- **Konsistente Spacing** und moderne UI-Komponenten

## 🔄 Development Workflow

### Entwicklung starten
```bash
bun run dev
```

### Code formatieren
```bash
bun run format
```

### Linting
```bash
bun run lint
```

### Build für Production
```bash
bun run build
```

### Preview des Builds
```bash
bun run preview
```

## 📦 Deployment

Das Projekt ist für **Netlify** optimiert:

1. **Build Command:** `bun run build`
2. **Publish Directory:** `dist`
3. **Node Version:** 18 oder höher

### Environment Variables für Deployment:
```
VITE_CLERK_PUBLISHABLE_KEY=your_publishable_key
```

## 🗂️ Projektstruktur

```
src/
├── components/
│   ├── Dashboard.tsx          # Hauptseite
│   ├── DashboardLayout.tsx    # Layout mit Sidebar
│   ├── Profile.tsx            # Profil anzeigen
│   ├── EditProfile.tsx        # Profil bearbeiten
│   ├── Files.tsx              # Multi-Step Form
│   └── ui/                    # shadcn/ui Komponenten
├── App.tsx                    # Routing
├── main.tsx                   # App Entry Point
└── index.css                  # Globale Styles
```

## 🚀 Erweiterte Funktionen

Das Dashboard ist erweiterbar für:
- **File Upload System**
- **Dashboard Analytics**
- **Dark/Light Mode**
- **E-Mail Integration**
- **PDF Export**
- **Benachrichtigungssystem**

## 🐛 Troubleshooting

### Problem: "Missing Publishable Key"
**Lösung:** Überprüfe deine `.env.local` Datei und stelle sicher, dass die Clerk-Keys korrekt gesetzt sind.

### Problem: Login funktioniert nicht
**Lösung:** Stelle sicher, dass in Clerk.com E-Mail + Passwort aktiviert ist.

### Problem: Build-Fehler
**Lösung:** Führe `bun install` erneut aus und prüfe die Konsole auf Fehler.

## 📞 Support

- **Clerk Dokumentation:** [docs.clerk.com](https://docs.clerk.com)
- **Shadcn/ui Komponenten:** [ui.shadcn.com](https://ui.shadcn.com)
- **Tailwind CSS:** [tailwindcss.com](https://tailwindcss.com)

## 📄 Lizenz

MIT License - Frei für kommerzielle und private Nutzung.

---

**🎉 Viel Erfolg mit deinem Dashboard!**

Entwickelt mit ❤️ für moderne Web-Anwendungen.
