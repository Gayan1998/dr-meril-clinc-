import { Link } from 'react-router-dom'
import { Wallet, ClockCounterClockwise, Receipt } from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Skeleton from '../../components/ui/Skeleton'
import ErrorState from '../../components/ui/ErrorState'
import PendingQueue from '../../components/payments/PendingQueue'
import { useApi, usePolling } from '../../hooks'
import { api, qs } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatMoney, formatMethod, formatTime, greeting, todayISO } from '../../lib/format'

export default function CashierDashboard() {
  const { user, settings } = useAuth()
  const currency = settings?.currency || 'LKR'
  const date = todayISO()
  const { data, loading, error, reload, refresh } = useApi(
    (signal) => api.get(`/dashboard/cashier${qs({ date })}`, { signal }),
    [date],
  )

  // Keep the totals and recent payments live while the cashier watches.
  usePolling(refresh, 5000)

  const summary = data?.summary

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting(user?.name || '')}
        description="Your collections today, and who still needs to pay."
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {loading ? (
              <>
                <StatSkeletonInline />
                <StatSkeletonInline />
                <StatSkeletonInline />
              </>
            ) : (
              <>
                <StatCard
                  label="Collected today"
                  value={formatMoney(summary.collected, currency)}
                  tone="success"
                  icon={<Wallet size={18} />}
                  hint="Payments you collected"
                />
                <StatCard
                  label="Pending"
                  value={formatMoney(summary.pending, currency)}
                  tone={summary.pending > 0 ? 'warning' : 'default'}
                  icon={<ClockCounterClockwise size={18} />}
                  hint={`${summary.visits_pending} awaiting payment`}
                />
                <StatCard
                  label="Transactions"
                  value={summary.transactions}
                  icon={<Receipt size={18} />}
                  hint="Completed by you today"
                  className="col-span-2 lg:col-span-1"
                />
              </>
            )}
          </div>

          <Card>
            <PendingQueue onChanged={reload} />
          </Card>

          <Card>
            <CardHeader
              title="Recent payments"
              description="Your latest collections today"
              action={
                <Link to="/cashier/payments" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                  View all
                </Link>
              }
            />
            {loading ? (
              <CardBody className="space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </CardBody>
            ) : data.recent_payments.length === 0 ? (
              <CardBody>
                <p className="text-sm text-slate-500">No payments collected yet today.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recent_payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{payment.patient_name}</p>
                      <p className="tnum text-xs text-slate-500">
                        {payment.payment_number} · {formatMethod(payment.payment_method)} ·{' '}
                        {formatTime(payment.paid_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tnum text-sm font-semibold text-emerald-600">
                        {formatMoney(payment.amount, currency)}
                      </span>
                      <Link
                        to={`/receipt/${payment.id}`}
                        className="text-xs font-medium text-brand-700 hover:text-brand-800"
                      >
                        Receipt
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function StatSkeletonInline() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-28" />
    </div>
  )
}
