import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, AlertCircle, ArrowRight, BadgeCheck, BarChart3, BatteryCharging, Brain, Building2, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDot, ClipboardCheck, Clock3, Crown,
  Dumbbell, Eye, FileText, Filter, Flag as FlagIcon, Flame, Footprints, Globe2, Goal, Heart, HeartPulse,
  Info, LockKeyhole, MapPin, Medal, MessageCircle, MessageSquareText, Minus, Move, Newspaper, Play, Radio,
  Plus, RotateCcw, Search, Shield, ShieldAlert, ShieldCheck, Sparkles, Star, Stethoscope,
  Swords, Target, Thermometer, Timer, TrendingUp, Trophy, UserRound, Users, Wind, X, Zap,
} from 'lucide-react'
import { useGame } from '../App'
import { Flag } from '../components/Flag'
import { PlayerPortrait, TeamShirt } from '../components/PlayerPortrait'
import { EmptyState, Metric, Panel, Progress, Segmented, TaskRow } from '../components/UI'
import { playerCaps, playerClub, playerName, playerOverall, playersFor, uiNations, uiPlayersByNation, type CampaignUIState, type UIPlayer } from './ui-model'
import { applyCampDecision } from './decisionEngine'
import { deriveCampaignProgress, type CampaignProgress, type ResolvedCampaignFixture } from './campaignProgress'
import { buildPressConference, pressConferenceComplete } from './pressConference'
import { suspendedPlayerIds } from './discipline'
import { activeInjuries } from './availability'
import { tournamentData } from '../data'
import type { GroupId } from '../domain'
import type { Position } from '../domain'
import { assessTacticalPlayer, assessTacticalShape, effectivePositionRating, inferTacticalPosition, positionSuitability, tacticalFitLabel } from '../domain/tacticalIntelligence'
import { starProfile } from './starPlayers'
import { SceneAssistant } from '../components/SceneAssistant'
import { buildAssistantAdvice } from './experienceDirector'
import {
  filterCalendarFixtures,
  fixtureUrgency,
  groupCalendarDays,
  nationForm,
  selectSpotlightFixture,
  stageCalendarSummaries,
  type CalendarScope,
  type CalendarStage,
  type FormResult,
} from './calendarModel'

