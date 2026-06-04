import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Electron + fs surface store.ts touches, so we can exercise the
// token-decoding logic in plain Node.
const state = {
  available: true,
  decrypt: () => 'plain-token',
  fileContents: Buffer.from('encrypted-bytes') as Buffer | undefined
}

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/brink-test' },
  safeStorage: {
    isEncryptionAvailable: () => state.available,
    decryptString: () => state.decrypt(),
    encryptString: (s: string) => Buffer.from(s)
  }
}))

vi.mock('fs', () => ({
  promises: {
    readFile: () => Promise.resolve(state.fileContents),
    writeFile: () => Promise.resolve(),
    unlink: () => Promise.resolve(),
    mkdir: () => Promise.resolve(),
    access: () => Promise.reject(new Error('nope')),
    copyFile: () => Promise.reject(new Error('nope'))
  }
}))

import { loadRefreshToken } from '../src/main/store'

describe('loadRefreshToken', () => {
  beforeEach(() => {
    state.available = true
    state.decrypt = () => 'plain-token'
    state.fileContents = Buffer.from('encrypted-bytes')
  })

  it('returns the decrypted token when the keychain can read it', async () => {
    await expect(loadRefreshToken()).resolves.toBe('plain-token')
  })

  it('returns null (not garbage) when decryption fails', async () => {
    // Regression: a token sealed by a different app identity must NOT be handed
    // back as raw bytes — that caused Google 400 invalid_grant. Expect a clean
    // signed-out state instead.
    state.decrypt = () => {
      throw new Error('cannot decrypt')
    }
    await expect(loadRefreshToken()).resolves.toBeNull()
  })

  it('returns null when OS encryption is unavailable (never trusts plaintext)', async () => {
    state.available = false
    await expect(loadRefreshToken()).resolves.toBeNull()
  })

  it('returns null when there is no token file', async () => {
    state.fileContents = undefined
    // readFile resolving undefined then decryptString throwing → still null
    state.decrypt = () => {
      throw new Error('no buffer')
    }
    await expect(loadRefreshToken()).resolves.toBeNull()
  })
})
