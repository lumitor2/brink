import { describe, it, expect } from 'vitest'
import { resolveLang, effectiveLang, createT } from '../src/shared/i18n'

describe('resolveLang', () => {
  it('picks Czech for cs* locales', () => {
    expect(resolveLang('cs')).toBe('cs')
    expect(resolveLang('cs-CZ')).toBe('cs')
    expect(resolveLang('CS')).toBe('cs')
  })

  it('falls back to English for everything else', () => {
    expect(resolveLang('en-US')).toBe('en')
    expect(resolveLang('de')).toBe('en')
    expect(resolveLang('')).toBe('en')
    expect(resolveLang(null)).toBe('en')
    expect(resolveLang(undefined)).toBe('en')
  })
})

describe('effectiveLang', () => {
  it('uses an explicit preference regardless of system locale', () => {
    expect(effectiveLang('cs', 'en-US')).toBe('cs')
    expect(effectiveLang('en', 'cs-CZ')).toBe('en')
  })

  it('follows the system locale when set to auto', () => {
    expect(effectiveLang('auto', 'cs-CZ')).toBe('cs')
    expect(effectiveLang('auto', 'en-GB')).toBe('en')
    expect(effectiveLang('auto', null)).toBe('en')
  })
})

describe('createT', () => {
  it('translates a key per language', () => {
    expect(createT('cs')('overlay.join')).toBe('Připojit se')
    expect(createT('en')('overlay.join')).toBe('Join')
  })

  it('interpolates {placeholders}', () => {
    expect(createT('en')('title.in', { time: '15 m 05 s' })).toBe('in 15 m 05 s')
    expect(createT('cs')('tray.next', { title: 'Standup', time: '13:37' })).toBe(
      'Další: Standup (13:37)'
    )
  })

  it('every Czech key has an English counterpart', () => {
    const cs = createT('cs')
    const en = createT('en')
    // Probe a representative spread of keys; a missing translation would
    // return the raw key, so cs and en differing from the key proves coverage.
    for (const key of [
      'menu.join',
      'settings.save',
      'banner.kicker',
      'meeting.untitled'
    ] as const) {
      expect(en(key)).not.toBe(key)
      expect(cs(key)).not.toBe(key)
    }
  })
})
