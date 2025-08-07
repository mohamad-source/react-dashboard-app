const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Static files für Bilder
app.use('/public', express.static('public'));

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
  try {
    const [rows] = await db.execute('SELECT * FROM akte ORDER BY erstellt_am DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Neue Akte erstellen  
app.post('/api/akten', async (req, res) => {
  try {
    const { kunde, kennzeichen, schadenort, status = 'Entwurf' } = req.body;
    
    const [result] = await db.execute(
      'INSERT INTO akte (kunde, kennzeichen, schadenort, status, erstellt_am) VALUES (?, ?, ?, ?, NOW())',
      [kunde, kennzeichen, schadenort, status]
    );
    
    res.json({ id: result.insertId, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
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

app.post('/api/akten/:id/kalkulation', async (req, res) => {
  // DAT-Kalkulation verarbeiten
  res.json({ success: true, message: 'Kalkulation gespeichert' })
})

app.listen(3001, () => {
  console.log('API Server running on http://localhost:3001');
});