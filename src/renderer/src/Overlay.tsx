import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { OverlayPayload } from '../../shared/types'
import { createT } from '../../shared/i18n'
import { useCountdown } from './countdown'

const t = createT(window.api.locale)

export function Overlay(): JSX.Element {
  const [payload, setPayload] = useState<OverlayPayload | null>(null)
  const countdown = useCountdown(payload?.startsAt ?? null)

  useEffect(() => {
    const off = window.api.onOverlay(setPayload)
    window.api.overlayReady() // request the payload now that we're listening
    return off
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') window.api.overlayAction('join')
      if (e.key === 'Escape') window.api.overlayAction('dismiss')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ev = payload?.event
  const starting = payload ? new Date(payload.startsAt).getTime() - Date.now() <= 0 : false

  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="kicker">{starting ? t('overlay.kickerStarting') : t('overlay.kicker')}</div>
        <div className="countdown">{countdown || '…'}</div>
        <h1 className="meeting-title">{ev?.title ?? t('meeting.untitled')}</h1>
        {ev && (
          <div className="meta">
            {new Date(ev.start).toLocaleTimeString(window.api.locale === 'cs' ? 'cs-CZ' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
            {' · '}
            {ev.provider}
          </div>
        )}

        <div className="overlay-actions">
          <button className="join" onClick={() => window.api.overlayAction('join')}>
            {t('overlay.join')}
          </button>
          <button className="snooze" onClick={() => window.api.overlayAction('snooze')}>
            {t('overlay.snooze')}
          </button>
          <button className="dismiss" onClick={() => window.api.overlayAction('dismiss')}>
            {t('overlay.dismiss')}
          </button>
        </div>
        <div className="hint-keys">{t('overlay.hintKeys')}</div>
      </div>
    </div>
  )
}
