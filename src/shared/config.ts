import type { AppConfig } from './types'

export const DEFAULT_CONFIG: AppConfig = {
  leadMinutes: 1,
  snoozeMinutes: 1,
  preReminderEnabled: true,
  preReminderMinutes: 15,
  includeDeclined: false,
  language: 'auto',
  clientId: '',
  clientSecret: ''
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

/**
 * Coerce/clamp config to known shapes and ranges. The renderer (or an on-disk
 * file) can supply any partial/garbage AppConfig, so never trust it blindly:
 * numbers are rounded and clamped, booleans coerced, language constrained to a
 * known value, and strings bounded in length.
 */
export function sanitizeConfig(c: Partial<AppConfig>): AppConfig {
  return {
    leadMinutes: clampInt(c.leadMinutes, 0, 1440, DEFAULT_CONFIG.leadMinutes),
    snoozeMinutes: clampInt(c.snoozeMinutes, 1, 1440, DEFAULT_CONFIG.snoozeMinutes),
    preReminderEnabled: Boolean(c.preReminderEnabled),
    preReminderMinutes: clampInt(c.preReminderMinutes, 1, 10080, DEFAULT_CONFIG.preReminderMinutes),
    includeDeclined: Boolean(c.includeDeclined),
    language: c.language === 'cs' || c.language === 'en' ? c.language : 'auto',
    clientId: String(c.clientId ?? '').slice(0, 512),
    clientSecret: String(c.clientSecret ?? '').slice(0, 512)
  }
}
