import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, BarChart3, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, MapPin, MessageSquareText, Plus, Shield, Sparkles, Star, Target, Trophy, Users, X, Zap } from 'lucide-react'
import { useGame } from '../App'
import { Flag } from '../components/Flag'
import { PlayerPortrait } from '../components/PlayerPortrait'
import { tournamentData } from '../data'
import { deriveCampaignProgress } from './campaignProgress'
import { playerCaps, playerClub, playerName, playerOverall, playersFor, uiNations, type CampaignUIState, type UIPlayer } from './ui-model'

const dayLabel = (date: string) => new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)).toUpperCase()
const dayPeriod = (time: string) => {
  const hour = Number(time.slice(0, 2))
  if (hour < 12) return 'MAÑANA'
  if (hour < 16) return 'MEDIODÍA'
  if (hour < 20) return 'TARDE'
  return 'NOCHE'
}
const eventConsequence = (event: CampaignUIState['agenda'][number]) => {
  const entries = Object.entries(event.skipEffects)
  if (!entries.length) return 'Si la omites: no obtienes el beneficio'
  const labels: Record<string, string> = { pressure: 'presión', federation: 'confianza', physicalRisk: 'riesgo físico', fatigue: 'fatiga', morale: 'moral' }
  return `Si la omites: ${entries.map(([key, value]) => `${labels[key] ?? key} ${Number(value) > 0 ? '+' : ''}${value}`).join(' · ')}`
}

