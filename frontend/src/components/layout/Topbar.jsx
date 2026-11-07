import { Link } from 'react-router-dom'
import { List, WifiHigh, WifiSlash } from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'

export default function Topbar({ onMenu, user, online }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <List size={20} />
        </button>

        <div className="flex-1" />

        <span
          className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset sm:inline-flex ${
            online
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-amber-50 text-amber-800 ring-amber-200'
          }`}
        >
          {online ? <WifiHigh size={14} /> : <WifiSlash size={14} />}
          {online ? 'Online' : 'Offline'}
        </span>

        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-slate-100"
        >
          <Avatar name={user?.name} size="sm" />
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user?.name}</span>
        </Link>
      </div>
    </header>
  )
}
