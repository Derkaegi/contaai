'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import type { DocumentContext } from '@/lib/types'

interface DriveFile {
  id: string
  name: string
  size: number
  modifiedTime: string
}

interface DriveInboxProps {
  context: DocumentContext
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DriveInbox({ context }: DriveInboxProps) {
  const router = useRouter()
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/drive/inbox')
      .then(async (r) => {
        if (r.status === 503) {
          setUnavailable(true)
          return
        }
        const data = await r.json()
        setFiles(data.files ?? [])
      })
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false))
  }, [])

  const handleProcess = async (file: DriveFile) => {
    setProcessing((p) => ({ ...p, [file.id]: true }))
    setError(null)

    try {
      const res = await fetch('/api/drive/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id, fileName: file.name, context }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Import failed')
      }

      const doc = await res.json()
      setDone((d) => ({ ...d, [file.id]: true }))
      setTimeout(() => router.push(`/documents/${doc.id}`), 800)
    } catch (err) {
      setError(`${file.name}: ${(err as Error).message}`)
    } finally {
      setProcessing((p) => ({ ...p, [file.id]: false }))
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        Loading Drive inbox...
      </div>
    )
  }

  if (unavailable) {
    return (
      <div className="ca-card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔌</div>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Google Drive sync is only available when running ContaAI locally.
          <br />
          Deploy locally or use the file upload above.
        </p>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="ca-card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📂</div>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          No PDF files found in your Drive inbox.
        </p>
        <a
          href="https://drive.google.com/drive/folders/12JtwV3HNFPOLpJxcCBvlOtVKJIyfnhUe"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--accent)', fontSize: '0.875rem', display: 'inline-block', marginTop: '8px' }}
        >
          Open Drive Inbox
        </a>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
          {files.length} PDF{files.length !== 1 ? 's' : ''} in Drive inbox
        </p>
        <a
          href="https://drive.google.com/drive/folders/12JtwV3HNFPOLpJxcCBvlOtVKJIyfnhUe"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--accent)', fontSize: '0.8125rem' }}
        >
          Open in Drive
        </a>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', marginBottom: '12px', color: 'var(--danger)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div className="ca-table-wrap">
        <table className="ca-table">
          <thead>
            <tr>
              <th>File name</th>
              <th>Size</th>
              <th>Modified</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {file.name}
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  {formatBytes(file.size)}
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                  {formatDate(file.modifiedTime.slice(0, 10))}
                </td>
                <td>
                  {done[file.id] ? (
                    <span style={{ color: 'var(--success)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      Imported
                    </span>
                  ) : (
                    <button
                      className="btn-primary"
                      style={{ padding: '5px 14px', minHeight: '30px', fontSize: '0.75rem' }}
                      onClick={() => handleProcess(file)}
                      disabled={processing[file.id]}
                    >
                      {processing[file.id] ? 'Processing...' : 'Process'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
