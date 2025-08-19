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
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface KundendatenData {
  kunde: string
  kennzeichen: string
  fahrzeugtyp: string
  vin: string
  adresse1: string
  adresse2: string
  versicherungsnummer: string
  schadennummer: string
  selbstbeteiligung: string
  schadentag: string
  schadenort: string
  vorsteuer_berechtigt: string
  marke: string
  model: string
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
  const [showModal, setShowModal] = useState<{
    type: 'error' | 'success' | 'info',
    title: string,
    message: string,
    onConfirm?: () => void
  } | null>(null)

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
      if (kundendaten.marke && !data.marke) {
        onUpdate('marke', kundendaten.marke)
      }
      if (kundendaten.model && !data.modell) {
        onUpdate('modell', kundendaten.model)
      }
      if (kundendaten.adresse1 && kundendaten.adresse2 && !data.adresse) {
        const vollAdresse = `${kundendaten.adresse1}, ${kundendaten.adresse2}`
        onUpdate('adresse', vollAdresse)
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
      setShowModal({
        type: 'error',
        title: 'Unterschrift fehlt',
        message: 'Bitte unterschreiben Sie zuerst.'
      })
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
        setShowModal({
          type: 'success',
          title: 'Erfolgreich gespeichert',
          message: 'Abtretung erfolgreich gespeichert!',
          onConfirm: () => {
            // Status aktualisieren
            setIsAbtretungSigned(true)
            setSignedDate(new Date().toLocaleDateString('de-DE') + ' ' + 
                         new Date().toLocaleTimeString('de-DE'))
          }
        })
        console.log('Abtretung gespeichert:', result)
      } else {
        throw new Error(result.error || 'Speichern fehlgeschlagen')
      }

    } catch (error) {
      console.error('Speicher-Fehler:', error)
      setShowModal({
        type: 'error',
        title: 'Speicherfehler',
        message: 'Fehler beim Speichern: ' + (error as Error).message
      })
    }
  }

  // Wenn Abtretung bereits vorhanden ist - PDF-Ansicht anzeigen
  if (isAbtretungSigned) {
    return (
      <div className="space-y-4">
        {/* Success Alert */}
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertDescription>
            <div>
              <h4 className="font-semibold text-green-800">Abtretung bereits erstellt</h4>
              <p className="text-green-700 text-sm mt-1">
                Unterschrieben am: {signedDate}
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Main Card */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-semibold text-lg">{kundendaten.kunde}</h5>
                  <p className="text-gray-600 text-sm">Versicherungsnehmer</p>
                </div>
                <Badge variant="outline" className="font-mono">
                  {kundendaten.kennzeichen}
                </Badge>
              </div>

              {/* Download Section */}
              <div className="text-center py-4">
                <Button
                  onClick={() => window.open(`${API_BASE}/api/akten/${actualAkteId}/pdf`, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF herunterladen
                </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="mt-4">
              <Label htmlFor="schadenbeschreibung">Schadenbeschreibung:</Label>
              <textarea
                id="schadenbeschreibung"
                value={data.schadenbeschreibung}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate('schadenbeschreibung', e.target.value)}
                placeholder="Am Fahrzeug mit dem amtlichen Kennzeichen [Kennzeichen eintragen] entstand ein Glasschaden.
Die Frontscheibe / Seitenscheibe / Heckscheibe weist einen Steinschlag / Riss / Bruch im Bereich [Position der Scheibe, z. B. Fahrerseite unten rechts] auf.
Der Schaden beeinträchtigt die Sicht des Fahrers / Stabilität der Scheibe / Verkehrssicherheit und macht eine Reparatur bzw. einen Austausch erforderlich.
Der Schaden trat am [Datum] während der Fahrt / durch einen Steinschlag / äußere Einwirkung auf.
Weitere Vorschäden an der Scheibe sind nicht vorhanden / wurden nicht festgestellt."
                rows={10}
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
                  defaultChecked={true}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate('kasko', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="kasko">Gegen meine Kaskoversicherung</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="haftpflicht"
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

      {/* Modal Component */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {showModal.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                {showModal.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                {showModal.type === 'info' && <AlertCircle className="h-5 w-5 text-blue-500" />}
                {showModal.title}
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowModal(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <p className="text-gray-700">{showModal.message}</p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button 
                onClick={() => {
                  showModal.onConfirm?.()
                  setShowModal(null)
                }}
                className={showModal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 
                          showModal.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 
                          'bg-blue-600 hover:bg-blue-700'}
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}