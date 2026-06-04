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
