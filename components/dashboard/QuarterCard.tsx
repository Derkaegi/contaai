import { formatEUR } from '@/lib/utils'
import type { QuarterSummary } from '@/lib/types'

interface QuarterCardProps {
  data: QuarterSummary
  context: 'business' | 'personal'
}

export default function QuarterCard({ data, context }: QuarterCardProps) {
  const balance = data.ingresos - data.gastos
  const ivaAPagar = data.iva_repercutido - data.iva_soportado

  return (
    <div className="ca-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem' }}>
          {data.quartal}
        </span>
        <span className="stat-chip">{data.count} docs</span>
      </div>

      {context === 'business' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <StatItem label="Income" value={data.ingresos} color="var(--success)" />
          <StatItem label="Expenses" value={data.gastos} color="var(--danger)" />
          <StatItem label="IVA to Pay" value={ivaAPagar} color={ivaAPagar > 0 ? 'var(--warning)' : 'var(--success)'} />
          <StatItem label="IRPF Retained" value={data.irpf_retenido} color="var(--info)" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <StatItem label="Income" value={data.ingresos} color="var(--success)" />
          <StatItem label="Spending" value={data.gastos} color="var(--danger)" />
          <div style={{ gridColumn: '1/-1' }}>
            <StatItem label="Net Balance" value={balance} color={balance >= 0 ? 'var(--success)' : 'var(--danger)'} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-number" style={{ fontSize: '1.125rem', color }}>
        {formatEUR(value)}
      </div>
    </div>
  )
}
