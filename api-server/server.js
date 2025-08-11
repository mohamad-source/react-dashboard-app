const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
const { PDFDocument } = require('pdf-lib');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// DAT Service Class - NACH DEN REQUIRES EINFÜGEN
class DATService {
  constructor() {
    this.customerNumber = "1331332"
    this.user = "kanaoezer"
    this.password = "VcP369ILp99!!"
    this.interfacePartnerNumber = "1331332"
    this.interfacePartnerSignature = "8DA52B0E91D6582DF5584071A9E96B047F421030515181C41F7686604CB9BE8E"
    this.token = null
  }

  async authenticate() {
    const payload = JSON.stringify({
      "action": "generateToken",
      "customerNumber": this.customerNumber,
      "user": this.user,
      "password": this.password,
      "interfacePartnerNumber": this.interfacePartnerNumber,        // <- FEHLTE
      "interfacePartnerSignature": this.interfacePartnerSignature,  // <- FEHLTE
      "productVariant": "calculateExpert"                           // <- FEHLTE
    })

    try {
      const response = await fetch('https://www.dat.de/AuthorizationManager/service--/endpoint/tokenService', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'payload=' + encodeURIComponent(payload)
      })

      if (response.ok) {
        this.token = (await response.text()).replace(/"/g, '').trim()
        console.log('New token generated:', this.token)
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
      console.log('=== DAT Process Start ===')
      console.log('contractID:', contractID)
      console.log('akteId:', akteId)

      // 1. Authentifizierung
      console.log('Starting authentication...')
      if (!await this.authenticate()) {
        console.log('Authentication FAILED')
        return { success: false, message: 'Authentication failed' }
      }
      console.log('Authentication SUCCESS, token:', this.token)

      // 2. Kalkulation berechnen
      console.log('Starting calculation...')
      const calcResult = await this.calculateContract(contractID)
      console.log('Calculation result:', calcResult)
      
      if (!calcResult.success) {
        console.log('Calculation FAILED')
        return { success: false, message: 'Calculation failed' }
      }

      // 3. PDF exportieren
      console.log('Starting PDF export...')
      const pdfResult = await this.exportToPDF(contractID)
      console.log('PDF result success:', pdfResult.success)
      
      // 4. In Datenbank speichern
      let pdfBlob = null
      if (pdfResult.success && pdfResult.pdf_base64) {
        pdfBlob = Buffer.from(pdfResult.pdf_base64, 'base64')
        console.log('PDF blob size:', pdfBlob.length)
      }

      const filename = `Kalkulation_${contractID}_${Date.now()}.pdf`
      
      console.log('Saving to database...')
      const [result] = await db.execute(
        `INSERT INTO dat_kalkulationen (akte_id, filename, brutto, netto, pdf_blob) 
        VALUES (?, ?, ?, ?, ?)`,
        [akteId, filename, 1500.00, 1260.50, pdfBlob]
      )

      console.log('Database save SUCCESS, ID:', result.insertId)
      return {
        success: true,
        saved_data: { id: result.insertId }
      }

    } catch (error) {
      console.error('=== DAT Process ERROR ===')
      console.error('Error details:', error)
      console.error('Stack:', error.stack)
      return { success: false, message: error.message }
    }
  }

  async calculateContract(contractID) {
    // SOAP Call für Kalkulation
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
    // SOAP Call für PDF Export
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

// Static files für Bilder
app.use('/public', express.static(path.join(__dirname, '..', 'react-dashboard', 'public')));

// MySQL Connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

// Multer Storage Configuration
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

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien sind erlaubt!'), false);
    }
  }
});

// Alle Akten laden
app.get('/api/akten', async (req, res) => {
  console.log('GET /api/akten aufgerufen')
  
  try {
    // Datenbankverbindung testen
    console.log('Teste Datenbankverbindung...')
    await db.execute('SELECT 1')
    console.log('Datenbankverbindung OK')
    
    // Tabelle prüfen
    console.log('Prüfe ob Tabelle existiert...')
    const [tableCheck] = await db.execute('SHOW TABLES LIKE "akte"')
    console.log('Tabellen-Check:', tableCheck)
    
    if (tableCheck.length === 0) {
      throw new Error('Tabelle "akte" existiert nicht')
    }
    
    // Daten abrufen
    console.log('Lade Akten...')
    const [rows] = await db.execute('SELECT * FROM akte ORDER BY erstellt_am DESC')
    console.log('Gefundene Akten:', rows.length)
    console.log('Erste Akte:', rows[0])
    
    res.json(rows)
  } catch (error) {
    console.error('Vollständiger Fehler:', error)
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      code: error.code 
    })
  }
})