export function ConsoleDashboard() {
  const navigate = useNavigate()
  const { campaign } = useGame()
  const campaignNations = campaign.customNations ?? uiNations
  const nation = campaignNations.find((item) => item.id === campaign.nationId)
  const progress = useMemo(() => {
    const customData = {
      ...tournamentData,
      nations: campaign.customNations ?? tournamentData.nations,
      fixtures: campaign.customFixtures ?? tournamentData.fixtures,
    }
    return deriveCampaignProgress(customData, campaign.matchResults, { controlledNationId: campaign.nationId })
  }, [campaign.matchResults, campaign.nationId, campaign.customNations, campaign.customFixtures])
  const next = progress.nextControlledFixture ?? progress.nextFixture
  const opponentId = next?.homeNationId === campaign.nationId ? next.awayNationId : next?.homeNationId
  const opponent = campaignNations.find((item) => item.id === opponentId)
  const venue = tournamentData.venues.find((item) => item.id === next?.venueId)
  const days = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(`${campaign.date}T12:00:00`)
    day.setDate(day.getDate() + offset)
    return day.toISOString().slice(0, 10)
  })
  const [selectedDate, setSelectedDate] = useState(campaign.date)
  const selectedEvents = campaign.agenda.filter((item) => item.date === selectedDate && item.status === 'pending')
  const todayEvents = campaign.agenda.filter((item) => item.date === campaign.date && item.status === 'pending')
  const nextMission = todayEvents.find((item) => item.type !== 'match') ?? todayEvents[0]
  const countdown = next
    ? Math.max(0, Math.round((new Date(`${next.date.slice(0, 10)}T12:00:00`).getTime() - new Date(`${campaign.date}T12:00:00`).getTime()) / 86_400_000))
    : 0
  const matchReady = Boolean(next && next.date.slice(0, 10) <= campaign.date)

  useEffect(() => {
    setSelectedDate(campaign.date)
  }, [campaign.date])

  const tiles = [
    { tone: 'cyan', icon: CalendarDays, eyebrow: 'MISIONES DE HOY', title: todayEvents.length ? `${todayEvents.length} pendientes` : 'Día despejado', meta: nextMission?.title ?? 'Listo para continuar', route: '/juego' },
    { tone: 'coral', icon: Dumbbell, eyebrow: 'PREPARACIÓN', title: 'Vida del equipo', meta: `Fatiga ${campaign.fatigue}% · recuperación ${campaign.recovery}%`, route: '/juego/concentracion' },
    { tone: 'lilac', icon: Target, eyebrow: 'PLAN DE JUEGO', title: campaign.tactic, meta: `Familiaridad ${campaign.tacticalFamiliarity}%`, route: '/juego/tacticas' },
    { tone: 'mint', icon: Trophy, eyebrow: 'MUNDIAL', title: `${progress.stats.matchesPlayed}/104`, meta: progress.groupStageComplete ? 'Eliminatorias' : `Fase de grupos · ${nation?.group ?? '—'}`, route: '/juego/mundial' },
  ]

  return <section className="console-dashboard">
    <div className="console-dashboard__background" />
    <header className="console-dashboard__headline"><div><span><Sparkles /> CENTRO MUNDIAL · DÍA A DÍA</span><h1>Tu misión empieza<br/><em>en el calendario.</em></h1><p>Juega rápido o entra en cada misión para mejorar al equipo. Nada opcional bloquea el torneo y toda omisión muestra su efecto antes de avanzar.</p></div><aside><small>PRÓXIMO PARTIDO</small><b>{countdown}</b><span>{countdown === 0 ? 'HOY' : countdown === 1 ? 'DÍA' : 'DÍAS'}</span></aside></header>

    <div className="console-dashboard__layout">
      <section className="calendar-stage console-focus-card" data-console-focus tabIndex={0}>
        <header><div><small>SEMANA DE {nation?.shortName?.toUpperCase()}</small><h2>{new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(new Date(`${campaign.date}T12:00:00`))}</h2></div><button onClick={() => navigate('/juego/mundial')}>CALENDARIO COMPLETO <ChevronRight /></button></header>
        <nav className="calendar-stage__days">{days.map((date) => { const events=campaign.agenda.filter((item)=>item.date===date&&item.status==='pending').slice(0,4); const hasMatch=events.some((item)=>item.type==='match'); return <button key={date} className={`${selectedDate===date?'is-active':''} ${hasMatch?'has-alert':''}`} onClick={()=>setSelectedDate(date)}><small>{date===campaign.date?'HOY':dayLabel(date).split(' ')[0]}</small><b>{dayLabel(date).split(' ')[1]}</b><i>{events.length}</i><span className="calendar-day-slots">{events.map((item)=><em key={item.id} className={`is-${item.type}`} title={`${item.time} · ${item.title}`}/>)}</span></button> })}</nav>
        <div className="calendar-stage__mission-list">{selectedEvents.length ? selectedEvents.slice(0,4).map((event) => <button key={event.id} className={`calendar-mission-compact is-${event.type} is-${event.priority}`} onClick={()=>navigate(event.route)}>
          <header><span>{dayPeriod(event.time)}</span><time>{event.time}</time><i>{event.mandatory ? 'PRINCIPAL' : 'OPCIONAL'}</i></header>
          <div><small>{event.type.toUpperCase()} · {event.durationMinutes} MIN</small><h3>{event.title}</h3><p>{event.summary}</p></div>
          <footer><span><Check/> {event.recommendedAction}</span><em>{eventConsequence(event)}</em><ChevronRight/></footer>
        </button>) : <div className="calendar-empty"><CalendarDays/><b>Jornada despejada</b><span>Álex no ha detectado tareas pendientes. Puedes revisar el equipo o avanzar.</span></div>}</div>
        <footer><span><Sparkles/> {selectedEvents.some((item)=>item.type==='match') ? 'ÁLEX: EL PARTIDO ES LA MISIÓN PRINCIPAL' : `ÁLEX: ${selectedEvents[0]?.recommendedAction ?? 'PUEDES AVANZAR SIN BLOQUEOS'}`}</span><span>{selectedEvents.length} MISIONES DISPONIBLES</span></footer>
      </section>

      <aside className="console-dashboard__side">
        <section className="next-match-tile console-focus-card" tabIndex={0} onClick={()=>navigate(matchReady && next ? `/partido?fixture=${next.id}` : '/juego/preparacion')} onKeyDown={(event)=>event.key==='Enter'&&navigate(matchReady && next ? `/partido?fixture=${next.id}` : '/juego/preparacion')}>
          <div><small>PRÓXIMO PARTIDO · {next?.group ? `GRUPO ${next.group}` : 'MUNDIAL'}</small><b>{next ? new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(next.date)) : 'POR DEFINIR'}</b><span><MapPin/>{venue?.city ?? 'Sede internacional'}</span></div>
          <section><article>{nation&&<Flag code={nation.flagCode} label={nation.name} size="lg"/>}<b>{nation?.code}</b></article><i>VS</i><article>{opponent&&<Flag code={opponent.flagCode} label={opponent.name} size="lg"/>}<b>{opponent?.code??'TBD'}</b></article></section>
          <button>{matchReady ? 'JUGAR PARTIDO' : 'PREPARAR PARTIDO'} <ChevronRight/></button>
        </section>
        <div className="console-module-grid">{tiles.map(({tone,icon:Icon,eyebrow,title,meta,route})=><button key={route} className={`console-module console-module--${tone}`} onClick={()=>navigate(route)}><Icon/><small>{eyebrow}</small><b>{title}</b><span>{meta}</span><ChevronRight/></button>)}</div>
      </aside>
    </div>
  </section>
}

type SquadFilter = 'TODOS' | 'POR' | 'DEF' | 'MED' | 'ATA'

