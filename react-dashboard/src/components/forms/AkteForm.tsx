import { useState, useEffect } from 'react'
import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import DashboardLayout from '../DashboardLayout'
import { Check, Copy, ArrowLeft, Undo, ChevronRight as StepCheck } from 'lucide-react'
import KundendatenStep from './steps/KundendatenStep'
import AbtretungStep from './steps/AbtretungStep'
import BilderStep from './steps/BilderStep'
import KalkulationStep from './steps/KalkulationStep'
import DokumentationStep from './steps/DokumentationStep'
import { useAktenApi } from "../../hooks/useAktenApi";
import {
    User,
    FileText,
    Camera,
    Calculator,
    FolderOpen,
    ChevronRight,
    AlertCircle,
    CheckCircle
} from 'lucide-react'

interface FormStep {
    id: string
    title: string
    icon: React.ComponentType<{ className?: string }>
    description: string
}

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

interface Kalkulation {
    id: number
    filename: string
    brutto: number
    netto: number
    erstellt_am: string
}

interface Akte {
    id: number
    status: string
    bearbeitet_am?: string
    signiert_am?: string
}

interface FormData {
    kundendaten: KundendatenData
    abtretung: AbtretungData
    bilder: {
        fahrzeugbilder: string
        schadenbilder: string
        dokumente: string
    }
    kalkulation: {
        schadenssumme: string
        selbstbeteiligung: string
        reparaturkosten: string
    }
    dokumentation: {
        gutachten: string
        polizeibericht: string
        notizen: string
    }
}

const formSteps: FormStep[] = [
    {
        id: 'kundendaten',
        title: 'Kundendaten',
        icon: User,
        description: 'Persönliche Informationen und Fahrzeugdaten'
    },
    {
        id: 'abtretung',
        title: 'Abtretung',
        icon: FileText,
        description: 'Abtretungserklärung und rechtliche Dokumente'
    },
    {
        id: 'bilder',
        title: 'Bilder',
        icon: Camera,
        description: 'Foto-Dokumentation des Schadens'
    },
    {
        id: 'kalkulation',
        title: 'Kalkulation',
        icon: Calculator,
        description: 'Kostenberechnung und Schadenshöhe'
    },
    {
        id: 'dokumentation',
        title: 'Dokumentation',
        icon: FolderOpen,
        description: 'Abschließende Dokumentation und Berichte'
    }
]

