import { useState } from 'react'
import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import DashboardLayout from './DashboardLayout'
import {
  User,
  FileText,
  Camera,
  Calculator,
  FolderOpen,
  Check,
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

interface FormData {
  kundendaten: {
    vorname: string
    nachname: string
    email: string
    telefon: string
  }
  abtretung: {
    abtretungserklaerung: string
    datum: string
    unterschrift: string
  }
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
    description: 'Persönliche Informationen des Kunden'
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

export default function Files() {
  const { user } = useUser()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<FormData>({
    kundendaten: {
      vorname: '',
      nachname: '',
      email: '',
      telefon: ''
    },
    abtretung: {
      abtretungserklaerung: '',
      datum: '',
      unterschrift: ''
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

  // Prüfen ob alle Felder eines Schritts ausgefüllt sind
  const isStepValid = (stepId: string): boolean => {
    const stepData = formData[stepId as keyof FormData]
    return Object.values(stepData).every(value => value.trim() !== '')
  }

  // Prüfen ob ein Schritt bearbeitbar ist (vorherige Schritte müssen abgeschlossen sein)
  const isStepAccessible = (stepIndex: number): boolean => {
    if (stepIndex === 0) return true
    return formSteps.slice(0, stepIndex).every((step, index) => isStepValid(step.id))
  }

  // Formular-Daten aktualisieren
  const updateFormData = (stepId: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [stepId]: {
        ...prev[stepId as keyof FormData],
        [field]: value
      }
    }))
  }

  // Zum nächsten Schritt wechseln
  const nextStep = () => {
    const currentStepId = formSteps[currentStep].id
    if (isStepValid(currentStepId) && currentStep < formSteps.length - 1) {
      setCurrentStep(currentStep + 1)
      setMessage({ type: 'success', text: `${formSteps[currentStep].title} erfolgreich abgeschlossen!` })
    } else {
      setMessage({ type: 'error', text: 'Bitte füllen Sie alle Felder aus, bevor Sie fortfahren.' })
    }
  }

  // Zum vorherigen Schritt wechseln
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Formular abschließen
  const submitForm = () => {
    if (formSteps.every(step => isStepValid(step.id))) {
      setMessage({ type: 'success', text: 'Akte erfolgreich erstellt und gespeichert!' })
      // Hier würde die Akte gespeichert werden
    } else {
      setMessage({ type: 'error', text: 'Bitte vervollständigen Sie alle Schritte.' })
    }
  }

  const renderStepContent = () => {
    const currentStepId = formSteps[currentStep].id

    switch (currentStepId) {
      case 'kundendaten':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vorname">Vorname *</Label>
                <Input
                  id="vorname"
                  value={formData.kundendaten.vorname}
                  onChange={(e) => updateFormData('kundendaten', 'vorname', e.target.value)}
placeholder=""
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nachname">Nachname *</Label>
                <Input
                  id="nachname"
                  value={formData.kundendaten.nachname}
                  onChange={(e) => updateFormData('kundendaten', 'nachname', e.target.value)}
placeholder=""
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.kundendaten.email}
                onChange={(e) => updateFormData('kundendaten', 'email', e.target.value)}
placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefon">Telefon *</Label>
              <Input
                id="telefon"
                value={formData.kundendaten.telefon}
                onChange={(e) => updateFormData('kundendaten', 'telefon', e.target.value)}
placeholder=""
              />
            </div>
          </div>
        )

      case 'abtretung':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="abtretungserklaerung">Abtretungserklärung *</Label>
              <Input
                id="abtretungserklaerung"
                value={formData.abtretung.abtretungserklaerung}
                onChange={(e) => updateFormData('abtretung', 'abtretungserklaerung', e.target.value)}
placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="datum">Datum der Abtretung *</Label>
              <Input
                id="datum"
                type="date"
                value={formData.abtretung.datum}
                onChange={(e) => updateFormData('abtretung', 'datum', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unterschrift">Unterschrift bestätigt *</Label>
              <Input
                id="unterschrift"
                value={formData.abtretung.unterschrift}
                onChange={(e) => updateFormData('abtretung', 'unterschrift', e.target.value)}
placeholder=""
              />
            </div>
          </div>
        )

      case 'bilder':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fahrzeugbilder">Fahrzeugbilder *</Label>
              <Input
                id="fahrzeugbilder"
                value={formData.bilder.fahrzeugbilder}
                onChange={(e) => updateFormData('bilder', 'fahrzeugbilder', e.target.value)}
placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schadenbilder">Schadenbilder *</Label>
              <Input
                id="schadenbilder"
                value={formData.bilder.schadenbilder}
                onChange={(e) => updateFormData('bilder', 'schadenbilder', e.target.value)}
placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dokumente">Zusätzliche Dokumente *</Label>
              <Input
                id="dokumente"
                value={formData.bilder.dokumente}
                onChange={(e) => updateFormData('bilder', 'dokumente', e.target.value)}
placeholder=""
              />
            </div>
          </div>
        )

      case 'kalkulation':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schadenssumme">Schadenssumme *</Label>
              <Input
                id="schadenssumme"
                value={formData.kalkulation.schadenssumme}
                onChange={(e) => updateFormData('kalkulation', 'schadenssumme', e.target.value)}
placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selbstbeteiligung">Selbstbeteiligung *</Label>
              <Input
                id="selbstbeteiligung"
                value={formData.kalkulation.selbstbeteiligung}
                onChange={(e) => updateFormData('kalkulation', 'selbstbeteiligung', e.target.value)}
placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reparaturkosten">Reparaturkosten *</Label>
              <Input
                id="reparaturkosten"
                value={formData.kalkulation.reparaturkosten}
                onChange={(e) => updateFormData('kalkulation', 'reparaturkosten', e.target.value)}
placeholder=""
              />
            </div>
          </div>
        )

      case 'dokumentation':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gutachten">Gutachten *</Label>
              <Input
                id="gutachten"
                value={formData.dokumentation.gutachten}
                onChange={(e) => updateFormData('dokumentation', 'gutachten', e.target.value)}
placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="polizeibericht">Polizeibericht *</Label>
              <Input
                id="polizeibericht"
                value={formData.dokumentation.polizeibericht}
                onChange={(e) => updateFormData('dokumentation', 'polizeibericht', e.target.value)}
placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notizen">Zusätzliche Notizen *</Label>
              <Input
                id="notizen"
                value={formData.dokumentation.notizen}
                onChange={(e) => updateFormData('dokumentation', 'notizen', e.target.value)}
placeholder=""
              />
            </div>
          </div>
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
                        onClick={() => isAccessible && setCurrentStep(index)}
                        disabled={!isAccessible}
                        className={`
                          w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                          ${isCurrent
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : isCompleted
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : isAccessible
                                ? 'bg-muted hover:bg-muted/80'
                                : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
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
                            <Check className="h-4 w-4" />
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
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground">
                        {React.createElement(formSteps[currentStep].icon, { className: "h-5 w-5" })}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{formSteps[currentStep].title}</CardTitle>
                        <CardDescription>{formSteps[currentStep].description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderStepContent()}

                    <div className="flex justify-between mt-8 pt-6 border-t">
                      <Button
                        variant="outline"
                        onClick={prevStep}
                        disabled={currentStep === 0}
                      >
                        Zurück
                      </Button>

                      <div className="flex gap-2">
                        {currentStep < formSteps.length - 1 ? (
                          <Button
                            onClick={nextStep}
                            disabled={!isStepValid(formSteps[currentStep].id)}
                          >
                            Weiter
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            onClick={submitForm}
                            disabled={!formSteps.every(step => isStepValid(step.id))}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Akte erstellen
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zusammenfassung */}
        <Card>
          <CardHeader>
            <CardTitle>Übersicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              {formSteps.map((step, index) => (
                <div key={step.id} className="text-center">
                  <div className={`
                    w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2
                    ${isStepValid(step.id)
                      ? 'bg-green-100 text-green-600'
                      : 'bg-muted text-muted-foreground'
                    }
                  `}>
                    {isStepValid(step.id) ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      React.createElement(step.icon, { className: "h-6 w-6" })
                    )}
                  </div>
                  <h4 className="font-medium text-sm">{step.title}</h4>
                  <Badge variant={isStepValid(step.id) ? 'default' : 'secondary'} className="mt-1">
                    {isStepValid(step.id) ? 'Abgeschlossen' : 'Ausstehend'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
