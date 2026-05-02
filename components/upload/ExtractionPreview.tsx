'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUSINESS_CATEGORIES, PERSONAL_CATEGORIES } from '@/lib/types'
import type { Document, DocumentContext } from '@/lib/types'

interface ExtractionPreviewProps {
  extracted: Partial<Document>
  context: DocumentContext
  onReset: () => void
}

const BUSINESS_TYPES = ['AUS', 'EIN', 'BEH', 'BEL']
const PERSONAL_TYPES = ['expense', 'income', 'transfer']

export default function ExtractionPreview({ extracted, context, onReset }: ExtractionPreviewProps) {
  const router = useRouter()
  const [doc, setDoc] = useState<Partial<Document>>({
    ...extracted,
    context,
    status: extracted.status ?? 'offen',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (key: keyof Document, value: unknown) => {
    setDoc((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      })
      if (!res.ok) throw new Error(await res.text())
      router.push(`/documents/${doc.id}`)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  const types = context === 'personal' ? PERSONAL_TYPES : BUSINESS_TYPES
  const categories = context === 'personal' ? PERSONAL_CATEGORIES : BUSINESS_CATEGORIES
  const isBusiness = context === 'business'

  return (
    <div className="ca-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Extracted Data</h2>
        <span
          className="badge"
          style={{
            background: isBusiness ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
            color: isBusiness ? 'var(--accent)' : 'var(--info)',
            border: `1px solid ${isBusiness ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'}`,
          }}
        >
          {isBusiness ? 'Business' : 'Personal'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <Field label="Date">
          <input
            className="ca-input"
            type="date"
            value={doc.datum ?? ''}
            onChange={(e) => update('datum', e.target.value)}
          />
        </Field>

        <Field label="Type">
          <select
            className="ca-input"
            value={doc.typ ?? ''}
            onChange={(e) => update('typ', e.target.value)}
          >
            {types.map((t) => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
        </Field>

        <Field label="Vendor / Name">
          <input
            className="ca-input"
            value={doc.vendor ?? ''}
            onChange={(e) => update('vendor', e.target.value)}
          />
        </Field>

        <Field label="Category">
          <select
            className="ca-input"
            value={doc.kategorie ?? ''}
            onChange={(e) => update('kategorie', e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Gross Amount (€)">
          <input
            className="ca-input"
            type="number"
            step="0.01"
            value={doc.betrag ?? ''}
            onChange={(e) => update('betrag', parseFloat(e.target.value) || 0)}
          />
        </Field>

        {isBusiness && (
          <Field label="VAT %">
            <input
              className="ca-input"
              type="number"
              step="0.01"
              value={doc.mwst ?? ''}
              onChange={(e) => update('mwst', parseFloat(e.target.value) || 0)}
            />
          </Field>
        )}

        {isBusiness && (
          <Field label="Net Amount (€)">
            <input
              className="ca-input"
              type="number"
              step="0.01"
              value={doc.netto ?? ''}
              onChange={(e) => update('netto', parseFloat(e.target.value) || 0)}
            />
          </Field>
        )}

        {isBusiness && (
          <Field label="IRPF Retention %">
            <input
              className="ca-input"
              type="number"
              step="0.01"
              value={doc.irpf ?? ''}
              onChange={(e) => update('irpf', parseFloat(e.target.value) || 0)}
            />
          </Field>
        )}

        <Field label="Project / Note" style={{ gridColumn: isBusiness ? 'auto' : '1/-1' }}>
          <input
            className="ca-input"
            value={doc.projekt ?? ''}
            onChange={(e) => update('projekt', e.target.value)}
          />
        </Field>

        <Field label="Status">
          <select
            className="ca-input"
            value={doc.status ?? 'offen'}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="offen">Open</option>
            <option value="bezahlt">Paid</option>
            <option value="gebucht">Booked</option>
          </select>
        </Field>

        {doc.notizen && (
          <Field label="Extraction Notes" style={{ gridColumn: '1/-1' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '8px 0' }}>
              {doc.notizen}
            </div>
          </Field>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', marginTop: '16px', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Document'}
        </button>
        <button className="btn-ghost" onClick={onReset}>
          Discard and Upload New
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
