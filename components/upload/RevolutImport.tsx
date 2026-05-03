'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RevolutFile {
  id: string
  name: string
  description: string
}

const KNOWN_FILES: RevolutFile[] = [
  { id: '1M0H8ErsFWfjtj2lxoB6kmKGiYUBZwzRH', name: 'Revolut 2025', description: 'account-statement_2025-01-01_2025-12-31' },
  { id: '1X58SO9tqeYfVkLOyCGslH8ISf8Dw2LCr', name: 'Revolut 2026', description: 'account-statement_2026-01-01_2026-05-03' },
]

interface Result {
  fileName: string
  inserted: number
  skipped: number
  total: number
}

export default function RevolutImport() {
  const router = useRouter()
  const [customFileId, setCustomFileId] = useState('')
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, Result>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const importFile = async (fileId: string, fileName: string) => {
    setProcessing(p => ({ ...p, [fileId]: true }))
    setErrors(e => { const n = { ...e }; delete n[fileId]; return n })

    try {
      const res = await fetch('/api/revolut/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, fileName, context: 'personal' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResults(r => ({ ...r, [fileId]: data }))
    } catch (err) {
      setErrors(e => ({ ...e, [fileId]: (err as Error).message }))
    } finally {
      setProcessing(p => ({ ...p, [fileId]: false }))
    }
  }

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px', marginTop: 0 }}>
        Import Revolut account statement CSV files from Google Drive. Each transaction becomes an entry, defaulting to Personal context. Use the Documents page to bulk-reclassify business expenses.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {KNOWN_FILES.map(file => {
          const r = results[file.id]
          const err = errors[file.id]
          const busy = processing[file.id]
          return (
            <div key={file.id} className="ca-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px' }}>
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9375rem' }}>{file.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '2px' }}>{file.description}</div>
                {r && (
                  <div style={{ color: 'var(--success)', fontSize: '0.8125rem', marginTop: '4px', fontWeight: 500 }}>
                    ✓ {r.inserted} imported, {r.skipped} skipped (total {r.total} rows)
                  </div>
                )}
                {err && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.8125rem', marginTop: '4px' }}>{err}</div>
                )}
              </div>
              {r ? (
                <button className="btn-secondary" style={{ flexShrink: 0 }}
                  onClick={() => router.push('/documents?context=personal')}>
                  View Transactions
                </button>
              ) : (
                <button className="btn-primary" style={{ flexShrink: 0 }}
                  onClick={() => importFile(file.id, file.name)} disabled={busy}>
                  {busy ? 'Importing…' : 'Import'}
                </button>
              )}
            </div>
          )
        })}

        {/* Custom file ID input */}
        <div className="ca-card" style={{ padding: '16px 20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '10px' }}>
            Import another Revolut CSV from Drive (paste file ID):
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="ca-input"
              placeholder="Google Drive file ID…"
              value={customFileId}
              onChange={e => setCustomFileId(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn-secondary"
              style={{ flexShrink: 0 }}
              disabled={!customFileId.trim() || !!processing[customFileId]}
              onClick={() => importFile(customFileId.trim(), `Revolut (${customFileId.slice(0, 8)})`)}
            >
              Import
            </button>
          </div>
          {errors[customFileId] && (
            <div style={{ color: 'var(--danger)', fontSize: '0.8125rem', marginTop: '8px' }}>{errors[customFileId]}</div>
          )}
        </div>
      </div>
    </div>
  )
}
