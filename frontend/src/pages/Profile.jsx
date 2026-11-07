import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SignOut, Key, UserCircle } from '@phosphor-icons/react'
import PageHeader from '../components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import { Field, Input } from '../components/ui/Field'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { formatDateTime } from '../lib/format'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const changePassword = async (event) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    if (form.new_password.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (form.new_password !== form.confirm_password) {
      setError('The new passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      setForm({ current_password: '', new_password: '', confirm_password: '' })
      setSuccess(true)
      toast.success('Use your new password next time you sign in.', 'Password updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will need to sign in again to continue.',
      confirmLabel: 'Sign out',
      tone: 'danger',
    })
    if (ok) {
      await logout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details and security." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={user?.name} size="lg" />
              <div>
                <p className="text-base font-semibold text-slate-900">{user?.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="brand" className="capitalize">
                    {user?.role}
                  </Badge>
                  <span className="font-mono text-xs text-slate-500">{user?.username}</span>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-slate-100 border-t border-slate-100 pt-2 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Last sign-in</dt>
                <dd className="text-slate-800">
                  {user?.last_login ? formatDateTime(user.last_login) : 'This session'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Role</dt>
                <dd className="capitalize text-slate-800">{user?.role}</dd>
              </div>
            </dl>
            <Button variant="secondary" block icon={<SignOut size={17} />} onClick={handleLogout}>
              Sign out
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Change password" description="You will stay signed in on this device." />
          <CardBody>
            <form onSubmit={changePassword} className="space-y-4" noValidate>
              {error ? <Alert variant="error">{error}</Alert> : null}
              {success ? <Alert variant="success">Your password has been updated.</Alert> : null}

              <Field label="Current password" htmlFor="cur-pw" required>
                <Input
                  id="cur-pw"
                  type="password"
                  autoComplete="current-password"
                  value={form.current_password}
                  onChange={update('current_password')}
                />
              </Field>
              <Field label="New password" htmlFor="new-pw" required hint="At least 8 characters.">
                <Input
                  id="new-pw"
                  type="password"
                  autoComplete="new-password"
                  value={form.new_password}
                  onChange={update('new_password')}
                />
              </Field>
              <Field label="Confirm new password" htmlFor="conf-pw" required>
                <Input
                  id="conf-pw"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm_password}
                  onChange={update('confirm_password')}
                />
              </Field>
              <Button type="submit" loading={submitting} icon={!submitting ? <Key size={17} /> : null}>
                {submitting ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
      >
        <UserCircle size={15} /> Clinic Manager
      </Link>
    </div>
  )
}
