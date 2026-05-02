'use client'

import { useRef, useState } from 'react'

interface DropZoneProps {
  onFile: (file: File) => void
  loading: boolean
}

export default function DropZone({ onFile, loading }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | null) => {
    if (!file) return
    onFile(file)
  }

  return (
    <div
      className={`drop-zone ${dragging ? 'dragging' : ''}`}
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '2rem' }}>⏳</div>
          <p style={{ color: 'var(--text-secondary)' }}>Extracting data with AI...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '2.5rem' }}>📄</div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            Drop a file here or click to select
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            PDF, JPG, PNG, WEBP — max 20MB
          </p>
        </div>
      )}
    </div>
  )
}
