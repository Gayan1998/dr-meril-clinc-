import { NavLink } from 'react-router-dom'
import { SignOut } from '@phosphor-icons/react'
import BrandMark from '../ui/BrandMark'
import Avatar from '../ui/Avatar'
import { cn } from '../../lib/cn'

function NavItem({ item, onNavigate }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-800'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <Icon size={18} weight="regular" />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ nav, user, clinicName, onLogout, onNavigate, className = '' }) {
  return (
    <aside className={cn('no-print flex h-full flex-col border-r border-slate-200 bg-white', className)}>
      <div className="flex items-center gap-3 px-5 py-5">
        <BrandMark size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{clinicName || 'Clinic'}</p>
          <p className="text-xs text-slate-500">Clinic Manager</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {nav.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="text-xs capitalize text-slate-500">{user?.role}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Sign out"
            title="Sign out"
          >
            <SignOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}
