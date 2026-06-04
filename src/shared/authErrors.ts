/**
 * True for the family of Google OAuth errors that mean "the stored refresh
 * token is no longer usable" (revoked, expired, client mismatch) — as opposed
 * to a transient network blip. The app signs out and prompts re-login on these.
 */
export function isAuthError(err: unknown): boolean {
  const e = err as {
    response?: { data?: { error?: string }; status?: number }
    message?: string
  }
  const code = e?.response?.data?.error
  return code === 'invalid_grant' || code === 'invalid_client' || e?.response?.status === 401
}
