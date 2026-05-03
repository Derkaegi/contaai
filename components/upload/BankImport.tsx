'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface ImportResult {
  total: number
  inserted: number
  skipped: number
  accounts: string[]
  fileName: string
}

export default function BankImport() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    const endpoint = file.name.toLowerCase().endsWith('.csv')
      ? '/api/revolut/import-file'
      : '/api/caixa/import'

    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult({ ...data, fileName: file.name })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px', marginTop: 0 }}>
        Drop a bank statement file to import transactions. Supported formats: CaixaBank .xls/.xlsx, Revolut .csv.
        Each transaction becomes a document entry. Dedup prevents re-importing the same rows.
      </p>

      {!result && (
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''}`}
          style={{ cursor: loading ? 'wait' : 'pointer' }}
          onClick={() => !loading && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '2rem' }}>⏳</div>
              <p style={{ color: 'var(--text-secondary)' }}>Importing transactions…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '2.5rem' }}>🏦</div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Drop bank statement here or click to select</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>CaixaBank XLS · Revolut CSV</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {result && (
        <div className="ca-card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 8px' }}>Import complete</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>{result.fileName}</p>
            </div>
            <span style={{ color: 'var(--success)', fontSize: '1.5rem' }}>✓</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
            <StatBox label="Imported" value={result.inserted} color="var(--success)" />
            <StatBox label="Skipped (dedup)" value={result.skipped} color="var(--text-muted)" />
            <StatBox label="Total rows" value={result.total} color="var(--text-secondary)" />
          </div>
          {result.accounts.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '8px' }}>
                Accounts detected
              </div>
              {result.accounts.map(a => (
                <div key={a} style={{ padding: '6px 12px', background: 'var(--surface-hover)', borderRadius: 'var(--radius)', fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {a}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button className="btn-primary" onClick={() => router.push('/documents')}>
              View Documents
            </button>
            <button className="btn-ghost" onClick={() => setResult(null)}>
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="ca-card" style={{ padding: '12px 16px' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-number" style={{ fontSize: '1.5rem', color }}>{value}</div>
    </div>
  )
}
