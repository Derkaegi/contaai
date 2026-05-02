'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import QuarterCard from '@/components/dashboard/QuarterCard'
import RecentDocuments from '@/components/dashboard/RecentDocuments'
import { currentYear, formatEUR } from '@/lib/utils'
import type { Document, DocumentContext, QuarterSummary } from '@/lib/types'

const CategoryBreakdown = dynamic(() => import('@/components/dashboard/CategoryBreakdown'), { ssr: false })

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

function aggregateQuarters(docs: Document[], context: DocumentContext): QuarterSummary[] {
  const year = currentYear()
  return QUARTERS.map((q) => {
    const qDocs = docs.filter((d) => d.quartal === q && d.context === context)
    const isIncome = (d: Document) => d.typ === 'AUS' || d.typ === 'income'
    const incomeDocs = qDocs.filter(isIncome)
    const expenseDocs = qDocs.filter((d) => !isIncome(d))

    const ingresos = incomeDocs.reduce((s, d) => s + (d.betrag ?? 0), 0)
    const gastos = expenseDocs.reduce((s, d) => s + (d.betrag ?? 0), 0)
    const iva_repercutido = incomeDocs.reduce((s, d) => s + ((d.betrag ?? 0) - (d.netto ?? 0)), 0)
    const iva_soportado = expenseDocs.reduce((s, d) => s + ((d.betrag ?? 0) - (d.netto ?? 0)), 0)
    const irpf_retenido = incomeDocs.reduce((s, d) => s + ((d.netto ?? 0) * (d.irpf ?? 0) / 100), 0)

    return { quartal: q, year, context, ingresos, gastos, iva_repercutido, iva_soportado, irpf_retenido, count: qDocs.length }
  })
}

function aggregateCategories(docs: Document[], context: DocumentContext) {
  const expenseTypes = context === 'business' ? ['EIN', 'BEH', 'BEL'] : ['expense', 'transfer']
  const expenseDocs = docs.filter((d) => d.context === context && expenseTypes.includes(d.typ ?? ''))
  const map: Record<string, number> = {}
  for (const d of expenseDocs) {
    const cat = d.kategorie ?? 'other'
    map[cat] = (map[cat] ?? 0) + (d.betrag ?? 0)
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([kategorie, total]) => ({ kategorie, total }))
}

export default function DashboardPage() {
  const [context, setContext] = useState<DocumentContext>('business')
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/documents?year=${currentYear()}&limit=500`)
    const data = await res.json()
    setDocs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const quarters = aggregateQuarters(docs, context)
  const categories = aggregateCategories(docs, context)
  const recent = docs
    .filter((d) => d.context === context)
    .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))
    .slice(0, 10)

  const totalIngresos = quarters.reduce((s, q) => s + q.ingresos, 0)
  const totalGastos = quarters.reduce((s, q) => s + q.gastos, 0)
  const totalIva = quarters.reduce((s, q) => s + (q.iva_repercutido - q.iva_soportado), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ marginBottom: '4px' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>{currentYear()} overview</p>
        </div>
        <Link href="/upload" className="btn-primary">
          + Upload Document
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button className={`context-tab ${context === 'business' ? 'active' : ''}`} onClick={() => setContext('business')}>
          Business
        </button>
        <button className={`context-tab ${context === 'personal' ? 'active' : ''}`} onClick={() => setContext('personal')}>
          Personal
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>Loading...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div className="ca-card">
              <div className="stat-label">{context === 'business' ? 'Total Income' : 'Total Income'}</div>
              <div className="stat-number" style={{ color: 'var(--success)' }}>{formatEUR(totalIngresos)}</div>
            </div>
            <div className="ca-card">
              <div className="stat-label">{context === 'business' ? 'Total Expenses' : 'Total Spending'}</div>
              <div className="stat-number" style={{ color: 'var(--danger)' }}>{formatEUR(totalGastos)}</div>
            </div>
            {context === 'business' ? (
              <div className="ca-card">
                <div className="stat-label">IVA Balance</div>
                <div className="stat-number" style={{ color: totalIva > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {formatEUR(totalIva)}
                </div>
              </div>
            ) : (
              <div className="ca-card">
                <div className="stat-label">Net Balance</div>
                <div className="stat-number" style={{ color: totalIngresos - totalGastos >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatEUR(totalIngresos - totalGastos)}
                </div>
              </div>
            )}
          </div>

          <div className="ca-section">
            <h2 style={{ marginBottom: '16px' }}>By Quarter</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {quarters.map((q) => (
                <QuarterCard key={q.quartal} data={q} context={context} />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="ca-section">
            <div>
              <h2 style={{ marginBottom: '16px' }}>Spending by Category</h2>
              <div className="ca-card" style={{ padding: '16px' }}>
                <CategoryBreakdown data={categories} />
              </div>
            </div>
            <div>
              <h2 style={{ marginBottom: '16px' }}>Recent Documents</h2>
              <RecentDocuments documents={recent} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
