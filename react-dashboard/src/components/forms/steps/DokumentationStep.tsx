import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button' 
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    FileText,
    User,
    Images,
    FileSignature,
    Calculator,
    CheckCircle,
    Download,
    ArrowLeft,
    Save,
    AlertTriangle,
    Loader2,
    Undo,
    Check
} from 'lucide-react'

interface KundendatenData {
    kunde: string
    kennzeichen: string
    fahrzeugtyp: string
    vin: string
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

interface DokumentationStepProps {
    kundendaten: KundendatenData
    isAkteSaved: boolean
    akteId?: number
    akte?: Akte
    bilder: any[]
    verfugbareKalkulationen: Kalkulation[]
    isAbtretungSigned: boolean
    isAkteCompleted: boolean
}

export default function DokumentationStep({
    kundendaten,
    isAkteSaved,
    akteId,
    akte,
    bilder = [],
    verfugbareKalkulationen = [],
    isAbtretungSigned = false,
    isAkteCompleted = false
}: DokumentationStepProps) {
    const [selectedSections, setSelectedSections] = useState<string[]>(['kundendaten', 'bilder'])
    const [selectedKalkulationId, setSelectedKalkulationId] = useState<string>('')
    const [showKalkulationSelection, setShowKalkulationSelection] = useState(false)
    const [selectAll, setSelectAll] = useState(true)
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

    // Kalkulation Info anzeigen
    const selectedKalkulation = Array.isArray(verfugbareKalkulationen) 
    ? verfugbareKalkulationen.find(k => k.id.toString() === selectedKalkulationId)
    : undefined

    // Section Checkbox Handler
    const handleSectionChange = (section: string, checked: boolean) => {
        if (checked) {
            setSelectedSections(prev => [...prev, section])
        } else {
            setSelectedSections(prev => prev.filter(s => s !== section))
            if (section === 'kalkulation') {
                setShowKalkulationSelection(false)
                setSelectedKalkulationId('')
            }
        }
    }

    // Kalkulation Checkbox Handler
    const handleKalkulationChange = (checked: boolean) => {
        handleSectionChange('kalkulation', checked)
        setShowKalkulationSelection(checked)
    }

    // Alle auswählen/abwählen
    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked)
        const availableSections = ['kundendaten', 'bilder']
        
        if (isAbtretungSigned) availableSections.push('abtretung')
        if (verfugbareKalkulationen.length > 0) availableSections.push('kalkulation')