export default function AkteForm() {
    const { user } = useUser()
    const { id } = useParams()
    const aktenApi = useAktenApi()
    const [currentStep, setCurrentStep] = useState(0)
    console.log('Current step:', currentStep, 'Max steps:', formSteps.length - 1)
    const [isLoading, setIsLoading] = useState(false)
    const [savedAkteId, setSavedAkteId] = useState<number | null>(
        id ? parseInt(id) : null
    )
    const [currentVIN, setCurrentVIN] = useState<string>('')
    const [vinCopied, setVinCopied] = useState(false)
    const [showKundendatenValidation, setShowKundendatenValidation] = useState(false)

    // Neue State-Variablen für Dokumentation
    const [bilder, setBilder] = useState<any[]>([])
    const [uploadedImages, setUploadedImages] = useState<any[]>([])
    const [kalkulationCompleted, setKalkulationCompleted] = useState(false)
    const [verfugbareKalkulationen, setVerfugbareKalkulationen] = useState<Kalkulation[]>([])
    const [akte, setAkte] = useState<Akte | null>(null)
    const [isAbtretungSigned, setIsAbtretungSigned] = useState(false)
    const [isAkteCompleted, setIsAkteCompleted] = useState(false)

    const [formData, setFormData] = useState<FormData>({
        kundendaten: {
            kunde: '',
            fahrzeugtyp: 'PKW',
            adresse1: '',
            adresse2: '',
            schadentag: '',
            schadenort: '',
            schadennummer: '',
            kennzeichen: '',
            versicherungsnummer: '',
            selbstbeteiligung: '150',
            vin: '',
            scheibe: 'Frontscheibe',
            auftragstyp: 'Reparaturauftrag',
            vorsteuer_berechtigt: 'Nein',
            marke: '',
            model: ''
        },
        abtretung: {
            kundenname: '',
            mobilnr: '',
            adresse: '',
            versicherungsschein: '',
            schadennummer: '',
            versicherungsname: '',
            selbstbeteiligung: '',
            vorsteuer: 'nein',
            marke: '',
            modell: '',
            kennzeichen: '',
            schadenzeitpunkt: '',
            schadenbeschreibung: '',
            kasko: false,
            haftpflicht: false,
            signatureData: '',
            isSignatureApplied: false
        },
        bilder: {
            fahrzeugbilder: '',
            schadenbilder: '',
            dokumente: ''
        },
        kalkulation: {
            schadenssumme: '',
            selbstbeteiligung: '',
            reparaturkosten: ''
        },
        dokumentation: {
            gutachten: '',
            polizeibericht: '',
            notizen: ''
        }
    })
        
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [versicherungsdaten, setVersicherungsdaten] = useState({
        versicherungsname: '',
        marke: '',
        modell: '',
        telefon: ''
    })

    useEffect(() => {
        if (id && savedAkteId) {
            loadAkteData()
        }
    }, [id, savedAkteId])

    useEffect(() => {
        setCurrentVIN(formData.kundendaten.vin)
    }, [formData.kundendaten.vin])

    const saveCurrentStep = async () => {
        const currentStepId = formSteps[currentStep].id

        if (currentStepId === 'kundendaten') {
            // Validierung beim Tab-Wechsel aktivieren, aber nicht blockieren
            if (!isStepValid(currentStepId)) {
                setShowKundendatenValidation(true)
            }

            try {
                if (!savedAkteId) {
                    const result = await aktenApi.createAkte(formData.kundendaten)
                    setSavedAkteId(result.id)
                } else {
                    await aktenApi.updateAkte(savedAkteId, formData.kundendaten)
                }
            } catch (error) {
                console.error('Fehler beim automatischen Speichern:', error)
            }
        }
    }

    // Prüfen ob alle Pflichtfelder eines Schritts ausgefüllt sind
    const isStepValid = (stepId: string): boolean => {
        if (stepId === 'kundendaten') {
            const required = ['kunde', 'fahrzeugtyp', 'adresse1', 'adresse2', 'schadentag', 'schadenort', 'kennzeichen', 'versicherungsnummer', 'scheibe', 'auftragstyp']
            return required.every(field => {
                const value = formData.kundendaten[field as keyof KundendatenData]
                return value && value.trim() !== ''
            })
        }

        if (stepId === 'abtretung') {
            return formData.abtretung.isSignatureApplied
        }

        if (stepId === 'bilder') {
            console.log('Bilder-Validierung - uploadedImages.length:', uploadedImages.length)
            return uploadedImages.length > 0
        }

        if (stepId === 'kalkulation') {
            return kalkulationCompleted
        }

        if (stepId === 'dokumentation') {
            // Hier könnte man prüfen ob tatsächlich Dokumentation ausgefüllt wurde
            return false // Nie grün werden lassen bis echte Validierung implementiert ist
        }

        // Für andere Steps (dokumentation etc.)
        const stepData = formData[stepId as keyof FormData]
        return Object.values(stepData).every(value => value.trim() !== '')
    }

    // Prüfen ob ein Schritt bearbeitbar ist (vorherige Schritte müssen abgeschlossen sein)
    const isStepAccessible = (stepIndex: number): boolean => {
        if (stepIndex === 0) return true
        return formSteps.slice(0, stepIndex).every((step, index) => isStepValid(step.id))
    }

    // Kundendaten aktualisieren
    const updateKundendaten = (field: keyof KundendatenData, value: string) => {
        setFormData(prev => ({
            ...prev,
            kundendaten: {
                ...prev.kundendaten,
                [field]: value
            }
        }))
    }

    // Abtretung aktualisieren
    const updateAbtretung = (field: keyof AbtretungData, value: any) => {
        setFormData(prev => ({
            ...prev,
            abtretung: {
                ...prev.abtretung,
                [field]: value
            }
        }))
    }

    // Handler für Z@Online Versicherungsdaten
    const handleVersicherungsdatenUpdate = (newVersicherungsdaten: {
        versicherungsname: string
        marke: string
        modell: string
        telefon: string
    }) => {
        console.log('Parent erhält Z@Online Daten:', newVersicherungsdaten)
        setVersicherungsdaten(newVersicherungsdaten)
    }

    const handleTabClick = async (stepIndex: number) => {
        const currentStepId = formSteps[currentStep].id

        // Aktuellen Schritt speichern
        await saveCurrentStep()

        // Bei Kundendaten: Validierung aktivieren wenn verlassen wird und nicht valid
        if (currentStepId === 'kundendaten' && !isStepValid(currentStepId)) {
            setShowKundendatenValidation(true)
        }

        setCurrentStep(stepIndex)
    }

    // Formular-Daten aktualisieren (für andere Schritte)
    const updateFormData = (stepId: string, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [stepId]: {
                ...prev[stepId as keyof FormData],
                [field]: value
            }
        }))
    }

    const loadAkteData = async () => {
        if (!savedAkteId) return

        setIsLoading(true)
        try {
            console.log('Lade Akte-Daten für ID:', savedAkteId)
            const akteData = await aktenApi.getAkte(savedAkteId)

            console.log('Geladene Akte-Daten:', akteData)

            // Kundendaten aus DB in FormData übertragen
            setFormData(prev => ({
                ...prev,
                kundendaten: {
                    kunde: akteData.kunde || '',
                    fahrzeugtyp: akteData.fahrzeugtyp || 'PKW',
                    adresse1: akteData.plz || '', // PLZ Feld für adresse1
                    adresse2: akteData.stadt || '', // Stadt Feld für adresse2  
                    schadentag: akteData.schadentag ? akteData.schadentag.split('T')[0] : '', // Date formatting
                    schadenort: akteData.schadenort || '',
                    schadennummer: akteData.schadennummer || '',
                    kennzeichen: akteData.kennzeichen || '',
                    versicherungsnummer: akteData.versicherungsnummer || '',
                    selbstbeteiligung: akteData.selbstbeteiligung || '300',
                    vin: akteData.vin || '',
                    scheibe: akteData.scheibe || 'Frontscheibe',
                    auftragstyp: akteData.auftragstyp || 'Kostenvoranschlag',
                    vorsteuer_berechtigt: akteData.vorsteuer_berechtigt || 'Nein',
                    marke: akteData.marke || '',
                    model: akteData.model || ''
                },
                // Abtretungsdaten laden falls vorhanden
                abtretung: akteData.abtretung_data ? {
                    kundenname: akteData.abtretung_data.kundenname || '',
                    mobilnr: akteData.abtretung_data.mobilnr || '',
                    adresse: akteData.abtretung_data.adresse || '',
                    versicherungsschein: akteData.abtretung_data.versicherungsschein || '',
                    schadennummer: akteData.abtretung_data.schadennummer || '',
                    versicherungsname: akteData.abtretung_data.versicherungsname || '',
                    selbstbeteiligung: akteData.abtretung_data.selbstbeteiligung || '',
                    vorsteuer: akteData.abtretung_data.vorsteuer || 'nein',
                    marke: akteData.abtretung_data.marke || '',
                    modell: akteData.abtretung_data.modell || '',
                    kennzeichen: akteData.abtretung_data.kennzeichen || '',
                    schadenzeitpunkt: akteData.abtretung_data.schadenzeitpunkt || '',
                    schadenbeschreibung: akteData.abtretung_data.schadenbeschreibung || '',
                    kasko: akteData.abtretung_data.kasko || false,
                    haftpflicht: akteData.abtretung_data.haftpflicht || false,
                    signatureData: akteData.abtretung_data.signatureData || '',
                    isSignatureApplied: akteData.abtretung_data.isSignatureApplied || false
                } : prev.abtretung
            }))

            // Zusätzliche Daten für Dokumentation laden
            setAkte({
                id: akteData.id,
                status: akteData.status || 'Entwurf',
                bearbeitet_am: akteData.bearbeitet_am,
                signiert_am: akteData.signiert_am
            })

            setIsAbtretungSigned(akteData.abtretung_data?.isSignatureApplied || false)
            setIsAkteCompleted(akteData.status === 'Abgeschlossen')
            setKalkulationCompleted(!!akteData.az)

            // Bilder laden (falls API verfügbar)
            try {
                const bilderData = await aktenApi.getBilder(savedAkteId)
                console.log('Geladene Bilder:', bilderData)
                setUploadedImages(bilderData.bilder || [])
                console.log('uploadedImages State gesetzt auf:', bilderData.bilder?.length || 0)
            } catch (error) {
                console.warn('Bilder konnten nicht geladen werden:', error)
                setUploadedImages([])
            }

            // Kalkulationen laden (falls API verfügbar)
            try {
                const kalkulationenData = await aktenApi.getKalkulationen(savedAkteId)
                setVerfugbareKalkulationen(kalkulationenData?.kalkulationen || [])
            } catch (error) {
                console.warn('Kalkulationen konnten nicht geladen werden:', error)
                setVerfugbareKalkulationen([])
            }

            setMessage({ type: 'success', text: 'Akte-Daten erfolgreich geladen!' })

        } catch (error) {
            console.error('Fehler beim Laden der Akte:', error)
            setMessage({ type: 'error', text: 'Fehler beim Laden: ' + (error as Error).message })
        } finally {
            setIsLoading(false)
        }
    }

    // Zum nächsten Schritt wechseln
    const nextStep = async () => {
        const currentStepId = formSteps[currentStep].id

        // Bei Kundendaten: Validierung aktivieren wenn Schritt nicht valid
        if (currentStepId === 'kundendaten') {
            if (!isStepValid(currentStepId)) {
                setShowKundendatenValidation(true) // ← VALIDIERUNG AKTIVIEREN
                setMessage({
                    type: 'error',
                    text: 'Bitte füllen Sie alle Pflichtfelder aus, bevor Sie fortfahren.'
                })
                return
            }

            // Wenn valid, automatisch speichern
            try {
                if (!savedAkteId) {
                    const result = await aktenApi.createAkte(formData.kundendaten)
                    setSavedAkteId(result.id)
                } else {
                    await aktenApi.updateAkte(savedAkteId, formData.kundendaten)
                }
                setMessage({ type: 'success', text: 'Kundendaten erfolgreich gespeichert!' })
                setShowKundendatenValidation(false) // Validierung ausschalten nach Erfolg
            } catch (error) {
                setMessage({ type: 'error', text: 'Fehler beim Speichern: ' + (error as Error).message })
                return
            }
        }

        // Für andere Schritte
        if (isStepValid(currentStepId) && currentStep < formSteps.length - 1) {
            setCurrentStep(currentStep + 1)
            setMessage({ type: 'success', text: `${formSteps[currentStep].title} erfolgreich abgeschlossen!` })
        } else {
            setMessage({ type: 'error', text: 'Bitte füllen Sie alle Pflichtfelder aus, bevor Sie fortfahren.' })
        }
    }

    // Zum vorherigen Schritt wechseln
    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    // Formular abschließen
    const submitForm = async () => {
        if (formSteps.every(step => isStepValid(step.id))) {
            try {
                // Hier würde die komplette Akte finalisiert werden
                setMessage({ type: 'success', text: 'Akte erfolgreich erstellt und gespeichert!' })
                console.log('Complete Form Data:', formData)
            } catch (error) {
                setMessage({ type: 'error', text: 'Fehler beim Speichern: ' + (error as Error).message })
            }
        } else {
            setMessage({ type: 'error', text: 'Bitte vervollständigen Sie alle Schritte.' })
        }
    }

    const renderStepContent = () => {
        const currentStepId = formSteps[currentStep].id

        switch (currentStepId) {
            case 'kundendaten':
                return (
                    <KundendatenStep
                        data={formData.kundendaten}
                        onUpdate={updateKundendaten}
                        showValidation={showKundendatenValidation}
                        onVersicherungsdatenUpdate={handleVersicherungsdatenUpdate}
                    />
                )

            case 'abtretung':
                return (
                    <AbtretungStep
                        data={formData.abtretung}
                        kundendaten={formData.kundendaten}
                        onUpdate={updateAbtretung}
                        isAkteSaved={!!savedAkteId}
                        akteId={savedAkteId || undefined}
                        versicherungsdaten={versicherungsdaten}
                    />
                )

            case 'bilder':
                return (
                    <BilderStep
                        akteId={savedAkteId || undefined}
                        isAkteSaved={!!savedAkteId}
                        onImagesUpdate={setUploadedImages}
                    />
                )

            case 'kalkulation':
                return (
                    <KalkulationStep
                        kundendaten={formData.kundendaten}
                        isAkteSaved={!!savedAkteId}
                        akteId={savedAkteId || undefined}
                        onKalkulationComplete={(azNumber) => {
                            setKalkulationCompleted(true)
                            setCurrentStep(currentStep + 1)
                        }}
                    />
                )

            case 'dokumentation':
                return (
                    <DokumentationStep
                        kundendaten={formData.kundendaten}
                        isAkteSaved={!!savedAkteId}
                        akteId={savedAkteId || undefined}
                        akte={akte || undefined}
                        bilder={bilder}
                        verfugbareKalkulationen={verfugbareKalkulationen}
                        isAbtretungSigned={isAbtretungSigned}
                        isAkteCompleted={isAkteCompleted}
                    />
                )

            default:
                return null
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {message && (
                    <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                        {message.type === 'success' ? (
                            <CheckCircle className="h-4 w-4" />
                        ) : (
                            <AlertCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>{message.text}</AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Neue Akte erstellen</CardTitle>
                        <CardDescription>
                            Erstellen Sie eine neue Akte durch Ausfüllen aller erforderlichen Schritte.
                            {savedAkteId && (
                                <Badge className="ml-2">Akte #{savedAkteId} gespeichert</Badge>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Vertikale Tab-Navigation */}
                            <div className="lg:col-span-1">
                                <nav className="space-y-1">
                                    {formSteps.map((step, index) => {
                                        const isCompleted = isStepValid(step.id)
                                        const isCurrent = index === currentStep
                                        const isAccessible = isStepAccessible(index)

                                        return (
                                            <button
                                                key={step.id}
                                                onClick={async () => {
                                                    await handleTabClick(index)
                                                }}
                                                disabled={false}
                                                className={`
                                                    w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                                                    ${isCurrent
                                                        ? 'bg-primary text-primary-foreground shadow-md'
                                                        : isCompleted
                                                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                            : 'bg-muted hover:bg-muted/80'
                                                    }
                                                    `}
                                            >
                                                <div className={`
                          flex items-center justify-center w-8 h-8 rounded-full border-2
                          ${isCurrent
                                                        ? 'border-primary-foreground bg-primary-foreground text-primary'
                                                        : isCompleted
                                                            ? 'border-green-600 bg-green-600 text-white'
                                                            : isAccessible
                                                                ? 'border-muted-foreground'
                                                                : 'border-muted-foreground/50'
                                                    }
                        `}>
                                                    {isCompleted ? (
                                                        <StepCheck className="h-4 w-4" />
                                                    ) : (
                                                        React.createElement(step.icon, { className: "h-4 w-4" })
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{step.title}</div>
                                                    <div className="text-xs opacity-75">{step.description}</div>
                                                </div>
                                                {isCurrent && <ChevronRight className="h-4 w-4" />}
                                            </button>
                                        )
                                    })}
                                </nav>

                                <div className="mt-6 p-4 bg-muted rounded-lg">
                                    <h4 className="font-medium text-sm mb-2">Fortschritt</h4>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-background rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all"
                                                style={{
                                                    width: `${(formSteps.filter(step => isStepValid(step.id)).length / formSteps.length) * 100}%`
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium">
                                            {formSteps.filter(step => isStepValid(step.id)).length}/{formSteps.length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Formular-Inhalt */}
                            <div className="lg:col-span-3">
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground">
                                                    {React.createElement(formSteps[currentStep].icon, { className: "h-5 w-5" })}
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl">{formSteps[currentStep].title}</CardTitle>
                                                    <CardDescription>{formSteps[currentStep].description}</CardDescription>
                                                </div>
                                            </div>

                                            {/* VIN Widget */}
                                            {currentVIN && (
                                                <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-lg">
                                                    <span className="text-sm font-mono">{currentVIN}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={async () => {
                                                            await navigator.clipboard.writeText(currentVIN)
                                                            setVinCopied(true)
                                                            setTimeout(() => setVinCopied(false), 1500)
                                                        }}
                                                        className="h-6 w-6 p-0"
                                                    >
                                                        {vinCopied ? (
                                                            <Check className="h-3 w-3 text-green-600" />
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {renderStepContent()}

                                        {/* Navigation Buttons - HIER richtig platziert */}
                                        <div className="flex justify-between items-center mt-6 pt-6 border-t">
                                            <Button
                                                variant="outline"
                                                onClick={prevStep}
                                                disabled={currentStep === 0}
                                            >
                                                <ArrowLeft className="mr-2 h-4 w-4" />
                                                Zurück
                                            </Button>

                                            {currentStep === formSteps.length - 1 ? (
                                                <div className="flex gap-3">
                                                    {isAkteCompleted ? (
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => {/* Akte wieder öffnen Logic */ }}
                                                            className="text-orange-600 border-orange-600 hover:bg-orange-50"
                                                        >
                                                            <Undo className="mr-2 h-4 w-4" />
                                                            Akte wieder öffnen
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            onClick={() => {/* Akte abschließen Logic */ }}
                                                            className="bg-green-600 hover:bg-green-700"
                                                        >
                                                            <Check className="mr-2 h-4 w-4" />
                                                            Akte abschließen
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <Button onClick={nextStep}>
                                                    Weiter
                                                    <ChevronRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}