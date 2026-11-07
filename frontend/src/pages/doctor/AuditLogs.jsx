import { useState } from 'react'
import { ShieldCheck } from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table'
import { Field, Input, Select } from '../../components/ui/Field'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Pagination from '../../components/ui/Pagination'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { api, qs } from '../../lib/api'
import { useApi } from '../../hooks'
import { formatDateTime, todayISO } from '../../lib/format'

const ACTION_TONE = {
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  LOGIN_FAILED: 'danger',
  LOGIN_BLOCKED: 'danger',
  PATIENT_CREATED: 'brand',
  VISIT_CREATED: 'brand',
  VISIT_CANCELLED: 'warning',
  PAYMENT_CREATED: 'success',
  PAYMENT_VOIDED: 'danger',
  USER_CREATED: 'brand',
  USER_ACTIVATED: 'success',
  USER_DEACTIVATED: 'warning',
  PASSWORD_CHANGED: 'warning',
  PASSWORD_RESET: 'warning',
  SETTINGS_UPDATED: 'neutral',
}

export default function AuditLogs() {
  const [date, setDate] = useState(todayISO())
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  const actions = useApi((signal) => api.get('/audit-logs/actions', { signal }), [])
  const logs = useApi(
    (signal) => api.get(`/audit-logs${qs({ date, action, page, per_page: 30 })}`, { signal }),
    [date, action, page],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="An append-only record of important actions. Entries cannot be edited or deleted."
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date" htmlFor="audit-date">
            <Input
              id="audit-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setPage(1)
              }}
            />
          </Field>
          <Field label="Action" htmlFor="audit-action">
            <Select
              id="audit-action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All actions</option>
              {(actions.data?.actions || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {logs.error ? (
          <ErrorState message={logs.error.message} onRetry={logs.reload} />
        ) : logs.loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : logs.data.items.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="No audit entries"
            description="No activity was recorded for the selected filters."
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>User</TH>
                  <TH>Action</TH>
                  <TH>Entity</TH>
                  <TH>Details</TH>
                  <TH>IP</TH>
                </TR>
              </THead>
              <TBody>
                {logs.data.items.map((entry) => (
                  <TR key={entry.id}>
                    <TD className="tnum whitespace-nowrap text-slate-500">{formatDateTime(entry.created_at)}</TD>
                    <TD>
                      <span className="font-medium text-slate-900">{entry.user_name}</span>
                      {entry.user_role ? (
                        <span className="block text-xs capitalize text-slate-500">{entry.user_role}</span>
                      ) : null}
                    </TD>
                    <TD>
                      <Badge variant={ACTION_TONE[entry.action] || 'neutral'}>{entry.action}</Badge>
                    </TD>
                    <TD className="tnum whitespace-nowrap text-slate-500">
                      {entry.entity_type ? `${entry.entity_type} #${entry.entity_id ?? '—'}` : '—'}
                    </TD>
                    <TD className="max-w-xs text-slate-600">{describe(entry)}</TD>
                    <TD className="tnum whitespace-nowrap text-slate-400">{entry.ip_address || '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={logs.data.page}
              perPage={logs.data.per_page}
              total={logs.data.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  )
}

function describe(entry) {
  const values = entry.new_values || entry.old_values
  if (!values || typeof values !== 'object') return '—'
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== '')
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(' · ')
}
