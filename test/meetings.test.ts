import { describe, it, expect } from 'vitest'
import {
  currentMeeting,
  nextMeeting,
  finishedMeetings,
  calendarDayOffset
} from '../src/shared/meetings'
import type { MeetingEvent } from '../src/shared/types'

const at = (startMin: number, endMin: number, id: string): MeetingEvent => ({
  id,
  title: id,
  start: new Date(NOW + startMin * 60_000).toISOString(),
  end: new Date(NOW + endMin * 60_000).toISOString(),
  joinUrl: 'https://meet.google.com/x',
  provider: 'Google Meet'
})

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)
// past: ended 30m ago · ongoing: started 5m ago, ends in 25m · soon: in 15m · later: in 90m
const PAST = at(-60, -30, 'past')
const ONGOING = at(-5, 25, 'ongoing')
const SOON = at(15, 45, 'soon')
const LATER = at(90, 120, 'later')

describe('currentMeeting', () => {
  it('returns the meeting in progress', () => {
    expect(currentMeeting([PAST, ONGOING, SOON], NOW)?.id).toBe('ongoing')
  })
  it('is inclusive of start and exclusive of end', () => {
    const m = at(0, 30, 'edge')
    expect(currentMeeting([m], NOW)?.id).toBe('edge') // exactly at start
    expect(currentMeeting([at(-30, 0, 'justEnded')], NOW)).toBeNull() // exactly at end
  })
  it('returns null when nothing is running', () => {
    expect(currentMeeting([PAST, SOON, LATER], NOW)).toBeNull()
  })
})

describe('nextMeeting', () => {
  it('returns the earliest meeting that has not started', () => {
    expect(nextMeeting([SOON, LATER], NOW)?.id).toBe('soon')
  })
  it('does not count an in-progress meeting as next', () => {
    expect(nextMeeting([ONGOING, LATER], NOW)?.id).toBe('later')
  })
  it('returns null when everything is in the past', () => {
    expect(nextMeeting([PAST], NOW)).toBeNull()
  })
})

describe('finishedMeetings', () => {
  it('returns only meetings that have already ended', () => {
    expect(finishedMeetings([PAST, ONGOING, SOON], NOW).map((m) => m.id)).toEqual(['past'])
  })
})

describe('calendarDayOffset', () => {
  const day = (y: number, m: number, d: number, h = 0, min = 0): number =>
    new Date(y, m, d, h, min).getTime()

  it('is 0 for the same calendar day', () => {
    expect(calendarDayOffset(day(2026, 0, 1, 9), day(2026, 0, 1, 17))).toBe(0)
  })
  it('is 1 for tomorrow, even across a short night gap', () => {
    expect(calendarDayOffset(day(2026, 0, 1, 23), day(2026, 0, 2, 1))).toBe(1)
    expect(calendarDayOffset(day(2026, 0, 1, 9), day(2026, 0, 2, 9))).toBe(1)
  })
  it('counts further days', () => {
    expect(calendarDayOffset(day(2026, 0, 1, 9), day(2026, 0, 4, 9))).toBe(3)
  })
})
