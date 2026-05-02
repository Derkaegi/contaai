'use client'

import { useState } from 'react'
import DropZone from '@/components/upload/DropZone'
import ExtractionPreview from '@/components/upload/ExtractionPreview'
import type { Document, DocumentContext } from '@/lib/types'

export default function UploadPage() {
  const [context, setContext] = useState<DocumentContext>('business')
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<Partial<Document> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    setExtracted(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error ?? 'Upload failed')
      }
      const { storage_path, storage_url } = await uploadRes.json()

      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path, storage_url, context }),
      })
      if (!extractRes.ok) {
        const err = await extractRes.json()
        throw new Error(err.error ?? 'Extraction failed')
      }
      const doc = await extractRes.json()
      setExtracted(doc)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '4px' }}>Upload Document</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Drop a receipt or invoice — AI extracts the data automatically.
        </p>
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Context:</span>
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

      {!extracted && !loading && (
        <DropZone onFile={handleFile} loading={false} />
      )}

      {loading && (
        <DropZone onFile={() => {}} loading={true} />
      )}

      {error && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger)',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {extracted && (
        <div style={{ marginTop: '24px' }}>
          <ExtractionPreview
            extracted={extracted}
            context={context}
            onReset={() => setExtracted(null)}
          />
        </div>
      )}
    </div>
  )
}
