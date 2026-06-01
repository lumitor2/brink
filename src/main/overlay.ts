import { BrowserWindow, screen } from 'electron'
import { openExternalSafe } from './security'
import { join } from 'path'
import type { MeetingEvent, OverlayAction, OverlayPayload } from '../shared/types'

let overlayWindows: BrowserWindow[] = []
let currentEvent: MeetingEvent | null = null
let actionHandler: ((action: OverlayAction, ev: MeetingEvent) => void) | null = null

export function onOverlayAction(cb: (action: OverlayAction, ev: MeetingEvent) => void): void {
  actionHandler = cb
}

const isDev = !!process.env['ELECTRON_RENDERER_URL']

function loadView(win: BrowserWindow): void {
  if (isDev) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/index.html?view=overlay`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { view: 'overlay' }
    })
  }
}

/**
 * Full takeover: one borderless, screen-saver-level window per display, made
 * visible on every Space *including* other apps' native full-screen Spaces.
 */
export function showOverlay(event: MeetingEvent): void {
  closeOverlay()
  currentEvent = event

  for (const display of screen.getAllDisplays()) {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: false,
      backgroundColor: '#0b0b10',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    // Float above everything, including other apps' full-screen Spaces.
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    if (process.platform === 'darwin') {
      // Cover the menu bar / notch area without spawning a new Space.
      win.setSimpleFullScreen(true)
    } else {
      // Windows/Linux: a borderless window already fills the display; take it
      // truly full-screen so it sits over the taskbar/panel too.
      win.setFullScreen(true)
    }

    loadView(win)

    win.once('ready-to-show', () => {
      win.show()
      win.focus()
    })

    overlayWindows.push(win)
  }
}

/** Push the event payload to all overlay windows once their renderer is ready. */
export function pushPayloadToOverlay(): void {
  if (!currentEvent) return
  const payload: OverlayPayload = {
    event: currentEvent,
    startsAt: currentEvent.start
  }
  for (const win of overlayWindows) {
    if (!win.isDestroyed()) win.webContents.send('overlay:event', payload)
  }
}

export function closeOverlay(): void {
  for (const win of overlayWindows) {
    if (!win.isDestroyed()) win.close()
  }
  overlayWindows = []
  currentEvent = null
}

/** Called from the IPC layer when the user clicks a button in the overlay. */
export function handleOverlayAction(action: OverlayAction): void {
  const ev = currentEvent
  if (!ev) return

  if (action === 'join') {
    openExternalSafe(ev.joinUrl)
  }

  // Notify the scheduler (for snooze bookkeeping) before tearing down.
  actionHandler?.(action, ev)
  closeOverlay()
}

export function isOverlayOpen(): boolean {
  return overlayWindows.length > 0
}
