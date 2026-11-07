import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Users } from '@phosphor-icons/react'
import PageHeader from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Button, { buttonClasses } from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Pagination from '../components/ui/Pagination'
import { TableSkeleton } from '../components/ui/Skeleton'
import NewPatientModal from '../components/patients/NewPatientModal'
import { api, qs } from '../lib/api'
import { useApi, useDebounced } from '../hooks'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatDate } from '../lib/format'

export default function Patients() {
  const { isDoctor } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showNew, setShowNew] = useState(false)
  const debounced = useDebounced(query, 350)

  const { data, loading, error, reload } = useApi(
    (signal) => api.get(`/patients${qs({ q: debounced, page, per_page: 25 })}`, { signal }),
    [debounced, page],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description="Search the patient register."
        actions={
          isDoctor ? (
            <Button icon={<UserPlus size={17} />} onClick={() => setShowNew(true)}>
              New Patient
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="border-b border-slate-200 p-4">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value)
              setPage(1)
            }}
            placeholder="Search by name, phone or patient code"
            className="sm:max-w-md"
          />
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title={query ? 'No matching patients' : 'No patients yet'}
            description={query ? 'Try a different search term.' : 'Patients you add will appear here.'}
            action={
              isDoctor && !query ? (
                <Button size="sm" icon={<UserPlus size={16} />} onClick={() => setShowNew(true)}>
                  New Patient
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 lg:hidden">
              {data.items.map((patient) => (
                <li key={patient.id}>
                  <Link to={`/patients/${patient.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <Avatar name={patient.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{patient.full_name}</p>
                      <p className="tnum text-xs text-slate-500">
                        {patient.patient_code}
                        {patient.phone ? ` · ${patient.phone}` : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden lg:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Patient</TH>
                    <TH>Code</TH>
                    <TH>Phone</TH>
                    <TH>Gender</TH>
                    <TH>Registered</TH>
                    <TH align="right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((patient) => (
                    <TR key={patient.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={patient.full_name} size="sm" />
                          <span className="font-medium text-slate-900">{patient.full_name}</span>
                        </div>
                      </TD>
                      <TD className="tnum text-slate-500">{patient.patient_code}</TD>
                      <TD className="tnum text-slate-600">{patient.phone || '—'}</TD>
                      <TD className="capitalize text-slate-600">{patient.gender || '—'}</TD>
                      <TD className="text-slate-500">{formatDate(patient.created_at)}</TD>
                      <TD align="right">
                        <Link
                          to={`/patients/${patient.id}`}
                          className="text-sm font-medium text-brand-700 hover:text-brand-800"
                        >
                          View
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <Pagination page={data.page} perPage={data.per_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      {isDoctor ? (
        <NewPatientModal
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={(created) => {
            setShowNew(false)
            reload()
            toast.success(created.full_name, 'Patient created')
          }}
        />
      ) : null}
    </div>
  )
}
