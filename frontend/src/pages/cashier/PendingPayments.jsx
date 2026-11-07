import PageHeader from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import PendingQueue from '../../components/payments/PendingQueue'

export default function PendingPayments() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending payments"
        description="Patients who have been charged and are waiting to pay."
      />
      <Card>
        <PendingQueue />
      </Card>
    </div>
  )
}
