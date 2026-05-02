import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { formatEUR } from '@/lib/utils'
import type { Document } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const year = searchParams.get('year') ?? String(new Date().getFullYear())
  const quartal = searchParams.get('quartal')
  const context = searchParams.get('context') ?? 'business'
  const format = searchParams.get('format') ?? 'csv'

  const db = createServiceClient()
  let query = db
    .from('documents')
    .select('*')
    .eq('year', parseInt(year, 10))
    .eq('context', context)
    .order('datum', { ascending: true })

  if (quartal) query = query.eq('quartal', quartal)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const docs = (data ?? []) as Document[]
  const periodLabel = quartal ? `${year}_${quartal}` : year

  if (format === 'csv') {
    const csv = buildCsv(docs)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="contaai_${context}_${periodLabel}.csv"`,
      },
    })
  }

  const html = buildHtmlReport(docs, context, year, quartal)
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="contaai_${context}_${periodLabel}.html"`,
    },
  })
}

function buildCsv(docs: Document[]): string {
  const headers = [
    'Date', 'Quarter', 'Context', 'Type', 'Vendor', 'Gross', 'VAT%', 'Net', 'IRPF%',
    'Category', 'Project', 'Status', 'Notes',
  ]
  const rows = docs.map((d) => [
    d.datum ?? '',
    d.quartal ?? '',
    d.context,
    d.typ ?? '',
    d.vendor ?? '',
    d.betrag ?? 0,
    d.mwst ?? 0,
    d.netto ?? 0,
    d.irpf ?? 0,
    d.kategorie ?? '',
    d.projekt ?? '',
    d.status,
    d.notizen ?? '',
  ])

  const escape = (v: unknown) => {
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
}

function buildHtmlReport(
  docs: Document[],
  context: string,
  year: string,
  quartal: string | null
): string {
  const ingresos = docs.filter((d) => d.typ === 'AUS' || d.typ === 'income')
  const gastos = docs.filter((d) => d.typ !== 'AUS' && d.typ !== 'income')

  const totalIngresos = ingresos.reduce((s, d) => s + (d.betrag ?? 0), 0)
  const totalGastos = gastos.reduce((s, d) => s + (d.betrag ?? 0), 0)
  const ivaRepercutido = ingresos.reduce((s, d) => s + ((d.betrag ?? 0) - (d.netto ?? 0)), 0)
  const ivaSoportado = gastos.reduce((s, d) => s + ((d.betrag ?? 0) - (d.netto ?? 0)), 0)
  const ivaAPagar = ivaRepercutido - ivaSoportado
  const irpfRetenido = ingresos.reduce((s, d) => s + ((d.netto ?? 0) * (d.irpf ?? 0) / 100), 0)

  const periodLabel = quartal ? `${quartal} ${year}` : `Full Year ${year}`
  const contextLabel = context === 'business' ? 'Business (Autonomo)' : 'Personal / Family'

  const rows = docs.map((d) => `
    <tr>
      <td>${d.datum ?? ''}</td>
      <td>${d.quartal ?? ''}</td>
      <td>${d.typ ?? ''}</td>
      <td>${d.vendor ?? ''}</td>
      <td style="text-align:right">${formatEUR(d.betrag)}</td>
      <td style="text-align:right">${d.mwst ?? 0}%</td>
      <td style="text-align:right">${formatEUR(d.netto)}</td>
      <td style="text-align:right">${d.irpf ?? 0}%</td>
      <td>${d.kategorie ?? ''}</td>
      <td>${d.status}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ContaAI Report - ${contextLabel} - ${periodLabel}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #333; padding: 32px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .subtitle { color: #666; margin-bottom: 24px; font-size: 13px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .summary-box { border: 1px solid #ddd; border-radius: 6px; padding: 16px; }
    .summary-box .label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.06em; }
    .summary-box .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    .pos { color: #16a34a; }
    .neg { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
    @media print { .summary-grid { display: flex; flex-wrap: wrap; } }
  </style>
</head>
<body>
  <h1>ContaAI Financial Report</h1>
  <div class="subtitle">${contextLabel} | ${periodLabel} | Generated ${new Date().toLocaleDateString('en-GB')}</div>

  <div class="summary-grid">
    <div class="summary-box">
      <div class="label">Income</div>
      <div class="value pos">${formatEUR(totalIngresos)}</div>
    </div>
    <div class="summary-box">
      <div class="label">Expenses</div>
      <div class="value neg">${formatEUR(totalGastos)}</div>
    </div>
    ${context === 'business' ? `
    <div class="summary-box">
      <div class="label">IVA to Pay</div>
      <div class="value ${ivaAPagar >= 0 ? 'neg' : 'pos'}">${formatEUR(ivaAPagar)}</div>
    </div>
    <div class="summary-box">
      <div class="label">IRPF Retained</div>
      <div class="value">${formatEUR(irpfRetenido)}</div>
    </div>
    ` : `
    <div class="summary-box">
      <div class="label">Net Balance</div>
      <div class="value ${totalIngresos - totalGastos >= 0 ? 'pos' : 'neg'}">${formatEUR(totalIngresos - totalGastos)}</div>
    </div>
    <div class="summary-box">
      <div class="label">Transactions</div>
      <div class="value">${docs.length}</div>
    </div>
    `}
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th><th>Q</th><th>Type</th><th>Vendor</th>
        <th>Gross</th><th>VAT%</th><th>Net</th><th>IRPF%</th>
        <th>Category</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}
