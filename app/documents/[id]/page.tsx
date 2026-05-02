'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BUSINESS_CATEGORIES, PERSONAL_CATEGORIES } from '@/lib/types'
import StatusBadge from '@/components/documents/StatusBadge'
import { formatEUR, formatDate } from '@/lib/utils'
import type { Document } from '@/lib/types'

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [doc, setDoc] = useState<Document | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Document>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((r) => r.json())
      .then((d) => { setDoc(d); setForm(d) })
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const updated = await res.json()
      setDoc(updated)
      setForm(updated)
      setEditing(false)
    } else {
      setError('Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this document? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    router.push('/documents')
  }

  const update = (key: keyof Document, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (!doc) {
    return <div style={{ color: 'var(--text-muted)', padding: '40px 0' }}>Loading...</div>
  }

  const isBusiness = doc.context === 'business'
  const categories = isBusiness ? BUSINESS_CATEGORIES : PERSONAL_CATEGORIES

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ marginBottom: '8px' }}>
            <Link href="/documents" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Documents
            </Link>
            <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>/</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{doc.vendor ?? 'Document'}</span>
          </div>
          <h1 style={{ marginBottom: '4px' }}>{doc.vendor ?? 'Unknown vendor'}</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{formatDate(doc.datum)}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <StatusBadge status={doc.status} />
            <span className="badge badge-info">
              {isBusiness ? 'Business' : 'Personal'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!editing && (
            <button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button>
          )}
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="ca-card">
          <div className="stat-label">Gross Amount</div>
          <div className="stat-number">{formatEUR(doc.betrag)}</div>
        </div>
        {isBusiness && (
          <>
            <div className="ca-card">
              <div className="stat-label">Net Amount</div>
              <div className="stat-number">{formatEUR(doc.netto)}</div>
            </div>
            <div className="ca-card">
              <div className="stat-label">VAT ({doc.mwst}%)</div>
              <div className="stat-number">{formatEUR((doc.betrag ?? 0) - (doc.netto ?? 0))}</div>
            </div>
            <div className="ca-card">
              <div className="stat-label">IRPF ({doc.irpf}%)</div>
              <div className="stat-number">{formatEUR((doc.netto ?? 0) * (doc.irpf ?? 0) / 100)}</div>
            </div>
          </>
        )}
      </div>

      {editing ? (
        <div className="ca-card">
          <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Document</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FieldGroup label="Date">
              <input className="ca-input" type="date" value={form.datum ?? ''} onChange={(e) => update('datum', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Type">
              <input className="ca-input" value={form.typ ?? ''} onChange={(e) => update('typ', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Vendor">
              <input className="ca-input" value={form.vendor ?? ''} onChange={(e) => update('vendor', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Category">
              <select className="ca-input" value={form.kategorie ?? ''} onChange={(e) => update('kategorie', e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Gross (€)">
              <input className="ca-input" type="number" step="0.01" value={form.betrag ?? ''} onChange={(e) => update('betrag', parseFloat(e.target.value))} />
            </FieldGroup>
            {isBusiness && <>
              <FieldGroup label="VAT %">
                <input className="ca-input" type="number" step="0.01" value={form.mwst ?? ''} onChange={(e) => update('mwst', parseFloat(e.target.value))} />
              </FieldGroup>
              <FieldGroup label="Net (€)">
                <input className="ca-input" type="number" step="0.01" value={form.netto ?? ''} onChange={(e) => update('netto', parseFloat(e.target.value))} />
              </FieldGroup>
              <FieldGroup label="IRPF %">
                <input className="ca-input" type="number" step="0.01" value={form.irpf ?? ''} onChange={(e) => update('irpf', parseFloat(e.target.value))} />
              </FieldGroup>
            </>}
            <FieldGroup label="Project">
              <input className="ca-input" value={form.projekt ?? ''} onChange={(e) => update('projekt', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Status">
              <select className="ca-input" value={form.status ?? 'offen'} onChange={(e) => update('status', e.target.value)}>
                <option value="offen">Open</option>
                <option value="bezahlt">Paid</option>
                <option value="gebucht">Booked</option>
              </select>
            </FieldGroup>
          </div>
          {error && <div style={{ color: 'var(--danger)', marginTop: '12px', fontSize: '0.875rem' }}>{error}</div>}
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-ghost" onClick={() => { setEditing(false); setForm(doc) }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="ca-card">
          <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Details</h2>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Detail label="Type" value={doc.typ ?? '—'} />
            <Detail label="Category" value={doc.kategorie ?? '—'} />
            <Detail label="Quarter" value={doc.quartal ?? '—'} />
            <Detail label="Year" value={String(doc.year ?? '—')} />
            {isBusiness && <>
              <Detail label="VAT" value={`${doc.mwst ?? 0}%`} />
              <Detail label="IRPF" value={`${doc.irpf ?? 0}%`} />
            </>}
            <Detail label="Project" value={doc.projekt ?? '—'} />
            <Detail label="Status" value={<StatusBadge status={doc.status} />} />
            {doc.notizen && <Detail label="Notes" value={doc.notizen} style={{ gridColumn: '1/-1' }} />}
          </dl>
        </div>
      )}

      {doc.storage_url && (
        <div className="ca-card" style={{ marginTop: '16px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '16px' }}>File</h2>
          {doc.storage_url.endsWith('.pdf') ? (
            <iframe src={doc.storage_url} style={{ width: '100%', height: '500px', border: 'none', borderRadius: 'var(--radius)' }} />
          ) : (
            <img src={doc.storage_url} alt="Document" style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} />
          )}
          <a href={doc.storage_url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ marginTop: '12px', display: 'inline-flex' }}>
            Open original
          </a>
        </div>
      )}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Detail({ label, value, style }: { label: string; value: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div className="stat-label">{label}</div>
      <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.875rem' }}>{value}</div>
    </div>
  )
}
