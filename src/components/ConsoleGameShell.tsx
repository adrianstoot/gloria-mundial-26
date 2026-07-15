import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Settings, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { Brand } from './Brand'
import { Flag } from './Flag'
import { useGame } from '../App'
import { uiNations } from '../features/ui-model'
import { tournamentData } from '../data'
import { deriveCampaignProgress } from '../features/campaignProgress'
import { buildContextualBriefing } from '../features/campaignDirector'
import { audioDirector } from '../audio/audioDirector'

const sceneNames: Record<string, string> = {
  '/juego': 'Centro Mundial', '/juego/convocatoria': 'Plantilla', '/juego/concentracion': 'Concentración',
  '/juego/tacticas': 'Plan de juego', '/juego/preparacion': 'Preparación', '/juego/medico': 'Disponibilidad',
  '/juego/prensa': 'Prensa', '/juego/mundial': 'Mundial 2026',
}

function focusableElements() {
  return [...document.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]')]
    .filter((element) => element.offsetParent !== null && !element.closest('[aria-hidden="true"]'))
}

function moveFocus(direction: 'left' | 'right' | 'up' | 'down') {
  const elements = focusableElements()
  if (!elements.length) return
  const active = document.activeElement instanceof HTMLElement && elements.includes(document.activeElement) ? document.activeElement : elements[0]
  const origin = active.getBoundingClientRect()
  const ox = origin.left + origin.width / 2
  const oy = origin.top + origin.height / 2
  const next = elements
    .filter((element) => element !== active)
    .map((element) => {
      const rect = element.getBoundingClientRect()
      const dx = rect.left + rect.width / 2 - ox
      const dy = rect.top + rect.height / 2 - oy
      const valid = direction === 'left' ? dx < -4 : direction === 'right' ? dx > 4 : direction === 'up' ? dy < -4 : dy > 4
      const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy)
      const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx)
      return { element, valid, score: primary + secondary * 2.35 }
    })
    .filter((item) => item.valid)
    .sort((left, right) => left.score - right.score)[0]?.element
  ;(next ?? active).focus()
}

function useConsoleNavigation(onBack: () => void) {
  const gamepadState = useRef({ horizontal: 0, vertical: 0, accept: false, back: false, at: 0 })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input,textarea,select')) return
      const keys: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' }
      if (keys[event.key]) { event.preventDefault(); moveFocus(keys[event.key]); return }
      if (event.key === 'Enter' || event.key === ' ') { if (document.activeElement instanceof HTMLElement) document.activeElement.click(); return }
      if (event.key === 'Escape' || event.key === 'Backspace') onBack()
    }
    window.addEventListener('keydown', onKey)
    let frame = 0
    const poll = () => {
      const gamepad = navigator.getGamepads?.()[0]
      if (gamepad) {
        const now = performance.now()
        const horizontal = Math.abs(gamepad.axes[0] ?? 0) > .58 ? Math.sign(gamepad.axes[0] ?? 0) : 0
        const vertical = Math.abs(gamepad.axes[1] ?? 0) > .58 ? Math.sign(gamepad.axes[1] ?? 0) : 0
        const state = gamepadState.current
        if (now - state.at > 190 && (horizontal !== state.horizontal || vertical !== state.vertical || horizontal || vertical)) {
          if (horizontal) moveFocus(horizontal < 0 ? 'left' : 'right')
          else if (vertical) moveFocus(vertical < 0 ? 'up' : 'down')
          state.at = now
        }
        const accept = Boolean(gamepad.buttons[0]?.pressed)
        const back = Boolean(gamepad.buttons[1]?.pressed)
        if (accept && !state.accept && document.activeElement instanceof HTMLElement) document.activeElement.click()
        if (back && !state.back) onBack()
        Object.assign(state, { horizontal, vertical, accept, back })
      }
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(frame) }
  }, [onBack])
}

