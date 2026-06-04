import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron'
import { join } from 'path'
import type { AppConfig, OverlayAction, BannerAction, MeetingEvent } from '../shared/types'
import { getConfig, saveConfig, migrateLegacyUserData } from './store'
import { getAuthStatus, signIn, signOut, refreshCachedEmail } from './auth'
import {
  startScheduler,
  syncNow,
  getMeetings,
  getCurrentMeeting,
  getNextMeeting,
  setMeetingsListener,
  setAuthInvalidListener
} from './scheduler'
import { fetchEarlierTodayMeetings } from './calendar'
import { handleOverlayAction, showOverlay, pushPayloadToOverlay } from './overlay'
import { handleBannerAction, showBanner, pushPayloadToBanner } from './banner'
import { buildTrayIcon } from './trayIcon'
import { applySecurityHardening, openExternalSafe } from './security'
import { formatRemaining } from '../shared/format'
import { effectiveLang, createT, type Lang, type Translate } from '../shared/i18n'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

let tray: Tray | null = null
let settingsWindow: BrowserWindow | null = null
let titleTimer: NodeJS.Timeout | null = null
let lang: Lang = 'en'
let t: Translate = createT('en')

// --- Single instance lock -------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// Hide from the Dock — this is a menu-bar/tray app.
if (process.platform === 'darwin') {
  app.dock?.hide()
}

function localeTag(): string {
  return lang === 'cs' ? 'cs-CZ' : 'en-US'
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })
}

function broadcastAuth(): void {
  void getAuthStatus().then((status) => {
    settingsWindow?.webContents.send('auth:changed', status)
    buildTrayMenu()
  })
}

/**
 * Recompute the effective UI language from the saved preference + system
 * locale. If it changed, rebuild the tray and reload the Settings window so the
 * renderer picks up the new language (it reads it once at load via app:locale).
 */
async function applyLanguage(): Promise<void> {
  const cfg = await getConfig()
  const next = effectiveLang(cfg.language, app.getLocale())
  if (next === lang) return
  lang = next
  t = createT(lang)
  buildTrayMenu()
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.reload()
}

