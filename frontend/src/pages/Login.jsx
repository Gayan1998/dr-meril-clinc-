import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeSlash, ShieldCheck, Receipt, ChartBar } from '@phosphor-icons/react'
import BrandMark from '../components/ui/BrandMark'
import Button from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import Alert from '../components/ui/Alert'
import FullPageLoader from '../components/FullPageLoader'
import { useAuth } from '../context/AuthContext'

const POINTS = [
  { icon: ShieldCheck, text: 'The doctor creates every charge. The cashier can only collect it.' },
  { icon: Receipt, text: 'Amounts are locked on the server, never trusted from the browser.' },
  { icon: ChartBar, text: 'Every action is recorded in an append-only audit log.' },
]

export default function Login() {
  const { login, user, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (status === 'loading') return <FullPageLoader />
  if (user) {
    return <Navigate to={user.role === 'doctor' ? '/doctor/dashboard' : '/cashier/dashboard'} replace />
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setSubmitting(true)
    try {
      const signedIn = await login(username.trim(), password)
      const destination =
        location.state?.from ||
        (signedIn.role === 'doctor' ? '/doctor/dashboard' : '/cashier/dashboard')
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.offline ? 'Unable to connect. Please check your connection and try again.' : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <span className="text-base font-semibold">Clinic Manager</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight">Clinic management with cash control built in.</h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-100">
            A focused system for a doctor and a cashier. Clear separation of duties, locked amounts and a
            full audit trail.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-brand-50">
                <Icon size={20} className="mt-0.5 shrink-0 text-brand-300" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-brand-200">
          Amounts and totals are always calculated on the server.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-slate-50 px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={40} />
            <span className="text-base font-semibold text-slate-900">Clinic Manager</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use the account provided by the clinic administrator.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {error ? <Alert variant="error">{error}</Alert> : null}

            <Field label="Username" htmlFor="username" required>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. doctor"
                invalid={Boolean(error)}
              />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                  invalid={Boolean(error)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" block loading={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
