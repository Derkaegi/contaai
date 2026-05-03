import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase'
import { deriveQuarter, deriveYear, toSlug } from '@/lib/utils'

export const runtime = 'nodejs'

// Map CaixaBank categories + vendor keywords to ContaAI categories
function inferCategory(caixaCat: string, emisor: string, concepto: string): string {
  const e = emisor.toLowerCase()
  const c = (concepto ?? '').toLowerCase()
  const cat = caixaCat.toLowerCase()

  // Vendor-specific overrides take priority over CaixaBank category labels
  if (/seg.social|seguridad social|tesoreria.*seg|tgss/.test(e + c)) return 'fees'
  if (/autonomo|autónom|mod.130|irpf|pago fraccionado/.test(e + c)) return 'fees'

  if (cat.includes('teléfono') || cat.includes('internet')) return 'subscriptions'
  if (cat.includes('seguros') || cat.includes('mutua')) return 'insurance'
  if (cat.includes('impuesto') || cat.includes('multa') || cat.includes('irpf') || cat.includes('aeat') || cat.includes('tribut')) return 'fees'
  if (cat.includes('cuotas') || cat.includes('suscripc')) return 'subscriptions'

  if (/seg.social|seguridad social|tesoreria.*seg|tgss/.test(e + c)) return 'fees'
  if (/autonomo|autónom|mod.130|modelo 130|irpf|pago fraccionado/.test(e + c)) return 'fees'
  if (/torres|campabadal|assessoria|asesori|gestor|notari/.test(e)) return 'fees'
  if (/vidacaixa|zurich|mapfre|allianz|axa |segur/.test(e)) return 'insurance'
  if (/paypal/.test(e)) return 'subscriptions'
  if (/vueling|ryanair|iberia|easyjet|renfe|tren|flight|viaje/.test(e)) return 'travel'
  if (/escola|school|jesuites|educaci|universit|academ/.test(e)) return 'education'
  if (/club|esportiu|sport|gym|piscina|futbol/.test(e)) return 'leisure'
  if (/farmaci|apotec|salut|metge|hospital|clínica|dental/.test(e)) return 'healthcare'
  if (/supermerc|mercado|aldi|lidl|sorli|condis|carrefour|dia /.test(e)) return 'groceries'
  if (/xfera|movistar|vodafone|orange |jazztel|masmovil/.test(e)) return 'subscriptions'

  return 'other'
}

// Infer business vs personal context
function inferContext(emisor: string, concepto: string, caixaCat: string): 'business' | 'personal' {
  const e = emisor.toLowerCase()
  const c = (concepto ?? '').toLowerCase()

  if (/seg.social|seguridad social|tesoreria.*seg|tgss|autonomo|autónom|irpf|mod.130|modelo 130|pago fraccionado|aeat|hacienda/.test(e + c)) return 'business'
  if (/torres|campabadal|assessoria|gestor/.test(e)) return 'business'
  if (/vidacaixa/.test(e)) return 'personal'
  if (/escola|school|jesuites|educaci/.test(e)) return 'personal'
  if (/club esportiu|esportiu|premier barcelona/.test(e)) return 'personal'

  return 'personal'
}

// Parse amount handling both Spanish (1.483,34) and English (1,483.34 or 1483.34) formats
function parseAmount(raw: string): number {
  const s = raw.trim()
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot > 0 && lastComma > 0) {
    // Both separators present: whichever comes last is the decimal separator
    if (lastDot > lastComma) {
      // English: 1,483.34 → strip commas, keep dot
      return parseFloat(s.replace(/,/g, '')) || 0
    } else {
      // Spanish: 1.483,34 → strip dots, replace comma with dot
      return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
    }
  }
  if (lastComma > 0 && lastDot < 0) {
    // Only comma: Spanish decimal (37,36 → 37.36)
    return parseFloat(s.replace(',', '.')) || 0
  }
  // Only dot or no separator: English format (1483.34 → 1483.34)
  return parseFloat(s) || 0
}

