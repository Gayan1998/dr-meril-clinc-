import { useEffect, useState } from 'react'
import { FloppyDisk, Storefront } from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import { Field, Input, Textarea, Select } from '../../components/ui/Field'
import Skeleton from '../../components/ui/Skeleton'
import ErrorState from '../../components/ui/ErrorState'
import { api } from '../../lib/api'
import { useApi } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD']

export default function Settings() {
  const { setSettings } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi((signal) => api.get('/settings', { signal }), [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaveError(null)
    if (!form.clinic_name?.trim()) {
      setSaveError('Clinic name is required.')
      return
    }
    setSaving(true)
    try {
      const saved = await api.put('/settings', form)
      setForm(saved)
      setSettings(saved)
      toast.success('Receipts and dashboards will use the new details.', 'Settings saved')
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <>
        <PageHeader title="Clinic settings" />
        <ErrorState message={error.message} onRetry={reload} className="mt-6" />
      </>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clinic settings" description="Used on receipts and across the app." />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Clinic details" description="Shown on every printed receipt." />
            <CardBody className="space-y-4">
              {loading || !form ? (
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
              ) : (
                <>
                  {saveError ? <Alert variant="error">{saveError}</Alert> : null}
                  <Field label="Clinic name" htmlFor="set-name" required>
                    <Input id="set-name" value={form.clinic_name} onChange={update('clinic_name')} />
                  </Field>
                  <Field label="Address" htmlFor="set-address">
                    <Textarea id="set-address" rows={2} value={form.address} onChange={update('address')} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Phone" htmlFor="set-phone">
                      <Input id="set-phone" value={form.phone} onChange={update('phone')} />
                    </Field>
                    <Field label="Email" htmlFor="set-email">
                      <Input id="set-email" type="email" value={form.email} onChange={update('email')} />
                    </Field>
                  </div>
                  <Field label="Logo URL" htmlFor="set-logo" hint="Optional. A link to a hosted logo image.">
                    <Input id="set-logo" value={form.logo_url} onChange={update('logo_url')} placeholder="https://…" />
                  </Field>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Receipt" />
            <CardBody className="space-y-4">
              {loading || !form ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <Field label="Receipt footer" htmlFor="set-footer" hint="A short closing line on every receipt.">
                    <Input id="set-footer" value={form.receipt_footer} onChange={update('receipt_footer')} />
                  </Field>
                  <Field label="Currency" htmlFor="set-currency" hint="Amounts are stored the same way; this only changes the symbol.">
                    <Select id="set-currency" value={form.currency} onChange={update('currency')}>
                      {CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader title="Save changes" />
              <CardBody className="space-y-4">
                <p className="text-sm text-slate-500">
                  Changes apply immediately for everyone, including the receipt layout.
                </p>
                <Button
                  type="submit"
                  block
                  loading={saving}
                  disabled={loading || !form}
                  icon={!saving ? <FloppyDisk size={17} /> : null}
                >
                  {saving ? 'Saving…' : 'Save Settings'}
                </Button>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                  <Storefront size={15} />
                  Currency currently shown as <span className="font-medium text-slate-700">{form?.currency || 'LKR'}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
