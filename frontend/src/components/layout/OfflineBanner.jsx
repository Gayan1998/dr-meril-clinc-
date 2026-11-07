import { WifiSlash } from '@phosphor-icons/react'
import { useOnlineStatus } from '../../hooks'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="no-print mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <WifiSlash size={18} className="mt-0.5 shrink-0" />
      <p>
        <span className="font-medium">You are offline.</span> Financial transactions require an internet
        connection. Nothing will be saved until you reconnect.
      </p>
    </div>
  )
}
