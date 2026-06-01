import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load .env (and process.env / CI secrets) so the OAuth client can be baked
  // into the build WITHOUT committing it. Set GOOGLE_CLIENT_ID and
  // GOOGLE_CLIENT_SECRET (see .env.example) for a one-click "Sign in with
  // Google" build; otherwise the app falls back to credentials entered in
  // Settings. Nothing here ends up in source control.
  const env = loadEnv(mode, process.cwd(), '')
  const bundledOAuth = {
    __BRINK_GOOGLE_CLIENT_ID__: JSON.stringify(env.GOOGLE_CLIENT_ID ?? ''),
    __BRINK_GOOGLE_CLIENT_SECRET__: JSON.stringify(env.GOOGLE_CLIENT_SECRET ?? '')
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: bundledOAuth,
      build: {
        rollupOptions: {
          input: { index: resolve(__dirname, 'src/main/index.ts') }
        }
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: { index: resolve(__dirname, 'src/preload/index.ts') }
        }
      }
    },
    renderer: {
      root: resolve(__dirname, 'src/renderer'),
      build: {
        rollupOptions: {
          input: { index: resolve(__dirname, 'src/renderer/index.html') }
        }
      },
      plugins: [react()]
    }
  }
})
