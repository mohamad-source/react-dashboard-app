// src/lib/aktenApi.ts - MySQL API Service

const API_URL = import.meta.env.VITE_API_URL

export const aktenApi = {
  // Alle Akten laden
  async getAkten() {
    try {
      const response = await fetch(`${API_URL}/akten`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
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
      const response = await fetch(`${API_URL}/akten/${id}`)
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
      const response = await fetch(`${API_URL}/akten`, {
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
      const response = await fetch(`${API_URL}/akten/${id}`, {
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
      const response = await fetch(`${API_URL}/akten/${id}`, {
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
      
      const response = await fetch(url)
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
      const response = await fetch(`${API_URL}/akten/stats`)
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
      const response = await fetch(`${API_URL}/akten/${akteId}/abtretung`, {
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
  }
}

export default aktenApi