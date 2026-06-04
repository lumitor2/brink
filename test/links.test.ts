import { describe, it, expect } from 'vitest'
import { extractJoinLink } from '../src/main/links'

describe('extractJoinLink', () => {
  it('prefers the native Google Meet hangoutLink', () => {
    expect(extractJoinLink({ hangoutLink: 'https://meet.google.com/abc-defg-hij' })).toEqual({
      url: 'https://meet.google.com/abc-defg-hij',
      provider: 'Google Meet'
    })
  })

  it('uses a conferenceData video entry point with its solution name', () => {
    expect(
      extractJoinLink({
        conferenceData: {
          conferenceSolution: { name: 'Zoom Meeting' },
          entryPoints: [
            { entryPointType: 'phone', uri: 'tel:+420123456789' },
            { entryPointType: 'video', uri: 'https://example.zoom.us/j/123' }
          ]
        }
      })
    ).toEqual({ url: 'https://example.zoom.us/j/123', provider: 'Zoom Meeting' })
  })

  it('falls back to "Video" when the conferenceData solution has no name', () => {
    expect(
      extractJoinLink({
        conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://x.test/v' }] }
      })
    ).toEqual({ url: 'https://x.test/v', provider: 'Video' })
  })

  it('detects a Zoom URL in the description', () => {
    const link = extractJoinLink({
      description: 'Join here: https://acme.zoom.us/j/987654321?pwd=xy'
    })
    expect(link?.provider).toBe('Zoom')
    expect(link?.url).toContain('acme.zoom.us/j/987654321')
  })

  it('detects a Microsoft Teams URL in the location', () => {
    const link = extractJoinLink({
      location: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc'
    })
    expect(link?.provider).toBe('Microsoft Teams')
  })

  it.each([
    ['Webex', 'https://acme.webex.com/meet/room'],
    ['Whereby', 'https://whereby.com/acme-standup'],
    ['Google Meet', 'https://meet.google.com/xyz-abcd-efg']
  ])('detects %s links in free text', (provider, url) => {
    expect(extractJoinLink({ description: `Call: ${url} see you there` })?.provider).toBe(provider)
  })

  it('returns null when there is no joinable link', () => {
    expect(extractJoinLink({ summary: 'Lunch', location: 'Kitchen' })).toBeNull()
    expect(extractJoinLink({})).toBeNull()
  })

  // Security regression: an event comes from a (possibly hostile) invite. Only
  // https links may ever be surfaced as joinable — never file:, smb:, custom
  // schemes, or plain http — so we never hand a dangerous URL to the OS opener.
  it('rejects a non-https hangoutLink', () => {
    expect(extractJoinLink({ hangoutLink: 'file:///etc/passwd' })).toBeNull()
    expect(extractJoinLink({ hangoutLink: 'smb://attacker/share' })).toBeNull()
    expect(extractJoinLink({ hangoutLink: 'http://meet.google.com/x' })).toBeNull()
  })

  it('rejects a non-https conferenceData entry point', () => {
    expect(
      extractJoinLink({
        conferenceData: {
          conferenceSolution: { name: 'Evil' },
          entryPoints: [{ entryPointType: 'video', uri: 'javascript:alert(1)' }]
        }
      })
    ).toBeNull()
  })

  it('only matches https provider URLs in free text, not http', () => {
    expect(extractJoinLink({ description: 'http://acme.zoom.us/j/1' })).toBeNull()
  })
})
