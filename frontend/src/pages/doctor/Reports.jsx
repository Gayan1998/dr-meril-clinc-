import { useState } from 'react'
import { Printer, ChartBar, Users, Receipt, Wallet, ClockCounterClockwise } from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table'
import { Field, Input, Select } from '../../components/ui/Field'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import StatusBadge from '../../components/ui/StatusBadge'
import Skeleton, { StatSkeleton, TableSkeleton } from '../../components/ui/Skeleton'
import { api, qs } from '../../lib/api'
import { useApi, useDebounced } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { formatMoney, formatMethod, formatTime, formatDate, plural, todayISO } from '../../lib/format'

export default function Reports() {
  const { settings } = useAuth()
  const currency = settings?.currency || 'LKR'
  const [date, setDate] = useState(todayISO())
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 350)

  const daily = useApi(
    (signal) => api.get(`/reports/daily${qs({ date, status, method, q: debounced })}`, { signal }),
    [date, status, method, debounced],
  )
  const closing = useApi((signal) => api.get(`/reports/closing${qs({ date })}`, { signal }), [date])

  const summary = daily.data?.summary

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Daily report"
          description="Charges created, payments collected and cash reconciliation."
          actions={
            <Button variant="secondary" icon={<Printer size={17} />} onClick={() => window.print()}>
              Print report
            </Button>
          }
        />
      </div>

      {/* Filters */}
      <Card className="no-print">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date" htmlFor="rep-date">
            <Input id="rep-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Payment status" htmlFor="rep-status">
            <Select id="rep-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="pending_payment">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Payment method" htmlFor="rep-method">
            <Select id="rep-method" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="">All methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
            </Select>
          </Field>
          <Field label="Search" htmlFor="rep-search">
            <Input
              id="rep-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Patient or visit"
            />
          </Field>
        </div>
      </Card>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">{settings?.clinic_name}</h1>
        <p className="text-sm">
          Daily report · {formatDate(date)} · generated {new Date().toLocaleString('en-GB')}
        </p>
      </div>

      {daily.error ? (
        <ErrorState message={daily.error.message} onRetry={daily.reload} />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {daily.loading ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <StatCard label="Patients seen" value={summary.patients_seen} icon={<Users size={18} />} />
                <StatCard
                  label="Total charges"
                  value={formatMoney(summary.total_charges, currency)}
                  icon={<Receipt size={18} />}
                />
                <StatCard
                  label="Paid"
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
                  hint={`${summary.visits_pending} ${plural(summary.visits_pending, 'visit')}`}
                />
              </>
            )}
          </div>

          {/* Anti-fraud reconciliation */}
          {!daily.loading ? (
            <Card>
              <CardHeader
                title="Charges vs collections"
                description="Visits created by the doctor compared with payments collected by the cashier"
              />
              <CardBody>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <Metric label="Visits created" value={summary.visits_created} />
                  <Metric label="Paid visits" value={summary.visits_paid} tone="success" />
                  <Metric
                    label="Pending visits"
                    value={summary.visits_pending}
                    tone={summary.visits_pending ? 'warning' : 'default'}
                  />
                  <Metric label="Cancelled" value={summary.visits_cancelled} />
                  <Metric label="Voided payments" value={summary.voided} tone={summary.voided ? 'danger' : 'default'} />
                </div>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Detail table */}
            <Card className="lg:col-span-2">
              <CardHeader title="Visit details" description={formatDate(date)} />
              {daily.loading ? (
                <TableSkeleton rows={6} cols={5} />
              ) : daily.data.items.length === 0 ? (
                <EmptyState
                  icon={<ChartBar size={22} />}
                  title="No activity for this date"
                  description="No visits match the selected filters."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Time</TH>
                      <TH>Patient</TH>
                      <TH>Visit</TH>
                      <TH align="right">Amount</TH>
                      <TH>Status</TH>
                      <TH>Cashier</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {daily.data.items.map((row) => (
                      <TR key={row.id}>
                        <TD className="tnum whitespace-nowrap">{formatTime(row.created_at)}</TD>
                        <TD className="font-medium text-slate-900">{row.patient_name}</TD>
                        <TD className="tnum whitespace-nowrap text-slate-500">{row.visit_number}</TD>
                        <TD align="right" className="tnum font-medium text-slate-900">
                          {formatMoney(row.consultation_fee, currency)}
                        </TD>
                        <TD>
                          <StatusBadge status={row.status} />
                        </TD>
                        <TD className="text-slate-500">{row.cashier || '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>

            {/* Daily closing */}
            <Card>
              <CardHeader title="Daily closing" description="Cash reconciliation by method" />
              <CardBody className="space-y-3">
                {closing.loading ? (
                  <>
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </>
                ) : (
                  <>
                    <ClosingRow label="Cash" value={formatMoney(closing.data.by_method.cash, currency)} />
                    <ClosingRow label="Card" value={formatMoney(closing.data.by_method.card, currency)} />
                    <ClosingRow
                      label="Bank Transfer"
                      value={formatMoney(closing.data.by_method.bank_transfer, currency)}
                    />
                    <div className="border-t border-slate-200 pt-3">
                      <ClosingRow
                        label="Total collected"
                        value={formatMoney(closing.data.total_collected, currency)}
                        strong
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm text-slate-600">Pending</span>
                      <span className="tnum text-sm font-medium text-amber-700">
                        {formatMoney(closing.data.pending_total, currency)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {closing.data.transactions} transactions · {closing.data.pending_count} pending visits
                    </p>
                  </>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'default' }) {
  const tones = { default: 'text-slate-900', success: 'text-emerald-600', warning: 'text-amber-600', danger: 'text-red-600' }
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`tnum mt-1 text-xl font-semibold ${tones[tone] || tones.default}`}>{value}</p>
    </div>
  )
}

function ClosingRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${strong ? 'font-medium text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`tnum text-sm ${strong ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}
