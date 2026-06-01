import type { MeetingEvent } from '../shared/types'
import { getConfig } from './store'
import { fetchUpcomingMeetings } from './calendar'
import { getAuthorizedClient } from './auth'
import { showOverlay, isOverlayOpen, onOverlayAction, pushPayloadToOverlay } from './overlay'
import {
  showBanner,
  isBannerOpen,
  closeBanner,
  onBannerAction,
  pushPayloadToBanner
} from './banner'

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const TICK_INTERVAL_MS = 1000 // 1 second

let meetings: MeetingEvent[] = []
let syncTimer: NodeJS.Timeout | null = null
let tickTimer: NodeJS.Timeout | null = null

/** Event ids whose fullscreen overlay has already fired. */
const fired = new Set<string>()
/** Event ids whose gentle pre-reminder banner has already shown. */
const firedPre = new Set<string>()
/** Event id -> epoch ms until which the event is snoozed. */
const snoozedUntil = new Map<string, number>()

let onMeetingsUpdated: ((m: MeetingEvent[]) => void) | null = null
let onAuthInvalid: (() => void) | null = null

export function setMeetingsListener(cb: (m: MeetingEvent[]) => void): void {
  onMeetingsUpdated = cb
}

/** Called when Google rejects the stored token (so the app can sign out). */
export function setAuthInvalidListener(cb: () => void): void {
  onAuthInvalid = cb
}

/** True for the family of errors that mean "the refresh token is no good". */
function isAuthError(err: unknown): boolean {
  const e = err as { response?: { data?: { error?: string }; status?: number }; message?: string }
  const code = e?.response?.data?.error
  return code === 'invalid_grant' || code === 'invalid_client' || e?.response?.status === 401
}

export function getMeetings(): MeetingEvent[] {
  return meetings
}

/** The meeting currently in progress (started, not yet ended), if any. */
export function getCurrentMeeting(): MeetingEvent | null {
  const now = Date.now()
  return (
    meetings.find((m) => new Date(m.start).getTime() <= now && now < new Date(m.end).getTime()) ??
    null
  )
}

/** The next meeting that hasn't started yet, if any. */
export function getNextMeeting(): MeetingEvent | null {
  const now = Date.now()
  return meetings.find((m) => new Date(m.start).getTime() > now) ?? null
}

export async function syncNow(): Promise<MeetingEvent[]> {
  const auth = await getAuthorizedClient()
  if (!auth) {
    meetings = []
    onMeetingsUpdated?.(meetings)
    return meetings
  }
  try {
    meetings = await fetchUpcomingMeetings()
    // Drop fired/snooze state for events no longer in the window.
    const liveIds = new Set(meetings.map((m) => m.id))
    for (const id of [...fired]) if (!liveIds.has(id)) fired.delete(id)
    for (const id of [...firedPre]) if (!liveIds.has(id)) firedPre.delete(id)
    for (const id of [...snoozedUntil.keys()]) if (!liveIds.has(id)) snoozedUntil.delete(id)
    onMeetingsUpdated?.(meetings)
  } catch (err) {
    if (isAuthError(err)) {
      // The stored token was rejected by Google — drop it and prompt re-login.
      // Log only the message — never the full error (gaxios errors can carry
      // request headers, i.e. the access token).
      console.error(
        '[scheduler] token rejected, signing out:',
        err instanceof Error ? err.message : String(err)
      )
      meetings = []
      onMeetingsUpdated?.(meetings)
      onAuthInvalid?.()
    } else {
      // Network blip — keep the last known set.
      console.error('[scheduler] sync failed:', err instanceof Error ? err.message : String(err))
    }
  }
  return meetings
}

async function tick(): Promise<void> {
  if (isOverlayOpen()) return // the fullscreen takeover supersedes everything
  const now = Date.now()
  const { leadMinutes, preReminderEnabled, preReminderMinutes } = await getConfig()
  const leadMs = Math.max(0, leadMinutes) * 60 * 1000
  const preMs = Math.max(0, preReminderMinutes) * 60 * 1000

  for (const ev of meetings) {
    const startMs = new Date(ev.start).getTime()
    const triggerAt = startMs - leadMs

    // Snoozed? Wait until the snooze expires.
    const snooze = snoozedUntil.get(ev.id)
    const effectiveTrigger = snooze ? Math.max(triggerAt, snooze) : triggerAt

    // --- Fullscreen overlay (the hard nag) ---
    // Fire from the trigger moment up to the meeting start. Don't fire for
    // meetings that already started long ago (e.g. after waking from sleep,
    // give a 2 minute grace so we still nudge for a just-started call).
    const overlayDue = !(fired.has(ev.id) && !snooze) && !(snooze && now < snooze)
    if (overlayDue && now >= effectiveTrigger && now <= startMs + 2 * 60 * 1000) {
      fired.add(ev.id)
      snoozedUntil.delete(ev.id)
      closeBanner() // the gentle reminder gives way to the takeover
      showOverlay(ev)
      // Renderer needs a moment to mount before it can receive the payload.
      setTimeout(() => pushPayloadToOverlay(), 400)
      break
    }

    // --- Gentle pre-reminder banner (the soft nudge) ---
    // Shows once, in the window between the pre-reminder time and the overlay
    // trigger. Skipped if the overlay already fired or it would coincide.
    if (
      preReminderEnabled &&
      preMs > leadMs &&
      !firedPre.has(ev.id) &&
      !fired.has(ev.id) &&
      !isBannerOpen() &&
      now >= startMs - preMs &&
      now < triggerAt
    ) {
      firedPre.add(ev.id)
      showBanner(ev)
      setTimeout(() => pushPayloadToBanner(), 400)
      break
    }
  }
}

export function snooze(eventId: string, minutes: number): void {
  snoozedUntil.set(eventId, Date.now() + minutes * 60 * 1000)
  fired.delete(eventId)
}

export function dismiss(eventId: string): void {
  fired.add(eventId)
  snoozedUntil.delete(eventId)
}

export async function startScheduler(): Promise<void> {
  // Wire overlay button actions back into scheduler bookkeeping.
  onOverlayAction(async (action, ev) => {
    if (action === 'snooze') {
      const { snoozeMinutes } = await getConfig()
      snooze(ev.id, snoozeMinutes)
    } else {
      dismiss(ev.id)
    }
  })

  // If the user joins from the gentle banner, suppress the later fullscreen
  // overlay for that meeting. Plain "dismiss" leaves the overlay as a backstop.
  onBannerAction((action, ev) => {
    if (action === 'join') dismiss(ev.id)
  })

  await syncNow()
  if (syncTimer) clearInterval(syncTimer)
  if (tickTimer) clearInterval(tickTimer)
  syncTimer = setInterval(() => void syncNow(), SYNC_INTERVAL_MS)
  tickTimer = setInterval(() => void tick(), TICK_INTERVAL_MS)
}

export function stopScheduler(): void {
  if (syncTimer) clearInterval(syncTimer)
  if (tickTimer) clearInterval(tickTimer)
  syncTimer = null
  tickTimer = null
}
