'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/upload', label: 'Upload' },
  { href: '/documents', label: 'Documents' },
  { href: '/chat', label: 'AI Chat' },
]

export default function Header() {
  const pathname = usePathname()

  return (
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        <Link
          href="/dashboard"
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            textDecoration: 'none',
          }}
        >
          Conta<span style={{ color: 'var(--accent)' }}>AI</span>
        </Link>

        <nav style={{ display: 'flex', gap: '4px' }}>
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: active ? 'var(--surface-hover)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
