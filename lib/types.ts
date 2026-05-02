export type DocumentContext = 'business' | 'personal'

export type BusinessTyp = 'AUS' | 'EIN' | 'BEH' | 'BEL'
export type PersonalTyp = 'expense' | 'income' | 'transfer'
export type DocumentTyp = BusinessTyp | PersonalTyp

export interface Document {
  id: string
  created_at: string
  updated_at: string
  context: DocumentContext
  datum: string | null
  typ: DocumentTyp | null
  vendor: string | null
  betrag: number | null
  mwst: number | null
  netto: number | null
  irpf: number | null
  kategorie: string | null
  projekt: string | null
  status: 'offen' | 'bezahlt' | 'gebucht'
  quartal: string | null
  year: number | null
  filename: string | null
  storage_path: string | null
  storage_url: string | null
  notizen: string | null
  extraction_raw: Record<string, unknown> | null
}

export interface ChatMessage {
  id: string
  created_at: string
  role: 'user' | 'assistant'
  content: string
  metadata: Record<string, unknown> | null
}

export interface QuarterSummary {
  quartal: string
  year: number
  context: DocumentContext
  ingresos: number
  gastos: number
  iva_repercutido: number
  iva_soportado: number
  irpf_retenido: number
  count: number
}

export const BUSINESS_CATEGORIES = [
  'software',
  'hosting',
  'office',
  'travel',
  'fees',
  'personnel',
  'marketing',
  'equipment',
  'communications',
  'other',
]

export const PERSONAL_CATEGORIES = [
  'groceries',
  'utilities',
  'rent',
  'healthcare',
  'transport',
  'dining',
  'subscriptions',
  'education',
  'clothing',
  'leisure',
  'insurance',
  'family',
  'other',
]

export const STATUS_OPTIONS = ['offen', 'bezahlt', 'gebucht'] as const
