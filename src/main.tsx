import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import 'flag-icons/css/flag-icons.min.css'
import '@fontsource-variable/archivo'
import './styles/global.css'
import './styles/console-v3.css'
import './styles/onboarding-v3.css'
import './styles/match-v3.css'
import { App } from './App'

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
