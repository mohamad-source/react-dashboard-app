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
    onKalkulationComplete?: (azNumber: string) => void
}

export default function KalkulationStep({ kundendaten, isAkteSaved, akteId, onKalkulationComplete }: KalkulationStepProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    
    // EINZIGER State für Initialisierung - verhindert doppeltes Laden
    const isInitializedRef = useRef<boolean>(false)

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
                    customerNumber: import.meta.env.VITE_DAT_CUSTOMER_NUMBER || "1331332",
                    user: import.meta.env.VITE_DAT_USER || "kanaoezer",
                    password: import.meta.env.VITE_DAT_PASSWORD || "VcP369ILp99!!"
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

    // HAUPT-Initialisierungsfunktion - OHNE useCallback Dependencies
    const initDATSystem = async () => {
        console.log('initDATSystem called - isInitialized:', isInitializedRef.current)

        // Verhindere doppelte Initialisierung
        if (isInitializedRef.current || isLoading) {
            console.log('Bereits initialisiert oder lädt - Abbruch')
            return
        }

        // SOFORT markieren als initialisiert
        isInitializedRef.current = true
        setIsLoading(true)
        setError(null)

        try {
            await loadDATScripts()
            const token = await getDATToken()
            await initDAT(token)
            console.log('DAT-System erfolgreich initialisiert')

        } catch (err) {
            console.error('DAT-Fehler:', err)
            setError('Fehler beim Laden des DAT-Systems: ' + (err as Error).message)
            isInitializedRef.current = false // Bei Fehler zurücksetzen
        } finally {
            setIsLoading(false)
        }
    }

    // Callback für DAT-System
    const handleDATCallback = useCallback(async (azNumber: string) => {
        console.log('=== handleDATCallback DEBUG ===')
        console.log('azNumber:', azNumber)
        console.log('akteId:', akteId)
        
        if (!azNumber || !akteId) return

        try {
            const formData = new FormData()
            formData.append('action', 'full_process')
            formData.append('az', azNumber)
            formData.append('akte_id', akteId.toString())

            const response = await fetch(`${import.meta.env.VITE_API_URL}/akten/${akteId}/kalkulation`, {
                method: 'POST',
                body: formData
            })

            const responseText = await response.text()
            const data = JSON.parse(responseText)

            if (data.success) {
                alert('Kalkulation wurde erfolgreich erstellt!')
                // Sphinx iFrame löschen
                if (window.sphinx) {
                    window.sphinx.deleteIframe()
                }
                
                // Zum nächsten Schritt wechseln
                if (onKalkulationComplete) {
                    onKalkulationComplete(azNumber)
                }
            } else {
                throw new Error(data.message || 'Fehler beim Erstellen der Kalkulation')
            }
        } catch (error) {
            console.error('Kalkulations-Fehler:', error)
            alert('Fehler beim Erstellen der Kalkulation: ' + (error as Error).message)
        }
    }, [akteId, onKalkulationComplete])

    // Globalen Callback setzen - NUR EINMAL
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
        }
    }, [handleDATCallback])

    // EINMALIGER useEffect für Initialisierung - KEINE Dependencies!
    useEffect(() => {
        console.log('useEffect triggered - isAkteSaved:', isAkteSaved, 'akteId:', akteId, 'isInitialized:', isInitializedRef.current)
        
        if (isAkteSaved && akteId && !isInitializedRef.current) {
            console.log('Initialisiere DAT System - useEffect')
            initDATSystem()
        }
    }, [isAkteSaved, akteId]) // NUR diese beiden Dependencies!

    // Reload-Funktion
    const reloadDAT = () => {
        console.log('Reload DAT triggered')
        setError(null)
        isInitializedRef.current = false
        setTimeout(() => initDATSystem(), 100)
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
                        {isInitializedRef.current && !error && (
                            <div
                                ref={containerRef}
                                id="datContainer"
                                className="w-full h-full"
                                style={{ minHeight: '720px' }}
                            />
                        )}

                        {/* Reload Button */}
                        {(isInitializedRef.current || error) && (
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