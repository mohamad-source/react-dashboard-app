import React, { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { supabase } from '../../../lib/supabase'
import { aktenApi } from '../../../lib/aktenApi'
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  TestTube
} from 'lucide-react'

interface KundendatenData {
  kunde: string
  fahrzeugtyp: string
  adresse1: string
  adresse2: string
  schadentag: string
  schadenort: string
  schadennummer: string
  kennzeichen: string
  versicherungsnummer: string
  selbstbeteiligung: string
  vin: string
  scheibe: string
  auftragstyp: string
  vorsteuer_berechtigt: string
}

interface KundendatenStepProps {
  data: KundendatenData
  onUpdate: (field: keyof KundendatenData, value: string) => void
}

export default function KundendatenStep({ data, onUpdate }: KundendatenStepProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [vinValidation, setVinValidation] = useState<'valid' | 'invalid' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // API Configuration für Fahrzeugschein Scanner
  const API_URL = 'https://api.fahrzeugschein-scanner.de/'
  const API_KEY = '9c97565c-84ed-47ee-b597-981e0c4905c9'

  // Felder mit Test-Daten ausfüllen
  const fillTestData = () => {
    onUpdate('kunde', 'Max Mustermann')
    onUpdate('fahrzeugtyp', 'PKW')
    onUpdate('adresse1', 'Musterstraße 123')
    onUpdate('adresse2', '12345 Berlin')
    onUpdate('schadentag', '2025-01-15')
    onUpdate('schadenort', 'Hauptstraße 45, Berlin')
    onUpdate('schadennummer', 'SN-2025-001')
    onUpdate('kennzeichen', 'B-AB 1234')
    onUpdate('versicherungsnummer', '123456789')
    onUpdate('selbstbeteiligung', '300')
    onUpdate('vin', 'WBAVA31030NL12345')
    onUpdate('scheibe', 'Frontscheibe')
    onUpdate('auftragstyp', 'Kostenvoranschlag')
    onUpdate('vorsteuer_berechtigt', 'Nein')
  }

  // Test-Daten direkt in DB speichern
  const handleTestSave = async () => {
    setUploadStatus('uploading')
    setUploadMessage('Test-Akte wird erstellt...')

    try {
      const testData = {
        kunde: 'Max Mustermann',
        kennzeichen: 'B-AB 1234',
        schadenort: 'Hauptstraße 123, Berlin'
      }

      await aktenApi.createAkte(testData)

      setUploadStatus('success')
      setUploadMessage('Test-Akte erfolgreich erstellt!')
      
      // Auto-fill Formular mit Test-Daten
      fillTestData()

    } catch (error) {
      setUploadStatus('error')
      setUploadMessage('Fehler beim Erstellen der Test-Akte: ' + (error as Error).message)
    }
  }

  // File Upload Handler
  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    
    if (!validTypes.includes(file.type)) {
      setUploadStatus('error')
      setUploadMessage('Ungültiger Dateityp. Bitte wählen Sie eine JPG, JPEG, PNG oder PDF Datei.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus('error')
      setUploadMessage('Datei zu groß. Maximale Dateigröße: 10MB')
      return
    }

    setSelectedFile(file)
    setUploadStatus('idle')
    setUploadMessage('')
  }, [])

  // Drag & Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  // Fahrzeugschein Scanner
  const scanFahrzeugschein = async () => {
    if (!selectedFile) return

    setUploadStatus('uploading')
    setUploadMessage('Daten werden eingelesen...')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('access_key', API_KEY)
      formData.append('show_cuts', 'false')
      formData.append('get_kba_data', 'false')

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        // Auto-fill fields
        if (result.name1 && result.firstname) {
          onUpdate('kunde', `${result.name1}, ${result.firstname}`)
        }
        if (result.address1) {
          onUpdate('adresse1', result.address1)
        }
        if (result.address2) {
          onUpdate('adresse2', result.address2)
        }
        if (result.registrationNumber) {
          onUpdate('kennzeichen', result.registrationNumber)
        }
        if (result.vin) {
          onUpdate('vin', result.vin)
          setVinValidation(result.vin_valid ? 'valid' : 'invalid')
        }

        setUploadStatus('success')
        setUploadMessage('Fahrzeugschein erfolgreich gescannt und Felder ausgefüllt!')
      } else {
        setUploadStatus('error')
        setUploadMessage(result.message || 'Fehler beim Scannen des Fahrzeugscheins')
      }
    } catch (error) {
      setUploadStatus('error')
      setUploadMessage('Verbindungsfehler beim Scannen')
    }
  }

  // VIN Validation
  const validateVIN = (vin: string) => {
    if (vin.length === 17) {
      // Einfache VIN Validierung (kann erweitert werden)
      const validPattern = /^[A-HJ-NPR-Z0-9]{17}$/
      setVinValidation(validPattern.test(vin) ? 'valid' : 'invalid')
    } else {
      setVinValidation(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Fahrzeugschein Scanner */}
      <Card className="border-2 border-dashed border-blue-300">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Fahrzeugschein Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Upload Area */}
          <div
            className={`
              border-3 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${isDragging 
                ? 'border-purple-500 bg-purple-50 scale-105' 
                : 'border-blue-300 hover:border-purple-500 hover:bg-blue-50'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-6xl mb-4">📄</div>
            <div className="text-xl text-gray-600 mb-3">
              Fahrzeugschein hier ablegen oder klicken zum Auswählen
            </div>
            <div className="text-gray-500 text-sm">
              Unterstützte Formate: JPG, JPEG, PNG, PDF
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>

          {/* File Info */}
          {selectedFile && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div><strong>Ausgewählte Datei:</strong> {selectedFile.name}</div>
              <div><strong>Größe:</strong> {formatFileSize(selectedFile.size)}</div>
            </div>
          )}

          {/* Auto-Fill Button */}
          <Button
            onClick={fillTestData}
            variant="outline"
            className="mt-4 mr-4"
          >
            <TestTube className="mr-2 h-4 w-4" />
            Felder ausfüllen
          </Button>

          {/* Test Button */}
          <Button
            onClick={handleTestSave}
            variant="secondary"
            className="mt-4 mr-4"
            disabled={uploadStatus === 'uploading'}
          >
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test läuft...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Test-Akte erstellen
              </>
            )}
          </Button>

          {/* Scan Button */}
          <Button
            onClick={scanFahrzeugschein}
            disabled={!selectedFile || uploadStatus === 'uploading'}
            className="mt-4"
          >
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gescannt...
              </>
            ) : (
              'Fahrzeugschein scannen'
            )}
          </Button>

          {/* Status Messages */}
          {uploadMessage && (
            <Alert className={`mt-4 ${uploadStatus === 'error' ? 'border-red-200' : uploadStatus === 'success' ? 'border-green-200' : ''}`}>
              {uploadStatus === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : uploadStatus === 'error' ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <AlertDescription className={
                uploadStatus === 'success' ? 'text-green-700' : 
                uploadStatus === 'error' ? 'text-red-700' : ''
              }>
                {uploadMessage}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Kundendaten Formular */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="kunde">Kunde *</Label>
          <Input
            id="kunde"
            value={data.kunde}
            onChange={(e) => onUpdate('kunde', e.target.value)}
            placeholder="z.B. Max Mustermann"
            className={data.kunde ? 'bg-green-50' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fahrzeugtyp">Fahrzeugtyp *</Label>
          <select
            id="fahrzeugtyp"
            value={data.fahrzeugtyp}
            onChange={(e) => onUpdate('fahrzeugtyp', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Bitte wählen --</option>
            <option value="PKW">PKW</option>
            <option value="LKW">LKW</option>
            <option value="Motorrad">Motorrad</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="adresse1">Adresse 1 *</Label>
          <Input
            id="adresse1"
            value={data.adresse1}
            onChange={(e) => onUpdate('adresse1', e.target.value)}
            placeholder="Straße und Hausnummer"
            className={data.adresse1 ? 'bg-green-50' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adresse2">Adresse 2 (PLZ/Ort) *</Label>
          <Input
            id="adresse2"
            value={data.adresse2}
            onChange={(e) => onUpdate('adresse2', e.target.value)}
            placeholder="PLZ Ort"
            className={data.adresse2 ? 'bg-green-50' : ''}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="schadentag">Schadentag *</Label>
          <Input
            id="schadentag"
            type="date"
            value={data.schadentag}
            onChange={(e) => onUpdate('schadentag', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schadenort">Schadenort *</Label>
          <Input
            id="schadenort"
            value={data.schadenort}
            onChange={(e) => onUpdate('schadenort', e.target.value)}
            placeholder="Unfallort"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schadennummer">Schadennummer</Label>
          <Input
            id="schadennummer"
            value={data.schadennummer}
            onChange={(e) => onUpdate('schadennummer', e.target.value)}
            placeholder="z.B. SN-2024-001"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="kennzeichen">Amtl. Kennzeichen *</Label>
          <Input
            id="kennzeichen"
            value={data.kennzeichen}
            onChange={(e) => onUpdate('kennzeichen', e.target.value.toUpperCase())}
            placeholder="K-AB 1234"
            className={`font-mono ${data.kennzeichen ? 'bg-green-50' : ''}`}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="versicherungsnummer">Vers.-Nummer *</Label>
          <Input
            id="versicherungsnummer"
            value={data.versicherungsnummer}
            onChange={(e) => onUpdate('versicherungsnummer', e.target.value)}
            placeholder="123456789"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="selbstbeteiligung">Selbstbeteiligung</Label>
          <select
            id="selbstbeteiligung"
            value={data.selbstbeteiligung}
            onChange={(e) => onUpdate('selbstbeteiligung', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Bitte wählen --</option>
            <option value="150">150 €</option>
            <option value="300">300 €</option>
            <option value="500">500 €</option>
            <option value="1000">1000 €</option>
          </select>
        </div>
      </div>

      {/* VIN Eingabe */}
      <div className="space-y-2">
        <Label htmlFor="vin" className="flex items-center gap-2">
          VIN / Fahrgestellnummer
          <span className="text-sm text-gray-500">(17-stellige Fahrzeug-Identifikationsnummer)</span>
          {vinValidation && (
            <Badge variant={vinValidation === 'valid' ? 'default' : 'destructive'}>
              {vinValidation === 'valid' ? '✓ VIN gültig' : '✗ VIN ungültig'}
            </Badge>
          )}
        </Label>
        <Input
          id="vin"
          value={data.vin}
          onChange={(e) => {
            const value = e.target.value.toUpperCase()
            onUpdate('vin', value)
            validateVIN(value)
          }}
          maxLength={17}
          placeholder="z.B. WBAVA31030NL12345"
          className={`font-mono ${data.vin ? 'bg-green-50' : ''}`}
        />
        <div className="text-sm text-gray-500">
          Optional: 17-stellige VIN (Vehicle Identification Number)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="scheibe">Welche Scheibe? *</Label>
          <select
            id="scheibe"
            value={data.scheibe}
            onChange={(e) => onUpdate('scheibe', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Bitte wählen --</option>
            <option value="Frontscheibe">Frontscheibe</option>
            <option value="Seitenscheibe Fahrer">Seitenscheibe Fahrer</option>
            <option value="Seitenscheibe Beifahrer">Seitenscheibe Beifahrer</option>
            <option value="Seitenscheibe HL">Seitenscheibe HL</option>
            <option value="Seitenscheibe HR">Seitenscheibe HR</option>
            <option value="Heckscheibe">Heckscheibe</option>
            <option value="Dach">Dach</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="auftragstyp">Auftragstyp *</Label>
          <select
            id="auftragstyp"
            value={data.auftragstyp}
            onChange={(e) => onUpdate('auftragstyp', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Bitte wählen --</option>
            <option value="Kostenvoranschlag">Kostenvoranschlag</option>
            <option value="Reparaturauftrag">Reparaturauftrag</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vorsteuer_berechtigt">Vorsteuerabzugsberechtigt</Label>
          <select
            id="vorsteuer_berechtigt"
            value={data.vorsteuer_berechtigt}
            onChange={(e) => onUpdate('vorsteuer_berechtigt', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Bitte wählen --</option>
            <option value="Nein">Nein</option>
            <option value="Ja">Ja</option>
          </select>
        </div>
      </div>
    </div>
  )
}