function currentData() {
  const { campaign } = useGame()
  const nation = uiNations.find((item) => item.id === campaign.nationId) ?? uiNations[0]
  const players = playersFor(nation?.id)
  return { campaign, nation, players }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

export function Dashboard() {
  const navigate = useNavigate()
  const { campaign, nation, players } = currentData()
  const progress = deriveCampaignProgress(
    {
      ...tournamentData,
      nations: campaign.customNations ?? tournamentData.nations,
      fixtures: campaign.customFixtures ?? tournamentData.fixtures,
    },
    campaign.matchResults,
    { controlledNationId: campaign.nationId }
  )
  const nextFixture = progress.nextControlledFixture ?? progress.nextFixture
  const leftTeam = uiNations.find((item) => item.id === nextFixture?.homeNationId) ?? nation
  const rightTeam = uiNations.find((item) => item.id === nextFixture?.awayNationId) ?? uiNations.find((item) => item.group === nation?.group && item.id !== nation?.id) ?? uiNations[1]
  const venue = tournamentData.venues.find((item) => item.id === nextFixture?.venueId)
  const daysToMatch = nextFixture ? Math.max(0, Math.ceil((new Date(nextFixture.date).getTime() - new Date(`${campaign.date}T12:00:00`).getTime()) / 86_400_000)) : 0
  const selected = players.filter((player) => campaign.squadIds.includes(player.id))
  const conference = buildPressConference(campaign, progress)
  const pressComplete = pressConferenceComplete(campaign, conference)
  const hubAdvice = buildAssistantAdvice(campaign, 'hub')
  const trainedToday = campaign.decisionLog.some((item) => item.key === `training:${campaign.date}:primary`)
  const leisureToday = campaign.decisionLog.some((item) => item.key === `leisure:${campaign.date}`)
  const tasks = [
    { icon: <Users />, title: 'Revisar la lista definitiva', meta: `${campaign.squadIds.length}/26 jugadores · Mínimo 3 porteros`, status: campaign.squadConfirmed ? 'LISTA' : 'URGENTE', path: '/juego/convocatoria' },
    { icon: <Building2 />, title: 'Fijar la base del equipo', meta: campaign.hotelId ? 'Hotel y entorno confirmados' : 'Clima, viajes, privacidad y apoyo local', status: campaign.hotelId ? 'HECHO' : 'URGENTE', path: '/juego/concentracion' },
    { icon: <Dumbbell />, title: 'Decidir el ejercicio de hoy', meta: trainedToday ? 'Carga incorporada al estado del equipo' : 'Técnico, táctico, físico o recuperación', status: trainedToday ? 'HECHO' : 'HOY', path: '/juego/concentracion' },
    { icon: <Sparkles />, title: 'Organizar el tiempo libre', meta: leisureToday ? 'Actividad del grupo confirmada' : 'Descanso, familias, afición o cohesión', status: leisureToday ? 'HECHO' : 'OPCIONAL', path: '/juego/concentracion' },
    { icon: <ClipboardCheck />, title: 'Cerrar decisiones invisibles', meta: `${new Set(campaign.decisionLog.filter((item) => item.madeAt === campaign.date && ['recovery','nutrition','media','operations','leadership'].includes(item.type)).map((item) => item.type)).size}/5 bloques de hoy`, status: campaign.decisionLog.filter((item) => item.madeAt === campaign.date && ['recovery','nutrition','media','operations','leadership'].includes(item.type)).length >= 5 ? 'HECHO' : 'HOY', path: '/juego/concentracion' },
    { icon: <Target />, title: 'Preparar el plan de partido', meta: `${campaign.tactic} · Mentalidad ${campaign.mentality.toLowerCase()}`, status: campaign.tacticalFamiliarity >= 60 ? 'LISTO' : 'PENDIENTE', path: '/juego/tacticas' },
    { icon: <MessageSquareText />, title: 'Comparecer ante los medios', meta: `${conference.title} · medios de ${nation?.name}`, status: pressComplete ? 'HECHO' : 'HOY', path: '/juego/prensa' },
  ]

  return (
    <div className="dashboard world-hub page-enter">
      <SceneAssistant advice={hubAdvice} step={6} totalSteps={6} title="Tu Centro Mundial ya está operativo" />
      <section className="dashboard-hero">
        <div className="dashboard-hero__glow" />
        <div className="dashboard-hero__copy">
          <span className="eyebrow"><Crown /> COMIENZA EL CAMINO</span>
          <h2>Buenos días, <em>míster {campaign.manager.name}</em></h2>
          <p>La concentración de {nation?.name} está en marcha. Cada decisión de carga, entorno y comunicación viajará hasta el motor del partido.</p>
          <div className="dashboard-hero__meta"><span><CalendarDays /> {formatDate(campaign.date)}</span><span><Thermometer /> Adaptación climática {campaign.climateAdaptation}%</span><span><Users /> {campaign.squadIds.length || 50} jugadores bajo seguimiento</span></div>
        </div>
        {nation && <div className="dashboard-hero__nation"><span className={`fi fi-${nation.flagCode}`} /><Flag code={nation.flagCode} label={nation.name} size="lg" /><small>FEDERACIÓN DE</small><b>{nation.name}</b></div>}
      </section>

      <section className="game-command-deck" aria-label="Modos de dirección">
        <button className={!campaign.squadConfirmed ? 'is-featured' : ''} onClick={() => navigate('/juego/convocatoria')}><span><Users /></span><small>PLANTILLA</small><b>Elegir los 26</b><em>{campaign.squadIds.length}/26 · informes técnicos</em><ChevronRight /></button>
        <button onClick={() => navigate('/juego/tacticas')}><span><Target /></span><small>PIZARRA</small><b>Plan de juego</b><em>{campaign.tactic} · rendimiento posicional</em><ChevronRight /></button>
        <button onClick={() => navigate('/juego/concentracion')}><span><Building2 /></span><small>CONCENTRACIÓN</small><b>Vida del equipo</b><em>{campaign.hotelId ? 'Base confirmada' : 'Hotel pendiente'} · carga y descanso</em><ChevronRight /></button>
        <button onClick={() => navigate('/juego/prensa')}><span><MessageSquareText /></span><small>PAÍS</small><b>Prensa y presión</b><em>{pressComplete ? 'Comparecencia cerrada' : 'Periodistas esperando'}</em><ChevronRight /></button>
        <button onClick={() => navigate('/juego/mundial')}><span><Trophy /></span><small>COMPETICIÓN</small><b>Mundial 2026</b><em>{progress.stats.matchesPlayed}/104 partidos · cuadro vivo</em><ChevronRight /></button>
        <button className="is-play" onClick={() => nextFixture && nextFixture.date.slice(0,10) <= campaign.date ? navigate(`/partido?fixture=${nextFixture.id}`) : navigate('/juego/preparacion')}><span><Play /></span><small>DÍA DE PARTIDO</small><b>{nextFixture && nextFixture.date.slice(0,10) <= campaign.date ? 'Entrar al estadio' : 'Preparar el próximo'}</b><em>{rightTeam?.shortName ?? 'Rival por definir'} · {daysToMatch} días</em><ChevronRight /></button>
      </section>

      <DashboardCalendarCommand progress={progress} campaignDate={campaign.date} controlledNationId={campaign.nationId} openTasks={tasks.filter((task) => !['HECHO', 'LISTA', 'LISTO'].includes(task.status)).length} onOpenCalendar={() => navigate('/juego/mundial')} onPrepare={() => navigate('/juego/preparacion')} />

      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
          <Panel eyebrow={progress.controlledNationEliminated ? 'MODO ESPECTADOR' : 'PRÓXIMO PARTIDO'} title={progress.controlledNationEliminated ? 'El Mundial continúa' : 'El siguiente desafío'} className="next-match" action={<button className="text-button" onClick={() => navigate('/juego/mundial')}>VER CALENDARIO <ChevronRight /></button>}>
            <div className="next-match__stage"><span>{nextFixture ? stageTitles[nextFixture.stage] : 'TORNEO COMPLETADO'}{nextFixture?.group ? ` · GRUPO ${nextFixture.group}` : ''}</span><b>{nextFixture ? new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(nextFixture.date)) : '19 JUL'}</b><small>{venue ? `${venue.name} · ${venue.city}` : 'Ceremonia final'}</small></div>
            <div className="next-match__teams">
              <div>{leftTeam && <Flag code={leftTeam.flagCode} label={leftTeam.name} size="lg" />}<b>{leftTeam?.shortName ?? '—'}</b><small>{leftTeam ? `#${leftTeam.worldRanking} del mundo` : 'Por definir'}</small></div>
              <span><i>EN</i><b>{daysToMatch}</b><small>DÍAS</small></span>
              <div>{rightTeam && <Flag code={rightTeam.flagCode} label={rightTeam.name} size="lg" />}<b>{rightTeam?.shortName ?? '—'}</b><small>{rightTeam ? `#${rightTeam.worldRanking} del mundo` : 'Por definir'}</small></div>
            </div>
            <div className="next-match__footer"><span><FileText /> El informe preliminar del rival está disponible</span><button className="button button--cyan" onClick={() => navigate('/juego/preparacion')}>ANALIZAR RIVAL <ArrowRight /></button></div>
          </Panel>

          <Panel eyebrow="TU AGENDA" title="Decisiones pendientes" action={<span className="count-pill">{tasks.filter((task) => !['HECHO', 'LISTA', 'LISTO'].includes(task.status)).length} ABIERTAS</span>}>
            <div className="task-list">{tasks.map((task) => <TaskRow key={task.title} icon={task.icon} title={task.title} meta={task.meta} status={task.status} onClick={() => navigate(task.path)} />)}</div>
          </Panel>

          <Panel eyebrow="ACTUALIDAD" title="Noticias de la concentración" action={<button className="text-button" onClick={() => navigate('/juego/prensa')}>SALA DE PRENSA <ChevronRight /></button>}>
            <div className="news-grid">
              <article className="news-card news-card--feature"><div><span>ÚLTIMA HORA</span><Newspaper /></div><small>MUNDIAL 2026 · HACE 18 MIN</small><h3>La expedición ya trabaja con un único sueño</h3><p>El nuevo seleccionador afronta sus primeras horas al mando entre expectación y confianza.</p></article>
              <article className="news-card"><span className="news-card__icon"><ShieldCheck /></span><small>FEDERACIÓN · HACE 1 H</small><h3>La directiva fija los objetivos del torneo</h3><p>“Queremos un equipo valiente y reconocible”.</p></article>
              <article className="news-card"><span className="news-card__icon news-card__icon--gold"><Star /></span><small>VESTUARIO · HACE 2 H</small><h3>Los líderes dan la bienvenida al cuerpo técnico</h3><p>La moral inicial se mantiene alta.</p></article>
            </div>
          </Panel>
        </div>
        <aside className="dashboard-grid__aside">
          <Panel eyebrow="PULSO DEL EQUIPO" title="Estado de la selección">
            <div className="team-pulse">
              <div><span><Heart /> Moral</span><b>{campaign.morale}%</b><Progress value={campaign.morale} tone="green" /></div>
              <div><span><Users /> Cohesión</span><b>{campaign.cohesion}%</b><Progress value={campaign.cohesion} tone="cyan" /></div>
              <div><span><ShieldCheck /> Confianza</span><b>{campaign.federation}%</b><Progress value={campaign.federation} tone="gold" /></div>
              <div><span><Activity /> Recuperación</span><b>{campaign.recovery}%</b><Progress value={campaign.recovery} tone="green" /></div>
            </div>
            <div className="assistant-note"><span className="avatar">MA</span><p><b>Mateo Alonso · Asistente</b>“Antes de cargar las piernas, debemos construir automatismos y confianza.”</p></div>
          </Panel>
          <Panel eyebrow="CONVOCATORIA" title="La lista, de un vistazo">
            <div className="squad-donut" style={{ '--value': `${campaign.squadIds.length / 26 * 360}deg` } as React.CSSProperties}><span><b>{campaign.squadIds.length}</b><small>de 26</small></span></div>
            <div className="mini-position-grid"><span><Goal /> POR <b>{selected.filter((player) => player.position === 'GK').length}</b></span><span><Shield /> DEF <b>{selected.filter((player) => ['DF', 'CB', 'LB', 'RB'].some((pos) => player.position.includes(pos))).length}</b></span><span><Brain /> MED <b>{selected.filter((player) => player.position.includes('M')).length}</b></span><span><Zap /> ATA <b>{selected.filter((player) => ['FW', 'ST', 'LW', 'RW'].some((pos) => player.position.includes(pos))).length}</b></span></div>
            <button className="button button--glass button--wide" onClick={() => navigate('/juego/convocatoria')}>GESTIONAR LISTA <ChevronRight /></button>
          </Panel>
          <Panel eyebrow="PRÓXIMAS FECHAS" title="Tu hoja de ruta">
            <div className="timeline"><div className="is-current"><b>25 MAY</b><span><i />Inicio de concentración<small>Hoy</small></span></div><div><b>01 JUN</b><span><i />Amistoso de preparación<small>Por confirmar</small></span></div><div><b>08 JUN</b><span><i />Cierre de convocatoria<small>Fecha límite</small></span></div><div><b>16 JUN</b><span><i />Primer partido<small>Fase de grupos</small></span></div></div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function DashboardCalendarCommand({
  progress,
  campaignDate,
  controlledNationId,
  openTasks,
  onOpenCalendar,
  onPrepare,
}: {
  progress: CampaignProgress
  campaignDate: string
  controlledNationId: string
  openTasks: number
  onOpenCalendar: () => void
  onPrepare: () => void
}) {
  const nation = uiNations.find((item) => item.id === controlledNationId)
  const spotlight = selectSpotlightFixture(progress.fixtures, controlledNationId)
  const upcomingDays = groupCalendarDays(
    progress.fixtures.filter((fixture) => fixture.status !== 'played' && fixture.date.slice(0, 10) >= campaignDate.slice(0, 10)),
    campaignDate,
    spotlight?.id,
  ).slice(0, 7)
  const nextFixtures = progress.fixtures
    .filter((fixture) => fixture.status !== 'played' && fixture.date.slice(0, 10) >= campaignDate.slice(0, 10))
    .sort((left, right) => left.date.localeCompare(right.date) || left.matchNumber - right.matchNumber)
    .slice(0, 5)
  const home = uiNations.find((item) => item.id === spotlight?.homeNationId)
  const away = uiNations.find((item) => item.id === spotlight?.awayNationId)
  const venue = tournamentData.venues.find((item) => item.id === spotlight?.venueId)
  const groupRows = nation ? progress.groupTables[nation.group as GroupId] : undefined
  const groupPosition = groupRows?.findIndex((row) => row.nationId === controlledNationId) ?? -1
  const row = groupRows?.find((item) => item.nationId === controlledNationId)
  const preparationDays = spotlight ? Math.max(0, Math.ceil((new Date(spotlight.date).getTime() - new Date(`${campaignDate}T12:00:00`).getTime()) / 86_400_000)) : 0
  const completion = Math.round(progress.stats.matchesPlayed / 104 * 100)

  return <section className="command-calendar">
    <div className="command-calendar__backdrop" />
    <header className="command-calendar__header">
      <div><span className="eyebrow"><CalendarDays /> CENTRO DE MANDO DEL MUNDIAL</span><h2>El torneo entero, <em>en una sola mirada</em></h2><p>Situación de tu selección, agenda global, sedes, decisiones y la ruta exacta hasta el 19 de julio.</p></div>
      <button className="button button--gold" onClick={onOpenCalendar}>ABRIR CALENDARIO COMPLETO <ArrowRight /></button>
    </header>
    <div className="command-calendar__situation">
      <article className="command-calendar__identity">
        {nation && <Flag code={nation.flagCode} label={nation.name} size="lg" />}
        <span><small>TU SITUACIÓN · GRUPO {nation?.group}</small><b>{nation?.name}</b><em>{groupPosition >= 0 && row?.played ? `${groupPosition + 1}.ª posición · ${row.points} pts · DG ${row.goalDifference >= 0 ? '+' : ''}${row.goalDifference}` : 'La clasificación empieza de cero'}</em></span>
      </article>
      <article><span className="command-stat-icon"><Trophy /></span><span><small>TORNEO</small><b>{progress.stats.matchesPlayed}/104</b><em>{completion}% completado</em></span><Progress value={completion} tone="gold" /></article>
      <article><span className="command-stat-icon"><Clock3 /></span><span><small>PRÓXIMO RETO</small><b>{preparationDays} días</b><em>{spotlight ? stageTitles[spotlight.stage] : 'Campaña completada'}</em></span></article>
      <article className={openTasks ? 'is-alert' : 'is-ready'}><span className="command-stat-icon"><ClipboardCheck /></span><span><small>DESPACHO</small><b>{openTasks} abiertas</b><em>{openTasks ? 'Tu día aún no está cerrado' : 'Preparación completa'}</em></span></article>
    </div>
    {spotlight && <div className="command-calendar__spotlight">
      <div><span className="calendar-live-kicker"><Flame /> TU PRÓXIMO PARTIDO</span><small>{stageTitles[spotlight.stage]}{spotlight.group ? ` · GRUPO ${spotlight.group}` : ''} · PARTIDO {spotlight.matchNumber}</small><b>{shortCalendarDate(spotlight.date)} · {localKickoff(spotlight.date)}</b><em><MapPin /> {venue ? `${venue.name}, ${venue.city}` : 'Sede pendiente'}</em></div>
      <section><div>{home ? <Flag code={home.flagCode} label={home.name} size="lg" /> : <Shield />}<b>{home?.shortName ?? spotlight.homeSlot}</b></div><span><small>CUENTA ATRÁS</small><strong>{preparationDays}</strong><em>DÍAS</em></span><div>{away ? <Flag code={away.flagCode} label={away.name} size="lg" /> : <Shield />}<b>{away?.shortName ?? spotlight.awaySlot}</b></div></section>
      <button onClick={onPrepare}><Target /> PREPARAR PARTIDO <ChevronRight /></button>
    </div>}
    <div className="command-calendar__days">
      {upcomingDays.map((day) => {
        const userFixture = day.fixtures.find((fixture) => fixture.homeNationId === controlledNationId || fixture.awayNationId === controlledNationId)
        return <button key={day.date} className={`${day.containsSpotlight ? 'has-spotlight' : ''} ${day.isCampaignDay ? 'is-today' : ''}`} onClick={onOpenCalendar}>
          <span>{new Intl.DateTimeFormat('es-ES',{weekday:'short'}).format(new Date(`${day.date}T12:00:00`)).toUpperCase()}</span><b>{day.date.slice(8,10)}</b><small>{shortCalendarDate(day.date).split(' ')[1]}</small><em>{day.fixtures.length} PARTIDOS</em>{userFixture && <i><Crown /> JUEGA {nation?.code}</i>}
        </button>
      })}
    </div>
    <footer className="command-calendar__ticker"><span><Radio /> PRÓXIMOS ENCUENTROS</span><div>{nextFixtures.map((fixture) => { const fixtureHome=uiNations.find((item)=>item.id===fixture.homeNationId); const fixtureAway=uiNations.find((item)=>item.id===fixture.awayNationId); return <button key={fixture.id} onClick={onOpenCalendar}><time>{shortCalendarDate(fixture.date)} · {localKickoff(fixture.date)}</time><b>{fixtureHome?.code ?? 'TBD'} <i>vs</i> {fixtureAway?.code ?? 'TBD'}</b><small>{tournamentData.venues.find((item)=>item.id===fixture.venueId)?.city}</small></button>})}</div></footer>
  </section>
}

function squadUnit(position: string) {
  if (position === 'GK') return 'POR'
  if (['RB','RCB','CB','LCB','LB','RWB','LWB','DF'].includes(position)) return 'DEF'
  if (['DM','RCM','CM','LCM','RM','AM','LM','MF'].includes(position)) return 'MED'
  return 'ATA'
}

export function Squad() {
  const navigate = useNavigate()
  const { campaign, updateCampaign } = useGame()
  const { nation, players } = currentData()
  const [query, setQuery] = useState('')
  const [unit, setUnit] = useState('TODOS')
  const [focusedId, setFocusedId] = useState(players[0]?.id ?? '')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const selected = useMemo(() => new Set(campaign.squadIds), [campaign.squadIds])
  const selectedPlayers = players.filter((player) => selected.has(player.id))
  const counts = { POR:0, DEF:0, MED:0, ATA:0 }
  selectedPlayers.forEach((player) => { counts[squadUnit(player.position) as keyof typeof counts] += 1 })
  const focused = players.find((player) => player.id === focusedId) ?? players[0]
  const filtered = players.filter((player) => (unit === 'TODOS' || squadUnit(player.position) === unit) && `${playerName(player)} ${playerClub(player)}`.toLowerCase().includes(query.toLowerCase()))
  const advice = buildAssistantAdvice(campaign, 'squad')

  const toggle = (player: UIPlayer) => {
    const next = new Set(selected)
    if (next.has(player.id)) next.delete(player.id)
    else if (next.size < 26) next.add(player.id)
    else { setMessage('La lista ya tiene 26 jugadores. Retira uno antes de añadir otro.'); return }
    updateCampaign({ squadIds:[...next], squadConfirmed:false })
    setMessage('')
  }
  const toggleCompare = (player: UIPlayer) => setCompareIds((current) => current.includes(player.id) ? current.filter((id) => id !== player.id) : current.length < 3 ? [...current,player.id] : [current[1]!,current[2]!,player.id])
  const preset = () => updateCampaign({ squadIds:players.filter((player)=>player.official2026).slice(0,26).map((player)=>player.id), squadConfirmed:false })
  const confirm = () => {
    if (selected.size !== 26) { setMessage(`Debes elegir exactamente 26. Faltan ${26-selected.size}.`); return }
    if (counts.POR < 3) { setMessage(`Necesitas tres porteros. Ahora tienes ${counts.POR}.`); return }
    updateCampaign({ squadConfirmed:true })
    navigate('/juego/concentracion?seccion=hotel')
  }
  const profile = (player: UIPlayer) => ({
    role: player.position === 'GK' ? 'Protección del área y primer pase' : ['CB','RCB','LCB'].includes(player.position) ? 'Defensa de espacios y duelos' : ['DM','CM','RCM','LCM'].includes(player.position) ? 'Control, ritmo y conexión' : ['RW','LW','RM','LM'].includes(player.position) ? 'Desborde y amenaza exterior' : 'Último pase y definición',
    pressure: player.gameRatings.composure ?? player.gameRatings.mental ?? playerOverall(player),
    load: Math.max(55,Math.min(96,(player.gameRatings.physical ?? playerOverall(player)) + (playerCaps(player)>40?5:0))),
    versatility: Math.min(99,65 + new Set([player.position,...player.positions]).size*9),
  })

  return <div className="squad-scene page-enter">
    <SceneAssistant advice={advice} step={1} />
    <header className="scene-title"><div><span><Users /> MISIÓN 01 · CONVOCATORIA</span><h1>Elige a los <em>26</em> que cargarán con un país</h1><p>50 candidatos. Siete partidos posibles. Cada perfil debe justificar su lugar.</p></div><div className="squad-score"><strong>{selected.size}<small>/26</small></strong><span><b>{selected.size===26&&counts.POR>=3?'LISTA PREPARADA':'DECISIÓN ABIERTA'}</b><em>{counts.POR}/3 porteros</em></span></div></header>
    <div className="squad-console">
      <section className="candidate-deck">
        <nav><label><Search/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar jugador o club"/></label>{['TODOS','POR','DEF','MED','ATA'].map((item)=><button key={item} className={unit===item?'is-active':''} onClick={()=>setUnit(item)}>{item}</button>)}<button onClick={preset}><Sparkles/> LISTA DE ÁLEX</button></nav>
        {compareIds.length>0&&<div className="compare-ribbon"><span><BarChart3/> COMPARADOR {compareIds.length}/3</span>{compareIds.map((id)=>{const player=players.find((item)=>item.id===id)!;return <button key={id} onClick={()=>setFocusedId(id)}><TeamShirt nationId={player.nationId} number={player.position}/><b>{player.shirtName}</b><em>{playerOverall(player)}</em><X onClick={(event)=>{event.stopPropagation();toggleCompare(player)}}/></button>})}</div>}
        <div className="candidate-grid">{filtered.map((player,index)=>{const chosen=selected.has(player.id);const data=profile(player);const star=starProfile(player);return <article key={player.id} className={`${focused?.id===player.id?'is-focused':''} ${chosen?'is-chosen':''}`} onClick={()=>setFocusedId(player.id)}><header><span>{player.position}</span><b>{playerOverall(player)}</b></header><PlayerPortrait playerId={player.id} nationId={player.nationId} label={playerName(player)} size="hero" number={campaign.shirtNumbers[player.id]??index+1}/><h3>{playerName(player)}</h3><p>{playerClub(player)}</p><div><span>FORMA <b>{(6.4+(index*11%16)/10).toFixed(1)}</b></span><span>COND. <b>{82+(index*7%17)}%</b></span><span>PRESIÓN <b>{data.pressure}</b></span></div>{star&&<em className="candidate-star"><Star/> {star.billing}</em>}<footer><button onClick={(event)=>{event.stopPropagation();toggleCompare(player)}} className={compareIds.includes(player.id)?'is-active':''}><BarChart3/> COMPARAR</button><button onClick={(event)=>{event.stopPropagation();toggle(player)}}>{chosen?<><Check/> CONVOCADO</>:<><Plus/> CONVOCAR</>}</button></footer></article>})}</div>
      </section>
      <aside className="squad-inspector">{focused&&<><header><PlayerPortrait playerId={focused.id} nationId={focused.nationId} label={playerName(focused)} size="hero"/><span><small>INFORME TÉCNICO</small><h2>{playerName(focused)}</h2><p>{focused.position} · {focused.positions.join(' / ')}</p></span><strong>{playerOverall(focused)}</strong></header><section><span>ROL IDEAL</span><h3>{profile(focused).role}</h3><p>{playerCaps(focused)>=45?'Experiencia contrastada para escenarios de máxima presión.':'Perfil con margen, necesita un contexto estable y responsabilidades claras.'}</p></section><div className="scout-metrics"><span><small>Presión</small><b>{profile(focused).pressure}</b><Progress value={profile(focused).pressure} tone="gold"/></span><span><small>Carga</small><b>{profile(focused).load}</b><Progress value={profile(focused).load} tone="green"/></span><span><small>Polivalencia</small><b>{profile(focused).versatility}</b><Progress value={profile(focused).versatility} tone="cyan"/></span></div><div className="assistant-verdict"><Brain/><span><small>VEREDICTO DE ÁLEX</small><b>{playerOverall(focused)>=86?'Diferencial para los grandes escenarios':playerOverall(focused)>=79?'Encaja en la rotación del torneo':'Convocatoria condicionada al rol'}</b><p>Nivel, forma, experiencia y coste táctico ponderados con confianza {Math.min(97,80+Math.floor(playerCaps(focused)/10))}%.</p></span></div></>}
        <section className="squad-composition"><header><span>TUS 26</span><b>{selected.size}/26</b></header><div>{Object.entries(counts).map(([label,value])=><span key={label} className={(label==='POR'?value>=3:label==='DEF'?value>=8:label==='MED'?value>=7:value>=5)?'is-good':''}><small>{label}</small><b>{value}</b></span>)}</div><div className="selected-chips">{selectedPlayers.map((player)=><button key={player.id} onClick={()=>toggle(player)}>{player.shirtName}<X/></button>)}</div></section>{message&&<div className="inline-message"><Info/>{message}</div>}<button className="confirm-squad" onClick={confirm} disabled={selected.size!==26||counts.POR<3}><ClipboardCheck/><span><small>DECISIÓN DEFINITIVA</small><b>CONFIRMAR LOS 26</b></span><ChevronRight/></button>
      </aside>
    </div>
  </div>
}

const formationSlots: Record<string, Array<[number, number, string]>> = {
  '4-3-3': [[50,89,'GK'],[16,70,'LB'],[38,77,'CB'],[62,77,'CB'],[84,70,'RB'],[50,58,'DM'],[32,48,'CM'],[68,48,'CM'],[16,27,'LW'],[50,17,'ST'],[84,27,'RW']],
  '4-2-3-1': [[50,89,'GK'],[16,70,'LB'],[38,77,'CB'],[62,77,'CB'],[84,70,'RB'],[38,58,'DM'],[62,58,'DM'],[20,37,'LW'],[50,34,'AM'],[80,37,'RW'],[50,16,'ST']],
  '4-4-2': [[50,89,'GK'],[16,70,'LB'],[38,77,'CB'],[62,77,'CB'],[84,70,'RB'],[16,48,'LM'],[40,54,'CM'],[60,54,'CM'],[84,48,'RM'],[38,21,'ST'],[62,21,'ST']],
  '3-4-2-1': [[50,89,'GK'],[28,76,'CB'],[50,80,'CB'],[72,76,'CB'],[13,52,'LWB'],[40,58,'CM'],[60,58,'CM'],[87,52,'RWB'],[32,34,'AM'],[68,34,'AM'],[50,16,'ST']],
  '5-3-2': [[50,89,'GK'],[13,65,'LWB'],[30,76,'CB'],[50,80,'CB'],[70,76,'CB'],[87,65,'RWB'],[25,49,'CM'],[50,55,'DM'],[75,49,'CM'],[38,22,'ST'],[62,22,'ST']],
  '4-1-4-1': [[50,89,'GK'],[16,70,'LB'],[38,77,'CB'],[62,77,'CB'],[84,70,'RB'],[50,61,'DM'],[16,43,'LM'],[39,48,'CM'],[61,48,'CM'],[84,43,'RM'],[50,17,'ST']],
  '4-3-1-2': [[50,89,'GK'],[16,70,'LB'],[38,77,'CB'],[62,77,'CB'],[84,70,'RB'],[50,59,'DM'],[33,49,'CM'],[67,49,'CM'],[50,35,'AM'],[38,18,'ST'],[62,18,'ST']],
  '3-4-3': [[50,89,'GK'],[28,76,'CB'],[50,80,'CB'],[72,76,'CB'],[14,51,'LWB'],[39,55,'CM'],[61,55,'CM'],[86,51,'RWB'],[18,27,'LW'],[50,17,'ST'],[82,27,'RW']],
  '3-5-2': [[50,89,'GK'],[28,76,'CB'],[50,80,'CB'],[72,76,'CB'],[13,52,'LWB'],[35,52,'CM'],[50,60,'DM'],[65,52,'CM'],[87,52,'RWB'],[38,20,'ST'],[62,20,'ST']],
  '5-4-1': [[50,89,'GK'],[13,66,'LWB'],[30,76,'CB'],[50,80,'CB'],[70,76,'CB'],[87,66,'RWB'],[18,45,'LM'],[40,51,'CM'],[60,51,'CM'],[82,45,'RM'],[50,17,'ST']],
}

const roleOptions = (position: string) => position === 'GK'
  ? ['Guardameta', 'Portero adelantado']
  : position.includes('B')
    ? ['Defensa', 'Constructor', 'Lateral profundo']
    : position.includes('M')
      ? ['Ancla', 'Organizador', 'Llegador']
      : ['Apoyo', 'Ataque', 'Delantero móvil']

function smartLineup(players: UIPlayer[], slots: Array<[number, number, string]>): string[] {
  const used = new Set<string>()
  return slots.map(([, , target]) => {
    const candidate = players.filter((player) => !used.has(player.id)).map((player) => {
      const compatible = positionSuitability(player, target as Position) / 100
      return { player, score: playerOverall(player) * compatible }
    }).sort((left,right)=>right.score-left.score||left.player.id.localeCompare(right.player.id))[0]?.player
    if (!candidate) return ''
    used.add(candidate.id)
    return candidate.id
  })
}

export function Tactics() {
  const { campaign, updateCampaign } = useGame()
  const { players } = currentData()
  const squad = players.filter((player) => campaign.squadIds.includes(player.id))
  const [formation, setFormation] = useState(formationSlots[campaign.tactic] ? campaign.tactic : '4-3-3')
  const [mentality, setMentality] = useState(campaign.mentality)
  const [lineup, setLineup] = useState<string[]>(() => {
    const activeFormation = formationSlots[campaign.tactic] ? campaign.tactic : '4-3-3'
    const automatic = smartLineup(squad, formationSlots[activeFormation]!)
    return formationSlots[activeFormation]!.map((_, index) => campaign.tacticSettings.positions[`${activeFormation}:${index}`]?.playerId ?? automatic[index] ?? '')
  })
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [mode, setMode] = useState<'lineup' | 'possession' | 'defence' | 'setpieces'>('lineup')
  const [benchPage, setBenchPage] = useState(0)
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null)
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; position: string; rating: number } | null>(null)
  const [width, setWidth] = useState(campaign.tacticSettings.width)
  const [tempo, setTempo] = useState(campaign.tacticSettings.tempo)
  const [press, setPress] = useState(campaign.tacticSettings.pressing)
  const [line, setLine] = useState(campaign.tacticSettings.defensiveLine)
  const [passingDirectness, setPassingDirectness] = useState(campaign.tacticSettings.passingDirectness)
  const [transition, setTransition] = useState(campaign.tacticSettings.transition)
  const [marking, setMarking] = useState(campaign.tacticSettings.marking)
  const [positions, setPositions] = useState(campaign.tacticSettings.positions)
  const [roles, setRoles] = useState(campaign.tacticSettings.roles)
  const [instructions, setInstructions] = useState(campaign.tacticSettings.instructions)
  const [saved, setSaved] = useState(false)
  const pitchRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slots = formationSlots[formation]
  const updateAdvanced = <K extends keyof CampaignUIState['tacticSettings']>(key: K, value: CampaignUIState['tacticSettings'][K]) => {
    updateCampaign((current) => ({ ...current, tacticSettings: { ...current.tacticSettings, [key]: value } }))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1200)
  }

  const responsibilityRanking = (field: 'captainId' | 'penaltyTakerId' | 'cornerTakerId' | 'freeKickTakerId') => [...squad].sort((left, right) => {
    const score = (player: UIPlayer) => field === 'captainId'
      ? playerCaps(player) * .55 + (player.gameRatings.teamwork ?? playerOverall(player)) * .28 + (player.gameRatings.decisions ?? playerOverall(player)) * .17
      : field === 'penaltyTakerId'
        ? (player.position === 'GK' ? -100 : 0) + (player.gameRatings.finishing ?? playerOverall(player)) * .55 + (player.gameRatings.composure ?? playerOverall(player)) * .45
        : (player.position === 'GK' ? -100 : 0) + (player.gameRatings.passing ?? playerOverall(player)) * .52 + (player.gameRatings.technique ?? playerOverall(player)) * .48
    return score(right) - score(left) || left.id.localeCompare(right.id)
  })
  const recommendedResponsibility = (field: 'captainId' | 'penaltyTakerId' | 'cornerTakerId' | 'freeKickTakerId') => responsibilityRanking(field)[0]

  // --- Auto-save: persist to campaign on any meaningful change ---
  const autoSave = (overrides?: {
    formationOverride?: string
    mentalityOverride?: string
    positionsOverride?: typeof positions
    rolesOverride?: typeof roles
    dutiesOverride?: CampaignUIState['tacticSettings']['duties']
    instructionsOverride?: string[]
    widthOverride?: number
    tempoOverride?: number
    pressOverride?: number
    lineOverride?: number
    passingOverride?: number
    transitionOverride?: typeof transition
    markingOverride?: typeof marking
    lineupOverride?: string[]
  }) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const f = overrides?.formationOverride ?? formation
      const m = overrides?.mentalityOverride ?? mentality
      const p = overrides?.positionsOverride ?? positions
      const r = overrides?.rolesOverride ?? roles
      const ins = overrides?.instructionsOverride ?? instructions
      const lu = overrides?.lineupOverride ?? lineup
      const currentSlots = formationSlots[f]
      const persistedPositions = { ...p }
      currentSlots?.forEach(([defaultX, defaultY], index) => {
        const key = `${f}:${index}`
        persistedPositions[key] = { x: p[key]?.x ?? defaultX, y: p[key]?.y ?? defaultY, playerId: lu[index] }
      })
      updateCampaign((current) => ({
        ...current,
        tactic: f,
        mentality: m,
        captainId: current.captainId ?? recommendedResponsibility('captainId')?.id,
        penaltyTakerId: current.penaltyTakerId ?? recommendedResponsibility('penaltyTakerId')?.id,
        cornerTakerId: current.cornerTakerId ?? recommendedResponsibility('cornerTakerId')?.id,
        freeKickTakerId: current.freeKickTakerId ?? recommendedResponsibility('freeKickTakerId')?.id,
        decisionLog: current.decisionLog.some((item) => item.key === 'tactic:first-plan') ? current.decisionLog : [...current.decisionLog, { key: 'tactic:first-plan', type: 'tactic' as const, label: `${f} · ${m}`, effects: { tacticalFamiliarity: 2 }, madeAt: current.date }],
        tacticalFamiliarity: current.decisionLog.some((item) => item.key === 'tactic:first-plan') ? current.tacticalFamiliarity : Math.min(100, current.tacticalFamiliarity + 2),
        tacticSettings: {
          ...current.tacticSettings,
          width: overrides?.widthOverride ?? width,
          tempo: overrides?.tempoOverride ?? tempo,
          pressing: overrides?.pressOverride ?? press,
          defensiveLine: overrides?.lineOverride ?? line,
          passingDirectness: overrides?.passingOverride ?? passingDirectness,
          transition: overrides?.transitionOverride ?? transition,
          marking: overrides?.markingOverride ?? marking,
          positions: persistedPositions,
          roles: r,
          duties: overrides?.dutiesOverride ?? current.tacticSettings.duties,
          instructions: ins,
        },
      }))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
    }, 350)
  }

  // Auto-save on first mount if no tactic decision exists yet
  useEffect(() => {
    if (!campaign.decisionLog.some((item) => item.type === 'tactic')) {
      autoSave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const swap = (from: number, to: number) => {
    setLineup((current) => {
      const next = [...current]; [next[from], next[to]] = [next[to], next[from]]
      autoSave({ lineupOverride: next })
      return next
    })
  }

  // --- Direct drag on player (pointer-based) ---
  const handlePitchPointerMove = (event: React.PointerEvent) => {
    if (draggingSlot === null || !pitchRef.current) return
    const rect = pitchRef.current.getBoundingClientRect()
    const x = Math.max(7, Math.min(93, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(8, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100))
    const pos = inferTacticalPosition(x, y)
    const player = squad.find((item) => item.id === lineup[draggingSlot])
    const role = roles[`${formation}:${draggingSlot}`] ?? roleOptionsExpanded(pos)[0]
    const duty = campaign.tacticSettings.duties[`${formation}:${draggingSlot}`] ?? 'support'
    const rating = player ? assessTacticalPlayer(player, x, y, campaign.tacticalFamiliarity, role, duty).effectiveRating : 0
    setDragPreview({ x, y, position: pos, rating })
    setPositions((current) => ({ ...current, [`${formation}:${draggingSlot}`]: { ...current[`${formation}:${draggingSlot}`], x, y, playerId: lineup[draggingSlot] } }))
  }

  const handlePitchPointerUp = () => {
    if (draggingSlot !== null) {
      autoSave()
      setDraggingSlot(null)
      setDragPreview(null)
    }
  }

  // --- Click-to-place: click pitch to move selected player ---
  const handlePitchClick = (event: React.MouseEvent) => {
    if (selectedSlot === null || draggingSlot !== null || !pitchRef.current) return
    const rect = pitchRef.current.getBoundingClientRect()
    const x = Math.max(7, Math.min(93, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(8, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100))
    setPositions((current) => {
      const next = { ...current, [`${formation}:${selectedSlot}`]: { ...current[`${formation}:${selectedSlot}`], x, y, playerId: lineup[selectedSlot] } }
      autoSave({ positionsOverride: next })
      return next
    })
  }

  const cycleRole = (index: number, position: string) => {
    const key = `${formation}:${index}`
    const options = roleOptionsExpanded(position)
    const current = roles[key] ?? options[0]
    const nextRole = options[(options.indexOf(current) + 1) % options.length]!
    setRoles((value) => {
      const next = { ...value, [key]: nextRole }
      autoSave({ rolesOverride: next })
      return next
    })
  }

  const cycleDuty = (index: number) => {
    const key = `${formation}:${index}`
    const order: Array<'defend' | 'support' | 'attack'> = ['defend', 'support', 'attack']
    const currentDuty = campaign.tacticSettings.duties[key] ?? 'support'
    const next = { ...campaign.tacticSettings.duties, [key]: order[(order.indexOf(currentDuty) + 1) % order.length]! }
    updateAdvanced('duties', next)
  }

  const putInLineup = (playerId: string) => {
    if (selectedSlot === null) return
    setLineup((current) => {
      const next = [...current]
      const existing = next.indexOf(playerId)
      if (existing >= 0) [next[existing], next[selectedSlot]] = [next[selectedSlot], next[existing]]
      else next[selectedSlot] = playerId
      autoSave({ lineupOverride: next })
      return next
    })
  }

  const toggleInstruction = (instruction: string) => {
    setInstructions((current) => {
      const next = current.includes(instruction) ? current.filter((item) => item !== instruction) : [...current, instruction]
      autoSave({ instructionsOverride: next })
      return next
    })
  }

  const cycleResponsibility = (field: 'captainId' | 'penaltyTakerId' | 'cornerTakerId' | 'freeKickTakerId') => {
    if (!squad.length) return
    const ranked = responsibilityRanking(field)
    const currentIndex = ranked.findIndex((player) => player.id === campaign[field])
    const next = ranked[(currentIndex + 1) % ranked.length]!
    updateCampaign({ [field]: next.id } as Partial<CampaignUIState>)
  }

  const responsibilityName = (field: 'captainId' | 'penaltyTakerId' | 'cornerTakerId' | 'freeKickTakerId') =>
    squad.find((player) => player.id === campaign[field])?.shirtName ?? recommendedResponsibility(field)?.shirtName ?? 'Sin asignar'

  const selectedPlayer = selectedSlot !== null ? squad.find((player) => player.id === lineup[selectedSlot]) : undefined
  const benchPlayers = squad.filter((player) => !lineup.includes(player.id))
  const benchPages = Math.max(1, Math.ceil(benchPlayers.length / 6))
  const selectedDefault = selectedSlot !== null ? (slots[selectedSlot] ?? slots[0]!) : slots[0]!
  const selectedPosition = selectedSlot !== null ? positions[`${formation}:${selectedSlot}`] : undefined
  const selectedTarget = inferTacticalPosition(selectedPosition?.x ?? selectedDefault[0], selectedPosition?.y ?? selectedDefault[1])
  const selectedSuitability = selectedPlayer ? positionSuitability(selectedPlayer, selectedTarget) : 0
  const selectedKey = selectedSlot !== null ? `${formation}:${selectedSlot}` : `${formation}:0`
  const selectedRole = roles[selectedKey] ?? roleOptionsExpanded(selectedTarget)[0]
  const selectedDuty = campaign.tacticSettings.duties[selectedKey] ?? 'support'
  const selectedAssessment = selectedPlayer ? assessTacticalPlayer(selectedPlayer, selectedPosition?.x ?? selectedDefault[0], selectedPosition?.y ?? selectedDefault[1], campaign.tacticalFamiliarity, selectedRole, selectedDuty) : undefined
  const selectedEffective = selectedAssessment?.effectiveRating ?? 0
  const unitRating = Math.round(slots.reduce((total, [x, y], index) => {
    const player = squad.find((item) => item.id === lineup[index])
    const custom = positions[`${formation}:${index}`]
    const pointX = custom?.x ?? x
    const pointY = custom?.y ?? y
    const key = `${formation}:${index}`
    const position = inferTacticalPosition(pointX, pointY)
    return total + (player ? assessTacticalPlayer(player, pointX, pointY, campaign.tacticalFamiliarity, roles[key] ?? roleOptionsExpanded(position)[0], campaign.tacticSettings.duties[key] ?? 'support').effectiveRating : 0)
  }, 0) / Math.max(1, slots.length))
  const shapeAssessment = assessTacticalShape(slots.map(([x, y], index) => {
    const custom = positions[`${formation}:${index}`]
    const point = { x: custom?.x ?? x, y: custom?.y ?? y }
    return { ...point, position: inferTacticalPosition(point.x, point.y) }
  }))
  const tacticAdvice = buildAssistantAdvice(campaign, 'tactics')

  // Line chemistry per unit
  const lineChemistry = (unit: 'DEF' | 'MED' | 'ATK') => {
    const indices = slots.map(([x, y], i) => {
      const custom = positions[`${formation}:${i}`]
      const pos = inferTacticalPosition(custom?.x ?? x, custom?.y ?? y)
      const isDefence = ['GK', 'RB', 'RCB', 'CB', 'LCB', 'LB', 'RWB', 'LWB'].includes(pos)
      const isAttack = ['RW', 'LW', 'SS', 'ST', 'AM'].includes(pos)
      return unit === 'DEF' ? isDefence : unit === 'ATK' ? isAttack : !isDefence && !isAttack
    })
    const lineRatings = indices.map((inUnit, i) => {
      if (!inUnit) return null
      const player = squad.find((item) => item.id === lineup[i])
      if (!player) return null
      const custom = positions[`${formation}:${i}`]
      return effectivePositionRating(player, inferTacticalPosition(custom?.x ?? slots[i]![0], custom?.y ?? slots[i]![1]))
    }).filter((v): v is number => v !== null)
    return lineRatings.length ? Math.round(lineRatings.reduce((s, v) => s + v, 0) / lineRatings.length) : 0
  }

  const applyQuickPlan = (plan: 'recommended' | 'protect' | 'balance' | 'chase') => {
    const config = plan === 'protect'
      ? { mentality: 'Cauta', tempo: 40, press: 44, line: 38, width: 50, passing: 38, block: 'low' as const, loss: 'regroup' as const, gain: 'balanced' as const, waste: 62 }
      : plan === 'chase'
        ? { mentality: 'Ofensiva', tempo: 84, press: 86, line: 76, width: 72, passing: 66, block: 'high' as const, loss: 'counter-press' as const, gain: 'counter' as const, waste: 0 }
        : { mentality: 'Equilibrada', tempo: 62, press: 66, line: 58, width: 58, passing: 46, block: 'mid' as const, loss: 'counter-press' as const, gain: 'balanced' as const, waste: 12 }
    setMentality(config.mentality); setTempo(config.tempo); setPress(config.press); setLine(config.line); setWidth(config.width); setPassingDirectness(config.passing)
    updateCampaign((current) => ({
      ...current,
      mentality: config.mentality,
      tacticSettings: { ...current.tacticSettings, tempo: config.tempo, pressing: config.press, defensiveLine: config.line, width: config.width, passingDirectness: config.passing, defensiveBlock: config.block, lossTransition: config.loss, gainTransition: config.gain, timeWasting: config.waste },
    }))
    setSaved(true); window.setTimeout(() => setSaved(false), 1200)
  }

  return (
    <div className="tactics-page-v2 page-enter">
      {!campaign.prologueComplete && <SceneAssistant advice={tacticAdvice} step={4} />}

      {/* TOP BAR: Formation, Mentality, Quick Plans */}
      <div className="tactics-topbar">
        <nav className="tactics-mode-nav" aria-label="Modo táctico">
          <button className={mode === 'lineup' ? 'is-active' : ''} onClick={() => setMode('lineup')}>ALINEACIÓN</button>
          <button className={mode === 'possession' ? 'is-active' : ''} onClick={() => setMode('possession')}>CON BALÓN</button>
          <button className={mode === 'defence' ? 'is-active' : ''} onClick={() => setMode('defence')}>SIN BALÓN</button>
          <button className={mode === 'setpieces' ? 'is-active' : ''} onClick={() => setMode('setpieces')}>BALÓN PARADO</button>
        </nav>
        <div className="tactics-topbar__formation">
          <span>FORMACIÓN</span>
          <select value={formation} onChange={(event) => { const next = event.target.value; setFormation(next); const newLineup = smartLineup(squad, formationSlots[next]!); setLineup(newLineup); setSelectedSlot(null); autoSave({ formationOverride: next, lineupOverride: newLineup }) }}>
            {Object.keys(formationSlots).map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="tactics-topbar__mentality">
          <span>MENTALIDAD</span>
          <Segmented value={mentality} onChange={(v) => { setMentality(v); autoSave({ mentalityOverride: v }) }} options={['Cauta', 'Equilibrada', 'Positiva', 'Ofensiva']} label="Mentalidad" />
        </div>
        <div className="tactics-topbar__plans">
          <button className="is-recommended" onClick={() => applyQuickPlan('recommended')}><Sparkles /> Recomendada</button>
          <button onClick={() => applyQuickPlan('protect')}><Shield /> Proteger</button>
          <button className={mentality === 'Equilibrada' ? 'is-active' : ''} onClick={() => applyQuickPlan('balance')}><CircleDot /> Equilibrar</button>
          <button onClick={() => applyQuickPlan('chase')}><Zap /> Remontar</button>
        </div>
        <div className="tactics-topbar__save">
          <span className={`save-indicator ${saved ? 'is-saved' : ''}`}>{saved ? <><Check /> GUARDADO</> : <><ClipboardCheck /> AUTO-SAVE</>}</span>
        </div>
      </div>

      {/* MAIN LAYOUT: 3 columns */}
      <div className="tactics-layout-v2">
        {/* LEFT: Tactic Controls */}
        <aside className="tactic-controls-v2">
          {mode === 'lineup' && <>
            <header><span className="eyebrow">ALINEACIÓN</span><h3>Once, rol y deber</h3></header>
            <p className="tactic-mode-help">Arrastra cualquier camiseta. El motor detecta la demarcación exacta y recalcula el rendimiento.</p>
            {selectedPlayer ? <div className="selected-player-controls">
              <b>{selectedPlayer.shirtName}</b><span>{selectedTarget} · {selectedEffective} efectivo</span>
              <button onClick={() => selectedSlot !== null && cycleRole(selectedSlot, selectedTarget)}>ROL <strong>{selectedRole}</strong><ChevronRight/></button>
              <button onClick={() => selectedSlot !== null && cycleDuty(selectedSlot)}>DEBER <strong>{selectedDuty === 'defend' ? 'Defensa' : selectedDuty === 'attack' ? 'Ataque' : 'Apoyo'}</strong><ChevronRight/></button>
              {['mantener posición','marcar más','arriesgar pases'].map((instruction) => { const active = (campaign.tacticSettings.playerInstructions[selectedKey] ?? []).includes(instruction); return <button key={instruction} className={active ? 'is-active' : ''} onClick={() => { const current = campaign.tacticSettings.playerInstructions[selectedKey] ?? []; updateAdvanced('playerInstructions', { ...campaign.tacticSettings.playerInstructions, [selectedKey]: active ? current.filter((item)=>item!==instruction) : [...current,instruction] }) }}>{active ? <Check/> : <Plus/>}{instruction}</button> })}
            </div> : <div className="tactic-select-prompt tactic-select-prompt--overview">
              <Move/>
              <b>Plan recomendado activo</b>
              <span>El once ya puede competir. Selecciona una camiseta para afinar su posición, rol y deber.</span>
              <div className="tactic-default-readout">
                <span><strong>{unitRating}</strong><small>NIVEL DEL ONCE</small></span>
                <span><strong>{campaign.tacticalFamiliarity}%</strong><small>FAMILIARIDAD</small></span>
              </div>
            </div>}
          </>}
          {mode === 'possession' && <>
            <header><span className="eyebrow">CON BALÓN</span><h3>Construcción y ataque</h3></header>
            <TacticSliderV2 label="Amplitud" left="Estrecha" right="Amplia" value={width} setValue={(v) => { setWidth(v); autoSave({ widthOverride: v }) }} />
            <TacticSliderV2 label="Ritmo" left="Paciente" right="Vertiginoso" value={tempo} setValue={(v) => { setTempo(v); autoSave({ tempoOverride: v }) }} />
            <TacticSliderV2 label="Riesgo de pase" left="Seguro" right="Agresivo" value={campaign.tacticSettings.passingRisk} setValue={(v) => updateAdvanced('passingRisk', v)} />
            <TacticSliderV2 label="Pase vertical" left="Combinativo" right="Directo" value={passingDirectness} setValue={(v) => { setPassingDirectness(v); autoSave({ passingOverride: v }) }} />
            <TacticSliderV2 label="Libertad creativa" left="Disciplinada" right="Expresiva" value={campaign.tacticSettings.creativeFreedom} setValue={(v) => updateAdvanced('creativeFreedom', v)} />
            <AdvancedSelect label="SALIDA" value={campaign.tacticSettings.buildUp} options={[['short','Corta'],['balanced','Mixta'],['direct','Directa']]} onChange={(value)=>updateAdvanced('buildUp', value as CampaignUIState['tacticSettings']['buildUp'])}/>
            <AdvancedSelect label="CENTROS" value={campaign.tacticSettings.crossing} options={[['low','Rasos'],['mixed','Mixtos'],['aerial','Aéreos']]} onChange={(value)=>updateAdvanced('crossing', value as CampaignUIState['tacticSettings']['crossing'])}/>
            <AdvancedSelect label="REGATE" value={campaign.tacticSettings.dribbling} options={[['safe','Conservar'],['balanced','Equilibrado'],['expressive','Encara']]} onChange={(value)=>updateAdvanced('dribbling', value as CampaignUIState['tacticSettings']['dribbling'])}/>
            <AdvancedSelect label="TRAS RECUPERAR" value={campaign.tacticSettings.gainTransition} options={[['hold','Mantener'],['balanced','Leer jugada'],['counter','Contraatacar']]} onChange={(value)=>updateAdvanced('gainTransition', value as CampaignUIState['tacticSettings']['gainTransition'])}/>
            <AdvancedSelect label="PORTERO" value={campaign.tacticSettings.goalkeeperDistribution} options={[['short','Salida corta'],['wide','A banda'],['long','Largo']]} onChange={(value)=>updateAdvanced('goalkeeperDistribution', value as CampaignUIState['tacticSettings']['goalkeeperDistribution'])}/>
          </>}
          {mode === 'defence' && <>
            <header><span className="eyebrow">SIN BALÓN</span><h3>Bloque y presión</h3></header>
            <TacticSliderV2 label="Presión" left="Contener" right="Asfixiante" value={press} setValue={(v) => { setPress(v); autoSave({ pressOverride: v }) }} />
            <TacticSliderV2 label="Altura defensiva" left="Baja" right="Alta" value={line} setValue={(v) => { setLine(v); autoSave({ lineOverride: v }) }} />
            <TacticSliderV2 label="Pérdida de tiempo" left="Nunca" right="Máxima" value={campaign.tacticSettings.timeWasting} setValue={(v) => updateAdvanced('timeWasting', v)} />
            <AdvancedSelect label="BLOQUE" value={campaign.tacticSettings.defensiveBlock} options={[['low','Bajo'],['mid','Medio'],['high','Alto']]} onChange={(value)=>updateAdvanced('defensiveBlock', value as CampaignUIState['tacticSettings']['defensiveBlock'])}/>
            <AdvancedSelect label="MARCAJE" value={marking} options={[['zonal','Zonal'],['mixed','Mixto'],['player','Individual']]} onChange={(value)=>{ const v=value as typeof marking;setMarking(v);autoSave({markingOverride:v}) }}/>
            <AdvancedSelect label="TRAMPA DE PRESIÓN" value={campaign.tacticSettings.pressingTrap} options={[['outside','Llevar fuera'],['inside','Llevar dentro'],['balanced','Sin trampa']]} onChange={(value)=>updateAdvanced('pressingTrap', value as CampaignUIState['tacticSettings']['pressingTrap'])}/>
            <AdvancedSelect label="TRAS PÉRDIDA" value={campaign.tacticSettings.lossTransition} options={[['regroup','Reagrupar'],['balanced','Equilibrar'],['counter-press','Contrapresión']]} onChange={(value)=>updateAdvanced('lossTransition', value as CampaignUIState['tacticSettings']['lossTransition'])}/>
            <button className={`tactic-toggle-wide ${campaign.tacticSettings.offsideTrap ? 'is-active' : ''}`} onClick={()=>updateAdvanced('offsideTrap', !campaign.tacticSettings.offsideTrap)}>{campaign.tacticSettings.offsideTrap ? <Check/> : <Plus/>} TRAMPA DEL FUERA DE JUEGO</button>
          </>}
          {mode === 'setpieces' && <>
            <header><span className="eyebrow">BALÓN PARADO</span><h3>Responsables y rutinas</h3></header>
            <div className="setpiece-orders">
              <button onClick={() => cycleResponsibility('captainId')}><CircleDot/><span>CAPITÁN<b>{responsibilityName('captainId')}</b></span><ChevronRight/></button>
              <button onClick={() => cycleResponsibility('penaltyTakerId')}><Goal/><span>PENALTIS · ORDEN 1<b>{responsibilityName('penaltyTakerId')}</b></span><ChevronRight/></button>
              <button onClick={() => cycleResponsibility('freeKickTakerId')}><Target/><span>FALTAS DIRECTAS<b>{responsibilityName('freeKickTakerId')}</b></span><ChevronRight/></button>
              <button onClick={() => cycleResponsibility('cornerTakerId')}><FlagIcon/><span>CÓRNERS IZQ./DER.<b>{responsibilityName('cornerTakerId')}</b></span><ChevronRight/></button>
            </div>
            <AdvancedSelect label="RUTINA OFENSIVA" value={campaign.tacticSettings.setPieces.attackingRoutine} options={[['near-post','Primer palo'],['far-post','Segundo palo'],['crowd-keeper','Bloquear portero'],['short','En corto']]} onChange={(value)=>updateAdvanced('setPieces',{...campaign.tacticSettings.setPieces,attackingRoutine:value as CampaignUIState['tacticSettings']['setPieces']['attackingRoutine']})}/>
            <AdvancedSelect label="RUTINA DEFENSIVA" value={campaign.tacticSettings.setPieces.defensiveRoutine} options={[['zonal','Zonal'],['mixed','Mixta'],['player','Individual']]} onChange={(value)=>updateAdvanced('setPieces',{...campaign.tacticSettings.setPieces,defensiveRoutine:value as CampaignUIState['tacticSettings']['setPieces']['defensiveRoutine']})}/>
            <p className="tactic-mode-help">El orden de cinco lanzadores se completa automáticamente por finalización, compostura y técnica. Puedes rotar el primero desde cada responsabilidad.</p>
          </>}
        </aside>

        {/* CENTER: Vertical Pitch */}
        <section className="tactic-board-v2">
          <div className="tactic-board-v2__header"><span><span className="live-dot" /> ONCE TITULAR</span><small>Pulsa un jugador y arrastra para mover · {formation}</small></div>
          <div
            className="tactic-pitch-v2"
            ref={pitchRef}
            onPointerMove={handlePitchPointerMove}
            onPointerUp={handlePitchPointerUp}
            onClick={handlePitchClick}
          >
            {/* Pitch markings */}
            <div className="pitch-markings-v2">
              <i className="pm-v2__outline" />
              <i className="pm-v2__half" />
              <i className="pm-v2__circle" />
              <i className="pm-v2__box pm-v2__box--top" />
              <i className="pm-v2__box pm-v2__box--bottom" />
              <i className="pm-v2__penalty-spot pm-v2__penalty-spot--top" />
              <i className="pm-v2__penalty-spot pm-v2__penalty-spot--bottom" />
              <i className="pm-v2__center-spot" />
            </div>

            {/* Drag preview zone indicator */}
            {dragPreview && (
              <div className="drag-zone-indicator" style={{ left: `${dragPreview.x}%`, top: `${dragPreview.y}%` }}>
                <span className="drag-zone-indicator__pos">{dragPreview.position}</span>
                <span className={`drag-zone-indicator__rating ${dragPreview.rating >= 80 ? 'is-great' : dragPreview.rating >= 70 ? 'is-ok' : 'is-poor'}`}>{dragPreview.rating}</span>
              </div>
            )}

            {/* Players */}
            {slots.map(([x, y], index) => {
              const player = squad.find((item) => item.id === lineup[index])
              const key = `${formation}:${index}`
              const custom = positions[key]
              const dynamicPosition = inferTacticalPosition(custom?.x ?? x, custom?.y ?? y)
              const suitability = player ? positionSuitability(player, dynamicPosition) : 0
              const role = roles[key] ?? roleOptionsExpanded(dynamicPosition)[0]
              const duty = campaign.tacticSettings.duties[key] ?? 'support'
              const assessment = player ? assessTacticalPlayer(player, custom?.x ?? x, custom?.y ?? y, campaign.tacticalFamiliarity, role, duty) : undefined
              const effective = assessment?.effectiveRating ?? 0
              const isDragging = draggingSlot === index
              return (
                <div
                  key={`${formation}-${index}`}
                  className={`tactic-player-v2 ${isDragging ? 'is-dragging' : ''} ${selectedSlot === index ? 'is-selected' : ''} ${suitability < 60 ? 'is-out-of-position' : suitability < 90 ? 'is-adapting' : 'is-natural'}`}
                  style={{ left: `${Math.max(7, Math.min(93, custom?.x ?? x))}%`, top: `${Math.max(8, Math.min(92, custom?.y ?? y))}%` }}
                  onClick={(event) => { event.stopPropagation(); setSelectedSlot(index) }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    setDraggingSlot(index)
                    setSelectedSlot(index)
                  }}
                >
                  <span className={`tp-v2__rating ${suitability >= 90 ? 'is-natural' : suitability >= 60 ? 'is-adapting' : 'is-risk'}`}>{effective || '—'}</span>
                  <TeamShirt nationId={player?.nationId ?? campaign.nationId} number={player ? (campaign.shirtNumbers[player.id] ?? index + 1) : index + 1} label={player?.shirtName} className="tp-v2__shirt" />
                  <span className="tp-v2__name">{player?.shirtName ?? 'Elegir'}</span>
                  <button className="tp-v2__role" onClick={(event) => { event.stopPropagation(); cycleRole(index, dynamicPosition) }}>{dynamicPosition} · {duty === 'defend' ? 'DEF' : duty === 'attack' ? 'ATA' : 'APO'} <ChevronDown /></button>
                </div>
              )
            })}

          </div>
          {/* Intensity is a real footer, never an overlay over the goalkeeper. */}
          <div className="tactic-intensity-v2">
            <span>INTENSIDAD</span>
            <div><i style={{ width: `${Math.round((tempo + press) / 2)}%` }} /></div>
            <b>{Math.round((tempo + press) / 2)}%</b>
          </div>
        </section>

        {/* RIGHT: Motor Posicional + Bench + Responsibilities */}
        <aside className={`lineup-panel-v2 mode-${mode}`}>
          {/* Motor Posicional */}
          <section className="motor-posicional-v2">
            <span className="eyebrow"><Brain /> MOTOR POSICIONAL</span>
            <div className="motor-unit-rating">
              <strong>{unitRating}</strong>
              <span><b>Índice del once</b><small>Rendimiento efectivo en esta estructura</small></span>
            </div>

            {/* Line chemistry */}
            <div className="line-chemistry">
              <div><small>DEF</small><b>{lineChemistry('DEF')}</b><i style={{ width: `${lineChemistry('DEF')}%` }} /></div>
              <div><small>MED</small><b>{lineChemistry('MED')}</b><i style={{ width: `${lineChemistry('MED')}%` }} /></div>
              <div><small>ATK</small><b>{lineChemistry('ATK')}</b><i style={{ width: `${lineChemistry('ATK')}%` }} /></div>
            </div>

            {/* Selected player detail */}
            {selectedPlayer ? <article className="player-tactical-detail">
              <header><b>{selectedPlayer.shirtName}</b><em>{selectedTarget}</em></header>
              <div className="ptd-stats">
                <span><small>Nivel base</small><b>{playerOverall(selectedPlayer)}</b></span>
                <span><small>Nivel efectivo</small><b className={selectedEffective < playerOverall(selectedPlayer) ? 'is-negative' : 'is-positive'}>{playerOverall(selectedPlayer)} → {selectedEffective}</b></span>
                <span><small>Encaje</small><b>{selectedSuitability}%</b></span>
              </div>
              {selectedAssessment && <div className="rating-breakdown">{selectedAssessment.breakdown.map((item)=><span key={item.label}><small>{item.label}</small><b className={item.value < 0 ? 'is-negative' : 'is-positive'}>{item.value > 0 ? '+' : ''}{item.value}</b></span>)}</div>}
              <div className="ptd-attributes">
                <div><small>TEC</small><b>{selectedPlayer.gameRatings.technical ?? playerOverall(selectedPlayer)}</b></div>
                <div><small>FIS</small><b>{selectedPlayer.gameRatings.physical ?? playerOverall(selectedPlayer)}</b></div>
                <div><small>MEN</small><b>{selectedPlayer.gameRatings.mental ?? playerOverall(selectedPlayer)}</b></div>
                <div><small>PAS</small><b>{selectedPlayer.gameRatings.passing ?? playerOverall(selectedPlayer)}</b></div>
                <div><small>TIR</small><b>{selectedPlayer.gameRatings.finishing ?? playerOverall(selectedPlayer)}</b></div>
                <div><small>DEF</small><b>{selectedPlayer.gameRatings.defending ?? (selectedPlayer.gameRatings as Record<string, number | undefined>).positioning ?? playerOverall(selectedPlayer)}</b></div>
              </div>
              <small className="ptd-fit">{tacticalFitLabel(selectedSuitability)} · {selectedSuitability < 60 ? 'perderá referencias y eficacia' : selectedSuitability < 90 ? 'necesita automatismos para rendir' : 'zona compatible con sus hábitos'}</small>
            </article> : <p className="motor-hint">Selecciona un futbolista para ver su análisis.</p>}

            {/* Shape diagnosis */}
            <div className="shape-diagnosis-v2">
              <span><b>ESTRUCTURA {shapeAssessment.score}</b><small>Amplitud {shapeAssessment.width} · Balance {shapeAssessment.verticalBalance}</small></span>
              {shapeAssessment.warnings.length ? <ul>{shapeAssessment.warnings.map((warning) => <li key={warning}><ShieldAlert />{warning}</li>)}</ul> : <p><CheckCircle2 /> Estructura equilibrada y líneas conectadas.</p>}
            </div>
          </section>

          {/* Bench */}
          <header className="bench-header-v2"><span className="eyebrow">BANQUILLO</span><nav><button disabled={benchPage===0} onClick={()=>setBenchPage((page)=>Math.max(0,page-1))}><ChevronLeft/></button><b>{benchPage+1}/{benchPages}</b><button disabled={benchPage>=benchPages-1} onClick={()=>setBenchPage((page)=>Math.min(benchPages-1,page+1))}><ChevronRight/></button></nav></header>
          <div className="bench-list-v2">
            {benchPlayers.slice(benchPage*6,benchPage*6+6).map((player) => (
              <div key={player.id} className="bench-item-v2">
                <span className="bench-item-v2__pos">{player.position}</span>
                <span className="bench-item-v2__name">{player.shirtName}{starProfile(player) && <Star className="bench-star" />}</span>
                <b className="bench-item-v2__ovr">{playerOverall(player)}</b>
                <button title={`Colocar en el once`} onClick={() => putInLineup(player.id)}><Plus /></button>
              </div>
            ))}
          </div>

          {/* Responsibilities */}
          <div className={`set-pieces-v2 ${mode === 'setpieces' ? 'is-focused' : ''}`}>
            <span className="eyebrow">RESPONSABILIDADES</span>
            <button onClick={() => cycleResponsibility('captainId')}><CircleDot /><span><b>Capitán</b><small>{responsibilityName('captainId')}</small></span><ChevronRight /></button>
            <button onClick={() => cycleResponsibility('penaltyTakerId')}><Goal /><span><b>Penaltis</b><small>{responsibilityName('penaltyTakerId')}</small></span><ChevronRight /></button>
            <button onClick={() => cycleResponsibility('cornerTakerId')}><FlagIcon /><span><b>Córners</b><small>{responsibilityName('cornerTakerId')}</small></span><ChevronRight /></button>
            <button onClick={() => cycleResponsibility('freeKickTakerId')}><Target /><span><b>Faltas</b><small>{responsibilityName('freeKickTakerId')}</small></span><ChevronRight /></button>
          </div>
        </aside>
      </div>
    </div>
  )
}

const roleOptionsExpanded = (position: string) => position === 'GK'
  ? ['Guardameta', 'Portero libero', 'Portero adelantado']
  : position.includes('B') || position.includes('WB')
    ? ['Defensa', 'Constructor', 'Lateral profundo', 'Carrilero', 'Lateral invertido']
    : ['DM', 'RCM', 'CM', 'LCM'].includes(position)
      ? ['Ancla', 'Organizador', 'Box-to-Box', 'Llegador', 'Pivote defensivo', 'Regista']
      : ['RM', 'LM'].includes(position)
        ? ['Banda', 'Interior invertido', 'Carrilero', 'Volante']
        : ['AM', 'SS'].includes(position)
          ? ['Enganche', 'Media punta', 'Falso 9', 'Enlace']
          : ['RW', 'LW'].includes(position)
            ? ['Extremo', 'Extremo invertido', 'Regate', 'Interior']
            : ['Delantero centro', 'Falso 9', 'Referencia', 'Depredador', 'Delantero móvil']

function TacticSliderV2({ label, left, right, value, setValue }: { label: string; left: string; right: string; value: number; setValue: (value: number) => void }) {
  return <label className="tactic-slider-v2"><span><b>{label}</b><strong>{value}</strong></span><input type="range" min="0" max="100" value={value} onChange={(event) => setValue(Number(event.target.value))} /><small><i>{left}</i><i>{right}</i></small></label>
}

function AdvancedSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="advanced-select"><span>{label}</span><select value={value} onChange={(event)=>onChange(event.target.value)}>{options.map(([option,labelText])=><option key={option} value={option}>{labelText}</option>)}</select></label>
}

const trainingOptions = [
  { name: 'Recuperación', icon: BatteryCharging, impact: 'Condición +4', load: 'Baja', color: 'green' },
  { name: 'Cohesión', icon: Users, impact: 'Cohesión +3', load: 'Media', color: 'cyan' },
  { name: 'Ataque', icon: Zap, impact: 'Ataque +2', load: 'Alta', color: 'gold' },
  { name: 'Defensa', icon: Shield, impact: 'Defensa +2', load: 'Alta', color: 'cyan' },
  { name: 'Presión', icon: Footprints, impact: 'Presión +2', load: 'Alta', color: 'red' },
  { name: 'Transiciones', icon: Wind, impact: 'Transición +2', load: 'Media', color: 'gold' },
  { name: 'Balón parado', icon: FlagIcon, impact: 'ABP +3', load: 'Baja', color: 'green' },
  { name: 'Penaltis', icon: Target, impact: 'Penaltis +3', load: 'Baja', color: 'gold' },
]

export function Preparation() {
  const { campaign, updateCampaign } = useGame()
  const { nation } = currentData()
  const opponent = uiNations.find((item) => item.group === nation?.group && item.id !== nation?.id) ?? uiNations[1]
  const [tab, setTab] = useState<'semana' | 'rival' | 'charla'>('semana')
  const [selectedDay, setSelectedDay] = useState(0)
  const [saved, setSaved] = useState(false)
  const plan = campaign.trainingPlan
  const setSession = (name: string) => updateCampaign({ trainingPlan: Array.from({ length: 7 }, (_, index) => index === selectedDay ? name : (plan[index] ?? 'Recuperación')) })

  return (
    <div className="preparation-page page-enter">
      <section className="page-heading"><div><span className="eyebrow"><Dumbbell /> CONCENTRACIÓN</span><h2>Entrena hoy lo que <em>decidirá mañana</em></h2><p>Equilibra carga, cohesión y necesidades del próximo rival.</p></div><div className="heading-metrics"><Metric label="CONDICIÓN MEDIA" value="91%" tone="green" /><Metric label="COHESIÓN" value="64%" tone="cyan" /><Metric label="CARGA SEMANAL" value="Media" tone="gold" /></div></section>
      <div className="page-tabs"><button className={tab === 'semana' ? 'is-active' : ''} onClick={() => setTab('semana')}><CalendarDays /> Plan semanal</button><button className={tab === 'rival' ? 'is-active' : ''} onClick={() => setTab('rival')}><Eye /> Informe del rival</button><button className={tab === 'charla' ? 'is-active' : ''} onClick={() => setTab('charla')}><MessageCircle /> Charla de equipo</button></div>
      {tab === 'semana' && <div className="preparation-layout">
        <section className="week-plan panel"><header className="week-plan__header"><div><span className="eyebrow">MICROCICLO 1</span><h3>Semana de construcción</h3></div><span>25 — 31 MAY</span></header><div className="week-days">{['LUN 25','MAR 26','MIÉ 27','JUE 28','VIE 29','SÁB 30','DOM 31'].map((day, index) => <button key={day} className={selectedDay === index ? 'is-active' : ''} onClick={() => setSelectedDay(index)}><small>{day.split(' ')[0]}</small><b>{day.split(' ')[1]}</b><span className={`session-chip session-chip--${trainingOptions.find((item) => item.name === plan[index])?.color ?? 'green'}`}>{plan[index] ?? 'Recuperación'}</span><i>{index % 2 ? '10:30' : '16:00'}</i></button>)}</div><div className="load-chart"><span>CARGA PROYECTADA</span><div>{[35,64,78,52,55,24,18].map((value, index) => <i key={index} style={{ height: `${value}%` }} className={index === selectedDay ? 'is-active' : ''} />)}</div><small><em>BAJA</em><em>ÓPTIMA</em><em>ALTA</em></small></div><div className="week-plan__footer"><span><ShieldCheck /> El plan respeta las ventanas de recuperación</span><button className="button button--gold" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2500) }}>{saved ? <><Check /> PLAN GUARDADO</> : <>GUARDAR SEMANA <ClipboardCheck /></>}</button></div></section>
        <aside className="session-picker panel"><header><span className="eyebrow">SESIÓN · DÍA {selectedDay + 1}</span><h3>Elige el objetivo</h3></header><div className="training-options">{trainingOptions.map(({ name, icon: Icon, impact, load, color }) => <button key={name} className={plan[selectedDay] === name ? 'is-selected' : ''} onClick={() => setSession(name)}><span className={`training-icon training-icon--${color}`}><Icon /></span><span><b>{name}</b><small>{impact} · Carga {load.toLowerCase()}</small></span>{plan[selectedDay] === name && <Check />}</button>)}</div><div className="coach-tip"><span className="avatar">PF</span><p><b>Paula Ferrer · Preparadora</b>“Dos sesiones intensas seguidas aumentan el riesgo muscular.”</p></div></aside>
      </div>}
      {tab === 'rival' && <OpponentReport nation={opponent} />}
      {tab === 'charla' && <TeamTalk />}
    </div>
  )
}

