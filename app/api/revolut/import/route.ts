import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createServiceClient } from '@/lib/supabase'
import { deriveQuarter, deriveYear, toSlug } from '@/lib/utils'
import { isGwsAvailable } from '@/lib/provider'

export const runtime = 'nodejs'

const GWS = `${process.env.HOME}/.local/bin/gws`

// Rule-based category inference from description keywords
function inferCategory(description: string): string {
  const d = description.toLowerCase()

  // Groceries / Food shops
  if (/aldi|lidl|sorli|condis|mercadona|carrefour|dia |eroski|bonarea|bon area|granja|forn|pa sant|pa anna|spar|rewe|edeka|netto |penny |kaufland|plus |tengelmann|real .markt|fresco/.test(d)) return 'groceries'
  // Schools / Education
  if (/escola|school|fundaci|jesuites|educaci|universit|akademi|lernst|nachhilfe|schule|college|institut|campus|apren/.test(d)) return 'education'
  // Sports / Leisure
  if (/club esportiu|esportiu|sport|gimnàs|gym|fitness|piscina|padel|tennis|futbol|swimming|poliesportiu|la salle gracia|premier barcelona|ef.premier/.test(d)) return 'leisure'
  // Healthcare
  if (/farmacia|farmàcia|apotheke|doctor|metge|hospital|clínica|clinica|dentist|salut|gesundheit|dr\.|medical/.test(d)) return 'healthcare'
  // Transport / Fuel
  if (/repsol|bp |shell|galp|cepsa|benzin|petrol|gasolina|autopista|peaje|parking|aparcament|taxi|uber|cabify|blablacar/.test(d)) return 'transport'
  // Public transport / Deutsche Bahn
  if (/deutsche bahn|db bahn|renfe|tram|metro|bus |s-bahn|u-bahn|cercanias|rodalies|tgv|sncf/.test(d)) return 'transport'
  // Flights / Travel
  if (/vueling|ryanair|iberia|easyjet|lufthansa|air |airlines|aeropuerto|flughafen|booking|airbnb|hotel|hostal/.test(d)) return 'travel'
  // Subscriptions / Streaming
  if (/netflix|spotify|amazon prime|disney|hbo|apple|google |microsoft|adobe|canva|notion|github|anthropic|openai|chatgpt|claude|masmovil|movistar|vodafone|orange |jazztel/.test(d)) return 'subscriptions'
  // Utilities
  if (/water|agua|electric|electri|gas |strom |gaz |endesa|iberdrola|naturgy|engie/.test(d)) return 'utilities'
  // Insurance
  if (/segur|insurance|versicher|allianz|mapfre|axa |zurich|generali/.test(d)) return 'insurance'
  // Dining / Restaurants
  if (/restaurant|café|cafe |bar |pizza|burger|mcdonalds|mcdonald|starbucks|cerveceria|tapas|bistro|ristorante|trattoria/.test(d)) return 'dining'
  // Clothing
  if (/zara|h&m|mango |pull.bear|bershka|massimo|primark|c&a |decathlon|intersport/.test(d)) return 'clothing'
  // Family transfers (to named persons)
  if (/to federica|to rocio|to rocío|an federica|an rocio|überweisung an|to .* mancini|to .* medina|familia|family/.test(d)) return 'family'
  // ATM
  if (/geldautomat|atm|cajero|caixer/.test(d)) return 'other'
  // Salary / Income
  if (/salary|nómina|nomina|salario|lohn|gehalt|payroll|einnahme/.test(d)) return 'income'
  // Fees
  if (/gebühr|fee|comisión|comision|taxa|tasa|charge/.test(d)) return 'fees'

  return 'other'
}

// Revolut type → document typ mapping
function inferTyp(amount: number, artType: string): string {
  if (artType === 'Einzahlung') return 'income'
  return amount >= 0 ? 'income' : 'expense'
}

// Fix mojibake: file is UTF-8 bytes that were misinterpreted as Latin-1
function fixEncoding(s: string): string {
  try {
    const bytes = Buffer.from(s, 'latin1')
    return bytes.toString('utf8')
  } catch {
    return s
  }
}

