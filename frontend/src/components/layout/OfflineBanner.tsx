import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div role="status" className="bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning">
      You're offline. Changes will fail until your connection comes back.
    </div>
  )
}
