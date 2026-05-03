'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import StatusBadge from './StatusBadge'
import { formatEUR, formatDate } from '@/lib/utils'
import { BUSINESS_CATEGORIES, PERSONAL_CATEGORIES } from '@/lib/types'
import type { Document, DocumentContext } from '@/lib/types'

interface DocumentTableProps {
  documents: Document[]
  onUpdate?: (id: string, patch: Partial<Document>) => void
}

const TYP_LABELS: Record<string, string> = {
  AUS: 'Outgoing', EIN: 'Incoming', BEH: 'Official', BEL: 'Receipt',
  expense: 'Expense', income: 'Income', transfer: 'Transfer',
}

const CONTEXT_COLORS: Record<DocumentContext, { color: string; bg: string }> = {
  business: { color: 'var(--accent)', bg: 'rgba(245,158,11,0.12)' },
  personal: { color: 'var(--info)', bg: 'rgba(59,130,246,0.12)' },
}

async function patchDocument(id: string, patch: Partial<Document>) {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function DocumentTable({ documents: initial, onUpdate }: DocumentTableProps) {
  const [docs, setDocs] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

  // Sync when parent updates the list
  if (initial !== docs && initial.length !== docs.length) {
    setDocs(initial)
  }

  const applyPatch = useCallback((id: string, patch: Partial<Document>) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))
    onUpdate?.(id, patch)
  }, [onUpdate])

  const toggleContext = async (doc: Document) => {
    const next = doc.context === 'business' ? 'personal' : 'business'
    applyPatch(doc.id, { context: next })
    try { await patchDocument(doc.id, { context: next }) }
    catch { applyPatch(doc.id, { context: doc.context }) }
  }

  const changeCategory = async (doc: Document, kategorie: string) => {
    applyPatch(doc.id, { kategorie })
    try { await patchDocument(doc.id, { kategorie }) }
    catch { applyPatch(doc.id, { kategorie: doc.kategorie ?? '' }) }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const selectAll = () => {
    setSelected(selected.size === docs.length ? new Set() : new Set(docs.map(d => d.id)))
  }

  const bulkSet = async (patch: Partial<Document>) => {
    if (selected.size === 0) return
    setBulkWorking(true)
    const ids = [...selected]
    for (const id of ids) applyPatch(id, patch)
    try {
      await Promise.all(ids.map(id => patchDocument(id, patch)))
    } catch { /* best-effort */ }
    setSelected(new Set())
    setBulkWorking(false)
  }

  if (docs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>
        <p>No documents found. Upload your first receipt or invoice.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
          background: 'var(--accent-subtle)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 'var(--radius-md)', marginBottom: '10px', flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.875rem' }}>
            {selected.size} selected
          </span>
          <button className="btn-secondary" style={{ padding: '4px 12px', minHeight: '28px', fontSize: '0.75rem' }}
            onClick={() => bulkSet({ context: 'business' })} disabled={bulkWorking}>
            Set Business
          </button>
          <button className="btn-secondary" style={{ padding: '4px 12px', minHeight: '28px', fontSize: '0.75rem' }}
            onClick={() => bulkSet({ context: 'personal' })} disabled={bulkWorking}>
            Set Personal
          </button>
          <select className="ca-input" style={{ width: 'auto', minHeight: '28px', fontSize: '0.75rem', padding: '2px 8px' }}
            defaultValue=""
            onChange={e => { if (e.target.value) bulkSet({ kategorie: e.target.value }) }}>
            <option value="">Set category…</option>
            <optgroup label="Business">
              {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
            <optgroup label="Personal">
              {PERSONAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>
          <button className="btn-ghost" style={{ padding: '4px 12px', minHeight: '28px', fontSize: '0.75rem' }}
            onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      <div className="ca-table-wrap">
        <table className="ca-table">
          <thead>
            <tr>
              <th style={{ width: '32px' }}>
                <input type="checkbox" checked={selected.size === docs.length && docs.length > 0}
                  onChange={selectAll} style={{ cursor: 'pointer' }} />
              </th>
              <th>Date</th>
              <th>Context</th>
              <th>Type</th>
              <th>Vendor</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => {
              const ctxCfg = CONTEXT_COLORS[doc.context] ?? CONTEXT_COLORS.personal
              const categories = doc.context === 'business' ? BUSINESS_CATEGORIES : PERSONAL_CATEGORIES
              return (
                <tr key={doc.id} style={{ background: selected.has(doc.id) ? 'var(--accent-subtle)' : undefined }}>
                  <td>
                    <input type="checkbox" checked={selected.has(doc.id)}
                      onChange={() => toggleSelect(doc.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                    {formatDate(doc.datum)}
                  </td>

                  {/* Clickable context toggle */}
                  <td>
                    <button
                      onClick={() => toggleContext(doc)}
                      title="Click to toggle business/personal"
                      style={{
                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.04em', cursor: 'pointer', border: `1px solid ${ctxCfg.color}33`,
                        color: ctxCfg.color, background: ctxCfg.bg, transition: 'all 150ms ease',
                      }}>
                      {doc.context === 'business' ? 'Biz' : 'Per'}
                    </button>
                  </td>

                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {TYP_LABELS[doc.typ ?? ''] ?? doc.typ ?? '—'}
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.vendor ?? '—'}
                  </td>

                  {/* Inline category dropdown */}
                  <td>
                    <select
                      className="ca-input"
                      value={doc.kategorie ?? ''}
                      onChange={e => changeCategory(doc, e.target.value)}
                      style={{ padding: '2px 6px', minHeight: '26px', fontSize: '0.75rem', width: '110px' }}>
                      <option value="">—</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>

                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    <span style={{ color: doc.typ === 'income' || doc.typ === 'AUS' ? 'var(--success)' : 'var(--text-primary)', fontWeight: 500, fontSize: '0.875rem' }}>
                      {formatEUR(doc.betrag)}
                    </span>
                  </td>

                  <td><StatusBadge status={doc.status} /></td>

                  <td>
                    <Link href={`/documents/${doc.id}`}
                      style={{ color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 500 }}>
                      Edit
                    </Link>
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
