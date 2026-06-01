import React from 'react'
import { createRoot } from 'react-dom/client'
import { Settings } from './Settings'
import { Overlay } from './Overlay'
import { Banner } from './Banner'
import './styles.css'
import type { RendererApi } from '../../shared/types'

declare global {
  interface Window {
    api: RendererApi
  }
}

function Root(): React.JSX.Element {
  const view = window.api.view
  if (view === 'overlay') return <Overlay />
  if (view === 'banner') return <Banner />
  return <Settings />
}

// Reflect the resolved UI language on <html lang> for a11y / correctness.
document.documentElement.lang = window.api.locale

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