// Convert DD/MM/YYYY to YYYY-MM-DD
function parseDate(raw: string): string | null {
  if (!raw) return null
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ]
  const ext = file.name.toLowerCase().split('.').pop()
  if (!['xls', 'xlsx'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Only .xls and .xlsx files are supported' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false })
  } catch (err) {
    return NextResponse.json({ error: `Failed to parse Excel file: ${(err as Error).message}` }, { status: 422 })
  }

  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  const allRows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as string[][]

  // Find header row — must contain BOTH "emisor" AND "concepto" (avoids matching date rows)
  let headerIdx = -1
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i].map(c => String(c).toLowerCase().trim())
    const hasEmisor = row.some(c => c === 'emisor')
    const hasConcepto = row.some(c => c === 'concepto')
    if (hasEmisor && hasConcepto) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    return NextResponse.json({ error: 'Could not find header row in Excel file' }, { status: 422 })
  }

  const headers = allRows[headerIdx].map(h => String(h).trim().toLowerCase())
  const col = (name: string) => headers.findIndex(h => h.includes(name))

  const idxEmisor    = col('emisor')
  const idxTipo      = col('tipo')
  const idxCat       = col('categ')
  const idxConcepto  = col('concepto')
  const idxFecha     = col('fecha')
  const idxImporte   = col('importe')
  const idxEstado    = col('estado')
  const idxCuenta    = col('cuenta')

  const dataRows = allRows.slice(headerIdx + 1).filter(r =>
    r.some(c => String(c).trim() !== '')
  )

  const db = createServiceClient()

  // Dedup: fetch already-imported source IDs for this file
  const fileKey = `caixa_${file.name}`
  const { data: existingRows } = await db
    .from('documents')
    .select('drive_file_id')
    .like('drive_file_id', `caixa_%`)
  const existingSet = new Set((existingRows ?? []).map((r: { drive_file_id: string }) => r.drive_file_id))

  const toInsert = []
  let skipped = 0

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const get = (idx: number) => idx >= 0 ? String(row[idx] ?? '').trim() : ''

    const emisor   = get(idxEmisor)
    const caixaCat = get(idxCat)
    const concepto = get(idxConcepto)
    const fechaRaw = get(idxFecha)
    const importeRaw = get(idxImporte)
    const estado   = get(idxEstado)
    const cuenta   = get(idxCuenta)

    if (!emisor && !fechaRaw) { skipped++; continue }

    const rowKey = `caixa_${file.name}_${i}`
    if (existingSet.has(rowKey)) { skipped++; continue }

    const datum  = parseDate(fechaRaw)

    const betrag = Math.abs(parseAmount(importeRaw))
    const vendor = toSlug(emisor.replace(/^TESORERIA DE LA |^Soc\. |^S\.A\.|^S\.L\./gi, '').trim(), 50)
    const kategorie = inferCategory(caixaCat, emisor, concepto)
    const context   = inferContext(emisor, concepto, caixaCat)
    const quartal   = datum ? deriveQuarter(datum) : 'Q1'
    const year      = datum ? deriveYear(datum) : new Date().getFullYear()

    toInsert.push({
      drive_file_id: rowKey,
      context,
      cuenta: cuenta || null,
      datum,
      typ: 'expense',
      vendor,
      betrag,
      mwst: 0,
      netto: betrag,
      irpf: 0,
      kategorie,
      projekt: context === 'business' ? 'general' : 'general',
      status: estado.toLowerCase() === 'pagado' ? 'bezahlt' : 'offen',
      quartal,
      year,
      filename: `${datum}_EIN_${vendor}_${betrag}EUR.xls`,
      notizen: concepto ? concepto.slice(0, 80) : caixaCat,
      extraction_raw: {
        emisor,
        tipo: get(idxTipo),
        categoria_caixa: caixaCat,
        concepto,
        estado,
        cuenta,
        source_file: file.name,
      },
    })
  }

  // Batch insert in chunks of 100
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 100) {
    const { error } = await db.from('documents').insert(toInsert.slice(i, i + 100))
    if (error) {
      return NextResponse.json({ error: error.message, inserted, skipped }, { status: 500 })
    }
    inserted += toInsert.slice(i, i + 100).length
  }

  return NextResponse.json({ ok: true, total: dataRows.length, inserted, skipped, accounts: [...new Set(toInsert.map(r => r.cuenta).filter(Boolean))] })
}
