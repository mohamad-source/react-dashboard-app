import React, { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { supabase } from '../../../lib/supabase'
//import { aktenApi } from '../../../lib/aktenApi'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  TestTube,
  AlertTriangle
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
  marke: string
  model: string
}

interface KundendatenStepProps {
  data: KundendatenData
  onUpdate: (field: keyof KundendatenData, value: string) => void
  showValidation?: boolean
  onVersicherungsdatenUpdate?: (versicherungsdaten: {
    versicherungsname: string
    marke: string
    modell: string
    telefon: string
  }) => void
}

interface ZOnlineRequest {
  requestor: string;
  password: string;
  requestType: '1' | '2' | '3';
  dateOfLoss: string;
  licenceNumber: string;
  country: string;
  admissionOfficeRequestDesired: '0' | '1';
}

interface ZOnlineResponse {
  success: boolean;
  data: {
    additionalInfo: {
      ResponseCode: string;
      ManufacturerName?: string;
      TypeName?: string;
      InsuranceCompanyName?: string;
      InsurancePOTelephoneNo?: string;
    }
  };
}

export default function KundendatenStep({ data, onUpdate, showValidation = false, onVersicherungsdatenUpdate }: KundendatenStepProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [vinValidation, setVinValidation] = useState<'valid' | 'invalid' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [zonlineData, setZonlineData] = useState<ZOnlineResponse | null>(null)
  const [showZonlineModal, setShowZonlineModal] = useState(false)

  // API Configuration für Fahrzeugschein Scanner
  const API_URL = import.meta.env.VITE_FAHRZEUGSCHEIN_API_URL || 'https://api.fahrzeugschein-scanner.de/'
  const API_KEY = import.meta.env.VITE_FAHRZEUGSCHEIN_API_KEY

  // PFLICHTFELDER DEFINITION
  const requiredFields: (keyof KundendatenData)[] = [
    'kunde',
    'fahrzeugtyp',
    'adresse1',
    'adresse2',
    'schadentag',
    'schadenort',
    'kennzeichen',
    'versicherungsnummer',
    'scheibe',
    'auftragstyp'
  ]

  // VALIDIERUNG: Prüfen ob Feld leer ist
  const isFieldEmpty = (field: keyof KundendatenData): boolean => {
    const value = data[field]
    return !value || value.trim() === ''
  }

  // VALIDIERUNG: Prüfen ob Feld Pflichtfeld ist UND leer
  const isRequiredFieldEmpty = (field: keyof KundendatenData): boolean => {
    return requiredFields.includes(field) && isFieldEmpty(field)
  }

  // CSS-KLASSEN für Feld-Styling
  const getFieldClassName = (field: keyof KundendatenData): string => {
    const baseClass = "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all"
    const isRequired = requiredFields.includes(field)
    const isEmpty = isFieldEmpty(field)

    if (!showValidation) {
      // Pflichtfelder subtil markieren
      if (isRequired && isEmpty) {
        return `${baseClass} border-blue-400 bg-blue-50/30 focus:ring-blue-500 focus:border-blue-500`
      } else if (!isEmpty) {
        return `${baseClass} border-green-400 bg-green-50 focus:ring-green-500 focus:border-green-500`
      } else {
        return `${baseClass} border-gray-300 focus:ring-blue-500`
      }
    }

    // Mit Validierung
    if (isRequiredFieldEmpty(field)) {
      return `${baseClass} border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500`
    } else if (!isFieldEmpty(field)) {
      return `${baseClass} border-green-400 bg-green-50 focus:ring-green-500 focus:border-green-500`
    } else {
      return `${baseClass} border-gray-300 focus:ring-blue-500`
    }
  }

  // LABEL mit Pflichtfeld-Kennzeichnung
  const renderLabel = (htmlFor: string, text: string, field: keyof KundendatenData) => {
    const isRequired = requiredFields.includes(field)
    const isEmpty = isRequiredFieldEmpty(field)

    return (
      <Label
        htmlFor={htmlFor}
        className={`flex items-center gap-2 min-h-[20px] ${showValidation && isEmpty ? 'text-red-600' : isRequired ? 'text-blue-700 font-medium' : ''}`}
      >
        {text}
        {isRequired && (
          <span className={`text-red-500 font-bold ${!showValidation ? 'animate-pulse' : ''}`}>*</span>
        )}
        {showValidation && isEmpty && (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        )}
      </Label>
    )
  }

  // ÜBERSICHT: Fehlende Pflichtfelder
  const getMissingRequiredFields = () => {
    return requiredFields.filter(field => isFieldEmpty(field))
  }

  // File Upload Handler - MODIFIZIERT für automatischen Scan
  const handleFileSelect = useCallback(async (file: File) => {
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

    // Automatisch scannen nach File-Auswahl
    await scanFahrzeugscheinAuto(file)
  }, [])

  // Neue Funktion für automatischen Scan
  const scanFahrzeugscheinAuto = async (file: File) => {
    setUploadStatus('uploading')
    setUploadMessage('Fahrzeugschein wird automatisch gescannt...')

    try {
      const formData = new FormData()
      formData.append('file', file)
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
        if (result.d1) {
          onUpdate('marke', result.d1)
        } else if (result.maker) {
          onUpdate('marke', result.maker)
        }
        if (result.model) {
          onUpdate('model', result.model)
        }

        if (result.registrationNumber) {
          console.log('Kennzeichen erkannt, rufe Z@Online API auf...')
          const zonlineResult = await callZOnlineAPI(result.registrationNumber)
          if (zonlineResult && zonlineResult.success && zonlineResult.data.additionalInfo.ResponseCode === '0') {
            const apiData = zonlineResult.data.additionalInfo;
            setZonlineData(zonlineResult)

            if (apiData.InsurancePolicyNumber) {
              onUpdate('versicherungsnummer', apiData.InsurancePolicyNumber)
            }

            if (onVersicherungsdatenUpdate) {
              onVersicherungsdatenUpdate({
                versicherungsname: apiData.InsuranceCompanyName || '',
                marke: apiData.ManufacturerName || '',
                modell: apiData.TypeName || '',
                telefon: apiData.InsurancePOTelephoneNo || ''
              })
            }
          }
        }

        setUploadStatus('success')
        setUploadMessage('Fahrzeugschein automatisch gescannt! Felder wurden ausgefüllt.')
        setShowZonlineModal(true)
      } else {
        setUploadStatus('error')
        setUploadMessage(result.message || 'Fehler beim automatischen Scannen')
      }
    } catch (error) {
      setUploadStatus('error')
      setUploadMessage('Verbindungsfehler beim automatischen Scannen')
    }
  }

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

  // Manueller Scan (Fallback Button)
  const scanFahrzeugschein = async () => {
    if (!selectedFile) return
    await scanFahrzeugscheinAuto(selectedFile)
  }

  // Test-Daten ausfüllen
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
    onUpdate('auftragstyp', 'Reparaturauftrag')
    onUpdate('vorsteuer_berechtigt', 'Nein')
  }

  // VIN Validation
  const validateVIN = (vin: string) => {
    if (vin.length === 17) {
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

  const callZOnlineAPI = async (kennzeichen: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/zonline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseNumber: kennzeichen,
          requestor: import.meta.env.VITE_ZONLINE_REQUESTOR || '',
          password: import.meta.env.VITE_ZONLINE_PASSWORD || ''
        })
      });

      const data = await response.json();

      if (data.success && data.data.additionalInfo.ResponseCode === '0') {
        const apiData = data.data.additionalInfo;

        // Versicherungsnummer setzen
        if (apiData.InsurancePolicyNumber) {
          onUpdate('versicherungsnummer', apiData.InsurancePolicyNumber)
        }

        // Marke/Modell setzen falls nicht schon vom Fahrzeugschein-Scanner gesetzt
        if (apiData.ManufacturerName && !data.marke) {
          onUpdate('marke', apiData.ManufacturerName)
        }
        if (apiData.TypeName && !data.model) {
          onUpdate('model', apiData.TypeName)
        }

        // Versicherungsdaten weiterleiten
        if (onVersicherungsdatenUpdate) {
          onVersicherungsdatenUpdate({
            versicherungsname: apiData.InsuranceCompanyName || '',
            marke: apiData.ManufacturerName || '',
            modell: apiData.TypeName || '',
            telefon: apiData.InsurancePOTelephoneNo || ''
          })
        }

        return apiData;
      }

      return null;
    } catch (error) {
      console.error('Z@Online API Fehler:', error);
      return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* VALIDIERUNGS-ÜBERSICHT */}
      {showValidation && getMissingRequiredFields().length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Bitte füllen Sie noch folgende Pflichtfelder aus:</strong>
            <div className="mt-2 flex flex-wrap gap-2">
              {getMissingRequiredFields().map(field => (
                <Badge key={field} variant="destructive" className="text-xs">
                  {field === 'kunde' ? 'Kunde' :
                    field === 'fahrzeugtyp' ? 'Fahrzeugtyp' :
                      field === 'adresse1' ? 'Adresse 1' :
                        field === 'adresse2' ? 'PLZ/Ort' :
                          field === 'schadentag' ? 'Schadentag' :
                            field === 'schadenort' ? 'Schadenort' :
                              field === 'kennzeichen' ? 'Kennzeichen' :
                                field === 'versicherungsnummer' ? 'Versicherung' :
                                  field === 'scheibe' ? 'Scheibe' :
                                    field === 'auftragstyp' ? 'Auftragstyp' : field}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

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
              Unterstützte Formate: JPG, JPEG, PNG, PDF • Automatischer Scan nach Upload
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

          {/* Buttons */}
          <div className="flex gap-4 mt-4">
            <Button
              onClick={fillTestData}
              variant="outline"
            >
              <TestTube className="mr-2 h-4 w-4" />
              Test-Daten
            </Button>

            {/* Fallback Scan Button - nur wenn Datei vorhanden */}
            {selectedFile && (
              <Button
                onClick={scanFahrzeugschein}
                disabled={uploadStatus === 'uploading'}
                variant="secondary"
              >
                {uploadStatus === 'uploading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scannt...
                  </>
                ) : (
                  'Erneut scannen'
                )}
              </Button>
            )}
          </div>

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

      {/* FORMULAR mit Validierung */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {renderLabel('kunde', 'Kunde', 'kunde')}
          <Input
            id="kunde"
            value={data.kunde}
            onChange={(e) => onUpdate('kunde', e.target.value)}
            placeholder="z.B. Max Mustermann"
            className={getFieldClassName('kunde')}
          />
        </div>

        <div className="space-y-2">
          {renderLabel('fahrzeugtyp', 'Fahrzeugtyp', 'fahrzeugtyp')}
          <select
            id="fahrzeugtyp"
            value={data.fahrzeugtyp}
            onChange={(e) => onUpdate('fahrzeugtyp', e.target.value)}
            className={getFieldClassName('fahrzeugtyp')}
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
          {renderLabel('adresse1', 'Adresse 1', 'adresse1')}
          <Input
            id="adresse1"
            value={data.adresse1}
            onChange={(e) => onUpdate('adresse1', e.target.value)}
            placeholder="Straße und Hausnummer"
            className={getFieldClassName('adresse1')}
          />
        </div>

        <div className="space-y-2">
          {renderLabel('adresse2', 'Adresse 2 (PLZ/Ort)', 'adresse2')}
          <Input
            id="adresse2"
            value={data.adresse2}
            onChange={(e) => onUpdate('adresse2', e.target.value)}
            placeholder="PLZ Ort"
            className={getFieldClassName('adresse2')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          {renderLabel('schadentag', 'Schadentag', 'schadentag')}
          <Input
            id="schadentag"
            type="date"
            value={data.schadentag}
            onChange={(e) => onUpdate('schadentag', e.target.value)}
            className={getFieldClassName('schadentag')}
          />
        </div>

        <div className="space-y-2">
          {renderLabel('schadenort', 'Schadenort', 'schadenort')}
          <Input
            id="schadenort"
            value={data.schadenort}
            onChange={(e) => onUpdate('schadenort', e.target.value)}
            placeholder="Unfallort"
            className={getFieldClassName('schadenort')}
          />
        </div>

        <div className="space-y-2">
          {renderLabel('schadennummer', 'Schadennummer', 'schadennummer')}
          <Input
            id="schadennummer"
            value={data.schadennummer}
            onChange={(e) => onUpdate('schadennummer', e.target.value)}
            placeholder="z.B. SN-2024-001"
            className={getFieldClassName('schadennummer')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          {renderLabel('kennzeichen', 'Amtl. Kennzeichen', 'kennzeichen')}
          <Input
            id="kennzeichen"
            value={data.kennzeichen}
            onChange={(e) => onUpdate('kennzeichen', e.target.value.toUpperCase())}
            placeholder="K-AB 1234"
            className={`font-mono ${getFieldClassName('kennzeichen')}`}
          />
        </div>

        <div className="space-y-2">
          {renderLabel('versicherungsnummer', 'Vers.-Nummer', 'versicherungsnummer')}
          <Input
            id="versicherungsnummer"
            value={data.versicherungsnummer}
            onChange={(e) => onUpdate('versicherungsnummer', e.target.value)}
            placeholder="123456789"
            className={getFieldClassName('versicherungsnummer')}
          />
        </div>

        <div className="space-y-2">
          {renderLabel('selbstbeteiligung', 'Selbstbeteiligung', 'selbstbeteiligung')}
          <select
            id="selbstbeteiligung"
            value={data.selbstbeteiligung}
            onChange={(e) => onUpdate('selbstbeteiligung', e.target.value)}
            className={getFieldClassName('selbstbeteiligung')}
          >
            <option value="">-- Bitte wählen --</option>
            <option value="150">150 €</option>
            <option value="300">300 €</option>
            <option value="500">500 €</option>
            <option value="1000">1000 €</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="marke">Marke</Label>
          <Input
            id="marke"
            value={data.marke}
            onChange={(e) => onUpdate('marke', e.target.value)}
            placeholder="Fahrzeugmarke"
            className={getFieldClassName('marke')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={data.model}
            onChange={(e) => onUpdate('model', e.target.value)}
            placeholder="Model"
            className={getFieldClassName('model')}
          />
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
          className={`font-mono ${getFieldClassName('vin')}`}
        />
        <div className="text-sm text-gray-500">
          Optional: 17-stellige VIN (Vehicle Identification Number)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          {renderLabel('scheibe', 'Welche Scheibe?', 'scheibe')}
          <select
            id="scheibe"
            value={data.scheibe}
            onChange={(e) => onUpdate('scheibe', e.target.value)}
            className={getFieldClassName('scheibe')}
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
          {renderLabel('auftragstyp', 'Auftragstyp', 'auftragstyp')}
          <select
            id="auftragstyp"
            value={data.auftragstyp}
            onChange={(e) => onUpdate('auftragstyp', e.target.value)}
            className={getFieldClassName('auftragstyp')}
          >
            <option value="">-- Bitte wählen --</option>
            <option value="Kostenvoranschlag">Kostenvoranschlag</option>
            <option value="Reparaturauftrag">Reparaturauftrag</option>
          </select>
        </div>

        <div className="space-y-2">
          {renderLabel('vorsteuer_berechtigt', 'Vorsteuerabzugsberechtigt', 'vorsteuer_berechtigt')}
          <select
            id="vorsteuer_berechtigt"
            value={data.vorsteuer_berechtigt}
            onChange={(e) => onUpdate('vorsteuer_berechtigt', e.target.value)}
            className={getFieldClassName('vorsteuer_berechtigt')}
          >
            <option value="">-- Bitte wählen --</option>
            <option value="Nein">Nein</option>
            <option value="Ja">Ja</option>
          </select>
        </div>
      </div>

      {/* Z@Online Modal */}
      {showZonlineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-center">
                Fahrzeugdaten und Versicherungsdaten wurden ausgelesen
              </h3>

              {zonlineData && zonlineData.success && zonlineData.data.additionalInfo.ResponseCode === '0' && (
                <div className="space-y-2 bg-green-50 p-4 rounded-lg mb-4">
                  <div><strong>Hersteller:</strong> {zonlineData.data.additionalInfo.ManufacturerName || ''}</div>
                  <div><strong>Typ:</strong> {zonlineData.data.additionalInfo.TypeName || ''}</div>
                  <div><strong>Versicherung:</strong> {zonlineData.data.additionalInfo.InsuranceCompanyName || ''}</div>
                  <div><strong>Telefon:</strong> {zonlineData.data.additionalInfo.InsurancePOTelephoneNo || ''}</div>
                </div>
              )}

              <div className="flex justify-center">
                <Button onClick={() => setShowZonlineModal(false)}>
                  OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}