function parseRevolutCsv(csvContent: string): Array<Record<string, string>> {
  // Parse CSV with quoted field support
  const lines = csvContent.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const header = lines[0].split(',').map(h => fixEncoding(h.trim().replace(/"/g, '')))

  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Handle quoted fields
    const fields: string[] = []
    let inQuote = false
    let current = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { fields.push(current); current = '' }
      else { current += ch }
    }
    fields.push(current)

    const row: Record<string, string> = {}
    header.forEach((h, idx) => { row[h] = fixEncoding((fields[idx] ?? '').trim()) })
    rows.push(row)
  }
  return rows
}

export async function POST(req: NextRequest) {
  if (!isGwsAvailable()) {
    return NextResponse.json({ error: 'Google Drive not available in this environment.' }, { status: 503 })
  }

  const body = await req.json()
  const { fileId, fileName, context = 'personal' } = body

  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

  const tmpPath = join(tmpdir(), `revolut_${Date.now()}_${fileId}.csv`)

  try {
    execSync(
      `${GWS} drive files get -o "${tmpPath}" --params '{"fileId":"${fileId}","alt":"media"}'`,
      { encoding: 'utf8', timeout: 30000 }
    )
  } catch (err) {
    return NextResponse.json({ error: `Download failed: ${(err as Error).message}` }, { status: 500 })
  }

  const csvContent = readFileSync(tmpPath, 'utf8')
  try { unlinkSync(tmpPath) } catch {}

  const rows = parseRevolutCsv(csvContent)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows parsed from CSV' }, { status: 422 })
  }

  const db = createServiceClient()

  // Fetch already-imported IDs for this file
  const { data: existing } = await db
    .from('documents')
    .select('drive_file_id')
    .like('drive_file_id', `revolut_${fileId}_%`)
  const existingSet = new Set((existing ?? []).map((r: { drive_file_id: string }) => r.drive_file_id))

  const toInsert = []
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowKey = `revolut_${fileId}_${i}`

    if (existingSet.has(rowKey)) { skipped++; continue }

    const amount = parseFloat(r['Betrag'] ?? '0') || 0
    const fee = parseFloat(r['Gebühr'] ?? r['GebÃ¼hr'] ?? '0') || 0
    const currency = r['Währung'] ?? r['WÃ¤hrung'] ?? 'EUR'
    const description = r['Beschreibung'] ?? ''
    const artType = r['Art'] ?? ''
    const completedDate = r['Datum des Abschlusses'] ?? ''
    const datum = completedDate ? completedDate.split(' ')[0] : null

    // Skip incomplete/failed rows
    const status = r['Status'] ?? ''
    if (status && status !== 'ABGESCHLOSSEN' && status !== 'COMPLETED') { skipped++; continue }
    if (!description.trim()) { skipped++; continue }

    // Skip internal Revolut housekeeping
    if (description.startsWith('Balance migration') || description.startsWith('Saldo-Migration')) { skipped++; continue }

    const typ = inferTyp(amount, artType)
    const vendor = toSlug(description.replace(/^To |^From |^An |^Von /i, '').trim(), 50)
    const betrag = Math.abs(amount)
    const kategorie = inferCategory(description)
    const quartal = datum ? deriveQuarter(datum) : 'Q1'
    const year = datum ? deriveYear(datum) : new Date().getFullYear()

    toInsert.push({
      drive_file_id: rowKey,
      context,
      datum,
      typ,
      vendor,
      betrag,
      mwst: 0,
      netto: betrag,
      irpf: 0,
      kategorie,
      projekt: 'general',
      status: 'bezahlt',
      quartal,
      year,
      filename: `${datum}_${typ}_${vendor}_${betrag}EUR.csv`,
      notizen: `Revolut ${artType}${currency !== 'EUR' ? ` (${currency})` : ''}${fee ? ` fee:${fee}` : ''}`,
      extraction_raw: { art: artType, currency, fee, balance: r['Kontostand'], raw_description: description },
    })
  }

  // Batch insert in chunks of 100
  let inserted = 0
  const CHUNK = 100
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { error } = await db.from('documents').insert(chunk)
    if (error) {
      return NextResponse.json({ error: error.message, inserted, skipped }, { status: 500 })
    }
    inserted += chunk.length
  }

  return NextResponse.json({
    ok: true,
    total: rows.length,
    inserted,
    skipped,
    fileName: fileName ?? fileId,
  })
}
