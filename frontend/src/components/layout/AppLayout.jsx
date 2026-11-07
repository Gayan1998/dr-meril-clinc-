import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { X, SignOut } from '@phosphor-icons/react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import OfflineBanner from './OfflineBanner'
import BrandMark from '../ui/BrandMark'
import Avatar from '../ui/Avatar'
import { doctorNav, doctorMobileNav, cashierNav, cashierMobileNav } from './navItems'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useOnlineStatus } from '../../hooks'
import { cn } from '../../lib/cn'

export default function AppLayout() {
  const { user, settings, logout } = useAuth()
  const confirm = useConfirm()
  const online = useOnlineStatus()
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isDoctor = user?.role === 'doctor'
  const nav = isDoctor ? doctorNav : cashierNav
  const mobileNav = isDoctor ? doctorMobileNav : cashierMobileNav

  // close the drawer on navigation
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKey = (event) => event.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will need to sign in again to continue.',
      confirmLabel: 'Sign out',
      tone: 'danger',
    })
    if (ok) logout()
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      {/* Desktop sidebar */}
      <Sidebar
        nav={nav}
        user={user}
        clinicName={settings?.clinic_name}
        onLogout={handleLogout}
        className="fixed inset-y-0 left-0 hidden w-64 lg:flex"
      />

      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', drawerOpen ? '' : 'pointer-events-none')}>
        <div
          className={cn(
            'absolute inset-0 bg-slate-900/40 transition-opacity',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-72 max-w-[85%] transition-transform duration-200',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex h-full flex-col bg-white">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-2.5">
                <BrandMark size={32} />
                <span className="text-sm font-semibold text-slate-900">
                  {settings?.clinic_name || 'Clinic'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Menu">
              {nav.map((item) => {
                const Icon = item.icon
                const active = location.pathname.startsWith(item.to)
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false)
                      navigate(item.to)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                      active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <Icon size={19} />
                    {item.label}
                  </button>
                )
              })}
            </nav>
            <div className="border-t border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={user?.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs capitalize text-slate-500">{user?.role}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Sign out"
                >
                  <SignOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="lg:pl-64">
        <Topbar onMenu={() => setDrawerOpen(true)} user={user} online={online} />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12">
          <OfflineBanner />
          <Outlet />
        </main>
      </div>

      <MobileNav items={mobileNav} />
    </div>
  )
}