function OpponentReport({ nation }: { nation: typeof uiNations[number] | undefined }) {
  if (!nation) return null
  return <div className="opponent-report"><section className="opponent-hero panel"><div className="opponent-hero__flag"><Flag code={nation.flagCode} label={nation.name} size="lg" /></div><div><span className="eyebrow">PRÓXIMO RIVAL · GRUPO {nation.group}</span><h2>{nation.name}</h2><p>{nation.style} · Ranking mundial #{nation.worldRanking}</p></div><div className="opponent-rating"><span>NIVEL ESTIMADO</span><b>{nation.teamRating}</b><Progress value={nation.teamRating} tone="gold" /></div></section><div className="report-grid"><Panel eyebrow="ESTRUCTURA" title="Cómo se organizan"><div className="mini-pitch"><span>4–2–3–1</span>{formationSlots['4-2-3-1'].map(([x,y],index)=><i key={index} style={{left:`${x}%`,top:`${y}%`}} />)}</div></Panel><Panel eyebrow="AMENAZAS" title="Lo que debemos controlar"><div className="scout-points"><span><Zap /><b>Transición veloz</b><small>Atacan el espacio tras pérdida</small></span><span><FlagIcon /><b>Balón parado</b><small>37% de sus goles recientes</small></span><span><Target /><b>Presión selectiva</b><small>Saltan sobre el mediocentro</small></span></div></Panel><Panel eyebrow="OPORTUNIDADES" title="Dónde hacer daño"><div className="scout-points scout-points--positive"><span><ArrowRight /><b>Espalda del lateral</b><small>Dejan 18 m en transición</small></span><span><Wind /><b>Cambio de orientación</b><small>Basculación lenta al lado débil</small></span><span><Swords /><b>Duelo aéreo</b><small>Centrales con menor envergadura</small></span></div></Panel></div></div>
}

