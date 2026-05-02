type Status = 'offen' | 'bezahlt' | 'gebucht'

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  offen: { label: 'Open', className: 'badge badge-warning' },
  bezahlt: { label: 'Paid', className: 'badge badge-success' },
  gebucht: { label: 'Booked', className: 'badge badge-muted' },
}

export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status as Status] ?? { label: status, className: 'badge badge-muted' }
  return <span className={s.className}>{s.label}</span>
}
