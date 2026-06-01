import { BrowserWindow, screen } from 'electron'
import { openExternalSafe } from './security'
import { join } from 'path'
import type { MeetingEvent, OverlayPayload, BannerAction } from '../shared/types'

// The gentle pre-reminder: a small floating card in the top-right corner.
// Visible across Spaces and above normal windows, but NOT a fullscreen
// takeover, and it never steals focus from what you're doing.

const WIDTH = 360
const HEIGHT = 150
const MARGIN = 16

let bannerWindow: BrowserWindow | null = null
let current: MeetingEvent | null = null
let actionCb: ((action: BannerAction, ev: MeetingEvent) => void) | null = null

export function onBannerAction(cb: (action: BannerAction, ev: MeetingEvent) => void): void {
  actionCb = cb
}

export function isBannerOpen(): boolean {
  return !!bannerWindow && !bannerWindow.isDestroyed()
}

export function showBanner(ev: MeetingEvent): void {
  closeBanner()
  current = ev

  const display = screen.getPrimaryDisplay()
  const { x, y, width } = display.workArea
  const win = new BrowserWindow({
    x: x + width - WIDTH - MARGIN,
    y: y + MARGIN,
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Float above ordinary windows and show on every Space (incl. other apps'
  // fullscreen), but stay out of the way — don't activate / grab focus.
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/index.html?view=banner`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { view: 'banner' } })
  }

  win.once('ready-to-show', () => win.showInactive())
  win.on('closed', () => {
    if (bannerWindow === win) bannerWindow = null
  })
  bannerWindow = win
}

function pushPayload(): void {
  if (!current || !isBannerOpen()) return
  const payload: OverlayPayload = { event: current, startsAt: current.start }
  bannerWindow!.webContents.send('banner:event', payload)
}

export function pushPayloadToBanner(): void {
  pushPayload()
}

export function handleBannerAction(action: BannerAction): void {
  const ev = current
  closeBanner()
  if (action === 'join' && ev) {
    openExternalSafe(ev.joinUrl)
  }
  if (actionCb && ev) actionCb(action, ev)
}

export function closeBanner(): void {
  if (bannerWindow && !bannerWindow.isDestroyed()) bannerWindow.close()
  bannerWindow = null
}
