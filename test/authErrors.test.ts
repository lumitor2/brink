import { describe, it, expect } from 'vitest'
import { isAuthError } from '../src/shared/authErrors'

describe('isAuthError', () => {
  it('is true for invalid_grant (revoked/expired refresh token)', () => {
    expect(isAuthError({ response: { data: { error: 'invalid_grant' } } })).toBe(true)
  })
  it('is true for invalid_client', () => {
    expect(isAuthError({ response: { data: { error: 'invalid_client' } } })).toBe(true)
  })
  it('is true for HTTP 401', () => {
    expect(isAuthError({ response: { status: 401 } })).toBe(true)
  })
  it('is false for transient/network errors', () => {
    expect(isAuthError(new Error('ENOTFOUND'))).toBe(false)
    expect(isAuthError({ response: { status: 500 } })).toBe(false)
    expect(isAuthError({ response: { data: { error: 'rate_limit_exceeded' } } })).toBe(false)
  })
  it('is false for null/undefined/garbage', () => {
    expect(isAuthError(null)).toBe(false)
    expect(isAuthError(undefined)).toBe(false)
    expect(isAuthError('boom')).toBe(false)
  })
})
