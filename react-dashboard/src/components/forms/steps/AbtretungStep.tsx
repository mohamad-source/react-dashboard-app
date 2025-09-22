import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useAktenApi } from '../../../hooks/useAktenApi'
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
  AlertCircle,
  Edit,
  AlertTriangle
} from 'lucide-react'

interface KundendatenData {
  kunde: string
  kennzeichen: string
  fahrzeugtyp: string
  vin: string
  adresse1: string
  adresse2: string
  scheibe: string
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
  versicherungsdaten?: {
    versicherungsname: string
    marke: string
    modell: string
    telefon: string
  }
}

export default function AbtretungStep({ data, kundendaten, onUpdate, isAkteSaved, akteId, versicherungsdaten }: AbtretungStepProps) {
  const { id: urlId } = useParams()
  const actualAkteId = akteId || (urlId ? parseInt(urlId) : null)
  const aktenApi = useAktenApi()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [isAbtretungSigned, setIsAbtretungSigned] = useState(false)
  const [signedDate, setSignedDate] = useState<string>('')
  const [editMode, setEditMode] = useState(false)
  const [originalData, setOriginalData] = useState<AbtretungData | null>(null)
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
      const akteData = await aktenApi.getAkte(actualAkteId!)

      if (akteData.abtretung_signiert) {
        setIsAbtretungSigned(true)
        setSignedDate(new Date(akteData.signiert_am).toLocaleDateString('de-DE') + ' ' +
          new Date(akteData.signiert_am).toLocaleTimeString('de-DE'))
      }
    } catch (error) {
      console.error('Fehler beim Prüfen des Abtretungsstatus:', error)
    }
  }

  // Edit-Modus aktivieren
  const enterEditMode = () => {
    setOriginalData({ ...data })
    setEditMode(true)
    // Unterschrift zurücksetzen für neue Signierung
    onUpdate('isSignatureApplied', false)
    onUpdate('signatureData', '')
  }

  // Edit-Modus abbrechen
  const cancelEdit = () => {
    if (originalData) {
      // Ursprüngliche Daten wiederherstellen
      Object.keys(originalData).forEach(key => {
        onUpdate(key as keyof AbtretungData, originalData[key as keyof AbtretungData])
      })
    }
    setEditMode(false)
    setOriginalData(null)
  }

  // Funktion zum Erstellen der vorausgefüllten Schadenbeschreibung
  const generateSchadenbeschreibung = () => {
    const kundenname = kundendaten.kunde || '[Name des Geschädigten]'
    const kennzeichen = kundendaten.kennzeichen || '[Kennzeichen eintragen]'
    const fahrzeugtyp = kundendaten.marke && kundendaten.model
      ? `${kundendaten.marke} ${kundendaten.model}`
      : '[Fahrzeugmarke und Modell]'
    const schadentag = kundendaten.schadentag || '[Schadentag, Datum eintragen]'
    const schadenort = kundendaten.schadenort || '[Straße/Ort des Schadens]'
    const scheibe = kundendaten.scheibe || '[Frontscheibe / Seitenscheibe / Heckscheibe]'

    return `Schadens- und Abtretungserklärung – Glasschaden

Am Fahrzeug des Kunden ${kundenname}, amtliches Kennzeichen ${kennzeichen}, Fahrzeugtyp ${fahrzeugtyp}, ist am ${schadentag} während der Fahrt auf der ${schadenort} ein Glasschaden entstanden.

Die ${scheibe} weist einen [Steinschlag / Riss / Bruch im Bereich …] auf. Dieser Schaden beeinträchtigt die Sicht des Fahrers, die Stabilität der Scheibe sowie die Verkehrssicherheit des Fahrzeugs. Eine Reparatur bzw. ein Austausch der Scheibe ist zwingend erforderlich.

Der Kunde bestätigt hiermit, dass der oben beschriebene Schaden durch äußere Einwirkung (z. B. Steinschlag) während der Fahrt entstanden ist.

Abtretungserklärung

Der Unterzeichner tritt seine Ansprüche aus dem Schadenereignis gegenüber der zuständigen Versicherungsgesellschaft unwiderruflich an die ausführende Autoglas-Werkstatt [Name der Werkstatt] ab.

Die Werkstatt ist hiermit berechtigt, die Reparatur- bzw. Austauschkosten direkt mit der Versicherung abzurechnen.

Dem Kunden entstehen aus dieser Abtretung keine zusätzlichen Kosten, soweit die Versicherung die Regulierung übernimmt.

Besteht jedoch in der Kaskoversicherung des Kunden eine Selbstbeteiligung, verpflichtet sich der Kunde, diesen Betrag nach Rechnungsstellung direkt an die ausführende Werkstatt zu zahlen. Gleiches gilt, falls die Versicherung eine (Teil-)Regulierung verweigert.`
  }

  // Kundendaten aus übergeordnetem Formular übernehmen
  useEffect(() => {
    if (!isAbtretungSigned || editMode) {
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
      if (kundendaten.vorsteuer_berechtigt && !data.vorsteuer) {
        onUpdate('vorsteuer', kundendaten.vorsteuer_berechtigt.toLowerCase())
      }
      if (!data.schadenbeschreibung) {
        onUpdate('schadenbeschreibung', generateSchadenbeschreibung())
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
      if (versicherungsdaten?.versicherungsname && !data.versicherungsname) {
        onUpdate('versicherungsname', versicherungsdaten.versicherungsname)
      }
    }
  }, [kundendaten, versicherungsdaten, data, onUpdate, isAbtretungSigned, editMode])

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

      const result = await aktenApi.saveAbtretung(akteId, data.signatureData, formData)

      if (result.success) {
        setShowModal({
          type: 'success',
          title: editMode ? 'Änderungen gespeichert' : 'Erfolgreich gespeichert',
          message: editMode ? 'Abtretung erfolgreich aktualisiert!' : 'Abtretung erfolgreich gespeichert!',
          onConfirm: () => {
            // Status aktualisieren
            setIsAbtretungSigned(true)
            setSignedDate(new Date().toLocaleDateString('de-DE') + ' ' +
              new Date().toLocaleTimeString('de-DE'))
            setEditMode(false)
            setOriginalData(null)
          }
        })
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

  // Wenn Abtretung bereits vorhanden ist UND nicht im Edit-Modus - PDF-Ansicht anzeigen
  if (isAbtretungSigned && !editMode) {
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

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={async () => {
                    try {
                      const response = await aktenApi.downloadAbtretungsPDF(actualAkteId!)
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `Abtretung_${actualAkteId}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    } catch (error) {
                      console.error('PDF Download Fehler:', error)
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF herunterladen
                </Button>
                <Button
                  variant="outline"
                  onClick={enterEditMode}
                  className="text-orange-600 border-orange-600 hover:bg-orange-50"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Abtretung bearbeiten
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Normales Formular wenn Abtretung noch nicht vorhanden ODER im Edit-Modus
  return (
    <div className="space-y-6">
      {/* Edit-Modus Warnung */}
      {editMode && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertDescription>
            <div>
              <h4 className="font-semibold text-orange-800">Bearbeitungsmodus</h4>
              <p className="text-orange-700 text-sm mt-1">
                Sie bearbeiten eine bereits unterschriebene Abtretung. Änderungen erfordern eine neue Unterschrift.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
            {editMode && <Badge variant="secondary" className="ml-2">Bearbeitung</Badge>}
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
                placeholder="Schadenbeschreibung eingeben..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
              {editMode && (
                <Button
                  onClick={cancelEdit}
                  variant="outline"
                  className="flex-1 text-gray-600"
                >
                  <X className="mr-2 h-4 w-4" />
                  Abbrechen
                </Button>
              )}
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
                  {editMode ? 'Änderungen speichern' : 'Abtretung speichern'}
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