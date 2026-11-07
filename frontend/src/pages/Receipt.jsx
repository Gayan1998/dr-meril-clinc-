import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from '@phosphor-icons/react'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import FullPageLoader from '../components/FullPageLoader'
import ReceiptSheet from '../components/payments/ReceiptSheet'
import { api } from '../lib/api'
import { useApi } from '../hooks'
import { useAuth } from '../context/AuthContext'

export default function Receipt() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings } = useAuth()
  const [paper, setPaper] = useState('thermal')
  const { data, loading, error, reload } = useApi((signal) => api.get(`/payments/${id}`, { signal }), [id])

  const clinic = data?.clinic || settings || {}

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex-1" />
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {[
              { value: 'thermal', label: '80mm' },
              { value: 'a4', label: 'A4' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPaper(option.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  paper === option.value ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button icon={<Printer size={17} />} onClick={() => window.print()} disabled={loading || !data}>
            Print
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading ? (
          <FullPageLoader label="Preparing receipt…" />
        ) : (
          <ReceiptSheet payment={data} clinic={clinic} paper={paper} />
        )}
      </div>
    </div>
  )
}