function matchesFilter(player: UIPlayer, filter: SquadFilter) {
  const position = `${player.position} ${player.positions.join(' ')}`.toUpperCase()
  if (filter === 'TODOS') return true
  if (filter === 'POR') return position.includes('GK')
  if (filter === 'DEF') return /(CB|LB|RB|DF|WB)/.test(position)
  if (filter === 'MED') return /(DM|CM|AM|MF|LM|RM)/.test(position)
  return /(ST|FW|LW|RW|SS)/.test(position)
}

export function ConsoleSquad() {
  const { campaign, updateCampaign } = useGame()
  const navigate = useNavigate()
  const candidates = playersFor(campaign.nationId)
  const [filter, setFilter] = useState<SquadFilter>('TODOS')
  const filtered = candidates.filter((player) => matchesFilter(player, filter))
  const [focusIndex, setFocusIndex] = useState(0)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const focused = filtered[Math.min(focusIndex, Math.max(0, filtered.length - 1))] ?? candidates[0]
  const selected = new Set(campaign.squadIds)
  const goalkeepers = campaign.squadIds.filter((id) => candidates.find((player) => player.id === id)?.position === 'GK').length
  const canConfirm = campaign.squadIds.length === 26 && goalkeepers >= 3
  const windowStart = Math.max(0, Math.min(focusIndex - 2, Math.max(0, filtered.length - 5)))
  const visible = filtered.slice(windowStart, windowStart + 5)

  const toggle = (player: UIPlayer) => updateCampaign((current) => {
    const exists = current.squadIds.includes(player.id)
    if (!exists && current.squadIds.length >= 26) return current
    return { ...current, squadIds: exists ? current.squadIds.filter((id) => id !== player.id) : [...current.squadIds, player.id] }
  })
  const choosePreset = () => updateCampaign((current) => ({ ...current, squadIds: candidates.filter((player) => player.official2026).slice(0,26).map((player)=>player.id) }))
  const confirm = () => { if (!canConfirm) return; updateCampaign({ squadConfirmed: true }); navigate('/juego/concentracion?seccion=hotel') }
  const assessment = focused ? {
    pressure: Math.min(97, 62 + Math.floor(playerCaps(focused) * .35)),
    versatility: Math.min(98, 48 + focused.positions.length * 13),
    freshness: 82 + (focused.id.length * 7 % 16),
  } : { pressure: 0, versatility: 0, freshness: 0 }

  return <section className="console-squad-scene">
    <div className="console-squad-scene__background"/>
    <header className="console-scene-title"><div><small>MISIÓN 01 · CONVOCATORIA</small><h1>Elige a quienes<br/><em>cargarán con el país.</em></h1></div><aside><b>{campaign.squadIds.length}<i>/26</i></b><span>{goalkeepers}/3 PORTEROS</span></aside></header>
    <nav className="squad-filter-console">{(['TODOS','POR','DEF','MED','ATA'] as SquadFilter[]).map((item)=><button key={item} className={filter===item?'is-active':''} onClick={()=>{setFilter(item);setFocusIndex(0)}}>{item}</button>)}<button className="is-auto" onClick={choosePreset}><Sparkles/> LISTA DE ÁLEX</button></nav>
    <div className="squad-console-layout">
      {/* 50 Mini Cards Grid on the Left */}
      <div className="player-grid-console">
        {filtered.map((player) => {
          const chosen = selected.has(player.id)
          const active = player.id === focused?.id
          const index = filtered.indexOf(player)
          return (
            <button
              type="button"
              key={player.id}
              className={`console-player-card-mini ${active ? 'is-active' : ''} ${chosen ? 'is-chosen' : ''}`}
              onClick={() => setFocusIndex(index)}
              title={playerName(player)}
            >
              <div className="card-mini-header">
                <span className="card-mini-pos">{player.position}</span>
                <span className="card-mini-rating">{playerOverall(player)}</span>
              </div>
              <div className="card-mini-portrait">
                <PlayerPortrait
                  playerId={player.id}
                  nationId={player.nationId}
                  label={playerName(player)}
                  size="md"
                  number={campaign.shirtNumbers[player.id] ?? index + 1}
                />
              </div>
              <div className="card-mini-name">{player.shirtName}</div>
            </button>
          )
        })}
      </div>

      {/* Large Player Card in the Middle */}
      {focused && (
        <div className={`console-player-card-large-wrapper ${selected.has(focused.id) ? 'is-chosen' : ''}`}>
          <div className="console-player-card is-large-show">
            <header>
              <span>{focused.position}</span>
              <b>{playerOverall(focused)}</b>
            </header>
            <div className="card-large-portrait-wrapper">
              <PlayerPortrait
                playerId={focused.id}
                nationId={focused.nationId}
                label={playerName(focused)}
                size="hero"
                number={campaign.shirtNumbers[focused.id] ?? filtered.indexOf(focused) + 1}
              />
            </div>
            <strong className="card-large-player-name">{focused.shirtName}</strong>
            <small className="card-large-player-club">{playerClub(focused)}</small>

            {/* Mega Premium Stats Grid */}
            <div className="card-large-stats-grid">
              <div className="card-large-stat">
                <span className="stat-label">TEC</span>
                <span className="stat-value">{focused.gameRatings.technical ?? 75}</span>
              </div>
              <div className="card-large-stat">
                <span className="stat-label">FIS</span>
                <span className="stat-value">{focused.gameRatings.physical ?? 75}</span>
              </div>
              <div className="card-large-stat">
                <span className="stat-label">MEN</span>
                <span className="stat-value">{focused.gameRatings.mental ?? 75}</span>
              </div>
              <div className="card-large-stat">
                <span className="stat-label">ALT</span>
                <span className="stat-value">{focused.realStats.heightCm ? `${focused.realStats.heightCm}cm` : '—'}</span>
              </div>
              <div className="card-large-stat">
                <span className="stat-label">INT</span>
                <span className="stat-value">{playerCaps(focused)}</span>
              </div>
              <div className="card-large-stat">
                <span className="stat-label">GOL</span>
                <span className="stat-value">{focused.realStats.goals ?? 0}</span>
              </div>
            </div>

            <footer>
              <span>
                <Activity size={12} />
                {82 + (focused.id.length * 7 % 16)}% COND
              </span>
              <i className="selected-indicator">{selected.has(focused.id) ? <Check size={12} /> : <Plus size={12} />}</i>
            </footer>
          </div>
        </div>
      )}

      {/* Technical Report on the Right */}
      {focused && (
        <aside className="console-player-report">
          <header>
            <div>
              <small>INFORME TÉCNICO</small>
              <h2>{playerName(focused)}</h2>
              <span>{focused.position} · {focused.positions.join(' / ')}</span>
            </div>
            <b>{playerOverall(focused)}</b>
          </header>
          <section>
            <small>VEREDICTO DE ÁLEX</small>
            <h3>{playerOverall(focused)>=86?'Puede decidir una noche grande':playerOverall(focused)>=80?'Solución fiable para el torneo':'Convocatoria ligada a un rol concreto'}</h3>
            <p>{playerCaps(focused)>=45?'Experiencia para soportar presión, viajes y eliminatorias.':'Necesita un contexto estable y responsabilidades claras.'}</p>
          </section>
          <div className="console-report-bars">
            <span>
              <small>Presión</small>
              <i><em style={{width:`${assessment.pressure}%`}}/></i>
              <b>{assessment.pressure}</b>
            </span>
            <span>
              <small>Polivalencia</small>
              <i><em style={{width:`${assessment.versatility}%`}}/></i>
              <b>{assessment.versatility}</b>
            </span>
            <span>
              <small>Condición</small>
              <i><em style={{width:`${assessment.freshness}%`}}/></i>
              <b>{assessment.freshness}</b>
            </span>
          </div>
          <div className="console-player-actions">
            <button
              type="button"
              className={compareIds.includes(focused.id)?'is-active':''}
              onClick={()=>setCompareIds((ids)=>ids.includes(focused.id)?ids.filter((id)=>id!==focused.id):ids.length<3?[...ids,focused.id]:ids)}
            >
              <BarChart3/> COMPARAR {compareIds.length}/3
            </button>
            <button
              type="button"
              className={selected.has(focused.id)?'is-remove':''}
              onClick={()=>toggle(focused)}
            >
              {selected.has(focused.id)?<><X/> RETIRAR</>:<><Plus/> CONVOCAR</>}
            </button>
          </div>
        </aside>
      )}
    </div>
    <footer className="squad-console-footer"><div>{campaign.squadIds.slice(-8).map((id)=>{const player=candidates.find((item)=>item.id===id);return player?<span key={id}>{player.shirtName}<button onClick={()=>toggle(player)}><X/></button></span>:null})}</div><button className="confirm-console" disabled={!canConfirm} onClick={confirm}><span><small>{canConfirm?'LISTA EQUILIBRADA':'FALTAN REQUISITOS'}</small><b>{canConfirm?'CONFIRMAR LOS 26':`${campaign.squadIds.length}/26 · ${goalkeepers}/3 POR`}</b></span><ChevronRight/></button></footer>
  </section>
}
