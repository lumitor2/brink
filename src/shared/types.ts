// Shared types between main, preload and renderer.

import type { Lang, LangPref } from './i18n'

export interface AppConfig {
  /** Minutes before the meeting start the fullscreen overlay should appear. */
  leadMinutes: number
  /** Snooze duration in minutes when the user hits "Snooze". */
  snoozeMinutes: number
  /** Whether the gentle, non-fullscreen pre-reminder banner is enabled. */
  preReminderEnabled: boolean
  /** Minutes before the meeting start the pre-reminder banner should appear. */
  preReminderMinutes: number
  /** Include meetings the user has declined (off by default). */
  includeDeclined: boolean
  /** UI language preference: 'auto' follows the system locale. */
  language: LangPref
  /** Google OAuth desktop client id. */
  clientId: string
  /** Google OAuth desktop client secret. */
  clientSecret: string
}

export interface AuthStatus {
  signedIn: boolean
  email: string | null
  /** True when usable OAuth credentials exist (bundled at build OR configured). */
  hasCredentials: boolean
  /** True when the OAuth client is baked into the build (hide the manual fields). */
  bundledCredentials: boolean
}

/** A calendar event that has a joinable video link. */
export interface MeetingEvent {
  id: string
  title: string
  /** ISO start time. */
  start: string
  /** ISO end time. */
  end: string
  /** The URL to open when joining (Meet/Zoom/Teams). */
  joinUrl: string
  /** Human label of the provider, e.g. "Google Meet". */
  provider: string
}

/** Payload pushed to the overlay window when it should fire. */
export interface OverlayPayload {
  event: MeetingEvent
  /** ISO start time, repeated for convenience in the renderer countdown. */
  startsAt: string
}

export type OverlayAction = 'join' | 'snooze' | 'dismiss'

/** Actions available on the gentle pre-reminder banner. */
export type BannerAction = 'join' | 'dismiss'

/** API exposed to the renderer via contextBridge. */
export interface RendererApi {
  // --- settings window ---
  getConfig(): Promise<AppConfig>
  saveConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  getAuthStatus(): Promise<AuthStatus>
  signIn(): Promise<AuthStatus>
  signOut(): Promise<AuthStatus>
  /** Force an immediate calendar sync; returns the next upcoming meetings. */
  refreshNow(): Promise<MeetingEvent[]>
  getUpcoming(): Promise<MeetingEvent[]>
  /** Today's meetings that already finished (for the on-demand history view). */
  getEarlierToday(): Promise<MeetingEvent[]>
  onAuthChanged(cb: (status: AuthStatus) => void): () => void
  /** Manually trigger a test overlay for the next meeting (or a fake one). */
  testOverlay(): Promise<void>

  /** Manually trigger a test pre-reminder banner. */
  testBanner(): Promise<void>

  // --- overlay window ---
  onOverlay(cb: (payload: OverlayPayload) => void): () => void
  overlayAction(action: OverlayAction): void

  // --- pre-reminder banner window ---
  onBanner(cb: (payload: OverlayPayload) => void): () => void
  bannerAction(action: BannerAction): void

  /** Which view this window should render. */
  view: 'settings' | 'overlay' | 'banner'

  /** UI language resolved from the system locale ('cs' or 'en'). */
  locale: Lang
}
