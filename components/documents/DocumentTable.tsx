'use client'

import Link from 'next/link'
import StatusBadge from './StatusBadge'
import { formatEUR, formatDate } from '@/lib/utils'
import type { Document } from '@/lib/types'

interface DocumentTableProps {
  documents: Document[]
}

const TYP_LABELS: Record<string, string> = {
  AUS: 'Outgoing',
  EIN: 'Incoming',
  BEH: 'Official',
  BEL: 'Receipt',
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
}

export default function DocumentTable({ documents }: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>
        <p>No documents found. Upload your first receipt or invoice.</p>
      </div>
    )
  }

  return (
    <div className="ca-table-wrap">
      <table className="ca-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Q</th>
            <th>Type</th>
            <th>Vendor</th>
            <th>Category</th>
            <th style={{ textAlign: 'right' }}>Gross</th>
            <th style={{ textAlign: 'right' }}>VAT%</th>
            <th style={{ textAlign: 'right' }}>IRPF%</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {formatDate(doc.datum)}
              </td>
              <td>
                <span className="stat-chip" style={{ fontSize: '0.6875rem' }}>
                  {doc.quartal ?? '—'}
                </span>
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                {TYP_LABELS[doc.typ ?? ''] ?? doc.typ ?? '—'}
              </td>
              <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {doc.vendor ?? '—'}
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                {doc.kategorie ?? '—'}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatEUR(doc.betrag)}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                {doc.mwst != null ? `${doc.mwst}%` : '—'}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                {doc.irpf ? `${doc.irpf}%` : '—'}
              </td>
              <td>
                <StatusBadge status={doc.status} />
              </td>
              <td>
                <Link
                  href={`/documents/${doc.id}`}
                  style={{
                    color: 'var(--accent)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
