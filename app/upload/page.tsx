'use client'

import { useState } from 'react'
import DropZone from '@/components/upload/DropZone'
import ExtractionPreview from '@/components/upload/ExtractionPreview'
import DriveInbox from '@/components/upload/DriveInbox'
import type { Document, DocumentContext } from '@/lib/types'

type Tab = 'upload' | 'drive'

export default function UploadPage() {
  const [tab, setTab] = useState<Tab>('upload')
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
          Upload a file or import from your Google Drive inbox.
        </p>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '3px' }}>
          <button
            className={`context-tab ${tab === 'upload' ? 'active' : ''}`}
            style={{ minHeight: '32px', padding: '4px 16px' }}
            onClick={() => { setTab('upload'); setExtracted(null) }}
          >
            Upload File
          </button>
          <button
            className={`context-tab ${tab === 'drive' ? 'active' : ''}`}
            style={{ minHeight: '32px', padding: '4px 16px' }}
            onClick={() => setTab('drive')}
          >
            Drive Inbox
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Context:</span>
          <button className={`context-tab ${context === 'business' ? 'active' : ''}`} onClick={() => setContext('business')}>
            Business
          </button>
          <button className={`context-tab ${context === 'personal' ? 'active' : ''}`} onClick={() => setContext('personal')}>
            Personal
          </button>
        </div>
      </div>

      {tab === 'upload' && (
        <>
          {!extracted && <DropZone onFile={handleFile} loading={loading} />}
          {loading && <DropZone onFile={() => {}} loading={true} />}

          {error && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.875rem' }}>
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
        </>
      )}

      {tab === 'drive' && (
        <DriveInbox context={context} />
      )}
    </div>
  )
}
