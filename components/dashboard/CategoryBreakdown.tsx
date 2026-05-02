'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface CategoryBreakdownProps {
  data: { kategorie: string; total: number }[]
}

const AMBER = '#F59E0B'
const AMBER_MUTED = 'rgba(245,158,11,0.4)'

export default function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return (
      <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No data yet
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.total))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="kategorie"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `€${Math.round(v)}`}
          width={60}
        />
        <Tooltip
          cursor={{ fill: 'var(--surface-hover)' }}
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-primary)',
          }}
          formatter={(value: number) => [`€${value.toFixed(2)}`, 'Total']}
        />
        <Bar dataKey="total" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.total === max ? AMBER : AMBER_MUTED}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
