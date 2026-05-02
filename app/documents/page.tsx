'use client'

import { useState, useEffect, useCallback } from 'react'
import DocumentTable from '@/components/documents/DocumentTable'
import FilterBar from '@/components/documents/FilterBar'
import type { Document } from '@/lib/types'
import { currentYear } from '@/lib/utils'

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState('business')
  const [filters, setFilters] = useState({
    year: String(currentYear()),
    quartal: '',
    typ: '',
    kategorie: '',
    status: '',
    q: '',
  })

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('context', context)
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })

    const res = await fetch(`/api/documents?${params}`)
    const data = await res.json()
    setDocuments(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [context, filters])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleExport = (format: 'csv' | 'html') => {
    const params = new URLSearchParams()
    params.set('context', context)
    params.set('year', filters.year)
    if (filters.quartal) params.set('quartal', filters.quartal)
    params.set('format', format)
    window.open(`/api/export?${params}`, '_blank')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ marginBottom: '4px' }}>Documents</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {documents.length} document{documents.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => handleExport('csv')}>
            Export CSV
          </button>
          <button className="btn-secondary" onClick={() => handleExport('html')}>
            Export Report
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button
          className={`context-tab ${context === 'business' ? 'active' : ''}`}
          onClick={() => setContext('business')}
        >
          Business
        </button>
        <button
          className={`context-tab ${context === 'personal' ? 'active' : ''}`}
          onClick={() => setContext('personal')}
        >
          Personal
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <FilterBar
          {...filters}
          context={context}
          onChange={handleFilterChange}
        />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
          Loading...
        </div>
      ) : (
        <DocumentTable documents={documents} />
      )}
    </div>
  )
}
