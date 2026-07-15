import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import 'flag-icons/css/flag-icons.min.css'
import '@fontsource-variable/archivo'
import '@fontsource/barlow-condensed/400.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800.css'
import './styles/global.css'
import './styles/console-v3.css'
import './styles/onboarding-v3.css'
import './styles/match-v3.css'
import { App } from './App'

const BUILD_STORAGE_KEY = 'gm26-published-build'

async function ensurePublishedBuild() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?check=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return true
    const manifest = await response.json() as { version?: string }
    if (!manifest.version) return true
    const previous = localStorage.getItem(BUILD_STORAGE_KEY)
    document.documentElement.dataset.gm26Build = manifest.version
    if (!previous) {
      localStorage.setItem(BUILD_STORAGE_KEY, manifest.version)
      return true
    }
    if (previous === manifest.version) return true

    localStorage.setItem(BUILD_STORAGE_KEY, manifest.version)
    const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : []
    await Promise.all(registrations.map((registration) => registration.unregister()))
    if ('caches' in window) {
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    }
    const freshUrl = new URL(window.location.href)
    freshUrl.searchParams.set('build', manifest.version)
    window.location.replace(freshUrl.toString())
    return false
  } catch {
    // Offline remains playable; the network check will run again on the next launch.
    return true
  }
}

function renderGame() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
        <aside className="mobile-orientation-guard" aria-label="Orientación recomendada">
          <span className="mobile-orientation-guard__phone"><i /></span>
          <small>GLORIA MUNDIAL 26</small>
          <strong>Gira el móvil</strong>
          <p>La concentración, la pizarra y los partidos están diseñados para jugar en horizontal.</p>
          <em>La partida continuará exactamente donde la dejaste.</em>
        </aside>
      </HashRouter>
    </React.StrictMode>,
  )
}

void ensurePublishedBuild().then((ready) => { if (ready) renderGame() })
