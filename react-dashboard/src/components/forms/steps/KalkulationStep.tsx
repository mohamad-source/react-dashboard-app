import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
    Calculator,
    AlertCircle,
    Loader2,
    RefreshCw,
    CheckCircle,
    Car,
    Euro
} from 'lucide-react'

// Global types
declare global {
    interface Window {
        reactKalkulationCallback?: (azNumber: string) => void
        callbackFromSphinx?: (object: any, xml: any) => void
        sphinx?: any
        DatTokenInformation?: any
    }
}

interface KundendatenData {
    kunde: string
    kennzeichen: string
    fahrzeugtyp: string
    vin: string
}

interface KalkulationStepProps {
    kundendaten: KundendatenData
    isAkteSaved: boolean
    akteId?: number
}

export default function KalkulationStep({ kundendaten, isAkteSaved, akteId }: KalkulationStepProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const initializationRef = useRef<boolean>(false)


    // DAT-System initialisieren
    const initDATSystem = useCallback(async () => {
        console.log('initDATSystem called')

        if (initializationRef.current || isLoading) return

        initializationRef.current = true
        setIsLoading(true)
        setError(null)

        try {
            setIsInitialized(true)
            await new Promise(resolve => setTimeout(resolve, 100))

            await loadDATScripts()
            const token = await getDATToken()
            await initDAT(token)

        } catch (err) {
            console.error('DAT-Fehler:', err)
            setError('Fehler beim Laden des DAT-Systems: ' + (err as Error).message)
            setIsInitialized(false)
            initializationRef.current = false
        } finally {
            setIsLoading(false)
        }
    }, [])

    // DAT-Skripte dynamisch laden
    const loadDATScripts = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (window.sphinx) {
                resolve()
                return
            }

            // LazyLoad Skript
            const lazyloadScript = document.createElement('script')
            lazyloadScript.src = 'https://www.dat.de/sphinx/js/lazyload.js'
            lazyloadScript.type = 'text/javascript'
            lazyloadScript.onload = () => {
                // External Sphinx Skript
                const sphinxScript = document.createElement('script')
                sphinxScript.src = 'https://www.dat.de/sphinx/js/externalSphinx.js'
                sphinxScript.type = 'text/javascript'
                sphinxScript.onload = () => resolve()
                sphinxScript.onerror = () => reject(new Error('Fehler beim Laden der DAT-Skripte'))
                document.head.appendChild(sphinxScript)
            }
            lazyloadScript.onerror = () => reject(new Error('Fehler beim Laden der DAT-Skripte'))
            document.head.appendChild(lazyloadScript)
        })
    }

    // DAT-Token anfordern
    const getDATToken = (): Promise<string> => {
        return fetch('https://www.dat.de/AuthorizationManager/service--/endpoint/tokenService', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                payload: JSON.stringify({
                    action: "generateToken",
                    customerNumber: "1331332",
                    user: "kanaoezer",
                    password: "VcP369ILp99!!"
                })
            })
        }).then(response => response.text())
    }

    // DAT-System initialisieren
    const initDAT = (token: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            try {
                const sphinx = window.sphinx
                if (!sphinx || !token) {
                    reject(new Error('DAT-System oder Token nicht verfügbar'))
                    return
                }

                if (!containerRef.current) {
                    reject(new Error('Container nicht verfügbar'))
                    return
                }

                // Container komplett leeren
                containerRef.current.innerHTML = ''

                // CSS für iFrame hinzufügen
                const style = document.createElement('style')
                style.innerHTML = `
                .modelIFrame {
                    width: 100% !important;
                    height: 720px !important; 
                    border: none !important;
                }
            `
                document.head.appendChild(style)

                const values = {
                    az: 9999999,
                    displayHeader: false,
                    showProcessMenu: true,
                    defaultReadyHandler: true,
                    urlReadyHandler: null,
                    tires: false,
                    hidePrintIcon: false
                }

                sphinx.productVariant = 'calculateExpert'
                sphinx.firstPage = "model"
                sphinx.lastPage = "printAndSend"
                sphinx.host = 'https://www.dat.de/VehicleRepairOnline'

                sphinx.init(
                    sphinx.host + "/vehicleSelection/model.tmpl",
                    "model",
                    containerRef.current,
                    "modelIFrame"
                )

                // Nur execute, kein iframe styling mehr nötig
                setTimeout(() => {
                    const DAF = sphinx.getDAFXml(values)
                    const loginInfo = sphinx.encryptPassword(new window.DatTokenInformation(token))
                    sphinx.execute(loginInfo, DAF, (error: any) => {
                        if (error) {
                            console.error('Execute error:', error)
                        }
                    })
                }, 1000)

                resolve()

            } catch (error) {
                reject(error)
            }
        })
    }

    // Callback für DAT-System
    const handleDATCallback = useCallback(async (azNumber: string) => {
        if (!azNumber || !akteId) return

        try {
            const formData = new FormData()
            formData.append('action', 'full_process')
            formData.append('az', azNumber)
            formData.append('akte_id', akteId.toString())

            const response = await fetch(`/api/akten/${akteId}/kalkulation`, {
                method: 'POST',
                body: formData
            })

            const data = await response.json()

            if (data.success) {
                alert('Kalkulation wurde erfolgreich erstellt!')
                // Sphinx iFrame löschen
                if (window.sphinx) {
                    window.sphinx.deleteIframe()
                }
            } else {
                throw new Error(data.message || 'Fehler beim Erstellen der Kalkulation')
            }
        } catch (error) {
            console.error('Kalkulations-Fehler:', error)
            alert('Fehler beim Erstellen der Kalkulation: ' + (error as Error).message)
        }
    }, [akteId])

    // Globalen Callback setzen
    useEffect(() => {
        window.callbackFromSphinx = (object: any, xml: any) => {
            let azNumber = null

            if (xml && xml.xml) {
                try {
                    const parser = new DOMParser()
                    const xmlDoc = parser.parseFromString(xml.xml, "text/xml")
                    const azElement = xmlDoc.getElementsByTagName("az")[0]
                    if (azElement) {
                        azNumber = azElement.textContent
                    }
                } catch (e) {
                    console.error("XML-Parsing Fehler:", e)
                }

                if (!azNumber) {
                    const match = xml.xml.match(/<az>([^<]+)<\/az>/)
                    if (match && match[1]) {
                        azNumber = match[1]
                    }
                }
            }

            if (azNumber) {
                handleDATCallback(azNumber)
            } else {
                alert("Keine AZ-Nummer gefunden!")
            }
        }

        // Cleanup
        return () => {
            window.callbackFromSphinx = undefined
            initializationRef.current = false
        }
    }, [handleDATCallback])

    useEffect(() => {
        if (isAkteSaved && akteId && !initializationRef.current) {
            initDATSystem()
        }
    }, [isAkteSaved, akteId])


    const reloadDAT = () => {
        setIsInitialized(false)
        setError(null)
        initializationRef.current = false
        setTimeout(() => initDATSystem(), 100)
    }
    if (!isAkteSaved) {
        return (
            <div className="space-y-6">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Hinweis:</strong> Bitte speichern Sie zuerst die Kundendaten, bevor Sie eine Kalkulation erstellen können.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Customer Info */}
            <Alert>
                <Car className="h-4 w-4" />
                <AlertDescription>
                    <strong>Kunde:</strong> {kundendaten.kunde} ({kundendaten.kennzeichen}) – {kundendaten.fahrzeugtyp}
                    <br />
                    <small className="text-muted-foreground">DAT-Kalkulation für Reparaturkosten erstellen</small>
                </AlertDescription>
            </Alert>

            {/* DAT Integration Card */}
            <Card className="border-2 border-blue-200">
                <CardContent className="p-0">
                    <div className="relative" style={{ height: '720px', background: '#f8f9fa' }}>
                        {/* Loading State */}
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
                                <div className="text-center">
                                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4 mx-auto" />
                                    <h5 className="text-lg font-semibold mb-2">DAT-System wird geladen...</h5>
                                    <p className="text-muted-foreground">Bitte warten Sie einen Moment</p>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white">
                                <div className="text-center">
                                    <AlertCircle className="h-16 w-16 text-red-500 mb-4 mx-auto" />
                                    <h5 className="text-lg font-semibold mb-2 text-red-600">Fehler</h5>
                                    <p className="text-muted-foreground mb-4">{error}</p>
                                    <Button onClick={reloadDAT} className="bg-blue-600 hover:bg-blue-700">
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Neu laden
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* DAT Container */}
                        {isInitialized && !error && (
                            <div
                                ref={containerRef}
                                id="datContainer"
                                className="w-full h-full"
                                style={{ minHeight: '720px' }}
                            />
                        )}

                        {/* Reload Button */}
                        {(isInitialized || error) && (
                            <div className="absolute top-4 right-4">
                                <Button
                                    onClick={reloadDAT}
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoading}
                                >
                                    <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                                    Neu laden
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}