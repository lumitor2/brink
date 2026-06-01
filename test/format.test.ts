import { describe, it, expect } from 'vitest'
import { formatRemaining } from '../src/shared/format'

const S = 1000
const M = 60 * S
const H = 60 * M
const D = 24 * H

describe('formatRemaining', () => {
  it('shows only seconds under a minute', () => {
    expect(formatRemaining(45 * S)).toBe('45 s')
    expect(formatRemaining(0)).toBe('0 s')
    expect(formatRemaining(999)).toBe('0 s')
  })

  it('shows minutes and zero-padded seconds under an hour', () => {
    expect(formatRemaining(10 * M + 15 * S)).toBe('10 m 15 s')
    expect(formatRemaining(1 * M + 5 * S)).toBe('1 m 05 s')
    expect(formatRemaining(59 * M + 59 * S)).toBe('59 m 59 s')
  })

  it('shows hours and zero-padded minutes under a day', () => {
    expect(formatRemaining(1 * H + 5 * M)).toBe('1 h 05 m')
    // The regression that started all this: 18h must not overflow to "1087:15".
    expect(formatRemaining(18 * H + 7 * M + 15 * S)).toBe('18 h 07 m')
  })

  it('shows days and hours for a day or more', () => {
    expect(formatRemaining(2 * D + 5 * H)).toBe('2 d 5 h')
    expect(formatRemaining(1 * D)).toBe('1 d 0 h')
  })

  it('prefixes negative durations with a minus sign', () => {
    expect(formatRemaining(-30 * S)).toBe('-30 s')
    expect(formatRemaining(-(2 * M + 3 * S))).toBe('-2 m 03 s')
  })
})