function TeamTalk() {
  const { campaign, updateCampaign } = useGame()
  const [choice, setChoice] = useState('')
  const talkKey = `talk:${campaign.date}`
  const delivered = campaign.decisionLog.find((item) => item.key === talkKey)
  const options = [{ tone:'Calmada', text:'Confío en vosotros. Disfrutad del camino y haced lo que sabéis.', effect:'Moral +1 · Presión −2', effects:{morale:1,pressure:-2,cohesion:1} },{ tone:'Ambiciosa', text:'Tenemos talento para llegar hasta el final. Vamos a demostrarlo.', effect:'Motivación +3 · Presión +1', effects:{morale:3,pressure:1,federation:1} },{ tone:'Protectora', text:'La responsabilidad es mía. Vosotros centraos en competir.', effect:'Confianza +2 · Federación −1', effects:{morale:2,pressure:-3,federation:-1,cohesion:2} }]
  const deliver = () => {
    const selected = options.find((item) => item.tone === choice)
    if (!selected || delivered) return
    updateCampaign((state) => applyCampDecision(state, { key: talkKey, type: 'talk', label: `Charla ${selected.tone.toLowerCase()}`, effects: selected.effects, madeAt: state.date }))
  }
  return <Panel className="team-talk" eyebrow="MENSAJE AL VESTUARIO" title={delivered ? `Mensaje pronunciado: ${delivered.label}` : '¿Qué tono marcará tu primera semana?'}><div className="locker-room"><div className="locker-room__lights" /><span className="locker-room__badge"><MessageCircle /></span><p>{delivered ? 'El vestuario ha recibido el mensaje. Su efecto ya forma parte del estado mental del equipo.' : 'El grupo guarda silencio. Los líderes te miran. Es tu primer mensaje como seleccionador.'}</p></div><div className="talk-options">{options.map((item)=><button key={item.tone} disabled={Boolean(delivered)} className={choice===item.tone?'is-selected':''} onClick={()=>setChoice(item.tone)}><span>{choice===item.tone?<Check />:<MessageCircle />}</span><b>{item.tone}</b><p>“{item.text}”</p><small>{item.effect}</small></button>)}</div><button className="button button--gold" disabled={!choice || Boolean(delivered)} onClick={deliver}>{delivered ? <><Check /> MENSAJE APLICADO</> : <>DIRIGIRSE AL EQUIPO <ArrowRight /></>}</button></Panel>
}

