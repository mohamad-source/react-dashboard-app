const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
const { PDFDocument } = require('pdf-lib');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();

// Enhanced Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'"],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true
}));

// Additional security headers
app.use((req, res, next) => {
  // Hide server information
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'SecureServer/1.0');
  
  // Additional security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Max 100 requests pro IP
  message: {
    error: 'Zu viele Anfragen von dieser IP, bitte später versuchen.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Nur 10 requests für kritische Endpoints
  message: {
    error: 'Zu viele Anfragen für diese Aktion, bitte später versuchen.'
  }
});

app.use('/api/', limiter);

// Validation Error Handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validierungsfehler',
      details: errors.array()
    });
  }
  next();
};

// CORS Sicherheitskonfiguration
const isDevelopment = process.env.NODE_ENV !== 'production'
const allowedOrigins = isDevelopment 
  ? ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000']
  : ['https://inteliexpert.de', 'https://www.inteliexpert.de', 'http://localhost:3001']

app.use(cors({
  origin: function (origin, callback) {
    // In development, allow localhost origins
    if (isDevelopment && (!origin || allowedOrigins.includes(origin))) {
      return callback(null, true);
    }
    
    // In production, strictly validate origin
    if (!isDevelopment) {
      if (!origin) {
        return callback(new Error('Origin header ist erforderlich'), false);
      }
      
      if (!allowedOrigins.includes(origin)) {
        console.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error('Nicht durch CORS-Policy erlaubt'), false);
      }
    }
    
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
  maxAge: 86400 // Cache preflight requests for 24 hours
}));
app.use(express.json());
app.use('/api/zonline', express.text({ 
  type: ['application/xml', 'text/xml'], 
  limit: '1mb' 
}));
app.use(express.text({ type: 'text/plain' }));

class DATService {
  constructor() {
    this.customerNumber = process.env.DAT_CUSTOMER_NUMBER || ""
    this.user = process.env.DAT_USER || ""
    this.password = process.env.DAT_PASSWORD || ""
    this.interfacePartnerNumber = process.env.DAT_INTERFACE_PARTNER_NUMBER || ""
    this.interfacePartnerSignature = process.env.DAT_INTERFACE_PARTNER_SIGNATURE || ""
    this.token = null
  }

  async authenticate() {
    const payload = JSON.stringify({
      "action": "generateToken",
      "customerNumber": this.customerNumber,
      "user": this.user,
      "password": this.password,
      "interfacePartnerNumber": this.interfacePartnerNumber,    
      "interfacePartnerSignature": this.interfacePartnerSignature, 
      "productVariant": "calculateExpert"                      
    })

    try {
      const response = await fetch('https://www.dat.de/AuthorizationManager/service--/endpoint/tokenService', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'payload=' + encodeURIComponent(payload)
      })

      if (response.ok) {
        this.token = (await response.text()).replace(/"/g, '').trim()
        return true
      }
      return false
    } catch (error) {
      console.error('Auth error:', error)
      return false
    }
  }

  async fullProcessWithDB(contractID, akteId) {
    try {
      if (!await this.authenticate()) {
        return { success: false, message: 'Authentication failed' }
      }

      const calcResult = await this.calculateContract(contractID)
      
      if (!calcResult.success) {
        return { success: false, message: 'Calculation failed' }
      }

      const pdfResult = await this.exportToPDF(contractID)
      
      let pdfBlob = null
      if (pdfResult.success && pdfResult.pdf_base64) {
        pdfBlob = Buffer.from(pdfResult.pdf_base64, 'base64')
      }

      const filename = `Kalkulation_${contractID}_${Date.now()}.pdf`
      
      const [result] = await db.execute(
        `INSERT INTO dat_kalkulationen (akte_id, filename, brutto, netto, pdf_blob) 
        VALUES (?, ?, ?, ?, ?)`,
        [akteId, filename, 1500.00, 1260.50, pdfBlob]
      )

      return {
        success: true,
        saved_data: { id: result.insertId }
      }

    } catch (error) {
      console.error('DAT Process ERROR:', error)
      return { success: false, message: error.message }
    }
  }

  async calculateContract(contractID) {
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:veh="http://sphinx.dat.de/services/VehicleRepairService">
        <soapenv:Header>
            <DAT-AuthorizationToken>${this.token}</DAT-AuthorizationToken>
        </soapenv:Header>
        <soapenv:Body>
            <veh:calculateContract>
                <request>
                    <contractID>${contractID}</contractID>
                </request>
            </veh:calculateContract>
        </soapenv:Body>
    </soapenv:Envelope>`

    try {
      const response = await fetch('https://www.dat.de/VehicleRepairOnline/services/VehicleRepairService', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'calculateContract',
          'DAT-AuthorizationToken': this.token
        },
        body: soapEnvelope
      })

      return {
        success: response.ok,
        response: await response.text()
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async exportToPDF(dossierID) {
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:veh="http://sphinx.dat.de/services/VehicleRepairService">
        <soapenv:Header>
            <DAT-AuthorizationToken>${this.token}</DAT-AuthorizationToken>
        </soapenv:Header>
        <soapenv:Body>
            <veh:exportDossierToDocument>
                <dossierID>${dossierID}</dossierID>
                <locale country="DE" datCountryIndicator="DE" language="de"/>
                <format>PDF</format>
                <product>VRO_CALC_RESULT</product>
                <printProduct>calculation</printProduct>
            </veh:exportDossierToDocument>
        </soapenv:Body>
    </soapenv:Envelope>`

    try {
      const response = await fetch('https://www.dat.de/VehicleRepairOnline/services/VehicleRepairService', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'exportDossierToDocument',
          'DAT-AuthorizationToken': this.token
        },
        body: soapEnvelope
      })

