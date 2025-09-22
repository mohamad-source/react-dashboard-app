// src/types/Akte.ts
// TypeScript Interfaces für Akten

export interface KundendatenData {
  kunde: string
  fahrzeugtyp: 'PKW' | 'LKW' | 'Motorrad'
  adresse1: string
  adresse2: string
  schadentag: string
  schadenort: string
  schadennummer: string
  kennzeichen: string
  versicherungsnummer: string
  selbstbeteiligung: '150' | '300' | '500' | '1000' | ''
  vin: string
  scheibe: string
  auftragstyp: 'Kostenvoranschlag' | 'Reparaturauftrag'
  vorsteuer_berechtigt: 'Ja' | 'Nein'
}

export interface AbtretungData {
  abtretungserklaerung: string
  datum: string
  unterschrift: string
}

export interface BilderData {
  fahrzeugbilder: string[]
  schadenbilder: string[]
  dokumente: string[]
}

export interface KalkulationData {
  schadenssumme: number
  selbstbeteiligung: number
  reparaturkosten: number
}

export interface DokumentationData {
  gutachten: string
  polizeibericht: string
  notizen: string
}

export interface AkteFormData {
  kundendaten: KundendatenData
  abtretung: AbtretungData
  bilder: BilderData
  kalkulation: KalkulationData
  dokumentation: DokumentationData
}

export interface Akte {
  _id?: string
  
  // Kundendaten (flach für DB-Kompatibilität)
  kunde: string
  fahrzeugtyp: string
  plz?: string
  stadt?: string
  adresse1?: string
  adresse2?: string
  schadentag: string
  schadenort: string
  schadennummer?: string
  auftragstyp: string
  vorsteuer_berechtigt: string
  kennzeichen: string
  versicherungsnummer: string
  selbstbeteiligung?: string
  vin?: string
  az?: string
  scheibe: string
  
  // Status & Timestamps
  status: 'Entwurf' | 'In Bearbeitung' | 'Abgeschlossen' | 'Storniert'
  erstellt_am: string
  bearbeitet_am: string
  
  // Abtretung
  abtretung_signiert: boolean
  signiert_am?: string
  signature_data?: string
  pdf_data?: string
  
  // Nested Objects (optional für erweiterte Daten)
  abtretung?: AbtretungData
  bilder?: BilderData
  kalkulation?: KalkulationData
  dokumentation?: DokumentationData
  
  // User
  created_by: string
}

export interface AkteListItem {
  _id: string
  kunde: string
  fahrzeugtyp: string
  kennzeichen: string
  schadentag: string
  schadenort: string
  schadennummer?: string
  status: 'Entwurf' | 'In Bearbeitung' | 'Abgeschlossen' | 'Storniert'
  auftragstyp: string
  versicherungsnummer: string
  scheibe: string
  erstellt_am: string
  bearbeitet_am: string
  created_by: string
}

export interface AkteStats {
  total: number
  entwurf: number
  inBearbeitung: number
  abgeschlossen: number
  storniert: number
}

export interface CreateAkteRequest {
  kundendaten: KundendatenData
  abtretung: AbtretungData
  bilder: BilderData
  kalkulation: KalkulationData
  dokumentation: DokumentationData
}

export interface UpdateAkteRequest extends Partial<CreateAkteRequest> {
  _id: string
}