import { shell } from 'electron'
import http from 'http'
import crypto from 'crypto'
import { AddressInfo } from 'net'
import { OAuth2Client } from 'google-auth-library'
import type { AuthStatus } from '../shared/types'
import { getConfig, saveRefreshToken, loadRefreshToken, clearRefreshToken } from './store'

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

// Injected at build time by electron-vite `define` (empty unless provided).
declare const __BRINK_GOOGLE_CLIENT_ID__: string
declare const __BRINK_GOOGLE_CLIENT_SECRET__: string
const BUNDLED_CLIENT_ID = __BRINK_GOOGLE_CLIENT_ID__
const BUNDLED_CLIENT_SECRET = __BRINK_GOOGLE_CLIENT_SECRET__

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
]

let client: OAuth2Client | null = null
let cachedEmail: string | null = null

/** True when the OAuth client is baked into this build. */
function hasBundledClient(): boolean {
  return Boolean(BUNDLED_CLIENT_ID && BUNDLED_CLIENT_SECRET)
}

/** Resolve the OAuth client id/secret: bundled build credentials win, else the
 *  ones entered in Settings. */
async function resolveCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  if (hasBundledClient()) {
    return { clientId: BUNDLED_CLIENT_ID, clientSecret: BUNDLED_CLIENT_SECRET }
  }
  const { clientId, clientSecret } = await getConfig()
  return { clientId, clientSecret }
}

async function buildClient(redirectUri?: string): Promise<OAuth2Client> {
  const { clientId, clientSecret } = await resolveCredentials()
  if (!clientId || !clientSecret) {
    throw new Error('No Google OAuth credentials available (bundled or in Settings).')
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri })
}

/** Fetch the signed-in account's email via the OAuth2 userinfo endpoint. */
async function fetchEmail(c: OAuth2Client): Promise<string | null> {
  try {
    const res = await c.request<{ email?: string }>({ url: USERINFO_URL })
    return res.data.email ?? null
  } catch {
    return null
  }
}

/** Returns an authorized client (with a refresh token loaded), or null. */
export async function getAuthorizedClient(): Promise<OAuth2Client | null> {
  if (client) return client
  const refreshToken = await loadRefreshToken()
  if (!refreshToken) return null
  const c = await buildClient()
  c.setCredentials({ refresh_token: refreshToken })
  client = c
  return client
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const { clientId, clientSecret } = await resolveCredentials()
  const refreshToken = await loadRefreshToken()
  return {
    signedIn: Boolean(refreshToken),
    email: cachedEmail,
    hasCredentials: Boolean(clientId && clientSecret),
    bundledCredentials: hasBundledClient()
  }
}

/** Base64url without padding, for PKCE. */
function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Run the desktop loopback OAuth flow with PKCE: spin up a localhost server on
 * an ephemeral port, open the consent screen in the default browser, capture
 * the authorization code on redirect, exchange it (with the PKCE verifier), and
 * persist the refresh token.
 */
export async function signIn(): Promise<AuthStatus> {
  return new Promise<AuthStatus>((resolve, reject) => {
    const server = http.createServer()
    const cleanup = (): void => {
      try {
        server.close()
      } catch {
        /* noop */
      }
    }

    server.on('error', (err) => {
      cleanup()
      reject(err)
    })

    server.listen(0, '127.0.0.1', async () => {
      try {
        const port = (server.address() as AddressInfo).port
        const redirectUri = `http://127.0.0.1:${port}`
        const c = await buildClient(redirectUri)

        const codeVerifier = base64url(crypto.randomBytes(32))
        const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())
        const state = base64url(crypto.randomBytes(16))

        const authUrl = c.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: SCOPES,
          state,
          code_challenge_method: 'S256' as never,
          code_challenge: codeChallenge
        })

        server.on('request', async (req, res) => {
          try {
            const url = new URL(req.url || '/', redirectUri)
            const code = url.searchParams.get('code')
            const error = url.searchParams.get('error')

            // CSRF / mix-up protection: the real callback (code or error) must
            // echo our state. Other requests (e.g. favicon) are ignored below.
            if ((code || error) && url.searchParams.get('state') !== state) {
              res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end(htmlPage('Invalid request', 'You can close this window.'))
              cleanup()
              reject(new Error('OAuth state mismatch'))
              return
            }

            if (error) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end(htmlPage('Sign-in cancelled', 'You can close this window.'))
              cleanup()
              reject(new Error(error))
              return
            }
            if (!code) {
              res.writeHead(404)
              res.end()
              return
            }

            const { tokens } = await c.getToken({ code, codeVerifier })
            c.setCredentials(tokens)
            client = c

            if (tokens.refresh_token) {
              await saveRefreshToken(tokens.refresh_token)
            }

            cachedEmail = await fetchEmail(c)

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(
              htmlPage(
                'Signed in ✓',
                'Brink is now connected to your calendar. You can close this window.'
              )
            )
            cleanup()
            resolve(await getAuthStatus())
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(htmlPage('Error', String(e)))
            cleanup()
            reject(e)
          }
        })

        await shell.openExternal(authUrl)
      } catch (e) {
        cleanup()
        reject(e)
      }
    })
  })
}

export async function signOut(): Promise<AuthStatus> {
  client = null
  cachedEmail = null
  await clearRefreshToken()
  return getAuthStatus()
}

/** Best-effort: populate cachedEmail on startup if already signed in. */
export async function refreshCachedEmail(): Promise<void> {
  const c = await getAuthorizedClient()
  if (!c) return
  cachedEmail = await fetchEmail(c)
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function htmlPage(rawTitle: string, rawBody: string): string {
  const title = esc(rawTitle)
  const body = esc(rawBody)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${title}</title><style>
body{font-family:-apple-system,system-ui,sans-serif;background:#0b0b10;color:#fff;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{text-align:center;padding:48px 56px;background:#16161f;border-radius:18px;
box-shadow:0 20px 60px rgba(0,0,0,.5)}
h1{font-size:28px;margin:0 0 12px}p{opacity:.7;margin:0;font-size:15px}
</style></head><body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`
}
