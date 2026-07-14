import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Building2, CalendarDays, ChevronRight, Crown, Dumbbell, Gamepad2, HeartPulse, HelpCircle, MessageSquareText, Play, Save, Settings, ShieldCheck, Target, Trophy, Users, X } from 'lucide-react'
import { Brand } from './Brand'
import { Flag } from './Flag'
import { useGame } from '../App'
import { uiNations } from '../features/ui-model'
import { tournamentData } from '../data'
import { deriveCampaignProgress } from '../features/campaignProgress'
import { buildPressConference, pressConferenceComplete } from '../features/pressConference'
import { prologueStage, prologueStages, stageTarget } from '../features/experienceDirector'

const modules = [
  { to: '/juego', label: 'Centro Mundial', icon: Gamepad2, id: 'hub', exact: true },
  { to: '/juego/convocatoria', label: 'Selección', icon: Users, id: 'squad' },
  { to: '/juego/concentracion', label: 'Concentración', icon: Building2, id: 'hotel' },
  { to: '/juego/tacticas', label: 'Táctica', icon: Target, id: 'tactics' },
  { to: '/juego/preparacion', label: 'Preparación', icon: Dumbbell, id: 'training' },
  { to: '/juego/medico', label: 'Médico', icon: HeartPulse, id: 'training' },
  { to: '/juego/prensa', label: 'Prensa', icon: MessageSquareText, id: 'press' },
  { to: '/juego/mundial', label: 'Mundial', icon: Trophy, id: 'hub' },
] as const

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { campaign, updateCampaign, continueDay } = useGame()
  const [toast, setToast] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const nation = uiNations.find((item) => item.id === campaign.nationId)
  const progress = useMemo(() => deriveCampaignProgress(tournamentData, campaign.matchResults, { controlledNationId: campaign.nationId }), [campaign.matchResults, campaign.nationId])
  const conferenceComplete = pressConferenceComplete(campaign, buildPressConference(campaign, progress))
  const stage = prologueStage(campaign, conferenceComplete)
  const stageIndex = prologueStages.findIndex((item) => item.id === stage)
  const expectedTarget = stageTarget(stage)
  const nextFixture = progress.nextControlledFixture
  const pendingFixture = nextFixture && nextFixture.date.slice(0, 10) <= campaign.date ? nextFixture : undefined
  const trainedToday = campaign.decisionLog.some((item) => item.key === `training:${campaign.date}:primary`)
  const taskCount = [!campaign.squadConfirmed, !campaign.hotelId, !trainedToday, !conferenceComplete].filter(Boolean).length

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (campaign.prologueComplete) return
    const unlocked = prologueStages.slice(0, stageIndex + 1).map((item) => item.id === 'hub' ? 'hub' : item.id) as typeof campaign.unlockedModules
    const completing = stage === 'hub'
    if (campaign.unlockedModules.join('|') !== unlocked.join('|') || completing) {
      updateCampaign((current) => ({ ...current, unlockedModules: completing ? ['squad','hotel','training','tactics','press','hub'] : unlocked, prologueComplete: completing }))
    }
    const [expectedPath, expectedSearch = ''] = expectedTarget.split('?')
    const currentSection = new URLSearchParams(location.search).get('seccion') ?? ''
    const expectedSection = new URLSearchParams(expectedSearch).get('seccion') ?? ''
    if (location.pathname !== expectedPath || (expectedSection && currentSection !== expectedSection)) navigate(expectedTarget, { replace: true })
  }, [campaign.prologueComplete, campaign.unlockedModules, expectedTarget, location.pathname, location.search, navigate, stage, stageIndex, updateCampaign])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const advance = async () => {
    if (!campaign.prologueComplete) { navigate(expectedTarget); setToast('Completa la misión actual con Álex Vega'); return }
    if (pendingFixture) { navigate(`/partido?fixture=${pendingFixture.id}`); return }
    if (campaign.completed || progress.completed) { navigate('/juego/mundial'); return }
    setAdvancing(true)
    try { await continueDay(); setToast('Jornada simulada y guardada') } finally { setAdvancing(false) }
  }

  const date = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${campaign.date}T12:00:00`))

  return (
    <div className={`game-shell ${campaign.prologueComplete ? 'game-shell--open' : 'game-shell--prologue'}`}>
      <header className="game-shell__header">
        <button className="game-shell__brand" onClick={() => navigate('/')}><Brand compact /></button>
        <nav className="game-shell__nav" aria-label="Áreas de dirección">
          {modules.map((item) => {
            const { to, label, icon: Icon, id } = item
            const exact = 'exact' in item && item.exact
            const unlocked = campaign.prologueComplete || campaign.unlockedModules.includes(id)
            return unlocked
              ? <NavLink key={to} to={to} end={exact}><Icon /><span>{label}</span></NavLink>
              : <span key={to} className="is-locked"><Icon /><span>{label}</span></span>
          })}
        </nav>
        <div className="game-shell__status">
          <button className="game-shell__alerts" onClick={() => setToast(taskCount ? `${taskCount} decisiones necesitan tu atención` : 'Equipo preparado')}><Bell />{taskCount > 0 && <b>{taskCount}</b>}</button>
          {nation && <span className="game-shell__manager"><Flag code={nation.flagCode} label={nation.name} /><span><small>{date.toUpperCase()}</small><b>{campaign.manager.name} · {nation.code}</b></span></span>}
          <button className="game-shell__continue" onClick={() => void advance()} disabled={advancing}><small>{pendingFixture ? 'DÍA DE PARTIDO' : campaign.prologueComplete ? 'SIGUIENTE' : `PRÓLOGO ${stageIndex + 1}/6`}</small><b>{advancing ? 'SIMULANDO…' : pendingFixture ? 'JUGAR' : campaign.prologueComplete ? 'CONTINUAR' : 'MISIÓN ACTUAL'}</b>{pendingFixture ? <Play /> : <ChevronRight />}</button>
          <button className="game-shell__settings" onClick={() => setSettingsOpen(true)} aria-label="Ajustes"><Settings /></button>
        </div>
      </header>

      {!campaign.prologueComplete && <div className="prologue-track">{prologueStages.map((item, index) => <span key={item.id} className={index < stageIndex ? 'is-done' : index === stageIndex ? 'is-current' : ''}><i>{index < stageIndex ? <ShieldCheck /> : index + 1}</i><b>{item.label}</b></span>)}</div>}
      {campaign.prologueComplete && <div className="game-shell__ticker"><span><Crown /> CAMINO A LA GLORIA</span><i /><b>{progress.controlledNationEliminated ? 'Modo espectador' : progress.groupStageComplete ? 'Fase eliminatoria' : `Fase de grupos · ${progress.stats.matchesPlayed}/104`}</b><button onClick={() => setToast('Partida guardada localmente')}><Save /> GUARDAR</button></div>}
      <main className="game-shell__scene"><Outlet /></main>
      {toast && <div className="game-toast" role="status">{toast}</div>}

      {settingsOpen && <div className="drawer-backdrop" onMouseDown={() => setSettingsOpen(false)}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">EXPERIENCIA v3</span><h2>Ajustes</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X /></button></header><button className="drawer-option" onClick={() => navigate('/tutorial')}><span><HelpCircle /><b>Manual de juego</b><small>Revisar todos los sistemas y consejos visuales de Álex</small></span><ChevronRight /></button></aside></div>}
    </div>
  )
}
