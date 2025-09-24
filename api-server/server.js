const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
const axios = require('axios');
const { PDFDocument } = require('pdf-lib');

// Load environment variables based on NODE_ENV
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development';

dotenv.config({ path: path.resolve(__dirname, envFile) });

// Fallback to default .env if specific env file doesn't exist
if (!process.env.DB_HOST) {
  dotenv.config({ path: path.resolve(__dirname, '.env') });
}

// Security middleware imports
const { corsOptions, apiLimiter, uploadLimiter, setupSecurity, requestLogger } = require('./middleware/security');
const { requireClerkAuth, checkClerkConfig } = require('./middleware/clerkAuth');
const {
  validateId,
  validateAkteCreate,
  validateAkteUpdate,
  validateSignature,
  validateFileUpload,
  validateStatusUpdate,
  validateKalkulation,
  sanitizeBody
} = require('./middleware/validation');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { encryptForStorage, decryptFromStorage, testEncryption, getEncryptionStatus } = require('./services/dataProtection');
const { securityAuditMiddleware } = require('./middleware/securityAudit');
const { securityMonitor } = require('./services/securityMonitor');
const { httpsRedirect, hstsMiddleware, secureConnectionHeaders, validateHttpsConfig } = require('./middleware/httpsRedirect');

const app = express();

// Security setup
setupSecurity(app);

// HTTPS Redirect (muss ganz am Anfang stehen)
app.use(httpsRedirect);

// HSTS und sichere Connection Headers
app.use(hstsMiddleware);
app.use(secureConnectionHeaders);

// CORS with security configuration
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

// Security auditing
app.use(securityAuditMiddleware);

// Rate limiting
app.use('/api/', apiLimiter);

// Body parsing with security limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/zonline', express.text({
  type: ['application/xml', 'text/xml'],
  limit: '1mb'
}));
app.use(express.text({ type: 'text/plain' }));

// Input sanitization
app.use(sanitizeBody);

// Clerk authentication (STRICT - Token required!)
app.use('/api/akten', requireClerkAuth);

class DATService {
  constructor() {
    this.customerNumber = process.env.DAT_CUSTOMER_NUMBER || "1331332"
    this.user = process.env.DAT_USER || "kanaoezer"
    this.password = process.env.DAT_PASSWORD || "VcP369ILp99!!"
    this.interfacePartnerNumber = process.env.DAT_INTERFACE_PARTNER_NUMBER || "1331332"
    this.interfacePartnerSignature = process.env.DAT_INTERFACE_PARTNER_SIGNATURE || "8DA52B0E91D6582DF5584071A9E96B047F421030515181C41F7686604CB9BE8E"
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
      logger.error('Authentication error', { error: error.message, endpoint: req.originalUrl, ip: req.ip })
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
      logger.error('DAT API process error', { error: error.message, function: 'processDATData' })
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

app.use('/public', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '..', 'react-dashboard', 'public')));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const akteId = req.params.id;
    const uploadPath = path.join(__dirname, '..', 'akte_bilder', `akte_${akteId}`);
    
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

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien sind erlaubt!'), false);
    }
  }
});

app.get('/api/akten', asyncHandler(async (req, res) => {
  await db.execute('SELECT 1')

  const [tableCheck] = await db.execute('SHOW TABLES LIKE "akte"')

  if (tableCheck.length === 0) {
    throw new Error('Tabelle "akte" existiert nicht')
  }

  const [rows] = await db.execute('SELECT * FROM akte ORDER BY erstellt_am DESC')

  // Decrypt sensitive data before sending to client
  const decryptedRows = decryptFromStorage('akten', rows);

  res.json(decryptedRows)
}))