        if (checked) {
            setSelectedSections([...availableSections])
            if (verfugbareKalkulationen.length > 0) {
                setShowKalkulationSelection(true)
            }
        } else {
            setSelectedSections([])
            setShowKalkulationSelection(false)
            setSelectedKalkulationId('')
        }
    }

    // PDF generieren
    const generatePDF = async () => {
        if (selectedSections.length === 0) {
            alert('Bitte wählen Sie mindestens einen Bereich aus!')
            return
        }

        if (!akteId) return

        setIsGeneratingPDF(true)

        try {
            const formData = new FormData()
            formData.append('akte_id', akteId.toString())
            
            selectedSections.forEach(section => {
                formData.append('pdf_sections[]', section)
            })

            if (selectedKalkulationId) {
                formData.append('selected_kalkulation_id', selectedKalkulationId)
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/akten/${akteId}/dokumentation`, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                throw new Error('PDF-Generierung fehlgeschlagen')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Dokumentation_Akte_${akteId}_${new Date().toISOString().split('T')[0]}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

        } catch (error) {
            console.error('PDF-Fehler:', error)
            alert('Fehler beim Generieren des PDFs: ' + (error as Error).message)
        } finally {
            setIsGeneratingPDF(false)
        }
    }

    // Akte-Status aktualisieren
    const updateAkteStatus = async (newStatus: string) => {
        if (!akteId) return

        setIsUpdatingStatus(true)

        try {
            const formData = new FormData()
            formData.append('action', 'update_status')
            formData.append('akte_id', akteId.toString())
            formData.append('status', newStatus)

            const response = await fetch('/api/akten/update-status', {
                method: 'POST',
                body: formData
            })

            const data = await response.json()

            if (data.success) {
                alert('Status erfolgreich geändert!')
                window.location.reload()
            } else {
                throw new Error(data.message || 'Fehler beim Aktualisieren des Status')
            }
        } catch (error) {
            console.error('Status-Update Fehler:', error)
            alert('Fehler: ' + (error as Error).message)
        } finally {
            setIsUpdatingStatus(false)
        }
    }

    // Akte schließen
    const closeAkte = () => {
        if (confirm('Möchten Sie diese Akte wirklich abschließen?\n\nDie Akte wird als "Abgeschlossen" markiert.')) {
            updateAkteStatus('Abgeschlossen')
        }
    }

    // Akte wieder öffnen
    const reopenAkte = () => {
        if (confirm('Möchten Sie diese Akte wieder öffnen?\n\nDie Akte wird wieder als "Entwurf" markiert.')) {
            updateAkteStatus('Entwurf')
        }
    }

    return (
        <div className="space-y-6">
            {/* PDF Dokumentation */}
            <Card>
                <CardHeader className="bg-blue-600 text-white">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        PDF Dokumentation erstellen
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <Alert className="mb-6">
                        <AlertDescription>
                            <strong>Wählen Sie die gewünschten Bereiche für die PDF-Dokumentation:</strong><br />
                            <small className="text-muted-foreground">Es wird eine einzige PDF-Datei mit den ausgewählten Bereichen erstellt</small>
                        </AlertDescription>
                    </Alert>

                    {/* Sections Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Kundendaten */}
                        <Card className="border">
                            <CardContent className="p-4">
                                <div className="flex items-start space-x-2">
                                    <input
                                        type="checkbox"
                                        id="pdf_kundendaten"
                                        checked={selectedSections.includes('kundendaten')}
                                        onChange={(e) => handleSectionChange('kundendaten', e.target.checked)}
                                        className="mt-1"
                                    />
                                    <div className="space-y-1">
                                        <label htmlFor="pdf_kundendaten" className="text-sm font-medium flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Kundendaten
                                        </label>
                                        <p className="text-xs text-muted-foreground">
                                            Name, Adresse, Fahrzeugdaten, Versicherung
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Schadenbilder */}
                        <Card className="border">
                            <CardContent className="p-4">
                                <div className="flex items-start space-x-2">
                                    <input
                                        type="checkbox"
                                        id="pdf_bilder"
                                        checked={selectedSections.includes('bilder')}
                                        onChange={(e) => handleSectionChange('bilder', e.target.checked)}
                                        className="mt-1"
                                    />
                                    <div className="space-y-1">
                                        <label htmlFor="pdf_bilder" className="text-sm font-medium flex items-center gap-2">
                                            <Images className="h-4 w-4" />
                                            Schadenbilder
                                        </label>
                                        <p className="text-xs text-muted-foreground">
                                            Alle hochgeladenen Schadenfotos ({bilder.length} Bilder)
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Abtretungserklärung */}
                        <Card className="border">
                            <CardContent className="p-4">
                                <div className="flex items-start space-x-2">
                                    <input
                                        type="checkbox"
                                        id="pdf_abtretung"
                                        checked={selectedSections.includes('abtretung')}
                                        onChange={(e) => handleSectionChange('abtretung', e.target.checked)}
                                        disabled={!isAbtretungSigned}
                                        className="mt-1"
                                    />
                                    <div className="space-y-1">
                                        <label htmlFor="pdf_abtretung" className="text-sm font-medium flex items-center gap-2">
                                            <FileSignature className="h-4 w-4" />
                                            Abtretungserklärung
                                        </label>
                                        {!isAbtretungSigned ? (
                                            <p className="text-xs text-red-600">Noch nicht unterschrieben</p>
                                        ) : (
                                            <p className="text-xs text-green-600">
                                                Unterschrieben am {akte?.signiert_am ? new Date(akte.signiert_am).toLocaleDateString('de-DE') : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Kalkulation */}
                        <Card className="border">
                            <CardContent className="p-4">
                                <div className="flex items-start space-x-2">
                                    <input
                                        type="checkbox"
                                        id="pdf_kalkulation"
                                        checked={selectedSections.includes('kalkulation')}
                                        onChange={(e) => handleKalkulationChange(e.target.checked)}
                                        disabled={verfugbareKalkulationen.length === 0}
                                        className="mt-1"
                                    />
                                    <div className="space-y-1 flex-1">
                                        <label htmlFor="pdf_kalkulation" className="text-sm font-medium flex items-center gap-2">
                                            <Calculator className="h-4 w-4" />
                                            Kalkulation
                                        </label>
                                        {verfugbareKalkulationen.length === 0 ? (
                                            <p className="text-xs text-red-600">Keine Kalkulationen verfügbar</p>
                                        ) : (
                                            <p className="text-xs text-green-600">
                                                {verfugbareKalkulationen.length} Kalkulation(en) verfügbar
                                            </p>
                                        )}

                                        {/* Kalkulation Selection */}
                                        {showKalkulationSelection && verfugbareKalkulationen.length > 0 && (
                                            <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                                <label className="text-xs font-medium text-gray-700 mb-2 block">
                                                    Kalkulation auswählen:
                                                </label>
                                                <select
                                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                                    value={selectedKalkulationId}
                                                    onChange={(e) => setSelectedKalkulationId(e.target.value)}
                                                >
                                                    <option value="">-- Bitte wählen --</option>
                                                    {verfugbareKalkulationen.map((kalk) => (
                                                        <option key={kalk.id} value={kalk.id.toString()}>
                                                            {kalk.filename} ({kalk.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} brutto)
                                                        </option>
                                                    ))}
                                                </select>

                                                {/* Kalkulation Info */}
                                                {selectedKalkulation && (
                                                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                                                        <div><strong>Brutto:</strong> {selectedKalkulation.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                                                        <div><strong>Netto:</strong> {selectedKalkulation.netto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                                                        <div><strong>Erstellt:</strong> {new Date(selectedKalkulation.erstellt_am).toLocaleString('de-DE')}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <hr className="my-6" />

                    {/* Controls */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="select_all"
                                checked={selectAll}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                            <label htmlFor="select_all" className="text-sm font-medium">
                                Alle auswählen / abwählen
                            </label>
                        </div>

                        <Button 
                            onClick={generatePDF}
                            disabled={isGeneratingPDF || selectedSections.length === 0}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isGeneratingPDF ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            {isGeneratingPDF ? 'Generiere PDF...' : 'PDF generieren'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Akte Status */}
            <Card>
                <CardHeader className="bg-green-600 text-white">
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Akte abschließen
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {isAkteCompleted ? (
                        <div className="space-y-4">
                            <Alert>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Akte abgeschlossen</strong> am {akte?.bearbeitet_am ? new Date(akte.bearbeitet_am).toLocaleString('de-DE') : ''}
                                </AlertDescription>
                            </Alert>
                            <Button 
                                variant="outline" 
                                onClick={reopenAkte}
                                disabled={isUpdatingStatus}
                                className="text-orange-600 border-orange-600 hover:bg-orange-50"
                            >
                                {isUpdatingStatus ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Undo className="mr-2 h-4 w-4" />
                                )}
                                Akte wieder öffnen
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Wenn alle Arbeiten abgeschlossen sind, können Sie die Akte als
                                <strong> "Abgeschlossen"</strong> markieren.
                            </p>
                            <Button 
                                onClick={closeAkte}
                                disabled={isUpdatingStatus}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isUpdatingStatus ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="mr-2 h-4 w-4" />
                                )}
                                Akte abschließen
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Zurück
                </Button>
                <Button variant="secondary">
                    <Save className="mr-2 h-4 w-4" />
                    Zwischenspeichern
                </Button>
            </div>
        </div>
    )
}