// Custom Hook für Akten API mit Clerk Authentication
import { useAuth } from '@clerk/clerk-react'

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api"

export const useAktenApi = () => {
  const { getToken } = useAuth();

  const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    try {
      const token = await getToken();

      if (token) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        };
      }

      const response = await fetch(url, options);

      // Bei 401 Unauthorized könnte man hier weitere Logik einfügen
      if (response.status === 401) {
        console.warn('API call unauthorized - token might be expired');
      }

      return response;
    } catch (error) {
      console.error('Auth error:', error);
      // Fallback ohne Token
      return await fetch(url, options);
    }
  };

  return {
    // Alle Akten laden
    async getAkten() {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten`)
        const responseText = await response.clone().text()

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Error loading akten:', error)
        throw error
      }
    },

    // Einzelne Akte laden
    async getAkte(id: number) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${id}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Error loading akte:', error)
        throw error
      }
    },

    // Neue Akte erstellen
    async createAkte(data: {
      kunde: string
      kennzeichen: string
      schadenort: string
      status?: string
    }) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        console.error('Error creating akte:', error)
        throw error
      }
    },

    // Akte aktualisieren
    async updateAkte(id: number, data: Partial<{
      kunde: string
      kennzeichen: string
      schadenort: string
      status: string
    }>) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        console.error('Error updating akte:', error)
        throw error
      }
    },

    // Akte löschen
    async deleteAkte(id: number) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${id}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        console.error('Error deleting akte:', error)
        throw error
      }
    },

    // Akten suchen/filtern
    async searchAkten(query: {
      search?: string
      status?: string
    }) {
      try {
        const params = new URLSearchParams()

        if (query.search) params.append('search', query.search)
        if (query.status && query.status !== 'alle') params.append('status', query.status)

        const queryString = params.toString()
        const url = queryString ? `${API_URL}/akten/search?${queryString}` : `${API_URL}/akten`

        const response = await authenticatedFetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        console.error('Error searching akten:', error)
        throw error
      }
    },

    // Akten-Statistiken laden
    async getAktenStats() {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/stats`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Error loading stats:', error)
        throw error
      }
    },

    // Abtretung speichern
    async saveAbtretung(akteId: number, signature: string, formData: any) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${akteId}/abtretung`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            signature,
            formData
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        console.error('Error saving abtretung:', error)
        throw error
      }
    },
    
    // Bilder einer Akte laden
    async getBilder(akteId: number) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${akteId}/bilder`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Error loading bilder:', error)
        throw error
      }
    },

    // Kalkulationen einer Akte laden
    async getKalkulationen(akteId: number) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${akteId}/kalkulationen`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Error loading kalkulationen:', error)
        throw error
      }
    },

    // Bilder hochladen
    async uploadBilder(akteId: number, formData: FormData) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${akteId}/bilder`, {
          method: 'POST',
          body: formData
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Error uploading bilder:', error)
        throw error
      }
    },

    // Bild löschen
    async deleteBild(akteId: number, bildId: number) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${akteId}/bilder/${bildId}`, {
          method: 'DELETE'
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Error deleting bild:', error)
        throw error
      }
    },

    // Dokumentation generieren
    async generateDokumentation(akteId: number, requestData: any) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${akteId}/dokumentation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return response // Für PDF-Download den Response direkt zurückgeben
      } catch (error) {
        console.error('Error generating dokumentation:', error)
        throw error
      }
    },

    // Abtretungs-PDF herunterladen
    async downloadAbtretungsPDF(akteId: number) {
      try {
        const response = await authenticatedFetch(`${API_URL}/akten/${akteId}/pdf`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return response
      } catch (error) {
        console.error('Error downloading PDF:', error)
        throw error
      }
    },

    // ZOnline API Aufruf
    async callZOnlineAPI(kennzeichen: string) {
      try {
        const response = await authenticatedFetch(`${API_URL}/zonline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            licenseNumber: kennzeichen,
            requestor: import.meta.env.VITE_ZONLINE_REQUESTOR || '',
            password: import.meta.env.VITE_ZONLINE_PASSWORD || ''
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json();
      } catch (error) {
        console.error('Z@Online API Fehler:', error);
        throw error;
      }
    }
  };
};