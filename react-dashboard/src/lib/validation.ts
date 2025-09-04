export const ValidationUtils = {
  sanitizeString: (input: string): string => {
    if (typeof input !== 'string') return ''
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .slice(0, 500)
  },

  sanitizeNumber: (input: string): string => {
    if (typeof input !== 'string') return ''
    return input.replace(/[^\d.,\-]/g, '').slice(0, 20)
  },

  sanitizeEmail: (input: string): string => {
    if (typeof input !== 'string') return ''
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9@._\-]/g, '')
      .slice(0, 254)
  },

  sanitizePhone: (input: string): string => {
    if (typeof input !== 'string') return ''
    return input.replace(/[^\d\s\+\-\(\)]/g, '').slice(0, 20)
  },

  validateRequired: (value: string, fieldName: string): string | null => {
    if (!value || value.trim().length === 0) {
      return `${fieldName} ist erforderlich`
    }
    return null
  },

  validateEmail: (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return 'Bitte geben Sie eine gültige E-Mail-Adresse ein'
    }
    return null
  },

  validatePhone: (phone: string): string | null => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
    if (!phoneRegex.test(cleanPhone)) {
      return 'Bitte geben Sie eine gültige Telefonnummer ein'
    }
    return null
  },

  validateKennzeichen: (kennzeichen: string): string | null => {
    if (kennzeichen.length < 2 || kennzeichen.length > 12) {
      return 'Kennzeichen muss zwischen 2 und 12 Zeichen lang sein'
    }
    return null
  },

  validateDate: (dateString: string): string | null => {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'Bitte geben Sie ein gültiges Datum ein'
    }
    return null
  },

  validateVIN: (vin: string): string | null => {
    if (vin.length > 0 && vin.length !== 17) {
      return 'VIN muss genau 17 Zeichen lang sein'
    }
    return null
  }
}

export const FormValidation = {
  validateKundendaten: (data: any) => {
    const errors: Record<string, string> = {}
    
    const requiredFields = [
      { field: 'kunde', name: 'Kundenname' },
      { field: 'kennzeichen', name: 'Kennzeichen' },
      { field: 'schadenort', name: 'Schadenort' }
    ]

    requiredFields.forEach(({ field, name }) => {
      const error = ValidationUtils.validateRequired(data[field] || '', name)
      if (error) errors[field] = error
    })

    if (data.kennzeichen) {
      const kennzeichenError = ValidationUtils.validateKennzeichen(data.kennzeichen)
      if (kennzeichenError) errors.kennzeichen = kennzeichenError
    }

    if (data.vin) {
      const vinError = ValidationUtils.validateVIN(data.vin)
      if (vinError) errors.vin = vinError
    }

    if (data.schadentag) {
      const dateError = ValidationUtils.validateDate(data.schadentag)
      if (dateError) errors.schadentag = dateError
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  },

  validateAbtretung: (data: any) => {
    const errors: Record<string, string> = {}
    
    const requiredFields = [
      { field: 'kundenname', name: 'Kundenname' },
      { field: 'mobilnr', name: 'Mobilnummer' },
      { field: 'adresse', name: 'Adresse' }
    ]

    requiredFields.forEach(({ field, name }) => {
      const error = ValidationUtils.validateRequired(data[field] || '', name)
      if (error) errors[field] = error
    })

    if (data.mobilnr) {
      const phoneError = ValidationUtils.validatePhone(data.mobilnr)
      if (phoneError) errors.mobilnr = phoneError
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  }
}