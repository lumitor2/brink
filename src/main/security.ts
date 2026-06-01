import { app, session, shell } from 'electron'

/**
 * Defense-in-depth hardening applied once at startup. The renderer only ever
 * loads our own bundled files, so we lock everything else down:
 *
 *  - external links (e.g. join URLs) open in the system browser, never in-app
 *  - in-app navigation away from the bundle is blocked
 *  - all permission requests (camera, mic, geolocation, …) are denied
 *
 * Combined with contextIsolation + sandbox + no nodeIntegration on every
 * window, this keeps the attack surface minimal.
 */
export function applySecurityHardening(): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']

  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafe(url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      const allowed = url.startsWith('file://') || (devUrl ? url.startsWith(devUrl) : false)
      if (!allowed) event.preventDefault()
    })
  })

  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false)
  )
}

/**
 * Open a URL in the system browser only if it is https. Join links come from
 * calendar events (which may be attacker-controlled invites), so we never hand
 * a file:/smb:/custom-scheme URL to the OS.
 */
export function openExternalSafe(url: string): void {
  if (/^https:\/\//i.test(url)) {
    void shell.openExternal(url)
  } else {
    console.warn('[security] refused to open non-https URL')
  }
}
