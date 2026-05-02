export function deriveQuarter(datum: string): string {
  const month = parseInt(datum?.split('-')[1] ?? '1', 10)
  if (month <= 3) return 'Q1'
  if (month <= 6) return 'Q2'
  if (month <= 9) return 'Q3'
  return 'Q4'
}

export function deriveYear(datum: string): number {
  const year = parseInt(datum?.split('-')[0] ?? String(new Date().getFullYear()), 10)
  return isNaN(year) ? new Date().getFullYear() : year
}

export function toSlug(str: string, maxLen = 40): string {
  return str.toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[c] ?? c))
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
}

export function coerceNumber(val: unknown): number {
  if (typeof val === 'number') return val
  const parsed = parseFloat(String(val ?? ''))
  return isNaN(parsed) ? 0 : parsed
}

export function formatEUR(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function generateFilename(
  datum: string | null,
  typ: string | null,
  vendor: string | null,
  betrag: number | null,
  projekt: string | null
): string {
  const d = datum || new Date().toISOString().slice(0, 10)
  const t = typ || 'EIN'
  const v = toSlug(vendor || 'unknown', 30)
  const b = Math.round((betrag ?? 0) * 100) / 100
  const p = toSlug(projekt || 'general')
  return `${d}_${t}_${v}_${b}EUR_${p}.pdf`
}

export function currentYear(): number {
  return new Date().getFullYear()
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