// --- Settings window ------------------------------------------------------
function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    title: 'Brink',
    backgroundColor: '#0b0b10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (isDev) {
    settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/index.html?view=settings`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { view: 'settings' }
    })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// --- Tray -----------------------------------------------------------------
/** Trim a meeting title so it doesn't crowd the menu bar. */
function shortTitle(title: string, max = 18): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title
}

/**
 * Live status shown next to the tray icon (macOS only — setTitle is a no-op
 * elsewhere). While a meeting is running it shows the time left of it;
 * otherwise the countdown to the next one.
 */
function updateTrayTitle(): void {
  if (!tray) return
  const current = getCurrentMeeting()
  if (current) {
    const left = new Date(current.end).getTime() - Date.now()
    tray.setTitle(
      ` ${t('title.left', { time: formatRemaining(left) })} · ${shortTitle(current.title)}`
    )
    return
  }
  const next = getNextMeeting()
  if (!next) {
    tray.setTitle('')
    return
  }
  const ms = new Date(next.start).getTime() - Date.now()
  const timeStr = ms <= 0 ? t('title.now') : t('title.in', { time: formatRemaining(ms) })
  tray.setTitle(` ${timeStr} · ${shortTitle(next.title)}`)
}

function buildTrayMenu(): void {
  if (!tray) return
  void getAuthStatus().then((status) => {
    const current = getCurrentMeeting()
    const next = getNextMeeting()

    const items: Electron.MenuItemConstructorOptions[] = []

    if (current) {
      const left = formatRemaining(new Date(current.end).getTime() - Date.now())
      items.push({ label: t('tray.ongoing', { title: current.title, time: left }), enabled: false })
      if (next) {
        items.push({
          label: t('tray.nextAfter', { title: next.title, time: hhmm(next.start) }),
          enabled: false
        })
      }
    } else if (next) {
      items.push({
        label: t('tray.next', { title: next.title, time: hhmm(next.start) }),
        enabled: false
      })
    } else {
      items.push({
        label: status.signedIn ? t('tray.none') : t('tray.notSignedIn'),
        enabled: false
      })
    }

    // Join buttons: when a meeting is in progress *and* another is coming up,
    // offer both (named so they're distinguishable); otherwise a single button.
    if (current && next) {
      items.push(
        {
          label: t('menu.joinNamed', { title: shortTitle(current.title, 24) }),
          click: () => openExternalSafe(current.joinUrl)
        },
        {
          label: t('menu.joinNamed', { title: shortTitle(next.title, 24) }),
          click: () => openExternalSafe(next.joinUrl)
        }
      )
    } else {
      const joinTarget = current ?? next
      if (joinTarget) {
        items.push({
          label: t('menu.join'),
          click: () => openExternalSafe(joinTarget.joinUrl)
        })
      }
    }

    items.push(
      { type: 'separator' },
      {
        label: status.signedIn
          ? t('menu.signedInAs', { email: status.email ?? '✓' })
          : t('menu.signIn'),
        click: async () => {
          if (status.signedIn) {
            openSettings()
          } else {
            try {
              await signIn()
              await syncNow()
              broadcastAuth()
            } catch (e) {
              console.error('sign-in failed:', e instanceof Error ? e.message : String(e))
            }
          }
        }
      },
      { label: t('menu.syncNow'), click: () => void syncNow().then(buildTrayMenu) },
      { label: t('menu.settings'), click: openSettings },
      { type: 'separator' },
      { label: t('menu.quit'), role: 'quit' }
    )

    const tooltip = current
      ? t('tray.ongoing', {
          title: current.title,
          time: formatRemaining(new Date(current.end).getTime() - Date.now())
        })
      : next
        ? t('tray.next', { title: next.title, time: hhmm(next.start) })
        : status.signedIn
          ? t('tray.none')
          : t('tray.notSignedIn')

    tray!.setContextMenu(Menu.buildFromTemplate(items))
    tray!.setToolTip(tooltip)
    updateTrayTitle()
  })
}

// --- IPC ------------------------------------------------------------------
function fakeMeeting(startInMin: number, durationMin: number): MeetingEvent {
  return {
    id: 'test',
    title: t('meeting.untitled'),
    start: new Date(Date.now() + startInMin * 60_000).toISOString(),
    end: new Date(Date.now() + (startInMin + durationMin) * 60_000).toISOString(),
    joinUrl: 'https://meet.google.com/landing',
    provider: 'Google Meet'
  }
}

/** Only accept IPC from our own bundled windows (file:// or the dev server). */
function senderAllowed(e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? ''
  const dev = process.env['ELECTRON_RENDERER_URL']
  return url.startsWith('file://') || (!!dev && url.startsWith(dev))
}

function guarded<T>(fn: (...args: unknown[]) => T) {
  return (e: Electron.IpcMainInvokeEvent, ...args: unknown[]): T => {
    if (!senderAllowed(e)) throw new Error('IPC sender rejected')
    return fn(...args)
  }
}

function guardedOn(fn: (...args: unknown[]) => void) {
  return (e: Electron.IpcMainEvent, ...args: unknown[]): void => {
    if (senderAllowed(e)) fn(...args)
  }
}

function registerIpc(): void {
  // Synchronous so the renderer has its language at first paint. Not guarded:
  // it runs at preload time (senderFrame.url may not be set yet) and only
  // returns the UI language — no sensitive data, no action.
  ipcMain.on('app:locale', (e) => {
    e.returnValue = lang
  })

  ipcMain.handle(
    'config:get',
    guarded(() => getConfig())
  )
  ipcMain.handle(
    'config:save',
    guarded(async (patch) => {
      const saved = await saveConfig(patch as Partial<AppConfig>)
      await applyLanguage() // language pref may have changed
      return saved
    })
  )

  ipcMain.handle(
    'auth:status',
    guarded(() => getAuthStatus())
  )
  ipcMain.handle(
    'auth:signIn',
    guarded(async () => {
      const status = await signIn()
      await syncNow()
      broadcastAuth()
      return status
    })
  )
  ipcMain.handle(
    'auth:signOut',
    guarded(async () => {
      const status = await signOut()
      await syncNow()
      broadcastAuth()
      return status
    })
  )

  ipcMain.handle(
    'calendar:refresh',
    guarded(() => syncNow())
  )
  ipcMain.handle(
    'calendar:upcoming',
    guarded(() => getMeetings())
  )
  ipcMain.handle(
    'calendar:earlierToday',
    guarded(() => fetchEarlierTodayMeetings())
  )

  ipcMain.handle(
    'overlay:test',
    guarded(() => {
      showOverlay(getNextMeeting() ?? fakeMeeting(1, 30))
      setTimeout(() => pushPayloadToOverlay(), 400)
    })
  )
  ipcMain.on(
    'overlay:action',
    guardedOn((action) => handleOverlayAction(action as OverlayAction))
  )
  // Renderer signals it's mounted → push the payload (reliable handshake, no
  // race with the fixed-delay push above).
  ipcMain.on(
    'overlay:ready',
    guardedOn(() => pushPayloadToOverlay())
  )

  ipcMain.handle(
    'banner:test',
    guarded(() => {
      showBanner(getNextMeeting() ?? fakeMeeting(15, 30))
      setTimeout(() => pushPayloadToBanner(), 400)
    })
  )
  ipcMain.on(
    'banner:action',
    guardedOn((action) => handleBannerAction(action as BannerAction))
  )
  ipcMain.on(
    'banner:ready',
    guardedOn(() => pushPayloadToBanner())
  )
}

// --- Launch at login ------------------------------------------------------
function ensureLoginItem(): void {
  if (isDev) return
  // setLoginItemSettings is supported on macOS and Windows only.
  if (process.platform === 'darwin' || process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: true })
  }
}

// --- Lifecycle ------------------------------------------------------------
app.whenReady().then(async () => {
  lang = effectiveLang((await getConfig()).language, app.getLocale())
  t = createT(lang)

  await migrateLegacyUserData()
  applySecurityHardening()
  registerIpc()

  tray = new Tray(buildTrayIcon())
  buildTrayMenu()
  tray.on('click', () => tray?.popUpContextMenu())

  // Refresh the menu-bar status every second.
  titleTimer = setInterval(updateTrayTitle, 1000)

  setMeetingsListener(() => buildTrayMenu())

  // If Google rejects the stored token, sign out and prompt a fresh login.
  setAuthInvalidListener(() => {
    void signOut().then(() => {
      broadcastAuth()
      openSettings()
    })
  })

  await refreshCachedEmail()

  const status = await getAuthStatus()
  if (!status.hasCredentials || !status.signedIn) {
    openSettings()
  }

  await startScheduler()
  broadcastAuth()
  ensureLoginItem()
})

app.on('second-instance', () => openSettings())

app.on('before-quit', () => {
  if (titleTimer) clearInterval(titleTimer)
  titleTimer = null
})

// Keep running in the menu bar even with no windows open.
app.on('window-all-closed', () => {
  /* stay alive in the tray */
})
