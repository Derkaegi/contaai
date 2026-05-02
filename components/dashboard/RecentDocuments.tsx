import Link from 'next/link'
import StatusBadge from '@/components/documents/StatusBadge'
import { formatEUR, formatDate } from '@/lib/utils'
import type { Document } from '@/lib/types'

export default function RecentDocuments({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
        No documents yet.{' '}
        <Link href="/upload" style={{ color: 'var(--accent)' }}>
          Upload your first one.
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {documents.map((doc) => (
        <Link
          key={doc.id}
          href={`/documents/${doc.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            transition: 'all 150ms ease',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.875rem' }}>
              {doc.vendor ?? 'Unknown vendor'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {formatDate(doc.datum)} · {doc.kategorie ?? '—'} · {doc.quartal ?? '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' }}>
              {formatEUR(doc.betrag)}
            </span>
            <StatusBadge status={doc.status} />
          </div>
        </Link>
      ))}
    </div>
  )
}