// Neue Akte erstellen  
app.post('/api/akten', async (req, res) => {
  try {
    const data = req.body
    
    // PLZ und Stadt trennen
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
    res.status(500).json({ error: error.message })
  }
})

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

// Akte aktualisieren
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
    console.error('UPDATE Fehler:', error)
    res.status(500).json({ error: error.message })
  }
})

// Einzelne Akte laden
app.get('/api/akten/:id', async (req, res) => {
  try {
    const akteId = req.params.id
    
    const [rows] = await db.execute('SELECT * FROM akte WHERE id = ?', [akteId])
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Akte nicht gefunden' })
    }
    
    const akte = rows[0]
    
    // Wenn Abtretung vorhanden ist, Formulardaten aus PDF extrahieren
    if (akte.abtretung_signiert && akte.pdf_data) {
      try {
        // PDF-Daten dekodieren und Formular-Daten extrahieren
        const pdfBuffer = Buffer.from(akte.pdf_data, 'binary')
        
        // Hier würden normalerweise die Daten aus dem PDF extrahiert
        // Für jetzt nehmen wir mock data basierend auf den Akte-Daten
        akte.abtretung_data = {
          mobilnr: '', // Nicht aus Akte-Tabelle verfügbar
          versicherungsname: '', // Nicht aus Akte-Tabelle verfügbar  
          marke: '', // Nicht aus Akte-Tabelle verfügbar
          modell: '', // Nicht aus Akte-Tabelle verfügbar
          kasko: false,
          haftpflicht: false,
          // Rest aus Akte-Daten übernehmen
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
        console.error('Fehler beim Laden der Abtretungsdaten:', error)
      }
    }
    
    res.json(akte)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PDF-Generierung Funktion
function generateAbtretungsPDF(akte, formData, signatureBuffer) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 102, 204); // Blau
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
  
  // Titel
  doc.setFontSize(16);
  doc.setTextColor(0, 102, 204);
  doc.text('ABTRETUNGSERKLÄRUNG', 20, 80);
  
  // Rahmen
  doc.rect(15, 90, 180, 160);
  
  let y = 100;
  
  // 1. Kunde / Versicherungsnehmer
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
  
  // 2. Versicherung
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
  
  // 3. Fahrzeug/Schadenbereich
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
  
  // Abtretungstext
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
  
  // Unterschrift
  doc.text('Unterschrift VN:', 20, y);
  
  // Unterschrift-Bild einfügen (wenn vorhanden)
  if (signatureBuffer) {
    try {
      const signatureBase64 = `data:image/png;base64,${signatureBuffer.toString('base64')}`;
      doc.addImage(signatureBase64, 'PNG', 60, y - 15, 60, 20);
    } catch (error) {
      console.error('Fehler beim Einfügen der Unterschrift:', error);
    }
  }
  
  // Datum
  doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}`, 120, 280);
  
  return doc.output('arraybuffer');
}

// Abtretung speichern
app.post('/api/akten/:id/abtretung', async (req, res) => {
  console.log('POST /api/akten/:id/abtretung aufgerufen')
  console.log('akteId:', req.params.id)

  try {
    const akteId = req.params.id
    const { signature, formData } = req.body
    
    console.log('Verarbeite Abtretung für Akte:', akteId)
    console.log('FormData erhalten:', formData)

    // Unterschrift verarbeiten (Base64)
    if (!signature || !signature.includes('data:image/png;base64,')) {
      throw new Error('Ungültige Unterschrift')
    }
    
    const signatureData = signature.replace('data:image/png;base64,', '')
    const signatureBuffer = Buffer.from(signatureData, 'base64')
    
    // Akte-Daten für PDF laden
    const [akteRows] = await db.execute('SELECT * FROM akte WHERE id = ?', [akteId])
    if (akteRows.length === 0) {
      throw new Error('Akte nicht gefunden')
    }
    
    const akte = akteRows[0]
    console.log('Akte-Daten für PDF:', akte)
    
    // PDF generieren
    console.log('Starte PDF-Generierung...')
    const pdfBuffer = generateAbtretungsPDF(akte, formData, signatureBuffer)
    console.log('PDF generiert, Größe:', pdfBuffer.byteLength, 'bytes')
    
    // In Datenbank speichern - WIE ORIGINAL PHP
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
    console.error('Abtretung Fehler:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// PDF Download
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
    res.status(500).json({ error: error.message })
  }
})

// Bilder einer Akte laden
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
    console.error('Fehler beim Laden der Bilder:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// Bilder hochladen
app.post('/api/akten/:id/bilder', upload.array('images[]', 10), async (req, res) => {
  console.log('POST /api/akten/:id/bilder aufgerufen')
  console.log('akteId:', req.params.id)

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
        console.error('DB Fehler für Datei:', file.filename, dbError)
        try {
          fs.unlinkSync(file.path)
        } catch (unlinkError) {
          console.error('Fehler beim Löschen der Datei:', unlinkError)
        }
      }
    }

    res.json({ 
      success: true, 
      message: `${uploadedCount} Bilder erfolgreich hochgeladen`,
      uploaded_count: uploadedCount
    })
    
  } catch (error) {
    console.error('Upload Fehler:', error)
    
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path)
        } catch (unlinkError) {
          console.error('Fehler beim Löschen der Datei:', unlinkError)
        }
      })
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// Bild löschen
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
      console.error('Fehler beim Löschen der Datei:', fileError)
    }
    
    await db.execute('DELETE FROM akte_bilder WHERE id = ?', [bildId])
    
    res.json({ 
      success: true,
      message: 'Bild erfolgreich gelöscht'
    })
  } catch (error) {
    console.error('Lösch-Fehler:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// Akte löschen
app.delete('/api/akten/:id', async (req, res) => {
  console.log('DELETE /api/akten/:id aufgerufen')
  console.log('akteId:', req.params.id)
  
  try {
    const akteId = req.params.id
    
    // Prüfen ob Akte existiert
    const [checkRows] = await db.execute('SELECT id FROM akte WHERE id = ?', [akteId])
    if (checkRows.length === 0) {
      return res.status(404).json({ error: 'Akte nicht gefunden' })
    }
    
    // Erst zugehörige Bilder löschen (falls vorhanden)
    try {
      // Bilder aus Datenbank löschen
      await db.execute('DELETE FROM akte_bilder WHERE akte_id = ?', [akteId])
      
      // Bilder-Ordner löschen (falls vorhanden)
      const fs = require('fs')
      const path = require('path')
      const bildOrdner = path.join(__dirname, '..', 'react-dashboard', 'public', 'akte_bilder', `akte_${akteId}`)
      
      if (fs.existsSync(bildOrdner)) {
        fs.rmSync(bildOrdner, { recursive: true, force: true })
        console.log('Bilder-Ordner gelöscht:', bildOrdner)
      }
    } catch (bildError) {
      console.error('Fehler beim Löschen der Bilder:', bildError)
      // Weitermachen, auch wenn Bilder nicht gelöscht werden konnten
    }
    
    // Akte löschen
    const [result] = await db.execute('DELETE FROM akte WHERE id = ?', [akteId])
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Akte nicht gefunden' })
    }
    
    console.log('Akte erfolgreich gelöscht:', akteId)
    res.json({ 
      success: true, 
      message: 'Akte erfolgreich gelöscht',
      deletedId: parseInt(akteId)
    })
    
  } catch (error) {
    console.error('Fehler beim Löschen der Akte:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// Kalkulation speichern
app.post('/api/akten/:id/kalkulation', upload.none(), async (req, res) => {
  console.log('POST /api/akten/:id/kalkulation aufgerufen')
  console.log('akteId:', req.params.id)
  console.log('Body:', req.body)

  try {
    const akteId = req.params.id
    const { action, az } = req.body
    
    // DAT Service starten
    const datService = new DATService()
    const result = await datService.fullProcessWithDB(az, akteId)
    
    if (result.success) {
      // AZ auch in akte Tabelle speichern
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
    console.error('Kalkulation Fehler:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// Kalkulationen einer Akte laden
app.get('/api/akten/:id/kalkulationen', async (req, res) => {
  try {
    const akteId = req.params.id
    
    // Kalkulationen aus dat_kalkulationen Tabelle laden
    const [rows] = await db.execute(
      'SELECT * FROM dat_kalkulationen WHERE akte_id = ? ORDER BY erstellt_am DESC', 
      [akteId]
    )
    
    res.json({
      success: true,
      kalkulationen: rows  // <- Das sollte ein Array sein
    })
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PDF Dokumentation generieren
app.post('/api/akten/:id/dokumentation', upload.none(), async (req, res) => {
  console.log('POST /api/akten/:id/dokumentation aufgerufen')
  
  try {
    const akteId = req.params.id
    const { selected_kalkulation_id } = req.body
    
    // PDF-Sections richtig extrahieren
    const pdf_sections = req.body['pdf_sections[]'] || req.body['pdf_sections'] || []
    
    console.log('Sections:', pdf_sections)
    console.log('Kalkulation ID:', selected_kalkulation_id)
    
    // Akte-Daten laden
    const [akteRows] = await db.execute('SELECT * FROM akte WHERE id = ?', [akteId])
    if (akteRows.length === 0) {
      throw new Error('Akte nicht gefunden')
    }
    const akte = akteRows[0]
    
    // Hauptdokument erstellen
    const doc = new jsPDF()
    let yPos = 20
    let pageCount = 1
    
    // Header für erste Seite
    doc.setFontSize(20)
    doc.setTextColor(0, 102, 204)
    doc.text('Akte Dokumentation', 20, yPos)
    yPos += 10
    
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(`Akte-ID: ${akteId}`, 20, yPos)
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}`, 120, yPos)
    yPos += 20
    
    // ========== KUNDENDATEN ==========
    if (pdf_sections.includes('kundendaten')) {
      console.log('Füge Kundendaten hinzu...')
      
      // Neue Seite für Kundendaten
      if (pageCount > 1) {
        doc.addPage()
        yPos = 20
      }
      
      // Header
      doc.setFontSize(18)
      doc.setTextColor(0, 102, 204)
      doc.text('Kundendaten', 20, yPos)
      yPos += 15
      
      // Rahmen um Kundendaten
      doc.rect(15, yPos - 5, 180, 180)
      yPos += 5
      
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      
      // Kundendaten in zwei Spalten
      const leftCol = 20
      const rightCol = 110
      let leftY = yPos
      let rightY = yPos
      
      // Linke Spalte
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
      
      // Rechte Spalte
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
      
      // Status und Zeiten
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
    
    // ========== SCHADENBILDER ==========
    if (pdf_sections.includes('bilder')) {
      console.log('Füge Schadenbilder hinzu...')
      
      const [bilderRows] = await db.execute('SELECT * FROM akte_bilder WHERE akte_id = ? ORDER BY upload_date ASC', [akteId])
      
      if (bilderRows.length > 0) {
        // Neue Seite für Bilder
        doc.addPage()
        yPos = 20
        
        // Header
        doc.setFontSize(18)
        doc.setTextColor(0, 102, 204)
        doc.text(`Schadenbilder (${bilderRows.length} Bilder)`, 20, yPos)
        yPos += 20
        
        let bildCounter = 0
        
        for (const bild of bilderRows) {
          const bildPath = path.join(__dirname, '..', 'react-dashboard', 'public', 'akte_bilder', `akte_${akteId}`, bild.filename)
          
          if (fs.existsSync(bildPath)) {
            try {
              // 2 Bilder pro Seite
              if (bildCounter > 0 && bildCounter % 2 === 0) {
                doc.addPage()
                yPos = 20
                
                // Header auf neuer Bildseite
                doc.setFontSize(16)
                doc.setTextColor(0, 102, 204)
                doc.text('Schadenbilder (Fortsetzung)', 20, yPos)
                yPos += 15
              }
              
              const imgData = fs.readFileSync(bildPath, { encoding: 'base64' })
              const imgFormat = path.extname(bild.filename).toLowerCase() === '.png' ? 'PNG' : 'JPEG'
              
              // Position berechnen (2 Bilder pro Seite)
              const isFirstImage = (bildCounter % 2 === 0)
              const imgY = isFirstImage ? yPos : yPos + 120
              
              // Bild einfügen (größer als vorher)
              doc.addImage(`data:image/${imgFormat.toLowerCase()};base64,${imgData}`, imgFormat, 20, imgY, 160, 100)
              
              // Bildname unter das Bild
              doc.setFontSize(10)
              doc.setTextColor(0, 0, 0)
              doc.text(`${bild.original_name || bild.filename}`, 20, imgY + 110)
              doc.text(`Größe: ${(bild.file_size / 1024).toFixed(1)} KB | Hochgeladen: ${new Date(bild.upload_date).toLocaleString('de-DE')}`, 20, imgY + 115)
              
              bildCounter++
              
              // Nach dem zweiten Bild yPos für nächste Seite setzen
              if (!isFirstImage) {
                yPos += 240
              }
              
            } catch (imgError) {
              console.error('Fehler beim Einfügen des Bildes:', imgError)
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
        // Neue Seite auch wenn keine Bilder
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
    
    // Basis-PDF als ArrayBuffer für weitere Verarbeitung
    let finalPdfBytes = new Uint8Array(doc.output('arraybuffer'))
    
    // ========== ABTRETUNGSERKLÄRUNG ANHÄNGEN ==========
    if (pdf_sections.includes('abtretung') && akte.abtretung_signiert && akte.pdf_data) {
      console.log('Füge Abtretungserklärung hinzu...')
      
      try {
        // PDFLib für das Zusammenfügen verwenden
        const PDFDocument = require('pdf-lib').PDFDocument
        
        // Haupt-PDF laden
        const mainPdf = await PDFDocument.load(finalPdfBytes)
        
        // Abtretungs-PDF laden
        const abtretungsPdf = await PDFDocument.load(akte.pdf_data)
        
        // Seiten aus Abtretungs-PDF kopieren
        const abtretungsPages = await mainPdf.copyPages(abtretungsPdf, abtretungsPdf.getPageIndices())
        
        // Seiten zum Haupt-PDF hinzufügen
        abtretungsPages.forEach((page) => mainPdf.addPage(page))
        
        // Aktualisiertes PDF speichern
        finalPdfBytes = await mainPdf.save()
        
      } catch (abtError) {
        console.error('Fehler beim Anhängen der Abtretungserklärung:', abtError)
        // Fallback: Neue Seite mit Hinweis
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
    
    // ========== DAT-KALKULATION ANHÄNGEN ==========
    // DEBUGGING VERSION - Füge diese Logs hinzu um zu sehen was passiert

// ========== DAT-KALKULATION ANHÄNGEN ==========
if (pdf_sections.includes('kalkulation') && selected_kalkulation_id) {
  console.log('Füge DAT-Kalkulation hinzu...')
  
  const [kalkRows] = await db.execute('SELECT * FROM dat_kalkulationen WHERE id = ? AND akte_id = ?', [selected_kalkulation_id, akteId])
  
  console.log('Kalkulation gefunden:', kalkRows.length > 0)
  if (kalkRows.length > 0) {
    console.log('Kalkulation Daten:', {
      id: kalkRows[0].id,
      filename: kalkRows[0].filename,
      brutto: kalkRows[0].brutto,
      netto: kalkRows[0].netto,
      has_pdf_blob: !!kalkRows[0].pdf_blob,
      pdf_blob_size: kalkRows[0].pdf_blob ? kalkRows[0].pdf_blob.length : 0
    })
  }
  
  if (kalkRows.length > 0 && kalkRows[0].pdf_blob) {
    try {
      console.log('Versuche PDFs zusammenzufügen...')
      
      // PDFLib für das Zusammenfügen verwenden
      const PDFDocument = require('pdf-lib').PDFDocument
      
      // Haupt-PDF laden
      console.log('Lade Haupt-PDF...')
      const mainPdf = await PDFDocument.load(finalPdfBytes)
      console.log('Haupt-PDF Seiten:', mainPdf.getPageCount())
      
      // DAT-Kalkulations-PDF laden
      console.log('Lade DAT-PDF...')
      const kalkulationsPdf = await PDFDocument.load(kalkRows[0].pdf_blob)
      console.log('DAT-PDF Seiten:', kalkulationsPdf.getPageCount())
      
      // Seiten aus Kalkulationss-PDF kopieren
      console.log('Kopiere DAT-PDF Seiten...')
      const kalkulationsPages = await mainPdf.copyPages(kalkulationsPdf, kalkulationsPdf.getPageIndices())
      console.log('Seiten kopiert:', kalkulationsPages.length)
      
      // Seiten zum Haupt-PDF hinzufügen
      console.log('Füge Seiten hinzu...')
      kalkulationsPages.forEach((page, index) => {
        console.log(`Füge Seite ${index + 1} hinzu...`)
        mainPdf.addPage(page)
      })
      
      console.log('Finales PDF Seiten:', mainPdf.getPageCount())
      
      // Aktualisiertes PDF speichern
      console.log('Speichere finales PDF...')
      finalPdfBytes = await mainPdf.save()
      console.log('Final PDF Größe:', finalPdfBytes.length)
      
    } catch (kalkError) {
      console.error('Fehler beim Anhängen der DAT-Kalkulation:', kalkError)
      console.error('Error Stack:', kalkError.stack)
      
      // Fallback: Neue Seite mit Kalkulations-Daten
      console.log('Verwende Fallback für DAT-Kalkulation...')
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
  } else {
    console.log('Keine DAT-Kalkulation gefunden oder kein PDF-Blob vorhanden')
  }
}
    
    // Final PDF senden
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="Dokumentation_Akte_${akteId}_${Date.now()}.pdf"`)
    res.send(Buffer.from(finalPdfBytes))
    
    console.log('PDF erfolgreich generiert und gesendet')
    
  } catch (error) {
    console.error('Dokumentation Fehler:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})


app.listen(3001, () => {
  console.log('API Server running on http://localhost:3001');
});