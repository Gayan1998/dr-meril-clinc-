import Badge from './Badge'
import { formatStatus } from '../../lib/format'

const MAP = {
  pending_payment: 'warning',
  paid: 'success',
  cancelled: 'neutral',
  voided: 'danger',
}

export default function StatusBadge({ status, className = '' }) {
  return (
    <Badge variant={MAP[status] || 'neutral'} className={className}>
      {formatStatus(status)}
    </Badge>
  )
}
