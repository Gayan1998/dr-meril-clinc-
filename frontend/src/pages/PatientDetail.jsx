import { useParams } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, CalendarBlank, User } from '@phosphor-icons/react'
import PageHeader from '../components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table'
import Avatar from '../components/ui/Avatar'
import StatusBadge from '../components/ui/StatusBadge'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { TableSkeleton } from '../components/ui/Skeleton'
import { api } from '../lib/api'
import { useApi } from '../hooks'
import { useAuth } from '../context/AuthContext'
import { formatDate, formatDateTime, formatMoney } from '../lib/format'

export default function PatientDetail() {
  const { id } = useParams()
  const { settings } = useAuth()
  const currency = settings?.currency || 'LKR'
  const { data, loading, error, reload } = useApi((signal) => api.get(`/patients/${id}`, { signal }), [id])

  if (error) {
    return (
      <>
        <PageHeader title="Patient" />
        <ErrorState message={error.message} onRetry={reload} className="mt-6" />
      </>
    )
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {loading ? (
        <Card>
          <CardBody>
            <TableSkeleton rows={2} cols={3} />
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardBody>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar name={data.full_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-semibold text-slate-900">{data.full_name}</h1>
                  <p className="tnum text-sm text-slate-500">{data.patient_code}</p>
                </div>
              </div>
              <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
                <Info icon={<Phone size={15} />} label="Phone" value={data.phone || '—'} />
                <Info icon={<CalendarBlank size={15} />} label="Date of birth" value={data.date_of_birth ? formatDate(data.date_of_birth) : '—'} />
                <Info icon={<User size={15} />} label="Gender" value={data.gender ? data.gender[0].toUpperCase() + data.gender.slice(1) : '—'} />
                <Info icon={<MapPin size={15} />} label="Address" value={data.address || '—'} className="sm:col-span-2" />
                <Info icon={<CalendarBlank size={15} />} label="Registered" value={formatDate(data.created_at)} />
              </dl>
              {data.notes ? (
                <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
                  {data.notes}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Visit history" description="Most recent visits first" />
            {data.visits.length === 0 ? (
              <EmptyState title="No visits yet" description="This patient has no recorded visits." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Visit</TH>
                    <TH align="right">Amount</TH>
                    <TH>Status</TH>
                    <TH>Receipt</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.visits.map((visit) => (
                    <TR key={visit.id}>
                      <TD className="tnum whitespace-nowrap">{formatDateTime(visit.created_at)}</TD>
                      <TD className="tnum text-slate-500">{visit.visit_number}</TD>
                      <TD align="right" className="tnum font-medium text-slate-900">
                        {formatMoney(visit.consultation_fee, currency)}
                      </TD>
                      <TD>
                        <StatusBadge status={visit.status} />
                      </TD>
                      <TD className="tnum text-slate-500">{visit.payment_number || '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function Info({ icon, label, value, className = '' }) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{value}</dd>
    </div>
  )
}