export function MedicalCenter() {
  const { updateCampaign } = useGame()
  const { campaign, players } = currentData()
  const squad = players.filter((player) => campaign.squadIds.includes(player.id))
  const [filter, setFilter] = useState('Todos')
  const suspended = suspendedPlayerIds(campaign.matchResults, campaign.nationId)
  const injuries = activeInjuries(campaign.matchResults, campaign.date, campaign.nationId)
  const injuryByPlayer = new Map(injuries.map((injury) => [injury.playerId, injury]))
  const medical = squad.map((player,index)=>({player, condition: injuryByPlayer.has(player.id)?58:83+(index*5%16), fatigue: 12+(index*11%57), risk: injuryByPlayer.has(player.id)?'Medio':index%13===0?'Medio':index%7===0?'Bajo':'Mínimo', status:injuryByPlayer.has(player.id)?'Lesionado':suspended.has(player.id)?'Suspendido':index%17===0?'Carga reducida':'Disponible'}))
  const visible = medical.filter((item)=>filter==='Todos'||item.risk===filter)
  const medicalMission = campaign.agenda.find((item)=>item.date===campaign.date&&item.type==='medical')
  const reviewed = Boolean(medicalMission && campaign.missionResolutions[medicalMission.id]?.status==='completed')
  const confirmReview = () => medicalMission && updateCampaign((current)=>({ ...current, physicalRisk: Math.max(0,current.physicalRisk-4), missionResolutions:{...current.missionResolutions,[medicalMission.id]:{status:'completed',resolvedAt:current.date}} }))
  return <div className="medical-page page-enter"><section className="page-heading"><div><span className="eyebrow"><HeartPulse /> DISPONIBILIDAD</span><h2>Protege a quienes <em>te llevarán más lejos</em></h2><p>Control de condición, fatiga, riesgo, lesiones, sanciones y recomendaciones del equipo médico.</p></div><div className="medical-summary"><Metric label="DISPONIBLES" value={`${medical.filter(i=>i.status==='Disponible'||i.status==='Carga reducida').length}/${medical.length}`} tone="green"/><Metric label="RIESGO TEMPORAL" value={`${campaign.physicalRisk}%`} tone={campaign.physicalRisk>6?'red':'gold'}/><Metric label="FATIGA MEDIA" value={`${Math.round(medical.reduce((a,b)=>a+b.fatigue,0)/(medical.length||1))}%`} tone="gold"/></div></section><div className="medical-alert"><Stethoscope/><span><b>Informe de disponibilidad</b>{injuries.length||suspended.size?`${injuries.length} lesionado(s) y ${suspended.size} sancionado(s) no están disponibles.`:'No hay lesiones ni sanciones activas.'} El control evita el +4 de riesgo físico por omisión.</span><button disabled={!medicalMission||reviewed} onClick={confirmReview}>{reviewed?'REVISIÓN CONFIRMADA':'CONFIRMAR REVISIÓN'} <ChevronRight/></button></div><Panel className="medical-table-panel" title="Estado de la plantilla" action={<div className="position-filter">{['Todos','Mínimo','Bajo','Medio'].map(item=><button className={filter===item?'is-active':''} key={item} onClick={()=>setFilter(item)}>{item}</button>)}</div>}><table className="player-table medical-table"><thead><tr><th>JUGADOR</th><th>CONDICIÓN</th><th>FATIGA</th><th>RIESGO</th><th>ESTADO</th><th>RECOMENDACIÓN</th></tr></thead><tbody>{visible.map(({player,condition,fatigue,risk,status})=><tr key={player.id}><td><div className="player-cell"><PlayerPortrait playerId={player.id} nationId={player.nationId} label={playerName(player)} /><span><b>{playerName(player)} {starProfile(player) && <Star className="inline-star" />}</b><small>{player.position} · {playerClub(player)}</small></span></div></td><td><div className="table-bar"><Progress value={condition} tone={condition>90?'green':'cyan'}/><b>{condition}%</b></div></td><td><div className="table-bar"><Progress value={fatigue} tone={fatigue>55?'red':fatigue>35?'gold':'green'}/><b>{fatigue}%</b></div></td><td><span className={`risk risk--${risk.toLowerCase()}`}>{risk==='Medio'?<AlertCircle/>:<ShieldCheck/>}{risk}</span></td><td><span className={status==='Disponible'?'status status--ok':'status status--warn'}>{status}</span></td><td>{status==='Lesionado'?'Tratamiento · reevaluación diaria':status==='Suspendido'?'No elegible · cumple sanción':risk==='Medio'?'Carga reducida + fisioterapia':risk==='Bajo'?'Evitar doble sesión':'Plan completo'}</td></tr>)}</tbody></table></Panel></div>
}

