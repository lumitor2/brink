import { describe, it, expect } from 'vitest'
import { sanitizeConfig, DEFAULT_CONFIG } from '../src/shared/config'

describe('sanitizeConfig', () => {
  it('passes through a valid config unchanged', () => {
    const valid = {
      leadMinutes: 2,
      snoozeMinutes: 10,
      preReminderEnabled: false,
      preReminderMinutes: 30,
      includeDeclined: true,
      language: 'cs' as const,
      clientId: 'abc',
      clientSecret: 'xyz'
    }
    expect(sanitizeConfig(valid)).toEqual(valid)
  })

  it('falls back to defaults for non-numeric / missing numbers', () => {
    const c = sanitizeConfig({ leadMinutes: 'oops' as unknown as number, snoozeMinutes: NaN })
    expect(c.leadMinutes).toBe(DEFAULT_CONFIG.leadMinutes)
    expect(c.snoozeMinutes).toBe(DEFAULT_CONFIG.snoozeMinutes)
  })

  it('clamps numbers into their allowed range and rounds them', () => {
    expect(sanitizeConfig({ leadMinutes: -5 }).leadMinutes).toBe(0)
    expect(sanitizeConfig({ leadMinutes: 99999 }).leadMinutes).toBe(1440)
    expect(sanitizeConfig({ snoozeMinutes: 0 }).snoozeMinutes).toBe(1) // min 1
    expect(sanitizeConfig({ preReminderMinutes: 3.7 }).preReminderMinutes).toBe(4)
  })

  it('coerces booleans', () => {
    expect(sanitizeConfig({ preReminderEnabled: 1 as unknown as boolean }).preReminderEnabled).toBe(
      true
    )
    expect(sanitizeConfig({ includeDeclined: '' as unknown as boolean }).includeDeclined).toBe(
      false
    )
  })

  it('constrains language to a known value, defaulting to auto', () => {
    expect(sanitizeConfig({ language: 'cs' }).language).toBe('cs')
    expect(sanitizeConfig({ language: 'en' }).language).toBe('en')
    expect(sanitizeConfig({ language: 'auto' }).language).toBe('auto')
    expect(sanitizeConfig({ language: 'fr' as unknown as 'auto' }).language).toBe('auto')
  })

  it('bounds string lengths and coerces nullish to empty', () => {
    const long = 'x'.repeat(1000)
    expect(sanitizeConfig({ clientId: long }).clientId).toHaveLength(512)
    expect(sanitizeConfig({ clientSecret: undefined }).clientSecret).toBe('')
  })
})
