import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
    Upload,
    Image as ImageIcon,
    X,
    Trash2,
    Download,
    Eye,
    AlertCircle,
    CheckCircle,
    Loader2
} from 'lucide-react'

interface UploadedImage {
    id: number
    filename: string
    original_name: string
    file_size: number
    upload_date: string
}

interface BilderStepProps {
    isAkteSaved: boolean
    akteId?: number
    onImagesUpdate?: (images: UploadedImage[]) => void
}

export default function BilderStep({ isAkteSaved, akteId, onImagesUpdate }: BilderStepProps) {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStatus, setUploadStatus] = useState('')
    const [showImageModal, setShowImageModal] = useState<{ url: string, name: string } | null>(null)
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    // API URL from environment
    const API_BASE = import.meta.env.VITE_API_URL.replace('/api', '')

    // Bilder beim ersten Laden abrufen
    useEffect(() => {
        if (akteId && isAkteSaved) {
            loadImages()
        }
    }, [akteId, isAkteSaved])

    const loadImages = async () => {
        if (!akteId) return

        try {
            const response = await fetch(`${API_BASE}/api/akten/${akteId}/bilder`)
            const data = await response.json()
            
            if (data.success) {
                setUploadedImages(data.bilder || [])
                onImagesUpdate?.(data.bilder || [])
            }
        } catch (error) {
            console.error('Fehler beim Laden der Bilder:', error)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        const files = Array.from(e.dataTransfer.files)
        processFiles(files)
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        processFiles(files)
    }

    const processFiles = (files: File[]) => {
        // Filter nur Bilder
        const imageFiles = files.filter(file => file.type.startsWith('image/'))

        if (imageFiles.length === 0) {
            alert('Bitte wählen Sie nur Bilddateien aus (JPG, PNG).')
            return
        }

        // Validierung: Max 5MB pro Datei
        const oversizedFiles = imageFiles.filter(file => file.size > 5 * 1024 * 1024)
        if (oversizedFiles.length > 0) {
            alert(`Die folgenden Dateien sind zu groß (max. 5MB): ${oversizedFiles.map(f => f.name).join(', ')}`)
            return
        }

        // Validierung: Max 10 Bilder total
        const currentCount = uploadedImages.length
        if (currentCount + imageFiles.length > 10) {
            alert(`Maximal 10 Bilder erlaubt. Aktuell: ${currentCount}, Versucht: ${imageFiles.length}`)
            return
        }

        setSelectedFiles(imageFiles)
    }

    const removeFile = (index: number) => {
        const newFiles = selectedFiles.filter((_, i) => i !== index)
        setSelectedFiles(newFiles)
        
        // FileInput zurücksetzen
        if (fileInputRef.current) {
            const dt = new DataTransfer()
            newFiles.forEach(file => dt.items.add(file))
            fileInputRef.current.files = dt.files
        }
    }

    const handleImageUpload = async () => {
        if (!selectedFiles.length) {
            alert('Bitte wählen Sie mindestens eine Datei aus.')
            return
        }

        if (!akteId) {
            alert('Fehler: Keine Akte-ID gefunden.')
            return
        }

        setIsUploading(true)
        setUploadProgress(0)
        setUploadStatus('Upload wird vorbereitet...')

        try {
            const formData = new FormData()
            formData.append('akte_id', akteId.toString())
            
            selectedFiles.forEach(file => {
                formData.append('images[]', file)
            })

            const response = await fetch(`${API_BASE}/api/akten/${akteId}/bilder`, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const data = await response.json()

            if (data.success) {
                setUploadProgress(100)
                setUploadStatus(`Upload erfolgreich! ${data.uploaded_count || 0} Datei(en) hochgeladen.`)
                alert('Bilder erfolgreich hochgeladen!')

                // Reset
                setSelectedFiles([])
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }

                // Bilder neu laden
                await loadImages()

                // Progress nach 3 Sekunden ausblenden
                setTimeout(() => {
                    setIsUploading(false)
                    setUploadProgress(0)
                    setUploadStatus('')
                }, 3000)
            } else {
                throw new Error(data.message || 'Unbekannter Fehler')
            }
        } catch (error) {
            console.error('Upload-Fehler:', error)
            alert('Upload-Fehler: ' + (error as Error).message)
            setIsUploading(false)
            setUploadProgress(0)
            setUploadStatus('')
        }
    }

    const deleteImage = async (imageId: number) => {
        if (!confirm('Möchten Sie dieses Bild wirklich löschen?')) {
            return
        }

        try {
            const response = await fetch(`${API_BASE}/api/akten/${akteId}/bilder/${imageId}`, {
                method: 'DELETE'
            })

            const data = await response.json()

            if (data.success) {
                alert('Bild erfolgreich gelöscht!')
                await loadImages()
            } else {
                throw new Error(data.message || 'Unbekannter Fehler')
            }
        } catch (error) {
            console.error('Lösch-Fehler:', error)
            alert('Fehler beim Löschen: ' + (error as Error).message)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    if (!isAkteSaved) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Bitte speichern Sie zuerst die Kundendaten, bevor Sie Bilder hochladen können.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-6">
            {/* Upload Bereich */}
            <Card className="border-2 border-dashed border-blue-300">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Bilder hochladen
                        <Badge variant="outline" className="bg-white text-blue-600">
                            ({uploadedImages.length}/10)
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {/* Drop Zone */}
                    <div
                        className={`
                            border-3 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                            ${isDragOver 
                                ? 'border-purple-500 bg-purple-50 scale-105' 
                                : 'border-blue-300 hover:border-purple-500 hover:bg-blue-50'
                            }
                        `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="text-6xl mb-4">📷</div>
                        <div className="text-xl text-gray-600 mb-3">
                            Bilder hier ablegen oder klicken zum Auswählen
                        </div>
                        <div className="text-gray-500 text-sm">
                            Unterstützte Formate: JPG, JPEG, PNG • Max. 5MB pro Datei • Max. 10 Bilder gesamt
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>

                    {/* File Preview */}
                    {selectedFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <h4 className="font-medium">Ausgewählte Dateien ({selectedFiles.length})</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {selectedFiles.map((file, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1 min-w-0">
                                            <div><strong>Datei:</strong> {file.name}</div>
                                            <div><strong>Größe:</strong> {formatFileSize(file.size)}</div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => removeFile(index)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload Progress */}
                    {isUploading && (
                        <div className="mt-4 space-y-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            <p className="text-sm text-center text-gray-600">{uploadStatus}</p>
                        </div>
                    )}

                    {/* Upload Button */}
                    <Button
                        onClick={handleImageUpload}
                        disabled={selectedFiles.length === 0 || isUploading}
                        className="w-full mt-4"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Wird hochgeladen...
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4 mr-2" />
                                {selectedFiles.length} Datei(en) hochladen
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Galerie */}
            {uploadedImages.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            Hochgeladene Bilder ({uploadedImages.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {uploadedImages.map((image) => (
                                <div key={image.id} className="group relative">
                                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                        <img
                                            src={`${API_BASE}/public/akte_bilder/akte_${akteId}/${image.filename}`}
                                            alt={image.original_name}
                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                            onClick={() => setShowImageModal({
                                                url: `${API_BASE}/public/akte_bilder/akte_${akteId}/${image.filename}`,
                                                name: image.original_name
                                            })}
                                        />
                                    </div>
                                    
                                    {/* Overlay */}
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setShowImageModal({
                                                url: `${API_BASE}/public/akte_bilder/akte_${akteId}/${image.filename}`,
                                                name: image.original_name
                                            })}
                                            className="opacity-80 hover:opacity-100"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => deleteImage(image.id)}
                                            className="opacity-80 hover:opacity-100"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* File info */}
                                    <div className="mt-2">
                                        <p className="text-xs font-medium truncate" title={image.original_name}>
                                            {image.original_name}
                                        </p>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>{formatFileSize(image.file_size)}</span>
                                            <span>{new Date(image.upload_date).toLocaleDateString('de-DE')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Image Modal */}
            {showImageModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden mx-4">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-medium">{showImageModal.name}</h3>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <a href={showImageModal.url} download={showImageModal.name}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Herunterladen
                                    </a>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowImageModal(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="p-4">
                            <img
                                src={showImageModal.url}
                                alt={showImageModal.name}
                                className="max-w-full max-h-[70vh] object-contain mx-auto"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}