app.post('/api/akten', validateAkteCreate, asyncHandler(async (req, res) => {
  const data = req.body

  const plzStadt = data.adresse2 || ""
  const plz = plzStadt.split(' ')[0] || ""
  const stadt = plzStadt.substring(plz.length).trim() || ""

  // Encrypt sensitive data before storage
  const encryptedData = encryptForStorage('akten', data);

  const [result] = await db.execute(
    `INSERT INTO akte (kunde, kennzeichen, schadenort, fahrzeugtyp, plz, stadt,
     schadentag, schadennummer, versicherungsnummer, selbstbeteiligung, vin, scheibe,
     auftragstyp, vorsteuer_berechtigt, status, erstellt_am)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Entwurf', NOW())`,
    [
      encryptedData.kunde,
      encryptedData.kennzeichen,
      data.schadenort,
      data.fahrzeugtyp,
      plz,
      data.adresse1,
      data.schadentag,
      data.schadennummer,
      data.versicherungsnummer,
      data.selbstbeteiligung,
      encryptedData.vin,
      data.scheibe,
      data.auftragstyp,
      data.vorsteuer_berechtigt
    ]
  )

  res.json({ id: result.insertId, success: true })
}))

app.put('/api/akten/:id', validateAkteUpdate, asyncHandler(async (req, res) => {
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
}))

app.get('/api/akten/:id', validateId, asyncHandler(async (req, res) => {
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
        logger.error('Database error loading Abtretungsdaten', { error: error.message, akteId: req.params.id })
      }
    }

    // Decrypt sensitive data before sending to client
    const decryptedAkte = decryptFromStorage('akten', akte);

    res.json(decryptedAkte)
}))

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
  doc.text('MAIL: info@autoglasneu.de', 120, 60);
  
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
      logger.error('Database error inserting signature', { error: error.message, akteId: akte.id });
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
    
    // Encrypt signature data before storage
    const encryptedSignatureData = encryptForStorage('signatures', { signature_data: signatureBuffer });

    const [result] = await db.execute(
      'UPDATE akte SET abtretung_signiert = 1, signiert_am = NOW(), signature_data = ?, pdf_data = ? WHERE id = ?',
      [encryptedSignatureData.signature_data, Buffer.from(pdfBuffer), akteId]
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
    logger.error('Abtretung processing error', { error: error.message, akteId: req.params.id })
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
    logger.error('PDF download error', { error: error.message, akteId: req.params.id })
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/akten/:id/bilder', requireClerkAuth, async (req, res) => {
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
    logger.error('Database error loading images', { error: error.message, akteId: req.params.id })
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.post('/api/akten/:id/bilder', requireClerkAuth, validateId, uploadLimiter, upload.array('images[]', 10), validateFileUpload, async (req, res) => {
  try {
    const akteId = req.params.id
    const uploadDir = `/var/www/html/react-dashboard-app/react-dashboard/akte_bilder/akte_${akteId}`

    const files = req.files

    // DEBUG hinzufügen:
    console.log('=== BILDER UPLOAD DEBUG ===');
    console.log('req.files:', files);
    console.log('req.files length:', files ? files.length : 'undefined');
    console.log('req.body:', req.body);

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
        console.log(`Attempting to insert file: ${file.filename}`);
        console.log(`Values: akteId=${akteId}, filename=${file.filename}, original_name=${file.originalname}, size=${file.size}, mimetype=${file.mimetype}`);
        
        const [result] = await db.execute(
          `INSERT INTO akte_bilder
          (akte_id, filename, original_name, file_size, mime_type, upload_date)
          VALUES (?, ?, ?, ?, ?, NOW())`,
          [akteId, file.filename, file.originalname, file.size, file.mimetype]
        );
        
        console.log('Database insert successful:', result.insertId);
        uploadedCount++
      } catch (dbError) {
        console.log('Database error:', dbError.message);
        console.log('Error code:', dbError.code);
        console.log('SQL State:', dbError.sqlState);
        logger.error('Database error saving uploaded file', { filename: file.filename, error: dbError.message, akteId: req.params.id })
        try {
          fs.unlinkSync(file.path)
        } catch (unlinkError) {
          logger.error('File system error deleting file', { error: unlinkError.message })
        }
      }
    }

    res.json({ 
      success: true, 
      message: `${uploadedCount} Bilder erfolgreich hochgeladen`,
      uploaded_count: uploadedCount
    })
    
  } catch (error) {
    logger.error('File upload error', { error: error.message, akteId: req.params.id })
    
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path)
        } catch (unlinkError) {
          logger.error('File system error deleting file', { error: unlinkError.message })
        }
      })
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.delete('/api/akten/:id/bilder/:bildId', requireClerkAuth, async (req, res) => {
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
    
    const filePath = path.join(__dirname, '..', 'akte_bilder', `akte_${akteId}`, bild.filename)
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (fileError) {
      logger.error('File system error deleting file', { filename: filePath, error: fileError.message })
    }
    
    await db.execute('DELETE FROM akte_bilder WHERE id = ?', [bildId])
    
    res.json({ 
      success: true,
      message: 'Bild erfolgreich gelöscht'
    })
  } catch (error) {
    logger.error('Delete image error', { error: error.message, akteId: req.params.id, bildId: req.params.bildId })
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
      
      const bildOrdner = path.join(__dirname, '..', 'akte_bilder', `akte_${akteId}`)
      
      if (fs.existsSync(bildOrdner)) {
        fs.rmSync(bildOrdner, { recursive: true, force: true })
      }
    } catch (bildError) {
      logger.error('Database error deleting images', { error: bildError.message, akteId: req.params.id })
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
    logger.error('Database error deleting akte', { error: error.message, akteId: req.params.id })
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
    logger.error('Kalkulation processing error', { error: error.message, akteId: req.params.id })
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
    logger.error('Database error getting kalkulationen', { error: error.message, akteId: req.params.id })
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
          const bildPath = path.join(__dirname, '..', 'akte_bilder', `akte_${akteId}`, bild.filename)
          
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
              logger.error('Database error inserting image', { error: imgError.message, akteId: req.params.id })
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
        logger.error('PDF processing error appending Abtretung', { error: abtError.message, akteId: req.params.id })
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
          logger.error('PDF processing error appending DAT calculation', { error: kalkError.message, akteId: req.params.id })
          
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
    logger.error('Dokumentation generation error', { error: error.message, akteId: req.params.id })
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
    logger.error('Database error updating status', { error: error.message, akteId: req.params.id })
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/zonline', requireClerkAuth, uploadLimiter, asyncHandler(async (req, res) => {
  logger.info('Z@Online API request', { requestData: req.body });

  const response = await axios.post('http://88.198.109.112:3000/api/v1/license/query', req.body, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.FAHRZEUGSCHEIN_API_KEY || 'fe12285780281f3c7c2a768edc141cb3'
    },
    timeout: 30000
  });

  logger.info('Z@Online API response', { responseData: response.data });
  res.json(response.data);
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Security status endpoint (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/security-status', (req, res) => {
    const encryptionStatus = getEncryptionStatus();
    const securityStatus = securityMonitor.getSecurityStatus();

    res.json({
      encryption: encryptionStatus,
      monitoring: securityStatus,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });
}

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