      if (response.ok) {
        const responseText = await response.text()
        const match = responseText.match(/<exportDocument>(.*?)<\/exportDocument>/s)
        if (match) {
          return {
            success: true,
            pdf_base64: match[1].trim()
          }
        }
      }

      return { success: false }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

app.use('/public', express.static(path.join(__dirname, '..', 'react-dashboard', 'public')));

// Optimized Database Connection Pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  connectionLimit: 20, // Max 20 gleichzeitige Verbindungen
  acquireTimeout: 60000, // 60s timeout für neue Verbindungen
  timeout: 60000, // 60s query timeout
  reconnect: true,
  charset: 'utf8mb4',
  timezone: 'Z',
  queueLimit: 0,
  dateStrings: true,
  // Weitere Optimierungen
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: false, // Sicherheit
  typeCast: true
});

// Connection Pool Event Handlers
db.on('connection', function (connection) {
  console.log('DB Connection established as id ' + connection.threadId);
});

db.on('error', function(err) {
  console.error('Database error: ', err);
  if(err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection lost, attempting to reconnect...');
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const akteId = req.params.id;
    const uploadPath = path.join(__dirname, '..', 'react-dashboard', 'public', 'akte_bilder', `akte_${akteId}`);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `bild_${uniqueSuffix}${ext}`);
  }
});

// Enhanced file upload security
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10 // Max 10 files per request
  },
  fileFilter: function (req, file, cb) {
    // Check MIME type
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Nur JPEG, PNG, GIF und WebP Dateien sind erlaubt!'), false);
    }
    
    // Check file extension
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowedExts.includes(ext)) {
      return cb(new Error('Unerlaubte Dateiendung!'), false);
    }
    
    // Additional security: Check for null bytes (security bypass attempt)
    if (file.originalname.includes('\0')) {
      return cb(new Error('Ungültiger Dateiname!'), false);
    }
    
    cb(null, true);
  }
});

// Authentication middleware using Clerk
const authenticateUser = async (req, res, next) => {
  try {
    // Skip auth for health check
    if (req.path === '/api/health') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentifizierung erforderlich',
        code: 'UNAUTHORIZED' 
      });
    }

    const token = authHeader.substring(7);
    
    // Validate Clerk JWT token
    if (!token || token.length < 10) {
      return res.status(401).json({ 
        error: 'Ungültiger Token',
        code: 'INVALID_TOKEN'
      });
    }

    // For development/testing, accept a simple check
    // In production, this should validate the actual Clerk JWT
    if (token === 'development-token' && process.env.NODE_ENV === 'development') {
      req.userId = 'dev-user';
      return next();
    }

    // TODO: Add proper Clerk JWT validation here
    // const payload = jwt.verify(token, process.env.CLERK_SECRET_KEY);
    // req.userId = payload.sub;
    
    // For now, reject all requests without proper setup
    return res.status(401).json({ 
      error: 'Authentication setup required',
      code: 'AUTH_NOT_CONFIGURED'
    });
    
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ 
      error: 'Authentifizierung fehlgeschlagen',
      code: 'AUTH_ERROR'
    });
  }
};

// Input validation middleware
const validateAkteInput = [
  body('kunde').trim().isLength({ min: 1, max: 100 }).escape().withMessage('Kunde ist erforderlich (max. 100 Zeichen)'),
  body('kennzeichen').trim().isLength({ min: 2, max: 12 }).matches(/^[A-Z0-9\-\s]+$/i).withMessage('Ungültiges Kennzeichen'),
  body('schadenort').trim().isLength({ min: 1, max: 200 }).escape().withMessage('Schadenort ist erforderlich'),
  body('adresse1').optional().trim().isLength({ max: 200 }).escape(),
  body('adresse2').optional().trim().isLength({ max: 200 }).escape(),
  body('schadentag').optional().isISO8601().withMessage('Ungültiges Datum'),
  body('versicherungsnummer').optional().trim().isLength({ max: 50 }).escape(),
  body('vin').optional().trim().isLength({ min: 0, max: 17 }).matches(/^[A-HJ-NPR-Z0-9]*$/i).withMessage('Ungültige VIN'),
];

