import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { OverlayPayload } from '../../shared/types'
import { createT } from '../../shared/i18n'
import { useCountdown } from './countdown'

const t = createT(window.api.locale)

export function Banner(): JSX.Element {
  const [payload, setPayload] = useState<OverlayPayload | null>(null)
  const countdown = useCountdown(payload?.startsAt ?? null)

  useEffect(() => {
    const off = window.api.onBanner(setPayload)
    return off
  }, [])

  const ev = payload?.event

  return (
    <div className="banner">
      <div className="banner-card">
        <button
          className="banner-close"
          aria-label={t('banner.close')}
          onClick={() => window.api.bannerAction('dismiss')}
        >
          ×
        </button>
        <div className="banner-kicker">{t('banner.kicker')}</div>
        <div className="banner-countdown">{countdown || '…'}</div>
        <div className="banner-title">{ev?.title ?? t('meeting.untitled')}</div>
        <div className="banner-actions">
          <button className="join" onClick={() => window.api.bannerAction('join')}>
            {t('banner.join')}
          </button>
        </div>
      </div>
    </div>
  )
}
