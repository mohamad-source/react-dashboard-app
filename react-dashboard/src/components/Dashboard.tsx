import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import DashboardLayout from './DashboardLayout'
import { useAktenApi } from '../hooks/useAktenApi'
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  FileText,
  User,
  MapPin,
  Car,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Home,
  ImageIcon
} from 'lucide-react'

interface Akte {
  id: number
  erstellt_am: string
  kunde: string
  kennzeichen: string
  schadenort: string
  status: string
  first_image?: string // Erstes Bild der Akte
}

export default function Dashboard() {
  const { user } = useUser()
  const navigate = useNavigate()
  const aktenApi = useAktenApi()
  const [akten, setAkten] = useState<Akte[]>([])
  const [aktenImages, setAktenImages] = useState<{[akteId: number]: string}>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('alle')
  const [error, setError] = useState<string | null>(null)

  // API URL from environment
  const API_BASE = import.meta.env.VITE_API_URL.replace('/api', '')

  useEffect(() => {
    loadAkten()
  }, [])

  const loadAkten = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await aktenApi.getAkten()
      setAkten(data || [])
      
      // Lade erstes Bild für jede Akte
      if (data && data.length > 0) {
        loadFirstImages(data)
      }
      
    } catch (err) {
      setError('Fehler beim Laden der Akten: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Erstes Bild für jede Akte laden
  const loadFirstImages = async (aktenList: Akte[]) => {
    const imagePromises = aktenList.map(async (akte) => {
      try {
        //const response = await fetch(`${import.meta.env.VITE_API_URL}/akten/${akte.id}/bilder`)
        const data = await aktenApi.getBilder(akte.id)
        
        if (data.success && data.bilder && data.bilder.length > 0) {
          return { akteId: akte.id, filename: data.bilder[0].filename }
        }
        return null
      } catch (error) {
        console.error(`Fehler beim Laden der Bilder für Akte ${akte.id}:`, error)
        return null
      }
    })

    const results = await Promise.all(imagePromises)
    const imageMap: {[akteId: number]: string} = {}
    
    results.forEach(result => {
      if (result) {
        imageMap[result.akteId] = result.filename
      }
    })
    
    setAktenImages(imageMap)
  }

  // Filtering Logic
  const filteredAkten = akten.filter(akte => {
    const matchesSearch = 
      akte.kunde.toLowerCase().includes(searchTerm.toLowerCase()) ||
      akte.kennzeichen.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'alle' || akte.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Status Badge Styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Abgeschlossen':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Abgeschlossen</Badge>
      case 'In Bearbeitung':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />In Bearbeitung</Badge>
      case 'Entwurf':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />Entwurf</Badge>
      case 'Storniert':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Storniert</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Actions
  const handleNeueAkte = () => {
    navigate('/akte-neu')
  }

  const handleAkteBearbeiten = (akteId: number) => {
    navigate(`/akte-bearbeiten/${akteId}`)
  }

  const handleAkteAnzeigen = (akteId: number) => {
    navigate(`/akte-anzeigen/${akteId}`)
  }

  const handleAkteLoeschen = async (akteId: number) => {
    if (window.confirm('Möchten Sie diese Akte wirklich löschen?')) {
      try {
        await aktenApi.deleteAkte(akteId)
        setAkten(prev => prev.filter(akte => akte.id !== akteId))
      } catch (err) {
        setError('Fehler beim Löschen der Akte: ' + (err as Error).message)
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Bild-URL generieren
  const getImageUrl = (akte: Akte) => {
    const filename = aktenImages[akte.id]
    if (!filename) return null
    const url = `${API_BASE}/public/akte_bilder/akte_${akte.id}/${filename}`
    return url
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Dashboard wird geladen...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Akten</h1>
            <p className="text-muted-foreground">
              Verwalten Sie alle Ihre Versicherungsakten an einem Ort
            </p>
          </div>
          <Button onClick={handleNeueAkte} className="gap-2">
            <Plus className="w-4 h-4" />
            Neue Akte
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters & Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter & Suche</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Status Legende */}
            <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mr-2">Status:</div>
              <Badge className="bg-yellow-100 text-yellow-800 text-xs"><AlertCircle className="w-2 h-2 mr-1" />Entwurf</Badge>
              <Badge className="bg-blue-100 text-blue-800 text-xs"><Clock className="w-2 h-2 mr-1" />In Bearbeitung</Badge>
              <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle className="w-2 h-2 mr-1" />Abgeschlossen</Badge>
              <Badge className="bg-red-100 text-red-800 text-xs"><XCircle className="w-2 h-2 mr-1" />Storniert</Badge>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Suchen Sie nach Kunde oder Kennzeichen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="alle">Alle Status</option>
                  <option value="Entwurf">Entwurf</option>
                  <option value="In Bearbeitung">In Bearbeitung</option>
                  <option value="Abgeschlossen">Abgeschlossen</option>
                  <option value="Storniert">Storniert</option>
                </select>
              </div>
            </div>

            {filteredAkten.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Keine Akten gefunden</h3>
                <p className="mt-2 text-muted-foreground">
                  {searchTerm || statusFilter !== 'alle' 
                    ? 'Keine Akten entsprechen Ihren Suchkriterien.' 
                    : 'Erstellen Sie Ihre erste Akte.'}
                </p>
                {!searchTerm && statusFilter === 'alle' && (
                  <Button onClick={handleNeueAkte} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Erste Akte erstellen
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAkten.map((akte) => (
                  <div
                    key={akte.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Bild-Vorschau */}
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                          {getImageUrl(akte) ? (
                            <img
                              src={getImageUrl(akte)!}
                              alt={`Schadensbild ${akte.kunde}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback bei Ladefehler
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.parentElement!.innerHTML = `
                                  <div class="w-full h-full flex items-center justify-center bg-gray-100">
                                    <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                  </div>
                                `
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Akten-Details */}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Kunde & Kennzeichen */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{akte.kunde}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {akte.kennzeichen}
                            </span>
                          </div>
                        </div>

                        {/* Schadenort */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm truncate">
                              {akte.schadenort}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Erstellt: {formatDate(akte.erstellt_am)}
                          </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                          {getStatusBadge(akte.status)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAkteBearbeiten(akte.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAkteLoeschen(akte.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}