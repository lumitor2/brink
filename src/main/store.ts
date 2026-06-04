import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import type { AppConfig } from '../shared/types'
import { DEFAULT_CONFIG, sanitizeConfig } from '../shared/config'

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function tokenPath(): string {
  return join(app.getPath('userData'), 'refresh-token.bin')
}

let cached: AppConfig | null = null

// Older userData folder names this app shipped under before settling on the
// current one. Used to migrate an existing login forward after a rename.
const LEGACY_APP_NAMES = ['in-your-face', 'in-your-face-mac']

/**
 * One-time migration of the userData folder. The app was renamed as it matured
 * (which moves Electron's userData directory), so copy the config + encrypted
 * token from the most recent old folder that still has them. This keeps
 * existing users signed in. No-op on fresh installs / platforms without one.
 */
export async function migrateLegacyUserData(): Promise<void> {
  const current = app.getPath('userData')
  const parent = dirname(current)
  for (const file of ['config.json', 'refresh-token.bin']) {
    const dst = join(current, file)
    try {
      await fs.access(dst)
      continue // already present — don't overwrite
    } catch {
      /* not there yet — try to bring it over from a legacy folder */
    }
    for (const name of LEGACY_APP_NAMES) {
      const src = join(parent, name, file)
      if (src === dst) continue
      try {
        await fs.mkdir(current, { recursive: true })
        await fs.copyFile(src, dst)
        break // migrated from the first legacy folder that had it
      } catch {
        /* try the next legacy folder */
      }
    }
  }
}

export async function getConfig(): Promise<AppConfig> {
  if (cached) return cached
  let next: AppConfig
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    next = sanitizeConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) })
  } catch {
    next = { ...DEFAULT_CONFIG }
  }
  cached = next
  return next
}

export async function saveConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getConfig()
  cached = sanitizeConfig({ ...current, ...patch })
  await fs.writeFile(configPath(), JSON.stringify(cached, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
  return cached
}

/**
 * Persist the Google refresh token encrypted at rest. On macOS, safeStorage is
 * backed by the system Keychain, so the encryption key never lives on disk.
 */
export async function saveRefreshToken(token: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    // No OS keyring (e.g. a headless Linux box). Never write the token in
    // plaintext — the session keeps working in memory and the user re-signs in
    // on next launch.
    console.warn('[store] OS encryption unavailable — refresh token not persisted')
    return
  }
  const enc = safeStorage.encryptString(token)
  await fs.writeFile(tokenPath(), enc, { mode: 0o600 })
}

export async function loadRefreshToken(): Promise<string | null> {
  try {
    const buf = await fs.readFile(tokenPath())
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(buf)
      } catch {
        // The token was encrypted with a key this build can't access (e.g. a
        // different app identity). Treat as signed-out so the user re-signs in,
        // rather than handing a garbage string to Google (→ 400 invalid_grant).
        return null
      }
    }
    // Without encryption we never persist a token; ignore any legacy plaintext.
    return null
  } catch {
    return null
  }
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await fs.unlink(tokenPath())
  } catch {
    /* already gone */
  }
}
