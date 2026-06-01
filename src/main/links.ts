// Minimal shape of the Google Calendar event fields we actually use. Declaring
// it ourselves (instead of pulling the huge `googleapis` types) keeps the
// dependency surface tiny.
export interface CalendarEvent {
  id?: string | null
  summary?: string | null
  status?: string | null
  location?: string | null
  description?: string | null
  hangoutLink?: string | null
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
  attendees?: Array<{ self?: boolean | null; responseStatus?: string | null }> | null
  conferenceData?: {
    conferenceSolution?: { name?: string | null } | null
    entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }> | null
  } | null
}

/**
 * Detect a joinable video-conferencing URL in a calendar event.
 *
 * Pure function with no Electron / network dependencies so it can be unit
 * tested in isolation. Checks, in order: native Google Meet link, structured
 * conferenceData entry points, then a regex scan of location + description for
 * known providers.
 */
/** Only https URLs are ever treated as joinable — never file:, smb:, custom
 *  schemes, etc. (the event can come from an untrusted invite). */
function isHttps(url: string): boolean {
  return /^https:\/\//i.test(url)
}

export function extractJoinLink(ev: CalendarEvent): { url: string; provider: string } | null {
  // 1. Native Google Meet link.
  if (ev.hangoutLink && isHttps(ev.hangoutLink)) {
    return { url: ev.hangoutLink, provider: 'Google Meet' }
  }

  // 2. conferenceData entry points (Meet, or add-on Zoom/Teams).
  const entry = ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video' && e.uri)
  if (entry?.uri && isHttps(entry.uri)) {
    return { url: entry.uri, provider: ev.conferenceData?.conferenceSolution?.name ?? 'Video' }
  }

  // 3. Scan location + description for known meeting URLs.
  const haystack = `${ev.location ?? ''}\n${ev.description ?? ''}`
  const patterns: Array<{ re: RegExp; provider: string }> = [
    { re: /https:\/\/[\w.-]*zoom\.us\/[^\s"'<>)]+/i, provider: 'Zoom' },
    { re: /https:\/\/[\w.-]*teams\.microsoft\.com\/[^\s"'<>)]+/i, provider: 'Microsoft Teams' },
    { re: /https:\/\/[\w.-]*teams\.live\.com\/[^\s"'<>)]+/i, provider: 'Microsoft Teams' },
    { re: /https:\/\/meet\.google\.com\/[^\s"'<>)]+/i, provider: 'Google Meet' },
    { re: /https:\/\/[\w.-]*webex\.com\/[^\s"'<>)]+/i, provider: 'Webex' },
    { re: /https:\/\/[\w.-]*whereby\.com\/[^\s"'<>)]+/i, provider: 'Whereby' }
  ]
  for (const { re, provider } of patterns) {
    const m = haystack.match(re)
    if (m) return { url: m[0], provider }
  }

  return null
}
