import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppConfig,
  AuthStatus,
  BannerAction,
  MeetingEvent,
  OverlayAction,
  OverlayPayload,
  RendererApi
} from '../shared/types'
import type { Lang } from '../shared/i18n'

function getView(): 'settings' | 'overlay' | 'banner' {
  const view = new URLSearchParams(window.location.search).get('view')
  if (view === 'overlay') return 'overlay'
  if (view === 'banner') return 'banner'
  return 'settings'
}

const api: RendererApi = {
  view: getView(),
  locale: ipcRenderer.sendSync('app:locale') as Lang,

  getConfig: () => ipcRenderer.invoke('config:get') as Promise<AppConfig>,
  saveConfig: (patch) => ipcRenderer.invoke('config:save', patch) as Promise<AppConfig>,
  getAuthStatus: () => ipcRenderer.invoke('auth:status') as Promise<AuthStatus>,
  signIn: () => ipcRenderer.invoke('auth:signIn') as Promise<AuthStatus>,
  signOut: () => ipcRenderer.invoke('auth:signOut') as Promise<AuthStatus>,
  refreshNow: () => ipcRenderer.invoke('calendar:refresh') as Promise<MeetingEvent[]>,
  getUpcoming: () => ipcRenderer.invoke('calendar:upcoming') as Promise<MeetingEvent[]>,
  getEarlierToday: () => ipcRenderer.invoke('calendar:earlierToday') as Promise<MeetingEvent[]>,
  testOverlay: () => ipcRenderer.invoke('overlay:test') as Promise<void>,
  testBanner: () => ipcRenderer.invoke('banner:test') as Promise<void>,

  onAuthChanged: (cb: (status: AuthStatus) => void) => {
    const listener = (_e: unknown, status: AuthStatus): void => cb(status)
    ipcRenderer.on('auth:changed', listener)
    return () => ipcRenderer.removeListener('auth:changed', listener)
  },

  onOverlay: (cb: (payload: OverlayPayload) => void) => {
    const listener = (_e: unknown, payload: OverlayPayload): void => cb(payload)
    ipcRenderer.on('overlay:event', listener)
    return () => ipcRenderer.removeListener('overlay:event', listener)
  },

  overlayAction: (action: OverlayAction) => ipcRenderer.send('overlay:action', action),

  onBanner: (cb: (payload: OverlayPayload) => void) => {
    const listener = (_e: unknown, payload: OverlayPayload): void => cb(payload)
    ipcRenderer.on('banner:event', listener)
    return () => ipcRenderer.removeListener('banner:event', listener)
  },

  bannerAction: (action: BannerAction) => ipcRenderer.send('banner:action', action)
}

contextBridge.exposeInMainWorld('api', api)
