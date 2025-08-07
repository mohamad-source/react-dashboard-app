import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Signature, 
  Download,
  Check,
  X,
  Save,
  User,
  Car,
  Shield,
  CheckCircle
} from 'lucide-react'

interface KundendatenData {
  kunde: string
  kennzeichen: string
  versicherungsnummer: string
  selbstbeteiligung: string
  vorsteuer_berechtigt: string
  schadentag: string
  schadenort: string
  schadennummer: string
}

interface AbtretungData {
  // Kunde
  kundenname: string
  mobilnr: string
  adresse: string
  
  // Versicherung
  versicherungsschein: string
  schadennummer: string
  versicherungsname: string
  selbstbeteiligung: string
  vorsteuer: string
  
  // Fahrzeug
  marke: string
  modell: string
  kennzeichen: string
  schadenzeitpunkt: string
  schadenbeschreibung: string
  
  // Abtretung
  kasko: boolean
  haftpflicht: boolean
  
  // Unterschrift
  signatureData: string
  isSignatureApplied: boolean
}

interface AbtretungStepProps {
  data: AbtretungData
  kundendaten: KundendatenData
  onUpdate: (field: keyof AbtretungData, value: any) => void
  isAkteSaved: boolean
  akteId?: number
}

export default function AbtretungStep({ data, kundendaten, onUpdate, isAkteSaved, akteId }: AbtretungStepProps) {
  const { id: urlId } = useParams()
  const actualAkteId = akteId || (urlId ? parseInt(urlId) : null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [isAbtretungSigned, setIsAbtretungSigned] = useState(false)
  const [signedDate, setSignedDate] = useState<string>('')

  // API URL from environment
  const API_BASE = import.meta.env.VITE_API_URL.replace('/api', '')

  // Prüfen ob Abtretung bereits signiert ist
  useEffect(() => {
    if (actualAkteId && isAkteSaved) {
      checkAbtretungStatus()
    }
  }, [actualAkteId, isAkteSaved])

  const checkAbtretungStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/akten/${actualAkteId}`)
      const akteData = await response.json()
      
      if (akteData.abtretung_signiert) {
        setIsAbtretungSigned(true)
        setSignedDate(new Date(akteData.signiert_am).toLocaleDateString('de-DE') + ' ' + 
                     new Date(akteData.signiert_am).toLocaleTimeString('de-DE'))
      }
    } catch (error) {
      console.error('Fehler beim Prüfen des Abtretungsstatus:', error)
    }
  }

  // Kundendaten aus übergeordnetem Formular übernehmen
  useEffect(() => {
    if (!isAbtretungSigned) {
      if (kundendaten.kunde && !data.kundenname) {
        onUpdate('kundenname', kundendaten.kunde)
      }
      if (kundendaten.kennzeichen && !data.kennzeichen) {
        onUpdate('kennzeichen', kundendaten.kennzeichen)
      }
      if (kundendaten.versicherungsnummer && !data.versicherungsschein) {
        onUpdate('versicherungsschein', kundendaten.versicherungsnummer)
      }
      if (kundendaten.schadennummer && !data.schadennummer) {
        onUpdate('schadennummer', kundendaten.schadennummer)
      }
      if (kundendaten.selbstbeteiligung && !data.selbstbeteiligung) {
        onUpdate('selbstbeteiligung', kundendaten.selbstbeteiligung)
      }
      if (kundendaten.schadentag && !data.schadenzeitpunkt) {
        onUpdate('schadenzeitpunkt', kundendaten.schadentag)
      }
      if (kundendaten.schadenort && !data.schadenbeschreibung) {
        onUpdate('schadenbeschreibung', kundendaten.schadenort)
      }
      if (kundendaten.vorsteuer_berechtigt && !data.vorsteuer) {
        onUpdate('vorsteuer', kundendaten.vorsteuer_berechtigt.toLowerCase())
      }
    }
  }, [kundendaten, data, onUpdate, isAbtretungSigned])

  // Canvas Setup
  useEffect(() => {
    if (!showSignatureModal) return
    
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas Größe setzen
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    
    // Canvas Style
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [showSignatureModal])

  // Signature Drawing Functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    setHasSignature(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setHasSignature(false)
  }

  const applySignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    const signatureData = canvas.toDataURL()
    onUpdate('signatureData', signatureData)
    onUpdate('isSignatureApplied', true)
    setShowSignatureModal(false)
  }

  const saveAbtretung = async () => {
    if (!data.isSignatureApplied || !data.signatureData) {
      alert('Bitte unterschreiben Sie zuerst.')
      return
    }

    try {
      console.log('Abtretung wird gespeichert...')
      
      if (!akteId) {
        throw new Error('Keine Akte-ID verfügbar')
      }
      
      const formData = {
        mobilnr: data.mobilnr,
        schadennummer: data.schadennummer,
        versicherungsname: data.versicherungsname,
        selbstbeteiligung: data.selbstbeteiligung,
        vorsteuer: data.vorsteuer,
        marke: data.marke,
        modell: data.modell,
        schadenzeitpunkt: data.schadenzeitpunkt,
        schadenbeschreibung: data.schadenbeschreibung,
        kasko: data.kasko,
        haftpflicht: data.haftpflicht
      }

      const response = await fetch(`${API_BASE}/api/akten/${akteId}/abtretung`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          signature: data.signatureData,
          formData
        })
      })

      const result = await response.json()

      if (result.success) {
        alert('Abtretung erfolgreich gespeichert!')
        console.log('Abtretung gespeichert:', result)
        
        // Status aktualisieren
        setIsAbtretungSigned(true)
        setSignedDate(new Date().toLocaleDateString('de-DE') + ' ' + 
                     new Date().toLocaleTimeString('de-DE'))
      } else {
        throw new Error(result.error || 'Speichern fehlgeschlagen')
      }

    } catch (error) {
      console.error('Speicher-Fehler:', error)
      alert('Fehler beim Speichern: ' + (error as Error).message)
    }
  }

  if (!isAkteSaved) {
    return (
      <div className="space-y-6">
        <Alert>
          <User className="h-4 w-4" />
          <AlertDescription>
            <strong>Hinweis:</strong> Bitte speichern Sie zuerst die Kundendaten, bevor Sie die Abtretung ausfüllen können.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Wenn Abtretung bereits vorhanden ist - PDF-Ansicht anzeigen
  if (isAbtretungSigned) {
    return (
      <div className="space-y-6">
        {/* Success Alert */}
        <Alert className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-green-800 text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Abtretung bereits erstellt
                </h4>
                <p className="text-green-700 mt-1">
                  Erfolgreich unterschrieben am: <strong>{signedDate}</strong>
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Main PDF Card */}
        <Card className="border-2 border-blue-200 shadow-lg">
          <CardContent className="p-8">
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      {kundendaten.kunde}
                    </h5>
                    <p className="text-gray-600 mt-1">Versicherungsnehmer</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-full">
                      <Car className="h-4 w-4 text-blue-600" />
                      <span className="font-mono font-bold text-blue-800">
                        {kundendaten.kennzeichen}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-emerald-600 font-medium">Status</p>
                      <p className="font-bold text-emerald-800">Abgeschlossen</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Signature className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Unterschrift</p>
                      <p className="font-bold text-blue-800">Erhalten</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Dokument</p>
                      <p className="font-bold text-purple-800">PDF verfügbar</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Download Section */}
              <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
                <div className="text-center space-y-4">
                  <div>
                    <h6 className="font-bold text-gray-800 text-lg mb-2">Abtretungserklärung herunterladen</h6>
                    <p className="text-gray-600 text-sm">
                      Das vollständige PDF-Dokument mit allen Daten und Unterschrift
                    </p>
                  </div>
                  
                  <Button
                    onClick={() => window.open(`${API_BASE}/api/akten/${actualAkteId}/pdf`, '_blank')}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    size="lg"
                  >
                    <Download className="mr-3 h-5 w-5" />
                    Abtretung PDF herunterladen
                  </Button>
                  
                  <p className="text-xs text-gray-500 mt-2">
                    📄 PDF wird in einem neuen Tab geöffnet
                  </p>
                </div>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Akte-ID: #{actualAkteId}</span>
                  <span>Erstellt: {signedDate}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Normales Formular wenn Abtretung noch nicht vorhanden
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Alert>
        <AlertDescription>
          <strong>Kunde:</strong> {kundendaten.kunde} ({kundendaten.kennzeichen})
          <br />
          <small className="text-muted-foreground">Füllen Sie das Formular aus und unterschreiben Sie am Ende</small>
        </AlertDescription>
      </Alert>

      {/* Abtretungserklärung */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Abtretungserklärung - AutoGlasNeu
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          
          {/* 1. Kunde / Versicherungsnehmer */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">1. Kunde / Versicherungsnehmer</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <Label htmlFor="kundenname">Vor/Nachname</Label>
                <Input
                  id="kundenname"
                  value={data.kundenname}
                  onChange={(e) => onUpdate('kundenname', e.target.value)}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="mobilnr">Mobilnr.</Label>
                <Input
                  id="mobilnr"
                  value={data.mobilnr}
                  onChange={(e) => onUpdate('mobilnr', e.target.value)}
                  placeholder="Mobilnummer"
                />
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="adresse">Straße PLZ / Ort</Label>
              <Input
                id="adresse"
                value={data.adresse}
                onChange={(e) => onUpdate('adresse', e.target.value)}
                placeholder="Vollständige Adresse"
              />
            </div>
          </div>

          {/* 2. Versicherung */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">2. Versicherung</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="versicherungsschein">VersicherungsscheinNr.</Label>
                <Input
                  id="versicherungsschein"
                  value={data.versicherungsschein}
                  onChange={(e) => onUpdate('versicherungsschein', e.target.value)}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="schadennummer">Schadennummer</Label>
                <Input
                  id="schadennummer"
                  value={data.schadennummer}
                  onChange={(e) => onUpdate('schadennummer', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="versicherungsname">Versicherungsname</Label>
                <Input
                  id="versicherungsname"
                  value={data.versicherungsname}
                  onChange={(e) => onUpdate('versicherungsname', e.target.value)}
                  placeholder="Name der Versicherung"
                />
              </div>
              <div>
                <Label htmlFor="selbstbeteiligung">Selbstbeteiligung in EUR</Label>
                <Input
                  id="selbstbeteiligung"
                  type="number"
                  value={data.selbstbeteiligung}
                  onChange={(e) => onUpdate('selbstbeteiligung', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Vorsteurabzugsberechtigt:</Label>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="vorsteuer_ja"
                    name="vorsteuer"
                    checked={data.vorsteuer === 'ja'}
                    onChange={() => onUpdate('vorsteuer', 'ja')}
                  />
                  <Label htmlFor="vorsteuer_ja">ja</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="vorsteuer_nein"
                    name="vorsteuer"
                    checked={data.vorsteuer === 'nein'}
                    onChange={() => onUpdate('vorsteuer', 'nein')}
                  />
                  <Label htmlFor="vorsteuer_nein">nein</Label>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Fahrzeug */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Car className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold">3. Fahrzeug/Schadenbereich</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="marke">Marke:</Label>
                  <Input
                    id="marke"
                    value={data.marke}
                    onChange={(e) => onUpdate('marke', e.target.value)}
                    placeholder="Fahrzeugmarke"
                  />
                </div>
                <div>
                  <Label htmlFor="modell">Modell:</Label>
                  <Input
                    id="modell"
                    value={data.modell}
                    onChange={(e) => onUpdate('modell', e.target.value)}
                    placeholder="Fahrzeugmodell"
                  />
                </div>
                <div>
                  <Label htmlFor="kennzeichen_fahrzeug">Kennzeichen:</Label>
                  <Input
                    id="kennzeichen_fahrzeug"
                    value={data.kennzeichen}
                    onChange={(e) => onUpdate('kennzeichen', e.target.value)}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label htmlFor="schadenzeitpunkt">Schadenzeitpunkt:</Label>
                  <Input
                    id="schadenzeitpunkt"
                    type="date"
                    value={data.schadenzeitpunkt}
                    onChange={(e) => onUpdate('schadenzeitpunkt', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Car className="h-24 w-24 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="schadenbeschreibung">Schadenbeschreibung:</Label>
              <textarea
                id="schadenbeschreibung"
                value={data.schadenbeschreibung}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate('schadenbeschreibung', e.target.value)}
                placeholder="Detaillierte Beschreibung des Schadens"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Abtretungstext */}
          <div className="mb-6">
            <p className="font-semibold mb-3">Hiermit trete ich meinen Schadenersatzanspruch / Leistungsanspruch</p>
            <div className="space-y-2 mb-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="kasko"
                  checked={data.kasko}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate('kasko', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="kasko">Gegen meine Kaskoversicherung</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="haftpflicht"
                  checked={data.haftpflicht}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate('haftpflicht', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="haftpflicht">Gegen die Haftpflichtversicherung des Unfallgegners</Label>
              </div>
            </div>
            <p className="font-semibold">
              In Höhe der Reparaturkosten zur Sicherung des Anspruches auf Bezahlung der Reparaturkosten von voraussichtlich (siehe Rechnung) unwiderruflich an die oben genannte Werkstatt ab.
            </p>
          </div>

          {/* Unterschrift */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Signature className="h-5 w-5" />
              Unterschrift VN:
            </h4>
            
            {/* Unterschrift Display */}
            <div 
              className="border-3 border-dashed border-blue-300 p-4 bg-blue-50 rounded-lg cursor-pointer min-h-24 flex items-center justify-center"
              onClick={() => setShowSignatureModal(true)}
            >
              {data.isSignatureApplied && data.signatureData ? (
                <img src={data.signatureData} alt="Unterschrift" className="max-h-20" />
              ) : (
                <div className="text-center text-blue-600">
                  <Signature className="h-8 w-8 mx-auto mb-2" />
                  <div className="font-semibold">Unterschrift VN:</div>
                  <small>Klicken Sie hier zum Unterschreiben</small>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => setShowSignatureModal(true)}
                variant="outline"
                className="flex-1"
              >
                <Signature className="mr-2 h-4 w-4" />
                {data.isSignatureApplied ? 'Unterschrift ändern' : 'Unterschreiben'}
              </Button>
              {data.isSignatureApplied && (
                <Button
                  onClick={saveAbtretung}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Abtretung speichern
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Unterschrift</h3>
            
            <div className="border-2 border-dashed border-blue-300 rounded-lg mb-4">
              <canvas
                ref={canvasRef}
                className="w-full h-48 cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>

            <div className="flex justify-between gap-2">
              <Button
                onClick={clearSignature}
                variant="outline"
              >
                <X className="mr-2 h-4 w-4" />
                Löschen
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowSignatureModal(false)}
                  variant="outline"
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={applySignature}
                  disabled={!hasSignature}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Übernehmen
                </Button>
              </div>
            </div>
            
            <div className="mt-3 text-center">
              <small className="text-gray-500">
                1. Unterschreiben Sie hier • 2. Übernehmen Sie die Unterschrift • 3. Speichern Sie die Abtretung
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}