app.use('/akte_bilder', express.static(path.join(__dirname, '..', 'akte_bilder')));

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  // Test encryption on startup
  const encryptionStatus = getEncryptionStatus();

  // Validate HTTPS configuration
  const httpsConfig = validateHttpsConfig();

  // Check Clerk configuration
  const clerkConfig = checkClerkConfig();

  // Start security monitoring
  securityMonitor.start();

  logger.info('API Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    security: {
      cors: 'enabled',
      rateLimiting: 'enabled',
      inputValidation: 'enabled',
      securityHeaders: 'enabled',
      requestLogging: 'enabled',
      authentication: 'REQUIRED (strict mode)',
      encryption: encryptionStatus.configured ? 'enabled' : 'fallback mode',
      securityMonitoring: 'enabled',
      httpsRedirect: process.env.NODE_ENV === 'production' ? 'enabled' : 'development only',
      hsts: process.env.NODE_ENV === 'production' ? 'enabled' : 'production only'
    },
    encryption: encryptionStatus,
    https: httpsConfig,
    clerk: clerkConfig
  });

  // Console output for development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🚀 API Server running on all interfaces:${PORT}`);
    console.log('🛡️ Security features enabled:');
    console.log('  ✅ CORS protection');
    console.log('  ✅ Rate limiting');
    console.log('  ✅ Input validation');
    console.log('  ✅ Security headers');
    console.log('  ✅ Enhanced logging');
    console.log(`  ${encryptionStatus.configured ? '✅' : '⚠️ '} Database encryption: ${encryptionStatus.configured ? 'enabled' : 'fallback mode'}`);
    console.log('  ✅ Security monitoring');
    console.log('  ⚠️  HTTPS redirect: Development (production only)');
    console.log('  ✅ Authentication: REQUIRED (strict mode)');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  }
});