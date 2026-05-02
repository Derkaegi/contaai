'use client'

import { BUSINESS_CATEGORIES, PERSONAL_CATEGORIES } from '@/lib/types'

interface FilterBarProps {
  year: string
  quartal: string
  context: string
  typ: string
  kategorie: string
  status: string
  q: string
  onChange: (key: string, value: string) => void
}

const YEARS = ['2026', '2025', '2024', '2023']
const QUARTERS = ['', 'Q1', 'Q2', 'Q3', 'Q4']
const BUSINESS_TYPES = ['', 'AUS', 'EIN', 'BEH', 'BEL']
const PERSONAL_TYPES = ['', 'expense', 'income', 'transfer']

export default function FilterBar({ year, quartal, context, typ, kategorie, status, q, onChange }: FilterBarProps) {
  const types = context === 'personal' ? PERSONAL_TYPES : BUSINESS_TYPES
  const categories = context === 'personal' ? PERSONAL_CATEGORIES : BUSINESS_CATEGORIES

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      <input
        className="ca-input"
        style={{ width: '180px' }}
        placeholder="Search vendor..."
        value={q}
        onChange={(e) => onChange('q', e.target.value)}
      />

      <select
        className="ca-input"
        style={{ width: '100px' }}
        value={year}
        onChange={(e) => onChange('year', e.target.value)}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <select
        className="ca-input"
        style={{ width: '90px' }}
        value={quartal}
        onChange={(e) => onChange('quartal', e.target.value)}
      >
        <option value="">All Q</option>
        {QUARTERS.filter(Boolean).map((q) => (
          <option key={q} value={q}>{q}</option>
        ))}
      </select>

      <select
        className="ca-input"
        style={{ width: '110px' }}
        value={typ}
        onChange={(e) => onChange('typ', e.target.value)}
      >
        <option value="">All types</option>
        {types.filter(Boolean).map((t) => (
          <option key={t} value={t}>{t.toUpperCase()}</option>
        ))}
      </select>

      <select
        className="ca-input"
        style={{ width: '140px' }}
        value={kategorie}
        onChange={(e) => onChange('kategorie', e.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        className="ca-input"
        style={{ width: '110px' }}
        value={status}
        onChange={(e) => onChange('status', e.target.value)}
      >
        <option value="">All status</option>
        <option value="offen">Open</option>
        <option value="bezahlt">Paid</option>
        <option value="gebucht">Booked</option>
      </select>
    </div>
  )
}
