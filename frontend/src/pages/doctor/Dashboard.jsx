import { Link } from 'react-router-dom'
import {
  Users,
  Receipt,
  Wallet,
  ClockCounterClockwise,
  PlusCircle,
  WarningCircle,
  Prohibit,
  ArrowRight,
} from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button, { buttonClasses } from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { StatSkeleton, Skeleton } from '../../components/ui/Skeleton'
import { useApi } from '../../hooks'
import { api, qs } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatMoney, formatMethod, formatTime, greeting, plural, todayISO } from '../../lib/format'

export default function DoctorDashboard() {
  const { user, settings } = useAuth()
  const currency = settings?.currency || 'LKR'
  const date = todayISO()
  const { data, loading, error, reload } = useApi((signal) => api.get(`/dashboard/doctor${qs({ date })}`, { signal }), [date])

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState message={error.message} onRetry={reload} className="mt-6" />
      </>
    )
  }

  const summary = data?.summary
  const anomalies = data?.anomalies

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting(user?.name || '')}
        description="Here is how the clinic is doing today."
        actions={
          <Link to="/doctor/new-visit" className={buttonClasses({ variant: 'primary' })}>
            <PlusCircle size={18} weight="fill" />
            New Visit
          </Link>
        }
      />

      {/* Key numbers */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Patients seen"
            value={summary.patients_seen}
            icon={<Users size={18} />}
            hint={`${summary.visits_created} ${plural(summary.visits_created, 'visit')} created`}
          />
          <StatCard
            label="Total charges"
            value={formatMoney(summary.total_charges, currency)}
            icon={<Receipt size={18} />}
            hint="Excludes cancelled visits"
          />
          <StatCard
            label="Collected"
            value={formatMoney(summary.collected, currency)}
            tone="success"
            icon={<Wallet size={18} />}
            hint={`${summary.transactions} ${plural(summary.transactions, 'payment')}`}
          />
          <StatCard
            label="Pending"
            value={formatMoney(summary.pending, currency)}
            tone={summary.pending > 0 ? 'warning' : 'default'}
            icon={<ClockCounterClockwise size={18} />}
            hint={`${summary.visits_pending} awaiting payment`}
          />
        </div>
      )}

      {/* Anomaly indicators */}
      {!loading && anomalies && (anomalies.pending_visits > 0 || anomalies.cancelled_visits > 0 || anomalies.voided_payments > 0) ? (
        <div className="flex flex-wrap gap-2">
          {anomalies.pending_visits > 0 ? (
            <Indicator icon={<ClockCounterClockwise size={15} />} tone="warning">
              {anomalies.pending_visits} {plural(anomalies.pending_visits, 'visit')} pending payment
            </Indicator>
          ) : null}
          {anomalies.cancelled_visits > 0 ? (
            <Indicator icon={<Prohibit size={15} />} tone="neutral">
              {anomalies.cancelled_visits} cancelled {plural(anomalies.cancelled_visits, 'visit')} today
            </Indicator>
          ) : null}
          {anomalies.voided_payments > 0 ? (
            <Indicator icon={<WarningCircle size={15} />} tone="danger">
              {anomalies.voided_payments} {plural(anomalies.voided_payments, 'payment')} voided today
            </Indicator>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's patients */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today's patients"
            description="Most recent visits created today"
            action={
              <Link to="/doctor/visits" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                View all
              </Link>
            }
          />
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : data.recent_visits.length === 0 ? (
            <EmptyState
              icon={<Users size={22} />}
              title="No visits yet today"
              description="Visits you create will appear here and in the cashier's queue."
              action={
                <Link to="/doctor/new-visit" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                  <PlusCircle size={16} weight="fill" />
                  New Visit
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_visits.map((visit) => (
                <li key={visit.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{visit.patient_name}</p>
                    <p className="tnum text-xs text-slate-500">
                      {visit.visit_number} · {formatTime(visit.created_at)}
                    </p>
                  </div>
                  <span className="tnum text-sm font-medium text-slate-800">
                    {formatMoney(visit.consultation_fee, currency)}
                  </span>
                  <StatusBadge status={visit.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Payment summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payment summary" description="Today by method" />
            <CardBody className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </>
              ) : (
                <>
                  <SummaryRow label="Cash" value={formatMoney(summary.by_method.cash, currency)} />
                  <SummaryRow label="Card" value={formatMoney(summary.by_method.card, currency)} />
                  <SummaryRow label="Bank Transfer" value={formatMoney(summary.by_method.bank_transfer, currency)} />
                  <div className="border-t border-slate-200 pt-3">
                    <SummaryRow
                      label="Total collected"
                      value={formatMoney(summary.collected, currency)}
                      strong
                    />
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent payments" />
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
                  <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-800">{payment.patient_name}</p>
                      <p className="text-xs text-slate-500">{formatMethod(payment.payment_method)}</p>
                    </div>
                    <span className="tnum text-sm font-medium text-emerald-600">
                      {formatMoney(payment.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Anti-fraud strip */}
      {!loading ? (
        <Card>
          <CardHeader
            title="Charges vs collections"
            description="A quick reconciliation of what was charged against what was collected today"
            action={
              <Link to="/doctor/reports" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
                Full report <ArrowRight size={14} />
              </Link>
            }
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MiniStat label="Visits created" value={summary.visits_created} />
              <MiniStat label="Paid visits" value={summary.visits_paid} tone="success" />
              <MiniStat label="Pending visits" value={summary.visits_pending} tone={summary.visits_pending ? 'warning' : 'default'} />
              <MiniStat label="Cancelled" value={summary.visits_cancelled} />
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${strong ? 'font-medium text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`tnum text-sm ${strong ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}

function MiniStat({ label, value, tone = 'default' }) {
  const tones = { default: 'text-slate-900', success: 'text-emerald-600', warning: 'text-amber-600' }
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`tnum mt-1 text-xl font-semibold ${tones[tone] || tones.default}`}>{value}</p>
    </div>
  )
}

function Indicator({ icon, children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
    warning: 'bg-amber-50 text-amber-800 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-red-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  )
}
