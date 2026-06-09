/**
 * True for the family of Google errors that mean "the stored token can't be
 * used to read the calendar and the user must sign in again" — as opposed to a
 * transient network blip. The app signs out and prompts re-login on these.
 *
 * Covers:
 *  - OAuth token endpoint: invalid_grant / invalid_client (revoked/expired,
 *    or client mismatch) — `error` is a string there.
 *  - HTTP 401 (unauthenticated).
 *  - HTTP 403 with an insufficient-scope reason — happens when the stored token
 *    was granted without calendar.readonly (e.g. signed in before the scope was
 *    configured). Re-login fixes it; a plain 403 (rate limit, etc.) does not, so
 *    we only match the scope/permission reason, not every 403.
 */
export function isAuthError(err: unknown): boolean {
  const e = err as {
    response?: {
      status?: number
      data?: {
        // OAuth endpoint → string; Calendar API → object.
        error?: string | { message?: string; errors?: Array<{ reason?: string }> }
      }
    }
    message?: string
  }

  const status = e?.response?.status
  if (status === 401) return true

  const data = e?.response?.data?.error
  if (typeof data === 'string') {
    return data === 'invalid_grant' || data === 'invalid_client'
  }

  if (status === 403) {
    const reason = data?.errors?.[0]?.reason ?? ''
    const message = data?.message ?? e?.message ?? ''
    return (
      reason === 'insufficientPermissions' ||
      reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
      /insufficient permission/i.test(message)
    )
  }

  return false
}
