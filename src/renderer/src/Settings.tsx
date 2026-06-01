import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { AppConfig, AuthStatus, MeetingEvent } from '../../shared/types'
import { createT } from '../../shared/i18n'

const t = createT(window.api.locale)
const LOCALE_TAG = window.api.locale === 'cs' ? 'cs-CZ' : 'en-US'
const fmtTime = (iso: string): string => {
  const d = new Date(iso)
  const time = d.toLocaleTimeString(LOCALE_TAG, { hour: '2-digit', minute: '2-digit' })
  // Same calendar day → just the time; otherwise prefix the weekday.
  if (d.toDateString() === new Date().toDateString()) return time
  return `${d.toLocaleDateString(LOCALE_TAG, { weekday: 'short' })} ${time}`
}

export function Settings(): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [upcoming, setUpcoming] = useState<MeetingEvent[]>([])
  const [earlier, setEarlier] = useState<MeetingEvent[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.api.getConfig().then(setConfig)
    void window.api.getAuthStatus().then(setAuth)
    void window.api.getUpcoming().then(setUpcoming)
    const off = window.api.onAuthChanged((s) => {
      setAuth(s)
      void window.api.getUpcoming().then(setUpcoming)
    })
    return off
  }, [])

  function update<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    setConfig((c) => (c ? { ...c, [key]: value } : c))
    setSaved(false)
  }

  // Changing the language saves immediately; the main process reloads this
  // window so the new language takes effect at once.
  async function changeLanguage(language: AppConfig['language']): Promise<void> {
    if (!config) return
    await window.api.saveConfig({ ...config, language })
  }

  async function save(): Promise<void> {
    if (!config) return
    setBusy(true)
    setError(null)
    try {
      const next = await window.api.saveConfig(config)
      setConfig(next)
      setAuth(await window.api.getAuthStatus())
      setSaved(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function signIn(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      // Persist credentials first so the OAuth client can be built.
      if (config) await window.api.saveConfig(config)
      const status = await window.api.signIn()
      setAuth(status)
      setUpcoming(await window.api.refreshNow())
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function signOut(): Promise<void> {
    setBusy(true)
    try {
      setAuth(await window.api.signOut())
      setUpcoming([])
    } finally {
      setBusy(false)
    }
  }

  if (!config || !auth) {
    return <div className="settings loading">{t('settings.loading')}</div>
  }

  return (
    <div className="settings">
      <header className="brand">
        <div className="dot" />
        <h1>Brink</h1>
      </header>

      <section className="card">
        <h2>{t('settings.googleAccount')}</h2>
        {auth.signedIn ? (
          <div className="account">
            <span className="ok">
              ●{' '}
              {auth.email
                ? t('settings.signedInAs', { email: auth.email })
                : t('settings.signedIn')}
            </span>
            <button className="ghost" onClick={signOut} disabled={busy}>
              {t('settings.signOut')}
            </button>
          </div>
        ) : auth.bundledCredentials ? (
          <>
            <button className="primary" onClick={signIn} disabled={busy}>
              {t('settings.signInGoogle')}
            </button>
            <p className="hint">{t('settings.signInHint')}</p>
          </>
        ) : (
          <>
            <label>
              Client ID
              <input
                type="text"
                value={config.clientId}
                placeholder="…apps.googleusercontent.com"
                onChange={(e) => update('clientId', e.target.value)}
              />
            </label>
            <label>
              Client Secret
              <input
                type="password"
                value={config.clientSecret}
                placeholder="GOCSPX-…"
                onChange={(e) => update('clientSecret', e.target.value)}
              />
            </label>
            <button
              className="primary"
              onClick={signIn}
              disabled={busy || !config.clientId || !config.clientSecret}
            >
              {t('settings.signInGoogle')}
            </button>
            <p className="hint">{t('settings.credsHint')}</p>
          </>
        )}
      </section>

      <section className="card">
        <h2>{t('settings.notifications')}</h2>
        <label className="row">
          {t('settings.overlayBefore')}
          <input
            type="number"
            min={0}
            max={60}
            value={config.leadMinutes}
            onChange={(e) => update('leadMinutes', Number(e.target.value))}
          />
          {t('settings.minutesBeforeStart')}
        </label>
        <label className="row">
          {t('settings.snoozeBy')}
          <input
            type="number"
            min={1}
            max={30}
            value={config.snoozeMinutes}
            onChange={(e) => update('snoozeMinutes', Number(e.target.value))}
          />
          {t('settings.minutes')}
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={config.preReminderEnabled}
            onChange={(e) => update('preReminderEnabled', e.target.checked)}
          />
          {t('settings.bannerToggle')}
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={config.includeDeclined}
            onChange={(e) => update('includeDeclined', e.target.checked)}
          />
          {t('settings.includeDeclined')}
        </label>
        <label className="row">
          {t('settings.bannerAnd')}
          <input
            type="number"
            min={1}
            max={120}
            value={config.preReminderMinutes}
            disabled={!config.preReminderEnabled}
            onChange={(e) => update('preReminderMinutes', Number(e.target.value))}
          />
          {t('settings.minutesBeforeStart')}
        </label>
        <div className="actions">
          <button className="primary" onClick={save} disabled={busy}>
            {t('settings.save')}
          </button>
          <button className="ghost" onClick={() => void window.api.testOverlay()}>
            {t('settings.testOverlay')}
          </button>
          <button className="ghost" onClick={() => void window.api.testBanner()}>
            {t('settings.testBanner')}
          </button>
          {saved && <span className="saved">{t('settings.saved')}</span>}
        </div>
        <label className="row">
          {t('settings.language')}
          <select
            value={config.language}
            onChange={(e) => void changeLanguage(e.target.value as AppConfig['language'])}
          >
            <option value="auto">{t('settings.langAuto')}</option>
            <option value="cs">{t('settings.langCs')}</option>
            <option value="en">{t('settings.langEn')}</option>
          </select>
        </label>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{t('settings.upcoming')}</h2>
          <button
            className="ghost small"
            onClick={() => void window.api.refreshNow().then(setUpcoming)}
          >
            {t('settings.refresh')}
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="hint">{t('settings.noUpcoming')}</p>
        ) : (
          <ul className="events">
            {upcoming.slice(0, 8).map((m) => (
              <li key={m.id}>
                <span className="time">{fmtTime(m.start)}</span>
                <span className="title">{m.title}</span>
                <span className="provider">{m.provider}</span>
              </li>
            ))}
          </ul>
        )}

        {earlier === null ? (
          <button
            className="ghost small earlier-toggle"
            onClick={() => void window.api.getEarlierToday().then(setEarlier)}
          >
            {t('settings.showEarlier')}
          </button>
        ) : (
          <>
            {earlier.length === 0 ? (
              <p className="hint">{t('settings.noEarlier')}</p>
            ) : (
              <ul className="events">
                {earlier.map((m) => (
                  <li key={m.id} className="past">
                    <span className="time">{fmtTime(m.start)}</span>
                    <span className="title">{m.title}</span>
                    <span className="provider">{m.provider}</span>
                  </li>
                ))}
              </ul>
            )}
            <button className="ghost small earlier-toggle" onClick={() => setEarlier(null)}>
              {t('settings.hideEarlier')}
            </button>
          </>
        )}
      </section>

      {error && <div className="error">{error}</div>}
    </div>
  )
}
