import { useEffect, useState } from 'react'
import { formatRemaining } from '../../shared/format'

/** Live, second-by-second countdown to an ISO timestamp, with explicit units. */
export function useCountdown(target: string | null): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!target) return ''
  return formatRemaining(new Date(target).getTime() - now)
}
