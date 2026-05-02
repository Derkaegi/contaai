'use client'

import { useEffect, useState, useRef } from 'react'
import { formatDate } from '@/lib/utils'
import type { DocumentContext } from '@/lib/types'

interface DriveFile {
  id: string
  name: string
  size: number
  modifiedTime: string
}

type FileStatus = 'pending' | 'processing' | 'done' | 'skipped' | 'error' | 'already_imported'

interface DriveInboxProps {
  context: DocumentContext
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DriveInbox({ context }: DriveInboxProps) {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })
  const abortRef = useRef(false)

  useEffect(() => {
    fetch('/api/drive/inbox')
      .then(async (r) => {
        if (r.status === 503) { setUnavailable(true); return }
        const data = await r.json()
        setFiles(data.files ?? [])
        const initial: Record<string, FileStatus> = {}
        for (const id of (data.importedIds ?? [])) {
          initial[id] = 'already_imported'
        }
        setStatuses(initial)
      })
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false))
  }, [])

  const processFile = async (file: DriveFile): Promise<boolean> => {
    setStatuses((s) => ({ ...s, [file.id]: 'processing' }))
    setErrors((e) => { const n = { ...e }; delete n[file.id]; return n })

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
      setStatuses((s) => ({ ...s, [file.id]: doc.skipped ? 'skipped' : 'done' }))
      return true
    } catch (err) {
      setStatuses((s) => ({ ...s, [file.id]: 'error' }))
      setErrors((e) => ({ ...e, [file.id]: (err as Error).message }))
      return false
    }
  }

  const handleProcessAll = async () => {
    const toProcess = files.filter(
      (f) => !statuses[f.id] || statuses[f.id] === 'error'
    )
    if (toProcess.length === 0) return

    abortRef.current = false
    setBatchRunning(true)
    setBatchProgress({ done: 0, total: toProcess.length })

    for (const file of toProcess) {
      if (abortRef.current) break
      await processFile(file)
      setBatchProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    setBatchRunning(false)
  }

  const newCount = files.filter(
    (f) => !statuses[f.id] || statuses[f.id] === 'error'
  ).length

  const statusBadge = (fileId: string) => {
    const s = statuses[fileId]
    if (!s) return null
    const map: Record<FileStatus, { label: string; color: string; bg: string }> = {
      already_imported: { label: 'Already imported', color: 'var(--text-muted)', bg: 'var(--surface)' },
      done:             { label: 'Imported',          color: 'var(--success)',    bg: 'rgba(34,197,94,0.1)' },
      skipped:          { label: 'Already imported',  color: 'var(--success)',    bg: 'rgba(34,197,94,0.1)' },
      processing:       { label: 'Processing...',     color: 'var(--accent)',     bg: 'rgba(245,158,11,0.1)' },
      error:            { label: 'Error',             color: 'var(--danger)',     bg: 'rgba(239,68,68,0.1)' },
      pending:          { label: 'Pending',           color: 'var(--text-muted)', bg: 'var(--surface)' },
    }
    const cfg = map[s]
    return (
      <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
        {cfg.label}
      </span>
    )
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading Drive inbox...</div>
  }

  if (unavailable) {
    return (
      <div className="ca-card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔌</div>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Google Drive sync is only available when running ContaAI locally.
        </p>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="ca-card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📂</div>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>No PDF files found in your Drive inbox.</p>
        <a href="https://drive.google.com/drive/folders/12JtwV3HNFPOLpJxcCBvlOtVKJIyfnhUe" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.875rem', display: 'inline-block', marginTop: '8px' }}>
          Open Drive Inbox
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {files.length} files · {newCount} new
          </span>
          {batchRunning && (
            <span style={{ color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600 }}>
              Processing {batchProgress.done}/{batchProgress.total}...
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {batchRunning ? (
            <button
              className="btn-secondary"
              style={{ fontSize: '0.8125rem', padding: '5px 14px', minHeight: '32px' }}
              onClick={() => { abortRef.current = true }}
            >
              Stop
            </button>
          ) : (
            <button
              className="btn-primary"
              style={{ fontSize: '0.8125rem', padding: '5px 16px', minHeight: '32px' }}
              onClick={handleProcessAll}
              disabled={newCount === 0}
            >
              {newCount === 0 ? 'All imported' : `Process All New (${newCount})`}
            </button>
          )}
          <a href="https://drive.google.com/drive/folders/12JtwV3HNFPOLpJxcCBvlOtVKJIyfnhUe" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.8125rem' }}>
            Open in Drive
          </a>
        </div>
      </div>

      {/* Progress bar */}
      {batchRunning && (
        <div className="progress-track" style={{ marginBottom: '12px' }}>
          <div
            className="progress-fill progress-fill-accent"
            style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
          />
        </div>
      )}

      {/* File table */}
      <div className="ca-table-wrap">
        <table className="ca-table">
          <thead>
            <tr>
              <th>File name</th>
              <th>Size</th>
              <th>Modified</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const s = statuses[file.id]
              const isActive = s === 'processing'
              const isDone = s === 'done' || s === 'skipped' || s === 'already_imported'
              const errMsg = errors[file.id]
              return (
                <tr key={file.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {formatBytes(file.size)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {formatDate(file.modifiedTime.slice(0, 10))}
                  </td>
                  <td>
                    {statusBadge(file.id)}
                    {errMsg && (
                      <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={errMsg}>
                        {errMsg}
                      </div>
                    )}
                  </td>
                  <td style={{ width: '80px' }}>
                    {!isDone && (
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 12px', minHeight: '28px', fontSize: '0.75rem' }}
                        onClick={() => processFile(file)}
                        disabled={isActive || batchRunning}
                      >
                        {isActive ? '...' : 'Process'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