export function PressRoom() {
  const { campaign, updateCampaign } = useGame()
  const { nation } = currentData()
  const progress = deriveCampaignProgress(
    {
      ...tournamentData,
      nations: campaign.customNations ?? tournamentData.nations,
      fixtures: campaign.customFixtures ?? tournamentData.fixtures,
    },
    campaign.matchResults,
    { controlledNationId: campaign.nationId }
  )
  const conference = buildPressConference(campaign, progress)
  const questions = conference.questions
  const [current, setCurrent] = useState(0)
  const [reviewMode, setReviewMode] = useState(false)
  const complete = pressConferenceComplete(campaign, conference)
  const pressAdvice = buildAssistantAdvice(campaign, 'press')
  useEffect(() => {
    const firstPending = questions.findIndex((question) => !campaign.pressAnswers[question.id])
    setCurrent(firstPending >= 0 ? firstPending : 0)
    setReviewMode(false)
  }, [conference.id])
  const item = questions[current] ?? questions[0]!
  const answer = (tone: typeof item.answers[number]['tone']) => {
    const selected = item.answers.find((option) => option.tone === tone)
    if (!selected) return
    updateCampaign((state) => {
      const affected = applyCampDecision(state, {
        key: `press:${item.id}`,
        type: 'press',
        label: `${item.outlet}: ${item.topic}`,
        effects: selected.effects,
        madeAt: state.date,
      })
      return { ...affected, pressAnswers: { ...affected.pressAnswers, [item.id]: tone } }
    })
    if(current<questions.length-1) setCurrent(current+1); else setReviewMode(false)
  }
  if(complete && !reviewMode) return <div className="press-page press-page--finished page-enter"><Panel className="press-complete"><span className="press-complete__icon"><BadgeCheck/></span><span className="eyebrow">RUEDA DE PRENSA FINALIZADA</span><h2>{conference.title}</h2><p>{conference.context}. Las respuestas quedan incorporadas a la presión, la moral y la cohesión con la que competirá el equipo.</p><div><Metric label="MORAL" value={`${campaign.morale}%`} tone="green"/><Metric label="CONFIANZA" value={`${campaign.federation}%`} tone="gold"/><Metric label="PRESIÓN" value={`${campaign.pressure}%`} tone="red"/><Metric label="PREGUNTAS" value={`${questions.length}/${questions.length}`} tone="cyan"/></div><button className="button button--gold" onClick={()=>{setCurrent(0);setReviewMode(true)}}><RotateCcw/> REPASAR COMPARECENCIA</button></Panel></div>
  return <div className="press-scene page-enter">
    {!campaign.prologueComplete && <SceneAssistant advice={pressAdvice} step={5} totalSteps={5} title="La presión también se entrena" />}
    <div className="press-page"><section className="press-stage"><div className="press-stage__lights"/><div className="press-stage__backdrop"><Crown/><span>GLORIA MUNDIAL 26</span>{nation&&<Flag code={nation.flagCode} label={nation.name} size="lg"/>}</div><div className="press-stage__desk"><span className="microphone"/><span className="microphone"/><div className="press-manager"><span className="avatar avatar--large">{campaign.manager.name[0]}{campaign.manager.surname[0]}</span><b>{campaign.manager.name} {campaign.manager.surname}</b><small>{conference.title} · {conference.context}</small></div></div><div className="press-progress">{questions.map((question,index)=>{const answered=Boolean(campaign.pressAnswers[question.id]);return <i key={question.id} className={answered?'is-done':index===current?'is-current':''}>{answered?<Check/>:index+1}</i>})}</div></section><section className="press-interaction panel"><header><span className="journalist-avatar">{item.outlet.slice(0,2).toUpperCase()}</span><div><b>{item.journalist}</b><small>{item.outlet} · {item.topic} · Pregunta {current+1} de {questions.length}</small></div><MessageSquareText/></header><blockquote>“{item.question}”</blockquote>{item.sourceUrl&&<a className="press-source" href={item.sourceUrl} target="_blank" rel="noreferrer"><Newspaper/> Contexto periodístico de actualidad</a>}<span className="eyebrow">ELIGE TU RESPUESTA</span><div className="press-answers">{item.answers.map((option)=><button key={option.tone} onClick={()=>answer(option.tone)}><span className={`tone-dot tone-dot--${option.tone}`}/><span><b>{option.tone.toUpperCase()}</b><p>“{option.text}”</p></span><ChevronRight/></button>)}</div><small className="press-hint"><Info/> Cada tono modifica de forma acotada moral, cohesión, presión, federación y apoyo. Habrá una nueva comparecencia antes del siguiente partido.</small></section></div>
  </div>
}

