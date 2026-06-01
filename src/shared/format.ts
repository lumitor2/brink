/**
 * Format a remaining duration (in milliseconds) with explicit units, so the
 * magnitude is never ambiguous (e.g. "10 m 15 s" can't be read as hours):
 *
 *   ≥ 1 day  → "2 d 5 h"
 *   ≥ 1 hour → "1 h 05 m"
 *   ≥ 1 min  → "10 m 15 s"
 *   < 1 min  → "45 s"
 *
 * Negative values are prefixed with "-" (used by the overlay once a meeting
 * has already started).
 */
export function formatRemaining(diffMs: number): string {
  const sign = diffMs < 0 ? '-' : ''
  const totalSec = Math.floor(Math.abs(diffMs) / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (d > 0) return `${sign}${d} d ${h} h`
  if (h > 0) return `${sign}${h} h ${pad(m)} m`
  if (m > 0) return `${sign}${m} m ${pad(s)} s`
  return `${sign}${s} s`
}
