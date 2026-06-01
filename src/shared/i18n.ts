// Minimal zero-dependency i18n. Language is chosen automatically from the
// system locale (Czech if it starts with "cs", English otherwise). Strings
// support {placeholder} interpolation.

export type Lang = 'cs' | 'en'
/** User preference: an explicit language, or 'auto' to follow the system. */
export type LangPref = Lang | 'auto'

/** Map a system locale string to a supported UI language. */
export function resolveLang(locale: string | null | undefined): Lang {
  return (locale ?? '').toLowerCase().startsWith('cs') ? 'cs' : 'en'
}

/** Resolve the effective language from the saved preference + system locale. */
export function effectiveLang(pref: LangPref, systemLocale: string | null | undefined): Lang {
  return pref === 'auto' ? resolveLang(systemLocale) : pref
}

const cs = {
  // tray title / tooltip
  'title.now': 'teď',
  'title.in': 'za {time}',
  'title.left': 'zbývá {time}',
  'tray.next': 'Další: {title} ({time})',
  'tray.ongoing': 'Probíhá: {title} · zbývá {time}',
  'tray.none': 'Žádný nadcházející hovor',
  'tray.notSignedIn': 'Nepřihlášeno',
  'tray.nextAfter': 'Pak: {title} ({time})',
  // tray menu
  'menu.join': 'Připojit se ke schůzce',
  'menu.signedInAs': 'Přihlášeno: {email}',
  'menu.signIn': 'Přihlásit Google…',
  'menu.syncNow': 'Synchronizovat teď',
  'menu.settings': 'Nastavení…',
  'menu.quit': 'Ukončit',
  // settings
  'settings.loading': 'Načítám…',
  'settings.googleAccount': 'Google účet',
  'settings.signedInAs': 'Přihlášeno jako {email}',
  'settings.signedIn': 'Přihlášeno',
  'settings.signOut': 'Odhlásit',
  'settings.signInGoogle': 'Přihlásit přes Google',
  'settings.credsHint':
    'Použij OAuth credentials typu Desktop app z Google Cloud Console. Tvůj pracovní e-mail musí být přidaný jako testovací uživatel.',
  'settings.signInHint': 'Přihlas se svým Google účtem pro napojení kalendáře.',
  'settings.notifications': 'Upozornění',
  'settings.overlayBefore': 'Vyskočit přes celou obrazovku',
  'settings.minutesBeforeStart': 'minut před začátkem',
  'settings.snoozeBy': 'Snooze odloží o',
  'settings.minutes': 'minut',
  'settings.bannerToggle': 'Jemné upozornění (malé okno v rohu) předem',
  'settings.bannerAnd': '…a to',
  'settings.includeDeclined': 'Zahrnout i odmítnuté schůzky',
  'settings.language': 'Jazyk',
  'settings.langAuto': 'Automaticky',
  'settings.langCs': 'Čeština',
  'settings.langEn': 'English',
  'settings.save': 'Uložit',
  'settings.testOverlay': 'Test overlay',
  'settings.testBanner': 'Test banner',
  'settings.saved': 'Uloženo ✓',
  'settings.upcoming': 'Nadcházející hovory',
  'settings.refresh': 'Obnovit',
  'settings.noUpcoming': 'Žádný hovor s video linkem v příštích 24 hodinách.',
  'settings.showEarlier': 'Zobrazit dnešní proběhlé',
  'settings.hideEarlier': 'Skrýt proběhlé',
  'settings.noEarlier': 'Dnes žádný proběhlý hovor.',
  'settings.footer': 'Appka běží v liště. Zavřením okna se neukončí.',
  // overlay
  'overlay.kicker': 'HOVOR ZA',
  'overlay.kickerStarting': 'HOVOR ZAČÍNÁ',
  'overlay.join': 'Připojit se',
  'overlay.snooze': 'Snooze',
  'overlay.dismiss': 'Zavřít',
  'overlay.hintKeys': 'Enter = Připojit · Esc = Zavřít',
  // banner
  'banner.kicker': 'HOVOR ZA',
  'banner.join': 'Připojit se',
  'banner.close': 'Zavřít',
  // shared
  'meeting.untitled': 'Schůzka'
} as const

const en: Record<keyof typeof cs, string> = {
  'title.now': 'now',
  'title.in': 'in {time}',
  'title.left': '{time} left',
  'tray.next': 'Next: {title} ({time})',
  'tray.ongoing': 'In progress: {title} · {time} left',
  'tray.none': 'No upcoming call',
  'tray.notSignedIn': 'Not signed in',
  'tray.nextAfter': 'Then: {title} ({time})',
  'menu.join': 'Join meeting',
  'menu.signedInAs': 'Signed in: {email}',
  'menu.signIn': 'Sign in with Google…',
  'menu.syncNow': 'Sync now',
  'menu.settings': 'Settings…',
  'menu.quit': 'Quit',
  'settings.loading': 'Loading…',
  'settings.googleAccount': 'Google account',
  'settings.signedInAs': 'Signed in as {email}',
  'settings.signedIn': 'Signed in',
  'settings.signOut': 'Sign out',
  'settings.signInGoogle': 'Sign in with Google',
  'settings.credsHint':
    'Use OAuth credentials of type Desktop app from the Google Cloud Console. Your work e-mail must be added as a test user.',
  'settings.signInHint': 'Sign in with your Google account to connect your calendar.',
  'settings.notifications': 'Notifications',
  'settings.overlayBefore': 'Show full-screen overlay',
  'settings.minutesBeforeStart': 'minutes before start',
  'settings.snoozeBy': 'Snooze postpones by',
  'settings.minutes': 'minutes',
  'settings.bannerToggle': 'Gentle reminder (small corner window) beforehand',
  'settings.bannerAnd': '…that is',
  'settings.includeDeclined': 'Include declined meetings',
  'settings.language': 'Language',
  'settings.langAuto': 'Automatic',
  'settings.langCs': 'Čeština',
  'settings.langEn': 'English',
  'settings.save': 'Save',
  'settings.testOverlay': 'Test overlay',
  'settings.testBanner': 'Test banner',
  'settings.saved': 'Saved ✓',
  'settings.upcoming': 'Upcoming calls',
  'settings.refresh': 'Refresh',
  'settings.noUpcoming': 'No video call in the next 24 hours.',
  'settings.showEarlier': "Show today's finished",
  'settings.hideEarlier': 'Hide finished',
  'settings.noEarlier': 'No finished calls today.',
  'settings.footer': 'The app lives in the menu bar. Closing this window does not quit it.',
  'overlay.kicker': 'CALL IN',
  'overlay.kickerStarting': 'CALL STARTING',
  'overlay.join': 'Join',
  'overlay.snooze': 'Snooze',
  'overlay.dismiss': 'Dismiss',
  'overlay.hintKeys': 'Enter = Join · Esc = Dismiss',
  'banner.kicker': 'CALL IN',
  'banner.join': 'Join',
  'banner.close': 'Close',
  'meeting.untitled': 'Meeting'
}

export type TKey = keyof typeof cs
const DICT: Record<Lang, Record<TKey, string>> = { cs, en }

export type Translate = (key: TKey, vars?: Record<string, string | number>) => string

export function createT(lang: Lang): Translate {
  const table = DICT[lang] ?? DICT.en
  return (key, vars) => {
    let s = table[key] ?? DICT.en[key] ?? key
    if (vars) {
      for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]))
    }
    return s
  }
}
