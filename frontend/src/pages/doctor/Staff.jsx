import { useState } from 'react'
import { UserPlus, UserList, Key, Power } from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'
import Alert from '../../components/ui/Alert'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { Field, Input, Select } from '../../components/ui/Field'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { api } from '../../lib/api'
import { useApi } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/format'

export default function Staff() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [showAdd, setShowAdd] = useState(false)
  const [resetting, setResetting] = useState(null)

  const { data, loading, error, reload } = useApi((signal) => api.get('/users', { signal }), [])

  const toggleStatus = async (member) => {
    const nextStatus = member.status === 'active' ? 'inactive' : 'active'
    const ok = await confirm({
      title: nextStatus === 'inactive' ? 'Deactivate account?' : 'Activate account?',
      message:
        nextStatus === 'inactive'
          ? `${member.name} will no longer be able to sign in.`
          : `${member.name} will be able to sign in again.`,
      confirmLabel: nextStatus === 'inactive' ? 'Deactivate' : 'Activate',
      tone: nextStatus === 'inactive' ? 'danger' : 'primary',
    })
    if (!ok) return
    try {
      await api.patch(`/users/${member.id}/status`, { status: nextStatus })
      toast.success(`${member.name} is now ${nextStatus}.`, 'Staff updated')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff accounts"
        description="Doctor and cashier accounts. Only a doctor can manage these."
        actions={
          <Button icon={<UserPlus size={17} />} onClick={() => setShowAdd(true)}>
            Add staff
          </Button>
        }
      />

      <Card>
        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={<UserList size={22} />} title="No accounts" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Username</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Last sign-in</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((member) => (
                <TR key={member.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="sm" />
                      <span className="font-medium text-slate-900">
                        {member.name}
                        {member.id === user?.id ? (
                          <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                        ) : null}
                      </span>
                    </div>
                  </TD>
                  <TD className="font-mono text-xs text-slate-600">{member.username}</TD>
                  <TD className="capitalize">{member.role}</TD>
                  <TD>
                    <Badge variant={member.status === 'active' ? 'success' : 'neutral'}>
                      {member.status}
                    </Badge>
                  </TD>
                  <TD className="tnum text-slate-500">
                    {member.last_login_at ? formatDateTime(member.last_login_at) : 'Never'}
                  </TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<Key size={15} />} onClick={() => setResetting(member)}>
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Power size={15} />}
                        disabled={member.id === user?.id}
                        onClick={() => toggleStatus(member)}
                        className={
                          member.status === 'active'
                            ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                            : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }
                      >
                        {member.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <AddStaffModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false)
          reload()
          toast.success('The new account can sign in now.', 'Staff created')
        }}
      />

      {resetting ? (
        <ResetPasswordModal
          member={resetting}
          onClose={() => setResetting(null)}
          onDone={() => {
            setResetting(null)
            toast.success('The user will need to sign in again.', 'Password reset')
          }}
        />
      ) : null}
    </div>
  )
}

function AddStaffModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'cashier' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (form.name.trim().length < 2) return setError('Enter the full name.')
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(form.username)) return setError('Username must be at least 3 characters (letters, numbers, dot, underscore, hyphen).')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')

    setSubmitting(true)
    try {
      await api.post('/users', { ...form, name: form.name.trim(), username: form.username.trim() })
      onCreated()
      setForm({ name: '', username: '', password: '', role: 'cashier' })
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
      title="Add staff account"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="add-staff-form" type="submit" loading={submitting}>
            {submitting ? 'Creating…' : 'Create Account'}
          </Button>
        </>
      }
    >
      <form id="add-staff-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field label="Full name" htmlFor="staff-name" required>
          <Input id="staff-name" value={form.name} onChange={update('name')} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" htmlFor="staff-username" required>
            <Input id="staff-username" value={form.username} onChange={update('username')} autoCapitalize="none" />
          </Field>
          <Field label="Role" htmlFor="staff-role" required>
            <Select id="staff-role" value={form.role} onChange={update('role')}>
              <option value="cashier">Cashier</option>
              <option value="doctor">Doctor</option>
            </Select>
          </Field>
        </div>
        <Field label="Temporary password" htmlFor="staff-password" required hint="At least 8 characters. The user can change it later.">
          <Input id="staff-password" type="text" value={form.password} onChange={update('password')} />
        </Field>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ member, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setSubmitting(true)
    try {
      await api.post(`/users/${member.id}/password`, { password })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password · ${member.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="reset-pw-form" type="submit" loading={submitting}>
            {submitting ? 'Saving…' : 'Reset Password'}
          </Button>
        </>
      }
    >
      <form id="reset-pw-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field label="New password" htmlFor="reset-pw" required hint="All of this user's sessions will be signed out.">
          <Input id="reset-pw" type="text" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        </Field>
      </form>
    </Modal>
  )
}