// Apply authentication to all /api/* routes except health check
app.use('/api', authenticateUser);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/akten', async (req, res) => {
  try {
    await db.execute('SELECT 1')
    
    const [tableCheck] = await db.execute('SHOW TABLES LIKE "akte"')
    
    if (tableCheck.length === 0) {
      throw new Error('Tabelle "akte" existiert nicht')
    }
    
    const [rows] = await db.execute('SELECT * FROM akte ORDER BY erstellt_am DESC')
    
    res.json(rows)
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      code: error.code 
    })
  }
})

app.post('/api/akten', validateAkteInput, handleValidationErrors, async (req, res) => {
  try {
    const data = req.body
    
    const plzStadt = data.adresse2 || ""
    const plz = plzStadt.split(' ')[0] || ""
    const stadt = plzStadt.substring(plz.length).trim() || ""
    
    const [result] = await db.execute(
      `INSERT INTO akte (kunde, kennzeichen, schadenort, fahrzeugtyp, plz, stadt, 
       schadentag, schadennummer, versicherungsnummer, selbstbeteiligung, vin, scheibe, 
       auftragstyp, vorsteuer_berechtigt, status, erstellt_am) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Entwurf', NOW())`,
      [
        data.kunde, 
        data.kennzeichen, 
        data.schadenort, 
        data.fahrzeugtyp, 
        plz,
        data.adresse1,
        data.schadentag, 
        data.schadennummer, 
        data.versicherungsnummer, 
        data.selbstbeteiligung, 
        data.vin, 
        data.scheibe, 
        data.auftragstyp, 
        data.vorsteuer_berechtigt
      ]
    )
    
    res.json({ id: result.insertId, success: true })
  } catch (error) {
    console.error('Create akte error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/akten/:id', async (req, res) => {
  try {
    const akteId = req.params.id
    const data = req.body

    const values = [
      data.kunde, data.kennzeichen, data.schadenort, data.fahrzeugtyp, 
      data.adresse1,
      data.adresse2,
      data.schadentag, data.schadennummer, 
      data.versicherungsnummer, data.selbstbeteiligung, data.vin, 
      data.scheibe, data.auftragstyp, data.vorsteuer_berechtigt, akteId
    ]
    
    const [result] = await db.execute(
      `UPDATE akte SET kunde=?, kennzeichen=?, schadenort=?, fahrzeugtyp=?, plz=?, stadt=?, 
       schadentag=?, schadennummer=?, versicherungsnummer=?, selbstbeteiligung=?, vin=?, 
       scheibe=?, auftragstyp=?, vorsteuer_berechtigt=?, bearbeitet_am=NOW() WHERE id=?`,
      values
    )
    
    res.json({ success: true })
  } catch (error) {
    console.error('Update akte error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/akten/:id', async (req, res) => {
  try {
    const akteId = req.params.id
    
    const [rows] = await db.execute('SELECT * FROM akte WHERE id = ?', [akteId])
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Akte nicht gefunden' })
    }
    
    const akte = rows[0]
    
    if (akte.abtretung_signiert && akte.pdf_data) {
      try {
        const pdfBuffer = Buffer.from(akte.pdf_data, 'binary')
        
        akte.abtretung_data = {
          mobilnr: '',
          versicherungsname: '',
          marke: '',
          modell: '',
          kasko: false,
          haftpflicht: false,
          kundenname: akte.kunde,
          adresse: `${akte.plz || ''} ${akte.stadt || ''}`.trim(),
          versicherungsschein: akte.versicherungsnummer,
          schadennummer: akte.schadennummer,
          selbstbeteiligung: akte.selbstbeteiligung,
          vorsteuer: akte.vorsteuer_berechtigt === 'Ja' ? 'ja' : 'nein',
          kennzeichen: akte.kennzeichen,
          schadenzeitpunkt: akte.schadentag,
          schadenbeschreibung: akte.schadenort,
          signatureData: `data:image/png;base64,${Buffer.from(akte.signature_data).toString('base64')}`,
          isSignatureApplied: true
        }
      } catch (error) {
        console.error('Error loading Abtretungsdaten:', error)
      }
    }
    
    res.json(akte)
  } catch (error) {
    console.error('Get akte error:', error)
    res.status(500).json({ error: error.message })
  }
})

function generateAbtretungsPDF(akte, formData, signatureBuffer) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(0, 102, 204);
  doc.text('AutoGlasNeu', 120, 20);
  
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('AUTOGLASNEU', 120, 30);
  doc.text('FRANZ-KREUTER-STR. 2', 120, 35);
  doc.text('50823 KÖLN (Ehrenfeld)', 120, 40);
  doc.text('TEL.: 0221 / 55 00 116', 120, 45);
  doc.text('FAX: 0221 / 55 00 115', 120, 50);
  doc.text('WEBSITE: www.autoglasneu.de', 120, 55);
  doc.text(`MAIL: ${process.env.COMPANY_EMAIL || 'info@autoglasneu.de'}`, 120, 60);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 102, 204);
  doc.text('ABTRETUNGSERKLÄRUNG', 20, 80);
  
  doc.rect(15, 90, 180, 160);
  
  let y = 100;
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('1. Kunde / Versicherungsnehmer', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`Vor/Nachname: ${akte.kunde}`, 20, y);
  doc.text(`Mobilnr: ${formData.mobilnr}`, 120, y);
  y += 8;
  
  doc.text(`Straße PLZ / Ort: ${akte.plz || ''} ${akte.stadt || ''}`, 20, y);
  y += 15;
  
  doc.setFontSize(12);
  doc.text('2. Versicherung', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`VersicherungsscheinNr.: ${akte.versicherungsnummer}`, 20, y);
  doc.text(`Schadennummer: ${formData.schadennummer}`, 120, y);
  y += 8;
  
  doc.text(`Versicherungsname: ${formData.versicherungsname}`, 20, y);
  doc.text(`Selbstbeteiligung: ${formData.selbstbeteiligung} EUR`, 120, y);
  y += 8;
  
  const vorsteuers = formData.vorsteuer === 'ja' ? '[X] ja   [ ] nein' : '[ ] ja   [X] nein';
  doc.text(`Vorsteurabzugsberechtigt: ${vorsteuers}`, 20, y);
  y += 15;
  
  doc.setFontSize(12);
  doc.text('3. Fahrzeug/Schadenbereich', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`Marke: ${formData.marke}`, 20, y);
  y += 6;
  doc.text(`Modell: ${formData.modell}`, 20, y);
  y += 6;
  doc.text(`Kennzeichen: ${akte.kennzeichen}`, 20, y);
  doc.text(`Schadenzeitpunkt: ${formData.schadenzeitpunkt}`, 120, y);
  y += 6;
  doc.text(`Schadenbeschreibung: ${formData.schadenbeschreibung}`, 20, y);
  y += 15;
  
  doc.text('Hiermit trete ich meinen Schadenersatzanspruch / Leistungsanspruch', 20, y);
  y += 8;
  
  const kaskoCheck = formData.kasko ? '[X]' : '[ ]';
  doc.text(`${kaskoCheck} Gegen meine Kaskoversicherung`, 20, y);
  y += 6;
  
  const haftpflichtCheck = formData.haftpflicht ? '[X]' : '[ ]';
  doc.text(`${haftpflichtCheck} Gegen die Haftpflichtversicherung des Unfallgegners`, 20, y);
  y += 10;
  
  doc.text('In Höhe der Reparaturkosten zur Sicherung des Anspruchs auf', 20, y);
  y += 6;
  doc.text('Bezahlung der Reparaturkosten von voraussichtlich (siehe Rechnung)', 20, y);
  y += 6;
  doc.text('unwiderruflich an die oben genannte Werkstatt ab.', 20, y);
  y += 20;
  
  doc.text('Unterschrift VN:', 20, y);
  
  if (signatureBuffer) {
    try {
      const signatureBase64 = `data:image/png;base64,${signatureBuffer.toString('base64')}`;
      doc.addImage(signatureBase64, 'PNG', 60, y - 15, 60, 20);
    } catch (error) {
      console.error('Error inserting signature:', error);
    }
  }
  
  doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}`, 120, 280);
  
  return doc.output('arraybuffer');
}

app.post('/api/akten/:id/abtretung', async (req, res) => {
  try {
    const akteId = req.params.id
    const { signature, formData } = req.body
    
    if (!signature || !signature.includes('data:image/png;base64,')) {
      throw new Error('Ungültige Unterschrift')
    }
    
    const signatureData = signature.replace('data:image/png;base64,', '')
    const signatureBuffer = Buffer.from(signatureData, 'base64')
    
    const [akteRows] = await db.execute('SELECT * FROM akte WHERE id = ?', [akteId])
    if (akteRows.length === 0) {
      throw new Error('Akte nicht gefunden')
    }
    
    const akte = akteRows[0]
    
    const pdfBuffer = generateAbtretungsPDF(akte, formData, signatureBuffer)
    
    const [result] = await db.execute(
      'UPDATE akte SET abtretung_signiert = 1, signiert_am = NOW(), signature_data = ?, pdf_data = ? WHERE id = ?',
      [signatureBuffer, Buffer.from(pdfBuffer), akteId]
    )
    
    if (result.affectedRows === 0) {
      throw new Error('Akte nicht gefunden')
    }
    
    res.json({ 
      success: true, 
      message: 'Abtretung erfolgreich gespeichert',
      akteId: parseInt(akteId)
    })
    
  } catch (error) {
    console.error('Abtretung error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/akten/:id/pdf', async (req, res) => {
  try {
    const akteId = req.params.id
    
    const [rows] = await db.execute('SELECT pdf_data, kunde FROM akte WHERE id = ? AND abtretung_signiert = 1', [akteId])
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'PDF nicht gefunden' })
    }
    
    const akte = rows[0]
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="Abtretung_${akte.kunde}_${akteId}.pdf"`)
    res.send(akte.pdf_data)
    
  } catch (error) {
    console.error('PDF download error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/akten/:id/bilder', async (req, res) => {
  try {
    const akteId = req.params.id
    
    const [rows] = await db.execute(
      'SELECT * FROM akte_bilder WHERE akte_id = ? ORDER BY upload_date DESC',
      [akteId]
    );
    
    res.json({
      success: true,
      bilder: rows
    })
  } catch (error) {
    console.error('Error loading images:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.post('/api/akten/:id/bilder', upload.array('images[]', 10), async (req, res) => {
  try {
    const akteId = req.params.id
    const files = req.files

    if (!files || files.length === 0) {
      throw new Error('Keine Dateien hochgeladen')
    }

    const [akteRows] = await db.execute('SELECT id FROM akte WHERE id = ?', [akteId])
    if (akteRows.length === 0) {
      throw new Error('Akte nicht gefunden')
    }

    let uploadedCount = 0
    
    for (const file of files) {
      try {
        await db.execute(
          `INSERT INTO akte_bilder 
           (akte_id, filename, original_name, file_size, mime_type, upload_date) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [akteId, file.filename, file.originalname, file.size, file.mimetype]
        )
        uploadedCount++
      } catch (dbError) {
        console.error('DB error for file:', file.filename, dbError)
        try {
          fs.unlinkSync(file.path)
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError)
        }
      }
    }

    res.json({ 
      success: true, 
      message: `${uploadedCount} Bilder erfolgreich hochgeladen`,
      uploaded_count: uploadedCount
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path)
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError)
        }
      })
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.delete('/api/akten/:id/bilder/:bildId', async (req, res) => {
  try {
    const { id: akteId, bildId } = req.params
    
    const [rows] = await db.execute(
      'SELECT * FROM akte_bilder WHERE id = ? AND akte_id = ?',
      [bildId, akteId]
    )
    
    if (rows.length === 0) {
      throw new Error('Bild nicht gefunden')
    }
    
    const bild = rows[0]
    
    const filePath = path.join(__dirname, 'public', 'akte_bilder', `akte_${akteId}`, bild.filename)
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (fileError) {
      console.error('Error deleting file:', fileError)
    }
    
    await db.execute('DELETE FROM akte_bilder WHERE id = ?', [bildId])
    
    res.json({ 
      success: true,
      message: 'Bild erfolgreich gelöscht'
    })
  } catch (error) {
    console.error('Delete image error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.delete('/api/akten/:id', async (req, res) => {
  try {
    const akteId = req.params.id
    
    const [checkRows] = await db.execute('SELECT id FROM akte WHERE id = ?', [akteId])
    if (checkRows.length === 0) {
      return res.status(404).json({ error: 'Akte nicht gefunden' })
    }
    
    try {
      await db.execute('DELETE FROM akte_bilder WHERE akte_id = ?', [akteId])
      
      const bildOrdner = path.join(__dirname, '..', 'react-dashboard', 'public', 'akte_bilder', `akte_${akteId}`)
      
      if (fs.existsSync(bildOrdner)) {
        fs.rmSync(bildOrdner, { recursive: true, force: true })
      }
    } catch (bildError) {
      console.error('Error deleting images:', bildError)
    }
    
    const [result] = await db.execute('DELETE FROM akte WHERE id = ?', [akteId])
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Akte nicht gefunden' })
    }
    
    res.json({ 
      success: true, 
      message: 'Akte erfolgreich gelöscht',
      deletedId: parseInt(akteId)
    })
    
  } catch (error) {
    console.error('Delete akte error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.post('/api/akten/:id/kalkulation', upload.none(), async (req, res) => {
  try {
    const akteId = req.params.id
    const { action, az } = req.body
    
    const datService = new DATService()
    const result = await datService.fullProcessWithDB(az, akteId)
    
    if (result.success) {
      await db.execute(
        'UPDATE akte SET az = ?, bearbeitet_am = NOW() WHERE id = ?',
        [az, akteId]
      )
      
      res.json({ 
        success: true, 
        message: 'Kalkulation erfolgreich erstellt!',
        id: result.saved_data.id
      })
    } else {
      res.json({ 
        success: false, 
        message: 'Fehler beim Erstellen der Kalkulation.'
      })
    }
    
  } catch (error) {
    console.error('Kalkulation error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/akten/:id/kalkulationen', async (req, res) => {
  try {
    const akteId = req.params.id
    
    const [rows] = await db.execute(
      'SELECT * FROM dat_kalkulationen WHERE akte_id = ? ORDER BY erstellt_am DESC', 
      [akteId]
    )
    
    res.json({
      success: true,
      kalkulationen: rows
    })
    
  } catch (error) {
    console.error('Get kalkulationen error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/akten/:id/dokumentation', upload.none(), async (req, res) => {
  try {
    const akteId = req.params.id
    const { selected_kalkulation_id } = req.body
    
    const pdf_sections = req.body['pdf_sections[]'] || req.body['pdf_sections'] || []
    
    const [akteRows] = await db.execute('SELECT * FROM akte WHERE id = ?', [akteId])
    if (akteRows.length === 0) {
      throw new Error('Akte nicht gefunden')
    }
    const akte = akteRows[0]
    
    const doc = new jsPDF()
    let yPos = 20
    let pageCount = 1
    
    doc.setFontSize(20)
    doc.setTextColor(0, 102, 204)
    doc.text('Akte Dokumentation', 20, yPos)
    yPos += 10
    
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(`Akte-ID: ${akteId}`, 20, yPos)
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}`, 120, yPos)
    yPos += 20
    
    if (pdf_sections.includes('kundendaten')) {
      if (pageCount > 1) {
        doc.addPage()
        yPos = 20
      }
      
      doc.setFontSize(18)
      doc.setTextColor(0, 102, 204)
      doc.text('Kundendaten', 20, yPos)
      yPos += 15
      
      doc.rect(15, yPos - 5, 180, 180)
      yPos += 5
      
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      
      const leftCol = 20
      const rightCol = 110
      let leftY = yPos
      let rightY = yPos
      
      doc.setFont('helvetica', 'bold')
      doc.text('Kunde:', leftCol, leftY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.kunde || '', leftCol + 30, leftY)
      leftY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Kennzeichen:', leftCol, leftY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.kennzeichen || '', leftCol + 30, leftY)
      leftY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Fahrzeugtyp:', leftCol, leftY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.fahrzeugtyp || '', leftCol + 30, leftY)
      leftY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('PLZ/Ort:', leftCol, leftY)
      doc.setFont('helvetica', 'normal')
      doc.text(`${akte.plz || ''} ${akte.stadt || ''}`, leftCol + 30, leftY)
      leftY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('VIN:', leftCol, leftY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.vin || '', leftCol + 30, leftY)
      leftY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Scheibe:', leftCol, leftY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.scheibe || '', leftCol + 30, leftY)
      leftY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Schadenort:', rightCol, rightY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.schadenort || '', rightCol + 35, rightY)
      rightY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Schadentag:', rightCol, rightY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.schadentag ? new Date(akte.schadentag).toLocaleDateString('de-DE') : '', rightCol + 35, rightY)
      rightY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Schadennummer:', rightCol, rightY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.schadennummer || '', rightCol + 35, rightY)
      rightY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Versicherung:', rightCol, rightY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.versicherungsnummer || '', rightCol + 35, rightY)
      rightY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Selbstbeteiligung:', rightCol, rightY)
      doc.setFont('helvetica', 'normal')
      doc.text(`${akte.selbstbeteiligung || ''} EUR`, rightCol + 35, rightY)
      rightY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Auftragstyp:', rightCol, rightY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.auftragstyp || '', rightCol + 35, rightY)
      rightY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('Vorsteuer:', rightCol, rightY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.vorsteuer_berechtigt || '', rightCol + 35, rightY)
      rightY += 8
      
      doc.setFont('helvetica', 'bold')
      doc.text('AZ:', rightCol, rightY)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.az || '', rightCol + 35, rightY)
      
      yPos = Math.max(leftY, rightY) + 15
      doc.setFont('helvetica', 'bold')
      doc.text('Status:', leftCol, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.status || '', leftCol + 30, yPos)
      
      doc.setFont('helvetica', 'bold')
      doc.text('Erstellt am:', rightCol, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(akte.erstellt_am ? new Date(akte.erstellt_am).toLocaleString('de-DE') : '', rightCol + 35, yPos)
      
      pageCount++
    }
    
    if (pdf_sections.includes('bilder')) {
      const [bilderRows] = await db.execute('SELECT * FROM akte_bilder WHERE akte_id = ? ORDER BY upload_date ASC', [akteId])
      
      if (bilderRows.length > 0) {
        doc.addPage()
        yPos = 20
        
        doc.setFontSize(18)
        doc.setTextColor(0, 102, 204)
        doc.text(`Schadenbilder (${bilderRows.length} Bilder)`, 20, yPos)
        yPos += 20
        
        let bildCounter = 0
        
        for (const bild of bilderRows) {
          const bildPath = path.join(__dirname, '..', 'react-dashboard', 'public', 'akte_bilder', `akte_${akteId}`, bild.filename)
          
          if (fs.existsSync(bildPath)) {
            try {
              if (bildCounter > 0 && bildCounter % 2 === 0) {
                doc.addPage()
                yPos = 20
                
                doc.setFontSize(16)
                doc.setTextColor(0, 102, 204)
                doc.text('Schadenbilder (Fortsetzung)', 20, yPos)
                yPos += 15
              }
              
              const imgData = fs.readFileSync(bildPath, { encoding: 'base64' })
              const imgFormat = path.extname(bild.filename).toLowerCase() === '.png' ? 'PNG' : 'JPEG'
              
              const isFirstImage = (bildCounter % 2 === 0)
              const imgY = isFirstImage ? yPos : yPos + 120
              
              doc.addImage(`data:image/${imgFormat.toLowerCase()};base64,${imgData}`, imgFormat, 20, imgY, 160, 100)
              
              doc.setFontSize(10)
              doc.setTextColor(0, 0, 0)
              doc.text(`${bild.original_name || bild.filename}`, 20, imgY + 110)
              doc.text(`Größe: ${(bild.file_size / 1024).toFixed(1)} KB | Hochgeladen: ${new Date(bild.upload_date).toLocaleString('de-DE')}`, 20, imgY + 115)
              
              bildCounter++
              
              if (!isFirstImage) {
                yPos += 240
              }
              
            } catch (imgError) {
              console.error('Error inserting image:', imgError)
              doc.setFontSize(10)
              doc.setTextColor(255, 0, 0)
              doc.text(`Bild konnte nicht geladen werden: ${bild.filename}`, 20, yPos)
              yPos += 10
            }
          } else {
            doc.setFontSize(10)
            doc.setTextColor(255, 0, 0)
            doc.text(`Bilddatei nicht gefunden: ${bild.filename}`, 20, yPos)
            yPos += 10
          }
        }
      } else {
        doc.addPage()
        yPos = 20
        
        doc.setFontSize(18)
        doc.setTextColor(0, 102, 204)
        doc.text('Schadenbilder', 20, yPos)
        yPos += 20
        
        doc.setFontSize(12)
        doc.setTextColor(255, 0, 0)
        doc.text('Keine Schadenbilder verfügbar', 20, yPos)
      }
    }
    
    let finalPdfBytes = new Uint8Array(doc.output('arraybuffer'))
    
    if (pdf_sections.includes('abtretung') && akte.abtretung_signiert && akte.pdf_data) {
      try {
        const PDFDocument = require('pdf-lib').PDFDocument
        
        const mainPdf = await PDFDocument.load(finalPdfBytes)
        
        const abtretungsPdf = await PDFDocument.load(akte.pdf_data)
        
        const abtretungsPages = await mainPdf.copyPages(abtretungsPdf, abtretungsPdf.getPageIndices())
        
        abtretungsPages.forEach((page) => mainPdf.addPage(page))
        
        finalPdfBytes = await mainPdf.save()
        
      } catch (abtError) {
        console.error('Error appending Abtretung PDF:', abtError)
        doc.addPage()
        doc.setFontSize(18)
        doc.setTextColor(0, 102, 204)
        doc.text('Abtretungserklärung', 20, 20)
        doc.setFontSize(12)
        doc.setTextColor(255, 0, 0)
        doc.text('Abtretungserklärung konnte nicht angehängt werden.', 20, 40)
        doc.text(`Unterschrieben am: ${akte.signiert_am ? new Date(akte.signiert_am).toLocaleString('de-DE') : ''}`, 20, 55)
        
        finalPdfBytes = new Uint8Array(doc.output('arraybuffer'))
      }
    }
    
    if (pdf_sections.includes('kalkulation') && selected_kalkulation_id) {
      const [kalkRows] = await db.execute('SELECT * FROM dat_kalkulationen WHERE id = ? AND akte_id = ?', [selected_kalkulation_id, akteId])
      
      if (kalkRows.length > 0 && kalkRows[0].pdf_blob) {
        try {
          const PDFDocument = require('pdf-lib').PDFDocument
          
          const mainPdf = await PDFDocument.load(finalPdfBytes)
          
          const kalkulationsPdf = await PDFDocument.load(kalkRows[0].pdf_blob)
          
          const kalkulationsPages = await mainPdf.copyPages(kalkulationsPdf, kalkulationsPdf.getPageIndices())
          
          kalkulationsPages.forEach((page) => {
            mainPdf.addPage(page)
          })
          
          finalPdfBytes = await mainPdf.save()
          
        } catch (kalkError) {
          console.error('Error appending DAT calculation:', kalkError)
          
          doc.addPage()
          doc.setFontSize(18)
          doc.setTextColor(0, 102, 204)
          doc.text('DAT-Kalkulation', 20, 20)
          doc.setFontSize(12)
          doc.setTextColor(0, 0, 0)
          doc.text(`Dateiname: ${kalkRows[0].filename}`, 20, 40)
          doc.text(`Brutto: ${kalkRows[0].brutto ? parseFloat(kalkRows[0].brutto).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : ''}`, 20, 55)
          doc.text(`Netto: ${kalkRows[0].netto ? parseFloat(kalkRows[0].netto).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : ''}`, 20, 70)
          doc.text(`Erstellt: ${kalkRows[0].erstellt_am ? new Date(kalkRows[0].erstellt_am).toLocaleString('de-DE') : ''}`, 20, 85)
          doc.setFontSize(10)
          doc.setTextColor(255, 0, 0)
          doc.text('Original DAT-PDF konnte nicht angehängt werden.', 20, 100)
          doc.text(`Fehler: ${kalkError.message}`, 20, 115)
          
          finalPdfBytes = new Uint8Array(doc.output('arraybuffer'))
        }
      }
    }
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="Dokumentation_Akte_${akteId}_${Date.now()}.pdf"`)
    res.send(Buffer.from(finalPdfBytes))
    
  } catch (error) {
    console.error('Dokumentation error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.patch('/api/akten/:id/status', async (req, res) => {
  try {
    const akteId = req.params.id
    const { status } = req.body
    
    const [result] = await db.execute(
      'UPDATE akte SET status = ?, bearbeitet_am = NOW() WHERE id = ?',
      [status, akteId]
    )
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Akte nicht gefunden' })
    }
    
    res.json({ 
      success: true, 
      message: `Status erfolgreich auf "${status}" geändert` 
    })
    
  } catch (error) {
    console.error('Status update error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/zonline', async (req, res) => {
  const net = require('net');
  
  try {
    let xmlRequest;
    
    if (typeof req.body === 'string') {
      xmlRequest = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      xmlRequest = req.body.toString('utf8');
    } else {
      throw new Error('Ungültiges Request-Format');
    }
    
    if (!xmlRequest || xmlRequest.trim() === '' || xmlRequest === '{}') {
      throw new Error('Leere oder ungültige XML-Anfrage erhalten');
    }
    
    if (!xmlRequest.includes('<Request>') || !xmlRequest.includes('</Request>')) {
      throw new Error('Ungültiges XML-Format - Request-Tags fehlen');
    }
    
    const socket = new net.Socket();
    let responseData = '';
    let isConnected = false;
    
    const tcpPromise = new Promise((resolve, reject) => {
      
      socket.setTimeout(15000);
      
      socket.on('connect', () => {
        isConnected = true;
        
        socket.write(xmlRequest, 'utf8');
      });
      
      socket.on('data', (data) => {
        const chunk = data.toString('utf8');
        responseData += chunk;
      });
      
      socket.on('close', () => {
        if (responseData && responseData.trim() !== '') {
          resolve(responseData);
        } else {
          reject(new Error('Leere Antwort von GDV erhalten'));
        }
      });
      
      socket.on('error', (error) => {
        console.error('TCP-Socket error:', error);
        reject(new Error(`Verbindung zu GDV fehlgeschlagen: ${error.message}`));
      });
      
      socket.on('timeout', () => {
        console.error('TCP connection timeout');
        socket.destroy();
        reject(new Error('Timeout beim Verbinden zu GDV (15s)'));
      });
    });
    
    const zonlinePort = parseInt(process.env.ZONLINE_PORT || '4027');
    const zonlineServer = process.env.ZONLINE_SERVER || '185.22.150.228';
    socket.connect(zonlinePort, zonlineServer);
    
    const gdvResponse = await tcpPromise;
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(gdvResponse);
    
  } catch (error) {
    console.error('Z@Online API error:', error);
    
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Siehe Server-Logs für weitere Details'
    });
  }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
    }
  };
  
  try {
    res.status(200).json(healthCheck);
  } catch (error) {
    healthCheck.message = error.message;
    res.status(503).json(healthCheck);
  }
});

// API Health Check (mit DB-Test)
app.get('/api/health', async (req, res) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {}
  };

  try {
    // Datenbank Test
    await new Promise((resolve, reject) => {
      connection.query('SELECT 1 as test', (err, results) => {
        if (err) {
          healthStatus.services.database = { status: 'ERROR', error: err.message };
          reject(err);
        } else {
          healthStatus.services.database = { status: 'OK' };
          resolve(results);
        }
      });
    });

    res.status(200).json(healthStatus);
  } catch (error) {
    healthStatus.status = 'ERROR';
    res.status(503).json(healthStatus);
  }
});

// Batch Image Loading - löst N+1 Problem
app.post('/api/akten/images/batch', [
  body('akteIds').isArray({ min: 1, max: 50 }).withMessage('akteIds muss Array mit 1-50 IDs sein'),
  body('akteIds.*').isInt({ min: 1 }).withMessage('Alle akteIds müssen positive Integers sein'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { akteIds } = req.body;
    
    // Single optimized query with proper prepared statement
    const placeholders = akteIds.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT ab1.akte_id, ab1.filename, ab1.upload_date 
       FROM akte_bilder ab1
       INNER JOIN (
         SELECT akte_id, MIN(upload_date) as min_date 
         FROM akte_bilder 
         WHERE akte_id IN (${placeholders})
         GROUP BY akte_id
       ) ab2 ON ab1.akte_id = ab2.akte_id AND ab1.upload_date = ab2.min_date
       ORDER BY ab1.akte_id`,
      akteIds
    );
    
    // Resultate zu Map umwandeln
    const imageMap = rows.reduce((acc, row) => {
      acc[row.akte_id] = row.filename;
      return acc;
    }, {});
    
    res.json({ 
      success: true, 
      images: imageMap,
      count: rows.length
    });
  } catch (error) {
    console.error('Batch image loading error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Fehler beim Laden der Bilder-Batch'
    });
  }
});

// DAT Token Endpoint - sicherer Proxy für Frontend
app.post('/api/dat/token', async (req, res) => {
  try {
    const datService = new DATService();
    await datService.authenticate();
    
    if (!datService.token) {
      throw new Error('Token konnte nicht generiert werden');
    }
    
    res.json({ 
      success: true, 
      token: datService.token 
    });
  } catch (error) {
    console.error('DAT Token error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Token-Generierung fehlgeschlagen' 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Server running on all interfaces:${PORT}`);
});