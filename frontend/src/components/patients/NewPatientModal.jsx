import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import { Field, Input, Textarea, Select } from '../ui/Field'
import { api } from '../../lib/api'

const EMPTY = { full_name: '', phone: '', address: '', date_of_birth: '', gender: '', notes: '' }

export default function NewPatientModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (form.full_name.trim().length < 2) {
      setError('Enter the patient’s full name.')
      return
    }
    setSubmitting(true)
    try {
      const payload = { ...form, full_name: form.full_name.trim() }
      Object.keys(payload).forEach((key) => payload[key] === '' && delete payload[key])
      const created = await api.post('/patients', payload)
      onCreated(created)
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New patient"
      description="A patient code is generated automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-patient-form" type="submit" loading={submitting}>
            {submitting ? 'Saving…' : 'Save Patient'}
          </Button>
        </>
      }
    >
      <form id="new-patient-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field label="Full name" htmlFor="np-name" required>
          <Input id="np-name" value={form.full_name} onChange={update('full_name')} placeholder="Patient name" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="np-phone">
            <Input id="np-phone" value={form.phone} onChange={update('phone')} placeholder="07X XXX XXXX" inputMode="tel" />
          </Field>
          <Field label="Date of birth" htmlFor="np-dob">
            <Input id="np-dob" type="date" value={form.date_of_birth} onChange={update('date_of_birth')} />
          </Field>
        </div>
        <Field label="Gender" htmlFor="np-gender">
          <Select id="np-gender" value={form.gender} onChange={update('gender')}>
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Address" htmlFor="np-address">
          <Input id="np-address" value={form.address} onChange={update('address')} placeholder="Optional" />
        </Field>
        <Field label="Notes" htmlFor="np-notes" hint="Optional clinical notes">
          <Textarea id="np-notes" rows={2} value={form.notes} onChange={update('notes')} />
        </Field>
      </form>
    </Modal>
  )
}
