import type { MeetingEvent, AppConfig } from '../shared/types'
import { getAuthorizedClient } from './auth'
import { getConfig } from './store'
import { extractJoinLink, type CalendarEvent } from './links'
import { finishedMeetings } from '../shared/meetings'

/** How far ahead the upcoming list / reminders look. */
const HORIZON_DAYS = 7
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

/** Fetch meetings (with a video link, concrete time, not cancelled) from the
 *  primary calendar within [timeMin, timeMax]. Declined events are skipped
 *  unless the user opted to include them. */
async function fetchWindow(
  timeMin: string,
  timeMax: string,
  cfg: AppConfig
): Promise<MeetingEvent[]> {
  const auth = await getAuthorizedClient()
  if (!auth) return []

  const url = new URL(EVENTS_URL)
  url.searchParams.set('timeMin', timeMin)
  url.searchParams.set('timeMax', timeMax)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '100')

  // Authorized request; google-auth-library refreshes the access token as needed.
  const res = await auth.request<{ items?: CalendarEvent[] }>({ url: url.toString() })

  const out: MeetingEvent[] = []
  for (const ev of res.data.items ?? []) {
    // Skip all-day events (no dateTime) and cancelled ones.
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue
    if (ev.status === 'cancelled') continue

    // Skip events the user has declined, unless they opted to keep them.
    const me = ev.attendees?.find((a) => a.self)
    if (me?.responseStatus === 'declined' && !cfg.includeDeclined) continue

    const link = extractJoinLink(ev)
    if (!link) continue

    out.push({
      id: ev.id ?? `${ev.start.dateTime}-${ev.summary ?? ''}`,
      title: ev.summary ?? '(no title)',
      start: ev.start.dateTime,
      end: ev.end.dateTime,
      joinUrl: link.url,
      provider: link.provider
    })
  }
  return out
}

/** Upcoming + in‑progress meetings within the horizon. Drives the reminders. */
export async function fetchUpcomingMeetings(): Promise<MeetingEvent[]> {
  const now = new Date()
  const cfg = await getConfig()
  const timeMax = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000)
  return fetchWindow(now.toISOString(), timeMax.toISOString(), cfg)
}

/** Today's meetings that have already finished (for the on‑demand history view). */
export async function fetchEarlierTodayMeetings(): Promise<MeetingEvent[]> {
  const now = new Date()
  const cfg = await getConfig()
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const all = await fetchWindow(midnight.toISOString(), now.toISOString(), cfg)
  return finishedMeetings(all, Date.now())
}
