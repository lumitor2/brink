import type { MeetingEvent } from './types'

/** The meeting in progress at `now` (started, not yet ended), if any. */
export function currentMeeting(meetings: MeetingEvent[], now: number): MeetingEvent | null {
  return (
    meetings.find((m) => new Date(m.start).getTime() <= now && now < new Date(m.end).getTime()) ??
    null
  )
}

/** The next meeting that hasn't started yet at `now`, if any. */
export function nextMeeting(meetings: MeetingEvent[], now: number): MeetingEvent | null {
  return meetings.find((m) => new Date(m.start).getTime() > now) ?? null
}

/** Meetings that have already finished at `now` (for the history view). */
export function finishedMeetings(meetings: MeetingEvent[], now: number): MeetingEvent[] {
  return meetings.filter((m) => new Date(m.end).getTime() <= now)
}

/**
 * Whole calendar days between `now` and `then` (local time): 0 = same day,
 * 1 = tomorrow, etc. Compares midnights, so 23:00→01:00 counts as 1 day.
 */
export function calendarDayOffset(now: number, then: number): number {
  const midnight = (ms: number): number => {
    const d = new Date(ms)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  return Math.round((midnight(then) - midnight(now)) / 86_400_000)
}