export function Tournament() {
  const { campaign } = useGame()
  const navigate = useNavigate()
  const [tab,setTab]=useState<'grupos'|'cuadro'|'calendario'|'estadisticas'>('calendario')
  const [groupPage,setGroupPage]=useState(0)
  const progress = deriveCampaignProgress(
    {
      ...tournamentData,
      nations: campaign.customNations ?? tournamentData.nations,
      fixtures: campaign.customFixtures ?? tournamentData.fixtures,
    },
    campaign.matchResults,
    { controlledNationId: campaign.nationId }
  )
  const groups = Object.keys(tournamentData.groups) as GroupId[]
  const champion = uiNations.find((nation) => nation.id === progress.championNationId)
  return <div className="tournament-page page-enter">
    <section className={`tournament-banner ${progress.completed ? 'tournament-banner--complete' : ''}`}><div className="tournament-banner__rings"/><span className="eyebrow"><Crown/> {progress.completed ? 'LA HISTORIA YA TIENE CAMPEÓN' : 'LA CUMBRE DEL FÚTBOL'}</span><h2>{progress.completed ? <>{champion?.name} <em>campeona</em></> : <>Mundial <em>2026</em></>}</h2><p>{progress.completed ? `${progress.stats.totalGoals} goles y 104 partidos después, comienza la ceremonia final.` : '48 naciones · 104 partidos · 16 ciudades · un campeón'}</p><div><span><b>{progress.stats.matchesPlayed}</b> JUGADOS</span><i/><span><b>{progress.stats.totalGoals}</b> GOLES</span><i/><span><b>{progress.stats.matchesRemaining}</b> PENDIENTES</span></div></section>
    {progress.controlledNationEliminated && !progress.completed && <div className="spectator-notice"><Eye/><span><b>Tu selección ha sido eliminada.</b> La campaña continúa en modo espectador: puedes seguir cada cruce hasta la final.</span></div>}
    <div className="page-tabs page-tabs--center tournament-tabs"><button className={tab==='calendario'?'is-active':''} onClick={()=>setTab('calendario')}><CalendarDays/> Centro del Mundial</button><button className={tab==='grupos'?'is-active':''} onClick={()=>setTab('grupos')}><Users/> Grupos</button><button className={tab==='cuadro'?'is-active':''} onClick={()=>setTab('cuadro')}><Swords/> Ruta a la final</button><button className={tab==='estadisticas'?'is-active':''} onClick={()=>setTab('estadisticas')}><BarChart3/> Estadísticas</button></div>
    {tab==='grupos'&&<div className="tournament-paged"><nav className="tournament-pager"><button disabled={groupPage===0} onClick={()=>setGroupPage((page)=>Math.max(0,page-1))}><ChevronLeft/> ANTERIORES</button><span>GRUPOS {groupPage*4+1}–{Math.min(12,groupPage*4+4)} · PÁGINA {groupPage+1}/3</span><button disabled={groupPage===2} onClick={()=>setGroupPage((page)=>Math.min(2,page+1))}>SIGUIENTES <ChevronRight/></button></nav><div className="group-grid">{groups.slice(groupPage*4,groupPage*4+4).map((group) => <Panel key={group} className="group-card" eyebrow="FASE DE GRUPOS" title={`Grupo ${group}`} action={<span className={`group-status ${progress.groupComplete[group] ? 'is-complete' : ''}`}>{progress.groupComplete[group] ? 'FINAL' : progress.groupTables[group].some((row) => row.played) ? 'EN JUEGO' : 'POR EMPEZAR'}</span>}><table><thead><tr><th>#</th><th>SELECCIÓN</th><th>PJ</th><th>DG</th><th>PTS</th></tr></thead><tbody>{progress.groupTables[group].map((row,index) => { const nation=uiNations.find((item)=>item.id===row.nationId); if(!nation)return null; return <tr key={nation.id} className={`${nation.id===campaign.nationId?'is-user':''} ${index<2?'is-qualified':index===2?'is-third':''}`}><td>{index+1}</td><td><Flag code={nation.flagCode} label={nation.name} size="sm"/><b>{nation.shortName}</b>{nation.id===campaign.nationId&&<Crown/>}</td><td>{row.played}</td><td>{row.goalDifference>0?'+':''}{row.goalDifference}</td><td><b>{row.points}</b></td></tr>})}</tbody></table><footer><span><i/> Clasificación directa</span><span><i/> Mejor tercero</span></footer></Panel>)}</div></div>}
    {tab==='cuadro'&&<Bracket progress={progress} onWatch={(fixture)=>navigate(`/partido?fixture=${fixture.id}`)}/>}
    {tab==='calendario'&&<TournamentCalendar progress={progress} campaignDate={campaign.date} controlledNationId={campaign.nationId} onWatch={(fixture)=>navigate(`/partido?fixture=${fixture.id}`)}/>}
    {tab==='estadisticas'&&<TournamentStats progress={progress} results={campaign.matchResults}/>}
  </div>
}

const stageTitles: Record<ResolvedCampaignFixture['stage'], string> = { GROUP:'GRUPOS', ROUND_OF_32:'DIECISEISAVOS', ROUND_OF_16:'OCTAVOS', QUARTER_FINAL:'CUARTOS', SEMI_FINAL:'SEMIFINALES', THIRD_PLACE:'TERCER PUESTO', FINAL:'FINAL' }

function Bracket({progress,onWatch}:{progress:CampaignProgress;onWatch:(fixture:ResolvedCampaignFixture)=>void}) {
  const [roundPage,setRoundPage]=useState(0)
  const rounds: Array<{title:string;fixtures:ResolvedCampaignFixture[]}> = [
    {title:'DIECISEISAVOS',fixtures:progress.fixtures.filter((fixture)=>fixture.stage==='ROUND_OF_32')},
    {title:'OCTAVOS',fixtures:progress.fixtures.filter((fixture)=>fixture.stage==='ROUND_OF_16')},
    {title:'CUARTOS',fixtures:progress.fixtures.filter((fixture)=>fixture.stage==='QUARTER_FINAL')},
    {title:'SEMIFINALES',fixtures:progress.fixtures.filter((fixture)=>fixture.stage==='SEMI_FINAL')},
    {title:'FINAL',fixtures:progress.fixtures.filter((fixture)=>fixture.stage==='FINAL')},
  ]
  const label=(id:string|undefined,slot:string|undefined)=>uiNations.find((nation)=>nation.id===id)?.shortName??slot??'Por definir'
  const flag=(id:string|undefined)=>uiNations.find((nation)=>nation.id===id)
  const bronze=progress.fixtures.find((fixture)=>fixture.stage==='THIRD_PLACE')
  const champion=uiNations.find((nation)=>nation.id===progress.championNationId)
  return <div className="bracket panel"><header><div><span className="eyebrow">RUTA A LA FINAL</span><h2>Cuadro eliminatorio vivo</h2></div><span>{progress.groupStageComplete?<><CheckCircle2/> Emparejamientos oficiales resueltos</>:<><LockKeyhole/> Se abrirá al cerrar los doce grupos</>}</span></header><nav className="tournament-pager"><button disabled={roundPage===0} onClick={()=>setRoundPage(0)}><ChevronLeft/> PRIMEROS CRUCES</button><span>{roundPage===0?'DIECISEISAVOS · OCTAVOS':'CUARTOS · SEMIFINALES · FINAL'}</span><button disabled={roundPage===1} onClick={()=>setRoundPage(1)}>CAMINO FINAL <ChevronRight/></button></nav>{progress.completed&&champion&&<div className="champion-ribbon"><Crown/><span><small>CAMPEÓN DEL MUNDO</small><b>{champion.name}</b></span><Flag code={champion.flagCode} label={champion.name} size="lg"/></div>}<div className={`bracket__rounds bracket__rounds--page-${roundPage}`}>{rounds.slice(roundPage===0?0:2,roundPage===0?2:5).map((round)=><section key={round.title}><h3>{round.title}</h3>{round.fixtures.map((fixture)=>{const home=flag(fixture.homeNationId);const away=flag(fixture.awayNationId);return <div className={`bracket-match bracket-match--${fixture.status}`} key={fixture.id}><span><i>{home?<Flag code={home.flagCode} label={home.name} size="sm"/>:<Shield/>}</i><b>{label(fixture.homeNationId,fixture.homeSlot)}</b>{fixture.result&&<strong>{fixture.result.home}</strong>}</span><em>—</em><span><i>{away?<Flag code={away.flagCode} label={away.name} size="sm"/>:<Shield/>}</i><b>{label(fixture.awayNationId,fixture.awaySlot)}</b>{fixture.result&&<strong>{fixture.result.away}</strong>}</span><small>PARTIDO {fixture.matchNumber} · {fixture.date.slice(5,10).replace('-','/')}</small>{fixture.status!=='blocked'&&<button onClick={()=>onWatch(fixture)}><Play/>{fixture.status==='played'?'RECREAR':'VER'}</button>}</div>})}</section>)}</div>{bronze&&roundPage===1&&<div className="bronze-match"><Medal/><span><small>TERCER PUESTO · PARTIDO 103</small><b>{label(bronze.homeNationId,bronze.homeSlot)} {bronze.result?`${bronze.result.home} — ${bronze.result.away}`:'vs'} {label(bronze.awayNationId,bronze.awaySlot)}</b></span>{bronze.status!=='blocked'&&<button onClick={()=>onWatch(bronze)}><Play/> VER</button>}</div>}</div>
}

const calendarStageLabels: Record<CalendarStage, string> = {
  ALL: 'Todas las fases',
  GROUP: 'Fase de grupos',
  ROUND_OF_32: 'Dieciseisavos',
  ROUND_OF_16: 'Octavos de final',
  QUARTER_FINAL: 'Cuartos de final',
  SEMI_FINAL: 'Semifinales',
  THIRD_PLACE: 'Tercer puesto',
  FINAL: 'Gran final',
}

const scopeLabels: Array<{ value: CalendarScope; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'MY_TEAM', label: 'Mi selección' },
  { value: 'UPCOMING', label: 'Por jugar' },
  { value: 'PLAYED', label: 'Resultados' },
]

function shortCalendarDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' })
    .format(new Date(`${value.slice(0, 10)}T12:00:00`))
    .replace('.', '')
    .toUpperCase()
}

function longCalendarDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${value.slice(0, 10)}T12:00:00`))
}

function localKickoff(value: string) {
  return value.slice(11, 16)
}

function resultLabel(fixture: ResolvedCampaignFixture) {
  if (!fixture.result) return undefined
  const penalties = fixture.result.homePenalties !== undefined && fixture.result.awayPenalties !== undefined
    ? ` · pen. ${fixture.result.homePenalties}-${fixture.result.awayPenalties}`
    : ''
  return `${fixture.result.home} — ${fixture.result.away}${penalties}`
}

function FormGuide({ form }: { form: FormResult[] }) {
  return <span className="calendar-form" aria-label="Forma reciente">{form.length
    ? form.map((result, index) => <i key={`${result}-${index}`} className={`is-${result.toLowerCase()}`}>{result === 'W' ? 'G' : result === 'D' ? 'E' : 'P'}</i>)
    : <small>Sin partidos</small>}</span>
}

function TournamentCalendar({
  progress,
  campaignDate,
  controlledNationId,
  onWatch,
}: {
  progress: CampaignProgress
  campaignDate: string
  controlledNationId: string
  onWatch: (fixture: ResolvedCampaignFixture) => void
}) {
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState<CalendarStage>('ALL')
  const [scope, setScope] = useState<CalendarScope>('ALL')
  const [view, setView] = useState<'overview'|'agenda'|'venues'>('overview')
  const [calendarPage, setCalendarPage] = useState(0)
  const nationLabels = useMemo(() => Object.fromEntries(uiNations.map((nation) => [nation.id, `${nation.name} ${nation.shortName}`])), [])
  const venueLabels = useMemo(() => Object.fromEntries(tournamentData.venues.map((venue) => [venue.id, `${venue.name} ${venue.city}`])), [])
  const spotlight = useMemo(() => selectSpotlightFixture(progress.fixtures, controlledNationId), [controlledNationId, progress.fixtures])
  const fixtures = useMemo(() => filterCalendarFixtures(progress.fixtures, {
    query,
    stage,
    scope,
    controlledNationId,
    nationLabels,
    venueLabels,
  }), [controlledNationId, nationLabels, progress.fixtures, query, scope, stage, venueLabels])
  const days = useMemo(() => groupCalendarDays(fixtures, campaignDate, spotlight?.id), [campaignDate, fixtures, spotlight?.id])
  const calendarPages = Math.max(1,Math.ceil(days.length/2))
  const visibleDays = days.slice(Math.min(calendarPage,calendarPages-1)*2,Math.min(calendarPage,calendarPages-1)*2+2)
  const route = useMemo(() => stageCalendarSummaries(progress.fixtures), [progress.fixtures])
  const home = uiNations.find((nation) => nation.id === spotlight?.homeNationId)
  const away = uiNations.find((nation) => nation.id === spotlight?.awayNationId)
  const venue = tournamentData.venues.find((item) => item.id === spotlight?.venueId)
  const spotlightStatus = spotlight ? fixtureUrgency(spotlight, campaignDate) : undefined
  const spotlightHasUser = Boolean(spotlight && (spotlight.homeNationId === controlledNationId || spotlight.awayNationId === controlledNationId))
  const spotlightAvailable = Boolean(spotlight
    && spotlight.status !== 'blocked'
    && !(spotlight.status === 'ready' && spotlight.date.slice(0, 10) > campaignDate))
  const venueCounts = useMemo(() => tournamentData.venues
    .map((host) => ({ host, fixtures: progress.fixtures.filter((fixture) => fixture.venueId === host.id).length }))
    .sort((left, right) => right.fixtures - left.fixtures || left.host.city.localeCompare(right.host.city))
    .slice(0, 6), [progress.fixtures])

  return <div className="world-calendar"><nav className="world-calendar-modes"><button className={view==='overview'?'is-active':''} onClick={()=>setView('overview')}><Trophy/> JORNADA MUNDIAL</button><button className={view==='agenda'?'is-active':''} onClick={()=>setView('agenda')}><CalendarDays/> AGENDA</button><button className={view==='venues'?'is-active':''} onClick={()=>setView('venues')}><MapPin/> SEDES</button></nav>
    {view==='overview'&&<>
    {spotlight && <section
      className={`calendar-spotlight calendar-spotlight--${spotlightStatus?.key ?? 'scheduled'}`}
      style={{ '--home-team': home?.primaryColor ?? '#23d7e8', '--away-team': away?.primaryColor ?? '#e7b84a' } as React.CSSProperties}
    >
      <div className="calendar-spotlight__atmosphere" />
      <header>
        <span className="calendar-live-kicker"><Flame /> {spotlightHasUser ? 'TU PRÓXIMO GRAN DESAFÍO' : 'PARTIDO ESTELAR DEL TORNEO'}</span>
        <span className={`calendar-urgency calendar-urgency--${spotlightStatus?.key}`}><Radio /> {spotlightStatus?.label}</span>
      </header>
      <div className="calendar-spotlight__body">
        <div className="calendar-spotlight__team calendar-spotlight__team--home">
          {home ? <Flag code={home.flagCode} label={home.name} size="lg" /> : <span className="calendar-placeholder"><Shield /></span>}
          <span><small>{home ? `RANKING MUNDIAL #${home.worldRanking}` : 'CRUCE PENDIENTE'}</small><b>{home?.name ?? spotlight.homeSlot ?? 'Por definir'}</b><FormGuide form={nationForm(progress.fixtures, spotlight.homeNationId)} /></span>
        </div>
        <div className="calendar-spotlight__event">
          <span>{stageTitles[spotlight.stage]}{spotlight.group ? ` · GRUPO ${spotlight.group}` : ''}</span>
          <strong>{resultLabel(spotlight) ?? localKickoff(spotlight.date)}</strong>
          <b>{shortCalendarDate(spotlight.date)} · HORA LOCAL</b>
          <i>PARTIDO {spotlight.matchNumber}</i>
        </div>
        <div className="calendar-spotlight__team calendar-spotlight__team--away">
          {away ? <Flag code={away.flagCode} label={away.name} size="lg" /> : <span className="calendar-placeholder"><Shield /></span>}
          <span><small>{away ? `RANKING MUNDIAL #${away.worldRanking}` : 'CRUCE PENDIENTE'}</small><b>{away?.name ?? spotlight.awaySlot ?? 'Por definir'}</b><FormGuide form={nationForm(progress.fixtures, spotlight.awayNationId)} /></span>
        </div>
      </div>
      <footer>
        <div><MapPin /><span><small>ESCENARIO</small><b>{venue?.name ?? 'Sede por confirmar'}</b><em>{venue ? `${venue.city} · ${venue.capacity.toLocaleString('es-ES')} espectadores` : 'La ruta decidirá la sede'}</em></span></div>
        <div><TrendingUp /><span><small>PULSO DEL TORNEO</small><b>{progress.stats.goalsPerMatch.toFixed(2)} goles por partido</b><em>{progress.stats.matchesRemaining} encuentros todavía por vivir</em></span></div>
        {spotlight.status === 'blocked'
          ? <span className="calendar-locked"><LockKeyhole /> El cruce se resolverá en el campo</span>
          : <button className="calendar-primary-action" disabled={!spotlightAvailable} onClick={() => onWatch(spotlight)}><Play /> {spotlight.status === 'played' ? 'REVIVIR PARTIDO' : spotlightAvailable ? 'ENTRAR AL PARTIDO' : 'PRÓXIMAMENTE'}</button>}
      </footer>
    </section>}

    <section className="tournament-roadmap panel">
      <header><div><span className="eyebrow"><Trophy /> RUTA A LA GLORIA</span><h2>Del debut a la final de Nueva York</h2></div><button className={stage === 'ALL' ? 'is-active' : ''} onClick={() => setStage('ALL')}>VER TORNEO COMPLETO</button></header>
      <div className="tournament-roadmap__track">{route.map((item) => {
        const percentage = item.total ? Math.round(item.played / item.total * 100) : 0
        return <button key={item.stage} className={`${stage === item.stage ? 'is-active' : ''} ${percentage === 100 ? 'is-complete' : item.played ? 'is-live' : ''}`} onClick={() => setStage(item.stage)}>
          <span><i style={{ width: `${percentage}%` }} /></span>
          <small>{shortCalendarDate(item.startDate)}{item.endDate !== item.startDate ? ` — ${shortCalendarDate(item.endDate)}` : ''}</small>
          <b>{calendarStageLabels[item.stage]}</b>
          <em>{item.played}/{item.total} partidos</em>
        </button>
      })}</div>
    </section>
    </>}

    {view==='venues'&&<section className="calendar-hosts panel">
      <header><div><span className="eyebrow"><Globe2 /> 3 PAÍSES · 16 SEDES</span><h2>Los grandes escenarios</h2></div><span>Canadá · México · Estados Unidos</span></header>
      <div>{venueCounts.map(({ host, fixtures: venueFixtures }) => <article key={host.id}><MapPin /><span><small>{host.country.toUpperCase()}</small><b>{host.city}</b><em>{host.name}</em></span><strong>{venueFixtures}<small>PARTIDOS</small></strong><i>{host.capacity.toLocaleString('es-ES')} asientos</i></article>)}</div>
    </section>}

    {view==='agenda'&&<section className="calendar-board panel">
      <header className="calendar-board__header"><div><span className="eyebrow"><CalendarDays /> AGENDA OFICIAL</span><h2>Cada jornada, cada estadio, cada historia</h2><p>{fixtures.length} partidos visibles · {days.length} días de competición</p></div><label className="calendar-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar selección, sede o partido…" /></label></header>
      <div className="calendar-filters">
        <div>{scopeLabels.map((item) => <button key={item.value} className={scope === item.value ? 'is-active' : ''} onClick={() => setScope(item.value)}>{item.value === 'MY_TEAM' && <Crown />}{item.label}</button>)}</div>
        <label><Filter /><span>FASE</span><select value={stage} onChange={(event) => setStage(event.target.value as CalendarStage)}>{Object.entries(calendarStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <nav className="tournament-pager"><button disabled={calendarPage===0} onClick={()=>setCalendarPage((page)=>Math.max(0,page-1))}><ChevronLeft/> ANTERIOR</button><span>DÍAS {Math.min(days.length,calendarPage*2+1)}–{Math.min(days.length,calendarPage*2+2)} · {calendarPage+1}/{calendarPages}</span><button disabled={calendarPage>=calendarPages-1} onClick={()=>setCalendarPage((page)=>Math.min(calendarPages-1,page+1))}>SIGUIENTE <ChevronRight/></button></nav>
      <div className="calendar-days">{days.length ? visibleDays.map((day) => <section key={day.date} className={`calendar-day-group ${day.isCampaignDay ? 'is-today' : ''} ${day.containsSpotlight ? 'has-spotlight' : ''}`}>
        <aside><span>{shortCalendarDate(day.date).split(' ')[0]}</span><b>{shortCalendarDate(day.date).split(' ')[1]}</b><small>{longCalendarDate(day.date).split(',')[0]}</small>{day.isCampaignDay && <em>HOY</em>}{day.containsSpotlight && !day.isCampaignDay && <em>DESTACADA</em>}</aside>
        <div><header><span>{longCalendarDate(day.date)}</span><small>{day.fixtures.length} partido{day.fixtures.length === 1 ? '' : 's'} · {new Set(day.fixtures.map((fixture) => fixture.venueId)).size} sede{new Set(day.fixtures.map((fixture) => fixture.venueId)).size === 1 ? '' : 's'}</small></header>
          <div className="calendar-match-grid">{day.fixtures.map((fixture) => {
            const fixtureHome = uiNations.find((nation) => nation.id === fixture.homeNationId)
            const fixtureAway = uiNations.find((nation) => nation.id === fixture.awayNationId)
            const fixtureVenue = tournamentData.venues.find((item) => item.id === fixture.venueId)
            const urgency = fixtureUrgency(fixture, campaignDate)
            const hasUser = fixture.homeNationId === controlledNationId || fixture.awayNationId === controlledNationId
            const canWatch = fixture.status !== 'blocked' && !(fixture.status === 'ready' && fixture.date.slice(0, 10) > campaignDate)
            return <article key={fixture.id} className={`calendar-match-card calendar-match-card--${urgency.key} ${hasUser ? 'is-user' : ''}`}>
              <header><span>{calendarStageLabels[fixture.stage]}{fixture.group ? ` · Grupo ${fixture.group}` : ''}</span><em className={`calendar-urgency calendar-urgency--${urgency.key}`}>{urgency.label}</em></header>
              <div className="calendar-match-card__teams">
                <div>{fixtureHome ? <Flag code={fixtureHome.flagCode} label={fixtureHome.name} /> : <span className="calendar-mini-placeholder"><Shield /></span>}<span><b>{fixtureHome?.shortName ?? fixture.homeSlot ?? 'Por definir'}</b><small>{fixtureHome ? `#${fixtureHome.worldRanking} · ${fixtureHome.style}` : 'Esperando clasificación'}</small><FormGuide form={nationForm(progress.fixtures, fixture.homeNationId, 3)} /></span></div>
                <strong>{resultLabel(fixture) ?? <><b>{localKickoff(fixture.date)}</b><small>HORA LOCAL</small></>}</strong>
                <div>{fixtureAway ? <Flag code={fixtureAway.flagCode} label={fixtureAway.name} /> : <span className="calendar-mini-placeholder"><Shield /></span>}<span><b>{fixtureAway?.shortName ?? fixture.awaySlot ?? 'Por definir'}</b><small>{fixtureAway ? `#${fixtureAway.worldRanking} · ${fixtureAway.style}` : 'Esperando clasificación'}</small><FormGuide form={nationForm(progress.fixtures, fixture.awayNationId, 3)} /></span></div>
              </div>
              <footer><span><MapPin /><b>{fixtureVenue?.city ?? 'Por definir'}</b><small>{fixtureVenue?.name ?? 'Sede pendiente'} · Partido {fixture.matchNumber}</small></span>{fixture.status === 'blocked' ? <em><LockKeyhole /> CRUCE PENDIENTE</em> : <button disabled={!canWatch} onClick={() => onWatch(fixture)}><Play />{fixture.status === 'played' ? 'REVIVIR' : canWatch ? 'VISUALIZAR' : 'PRÓXIMAMENTE'}</button>}</footer>
            </article>
          })}</div>
        </div>
      </section>) : <EmptyState title="No hay partidos con estos filtros" text="Prueba otra fase, vuelve a mostrar todo el torneo o busca una selección diferente." action={<button className="button button--cyan" onClick={() => { setQuery(''); setStage('ALL'); setScope('ALL') }}>RESTABLECER CALENDARIO</button>} />}</div>
    </section>}
  </div>
}

function TournamentStats({progress,results}:{progress:CampaignProgress;results:CampaignUIState['matchResults']}) {
  const resultList=Object.values(results)
  const cards=resultList.reduce((sum,result)=>sum+(result.homeYellowCards??0)+(result.awayYellowCards??0)+(result.homeRedCards??0)+(result.awayRedCards??0),0)
  const totalXg=resultList.reduce((sum,result)=>sum+(result.homeXg??0)+(result.awayXg??0),0)
  const scorerCounts=new Map<string,number>();const assistCounts=new Map<string,number>()
  resultList.flatMap((result)=>result.goals??[]).forEach((goal)=>{if(goal.playerId)scorerCounts.set(goal.playerId,(scorerCounts.get(goal.playerId)??0)+1);if(goal.assistId)assistCounts.set(goal.assistId,(assistCounts.get(goal.assistId)??0)+1)})
  const allPlayers=Object.values(uiPlayersByNation).flat();const playerById=new Map(allPlayers.map((player)=>[player.id,player]))
  const ranking=(counts:Map<string,number>)=>[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8)
  const scorers=ranking(scorerCounts);const assists=ranking(assistCounts)
  const topTeams=progress.stats.topScoringNationIds.slice(0,6).map((id)=>({nation:uiNations.find((item)=>item.id===id),stats:progress.stats.byNation[id]})).filter((item)=>item.nation)
  const champion=uiNations.find((nation)=>nation.id===progress.championNationId)
  return <div className="tournament-stats"><section className="stats-summary panel"><div><Metric label="GOLES" value={String(progress.stats.totalGoals)} tone="gold"/><Metric label="PARTIDOS" value={`${progress.stats.matchesPlayed}/104`} tone="cyan"/><Metric label="TARJETAS" value={String(cards)} tone="red"/><Metric label="xG TOTAL" value={totalXg.toFixed(2)} tone="green"/></div><p><BarChart3/> Todos los datos proceden del mismo registro determinista que genera marcador y animación.</p></section><div className="stats-leaders"><Panel eyebrow="BOTA DE ORO" title="Goleadores"><div className="leader-list">{scorers.length?scorers.map(([id,value],index)=>{const player=playerById.get(id);const nation=uiNations.find((item)=>item.id===player?.nationId);return <div key={id}><b>{index+1}</b>{nation&&<Flag code={nation.flagCode} label={nation.name} size="sm"/>}<span><strong>{player?.shirtName??'Jugador'}</strong><small>{nation?.shortName}</small></span><em>{value}</em></div>}):<p className="empty-copy">Los goles aparecerán al comenzar el torneo.</p>}</div></Panel><Panel eyebrow="CREADORES" title="Asistencias"><div className="leader-list">{assists.length?assists.map(([id,value],index)=>{const player=playerById.get(id);const nation=uiNations.find((item)=>item.id===player?.nationId);return <div key={id}><b>{index+1}</b>{nation&&<Flag code={nation.flagCode} label={nation.name} size="sm"/>}<span><strong>{player?.shirtName??'Jugador'}</strong><small>{nation?.shortName}</small></span><em>{value}</em></div>}):<p className="empty-copy">Las asistencias se registrarán jugada a jugada.</p>}</div></Panel><Panel eyebrow="PODER OFENSIVO" title="Selecciones con más gol"><div className="leader-list">{topTeams.map(({nation,stats},index)=><div key={nation!.id}><b>{index+1}</b><Flag code={nation!.flagCode} label={nation!.name} size="sm"/><span><strong>{nation!.shortName}</strong><small>{stats.won} victorias · DG {stats.goalDifference}</small></span><em>{stats.goalsFor}</em></div>)}</div></Panel></div>{progress.completed&&champion&&<section className="ceremony panel"><div className="ceremony__lights"/><Crown/><span className="eyebrow">CEREMONIA FINAL · 19 DE JULIO</span><h2>{champion.name}, en la eternidad</h2><Flag code={champion.flagCode} label={champion.name} size="lg"/><p>Campeón: {champion.name} · Subcampeón: {uiNations.find((nation)=>nation.id===progress.runnerUpNationId)?.name} · Tercero: {uiNations.find((nation)=>nation.id===progress.thirdPlaceNationId)?.name}</p></section>}</div>
}