export function ConsoleGameShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { campaign, updateCampaign, continueDay } = useGame()
  const rootRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantDetail, setAssistantDetail] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const nation = uiNations.find((item) => item.id === campaign.nationId)
  const progress = useMemo(() => {
    const customData = {
      ...tournamentData,
      nations: campaign.customNations ?? tournamentData.nations,
      fixtures: campaign.customFixtures ?? tournamentData.fixtures,
    }
    return deriveCampaignProgress(customData, campaign.matchResults, { controlledNationId: campaign.nationId })
  }, [campaign.matchResults, campaign.nationId, campaign.customNations, campaign.customFixtures])
  const nextFixture = progress.nextControlledFixture
  const pendingFixture = nextFixture && nextFixture.date.slice(0, 10) <= campaign.date ? nextFixture : undefined
  const briefing = useMemo(() => buildContextualBriefing(campaign, location.pathname), [campaign, location.pathname])

  const goBack = useCallback(() => {
    if (settingsOpen) { setSettingsOpen(false); return }
    if (notificationsOpen) { setNotificationsOpen(false); return }
    if (location.pathname !== '/juego') navigate(-1)
  }, [location.pathname, navigate, notificationsOpen, settingsOpen])
  useConsoleNavigation(goBack)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const resize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const scale = Math.max(.76, Math.min(2, Math.min(width / 1920, height / 1080)))
      root.style.setProperty('--console-scale', scale.toFixed(3))
      root.style.setProperty('--console-px', `${scale}px`)
      root.style.setProperty('--console-aspect', (width / height).toFixed(3))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(document.documentElement)
    resize()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const unlock = () => void audioDirector.unlock(campaign.audio)
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  }, [campaign.audio])

  useEffect(() => audioDirector.apply(campaign.audio), [campaign.audio])

  useEffect(() => {
    const saved = campaign.focusMemory[location.pathname]
    const timer = window.setTimeout(() => {
      const elements = focusableElements()
      const target = saved ? elements.find((element) => (element.dataset.consoleFocusKey ?? element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 80)) === saved) : undefined
      ;(target ?? elements.find((element) => element.hasAttribute('data-console-focus')))?.focus({ preventScroll: true })
    }, 80)
    const remember = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : undefined
      if (!target) return
      const key = target.dataset.consoleFocusKey ?? target.getAttribute('aria-label') ?? target.textContent?.trim().slice(0, 80)
      if (!key || campaign.focusMemory[location.pathname] === key) return
      updateCampaign((current) => ({ ...current, focusMemory: { ...current.focusMemory, [location.pathname]: key } }))
    }
    document.addEventListener('focusin', remember)
    return () => { window.clearTimeout(timer); document.removeEventListener('focusin', remember) }
  }, [campaign.focusMemory, location.pathname, updateCampaign])

  useEffect(() => {
    const onFocus = () => audioDirector.cue('focus')
    const onClick = () => audioDirector.cue('select')
    document.addEventListener('focusin', onFocus)
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('focusin', onFocus); document.removeEventListener('click', onClick) }
  }, [])

  useEffect(() => {
    if (campaign.prologueComplete) return
    updateCampaign((current) => ({ ...current, prologueComplete: true, tutorialComplete: true, unlockedModules: ['squad','hotel','training','tactics','press','hub'] }))
  }, [campaign.prologueComplete, updateCampaign])

  useEffect(() => {
    if (campaign.assistantMemory.heardBriefingIds.includes(briefing.id)) return
    updateCampaign((current) => ({ ...current, assistantMemory: { ...current.assistantMemory, heardBriefingIds: [briefing.id, ...current.assistantMemory.heardBriefingIds].slice(0, 80), lastContext: location.pathname } }))
  }, [briefing.id, campaign.assistantMemory.heardBriefingIds, campaign.prologueComplete, location.pathname, updateCampaign])

  const advance = async () => {
    if (pendingFixture) { navigate(`/partido?fixture=${pendingFixture.id}`); return }
    setAdvancing(true)
    try { await continueDay() } finally { setAdvancing(false) }
  }

  const updateAudio = (key: keyof typeof campaign.audio, value: number | boolean) => updateCampaign((current) => ({ ...current, audio: { ...current.audio, [key]: value, voice: 0, voiceEnabled: false }, assistantVoiceEnabled: false }))
  const postponeBriefing = () => {
    if (briefing.urgency === 'critical') return
    updateCampaign((current) => ({ ...current, assistantMemory: { ...current.assistantMemory, postponedActionIds: [...new Set([briefing.id, ...current.assistantMemory.postponedActionIds])].slice(0, 80) } }))
    setAssistantOpen(false)
  }
  const applyBriefingAction = (route: string, actionId: string) => {
    const noticeId = actionId.startsWith('alert-') ? actionId.slice(6) : undefined
    updateCampaign((current) => ({ ...current, worldNotifications: noticeId ? current.worldNotifications.map((item) => item.id === noticeId ? { ...item, read: true } : item) : current.worldNotifications, assistantMemory: { ...current.assistantMemory, appliedActionIds: [...new Set([actionId, ...current.assistantMemory.appliedActionIds])].slice(0, 80) } }))
    setAssistantOpen(false)
    navigate(route)
  }
  const date = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${campaign.date}T12:00:00`))

  return <div ref={rootRef} className={`console-shell console-scene--${sceneNames[location.pathname]?.toLowerCase().replace(/\s+/g, '-') ?? 'game'}`}>
    <header className="console-topbar">
      <button className="console-brand" onClick={() => navigate('/juego')}><Brand compact /></button>
      <div className="console-location"><small>GLORIA MUNDIAL 26</small><b>{sceneNames[location.pathname] ?? 'Dirección técnica'}</b></div>
      <div className="console-status">
        {nation && <span><Flag code={nation.flagCode} label={nation.name} /><i>{date.toUpperCase()}</i><b>{nation.code}</b></span>}
        <button className="console-icon" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Notificaciones"><Bell /><em>{campaign.worldNotifications.filter((item) => !item.read).length}</em></button>
        <button className="console-continue" onClick={() => void advance()} disabled={advancing}><small>{pendingFixture ? 'DÍA DE PARTIDO' : 'AVANZAR UN DÍA'}</small><b>{advancing ? 'SIMULANDO…' : pendingFixture ? 'JUGAR PARTIDO' : 'CONTINUAR'}</b><ChevronRight /></button>
        <button className="console-icon" onClick={() => setSettingsOpen(true)} aria-label="Ajustes"><Settings /></button>
      </div>
    </header>

    <main className="console-stage"><Outlet /></main>

    <footer className="console-footer">
      <button className={`assistant-core ${assistantOpen ? 'is-open' : ''}`} data-console-focus-key="alex" onClick={() => { setAssistantDetail(false); setAssistantOpen((value) => !value) }}>
        <span className="assistant-core__orb"><i /><i /><i /><Sparkles /></span>
        <span className="assistant-core__copy"><small>ÁLEX VEGA · {briefing.eyebrow}</small><b>{briefing.headline}</b><em>{briefing.detail}</em></span>
        <span className="assistant-core__mission"><small>INFORME DEL DÍA</small><b>ABRIR PLAN <ChevronRight /></b></span>
      </button>
      <div className="console-hints"><span><kbd>A</kbd> ELEGIR</span><span><kbd>B</kbd> ATRÁS</span><span><kbd>☰</kbd> AJUSTES</span></div>
    </footer>

    {assistantOpen && <section className="assistant-briefing-scene"><button onClick={() => setAssistantOpen(false)}><X /></button><div className="assistant-briefing-scene__art"/><article><small>{briefing.eyebrow} · CONFIANZA {briefing.confidence}%</small><h2>{briefing.headline}</h2><p>{briefing.detail}</p><div>{briefing.evidence.map((item) => <span key={item}>{item}</span>)}</div>{assistantDetail&&<section className="assistant-briefing-scene__detail"><b>LECTURA COMPLETA</b><p>{briefing.speech}</p>{briefing.risks.map((risk)=><span key={risk}>RIESGO · {risk}</span>)}</section>}<footer>{briefing.actions.map((action) => <button key={action.id} onClick={() => applyBriefingAction(action.route, action.id)}>{action.label}<ChevronRight /></button>)}<button onClick={()=>setAssistantDetail((value)=>!value)}>{assistantDetail?'RESUMEN':'EXPLICAR INFORME'}</button>{briefing.urgency!=='critical'&&<button onClick={postponeBriefing}>POSPONER</button>}</footer></article></section>}

    {notificationsOpen && <section className="console-notification-scene"><header><small>CENTRO DE NOTIFICACIONES</small><h2>Lo que cambia hoy</h2><button onClick={() => setNotificationsOpen(false)}><X /></button></header><div>{campaign.worldNotifications.map((item) => <button key={item.id} className={`is-${item.urgency}`} onClick={() => navigate(item.route)}><span>{item.category}</span><b>{item.headline}</b><p>{item.summary}</p><ChevronRight /></button>)}</div></section>}

    {settingsOpen && <section className="console-settings-scene"><header><small>EXPERIENCIA v3</small><h2>Sonido y accesibilidad</h2><button onClick={() => setSettingsOpen(false)}><X /></button></header><div className="console-settings-grid">{(['master','music','interface','stadium'] as const).map((key) => <label key={key}><span>{key === 'master' ? 'Volumen maestro' : key === 'music' ? 'Música' : key === 'interface' ? 'Interfaz' : 'Estadio'}<b>{campaign.audio[key]}%</b></span><input type="range" min="0" max="100" value={campaign.audio[key]} onChange={(event) => updateAudio(key, Number(event.target.value))}/></label>)}<button className={campaign.audio.muted ? 'is-active' : ''} onClick={() => updateAudio('muted', !campaign.audio.muted)}>{campaign.audio.muted ? <VolumeX/> : <Volume2/>}<b>{campaign.audio.muted ? 'Activar todo' : 'Silenciar todo'}</b></button><div className="console-settings-note"><Sparkles/><span><b>Álex funciona solo en pantalla</b><small>Consejos, riesgos y próximos pasos siempre visibles; sin narración de voz.</small></span></div></div></section>}
  </div>
}
