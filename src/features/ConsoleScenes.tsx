import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, BarChart3, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, MapPin, MessageSquareText, Plus, Shield, Sparkles, Star, Target, Trophy, Users, X, Zap } from 'lucide-react'
import { useGame } from '../App'
import { Flag } from '../components/Flag'
import { PlayerPortrait } from '../components/PlayerPortrait'
import { tournamentData } from '../data'
import { deriveCampaignProgress } from './campaignProgress'
import { playerCaps, playerClub, playerName, playerOverall, playersFor, uiNations, type UIPlayer } from './ui-model'

const dayLabel = (date: string) => new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)).toUpperCase()

export function ConsoleDashboard() {
  const navigate = useNavigate()
  const { campaign } = useGame()
  const nation = uiNations.find((item) => item.id === campaign.nationId)
  const progress = useMemo(() => deriveCampaignProgress(tournamentData, campaign.matchResults, { controlledNationId: campaign.nationId }), [campaign.matchResults, campaign.nationId])
  const next = progress.nextControlledFixture ?? progress.nextFixture
  const opponentId = next?.homeNationId === campaign.nationId ? next.awayNationId : next?.homeNationId
  const opponent = uiNations.find((item) => item.id === opponentId)
  const venue = tournamentData.venues.find((item) => item.id === next?.venueId)
  const days = [...new Set(campaign.agenda.map((item) => item.date))].slice(0, 7)
  const [selectedDate, setSelectedDate] = useState(campaign.date)
  const [eventIndex, setEventIndex] = useState(0)
  const selectedEvents = campaign.agenda.filter((item) => item.date === selectedDate && item.status === 'pending')
  const activeEvent = selectedEvents[Math.min(eventIndex, Math.max(0, selectedEvents.length - 1))]
  const countdown = next ? Math.max(0, Math.ceil((new Date(next.date).getTime() - new Date(`${campaign.date}T12:00:00`).getTime()) / 86_400_000)) : 0
  const urgent = campaign.agenda.filter((item) => item.date === campaign.date && item.mandatory && item.status === 'pending').length

  const tiles = [
    { tone: 'cyan', icon: Users, eyebrow: 'PLANTILLA', title: campaign.squadConfirmed ? 'Los 26' : 'Cerrar la lista', meta: `${campaign.squadIds.length}/26 · ${campaign.squadIds.filter((id) => playersFor(campaign.nationId).find((player) => player.id === id)?.position === 'GK').length}/3 POR`, route: '/juego/convocatoria' },
    { tone: 'coral', icon: Dumbbell, eyebrow: 'PREPARACIÓN', title: 'Vida del equipo', meta: `Fatiga ${campaign.fatigue}% · recuperación ${campaign.recovery}%`, route: '/juego/concentracion' },
    { tone: 'lilac', icon: Target, eyebrow: 'PLAN DE JUEGO', title: campaign.tactic, meta: `Familiaridad ${campaign.tacticalFamiliarity}%`, route: '/juego/tacticas' },
    { tone: 'mint', icon: Trophy, eyebrow: 'MUNDIAL', title: `${progress.stats.matchesPlayed}/104`, meta: progress.groupStageComplete ? 'Eliminatorias' : `Fase de grupos · ${nation?.group ?? '—'}`, route: '/juego/mundial' },
  ]

  return <section className="console-dashboard">
    <div className="console-dashboard__background" />
    <header className="console-dashboard__headline"><div><span><Sparkles /> CENTRO MUNDIAL</span><h1>El torneo vive<br/><em>en tu calendario.</em></h1></div><aside><small>PRÓXIMO RETO</small><b>{countdown}</b><span>DÍAS</span></aside></header>

    <div className="console-dashboard__layout">
      <section className="calendar-stage console-focus-card" data-console-focus tabIndex={0}>
        <header><div><small>SEMANA DE {nation?.shortName?.toUpperCase()}</small><h2>{new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(new Date(`${campaign.date}T12:00:00`))}</h2></div><button onClick={() => navigate('/juego/mundial')}>CALENDARIO COMPLETO <ChevronRight /></button></header>
        <nav className="calendar-stage__days">{days.map((date) => { const events=campaign.agenda.filter((item)=>item.date===date&&item.status==='pending'); const mandatory=events.some((item)=>item.mandatory); return <button key={date} className={`${selectedDate===date?'is-active':''} ${mandatory?'has-alert':''}`} onClick={()=>{setSelectedDate(date);setEventIndex(0)}}><small>{dayLabel(date).split(' ')[0]}</small><b>{dayLabel(date).split(' ')[1]}</b><i>{events.length}</i>{mandatory&&<em>!</em>}</button> })}</nav>
        <div className="calendar-stage__mission">{activeEvent ? <>
          <button className={`calendar-mission-card is-${activeEvent.priority}`} onClick={()=>navigate(activeEvent.route)}>
            <time><b>{activeEvent.time}</b><span>{activeEvent.durationMinutes} MIN</span></time>
            <span><small>{activeEvent.mandatory ? 'MISIÓN OBLIGATORIA' : activeEvent.type.toUpperCase()}</small><h3>{activeEvent.title}</h3><p>{activeEvent.summary}</p><footer>{activeEvent.effects.slice(0,3).map((effect)=><i key={effect}>{effect}</i>)}</footer></span>
            <strong>JUGAR DECISIÓN <ChevronRight/></strong>
          </button>
          <nav aria-label="Cambiar evento"><button disabled={eventIndex===0} onClick={()=>setEventIndex((value)=>Math.max(0,value-1))}><ChevronLeft/></button><span><b>{eventIndex+1}</b> / {selectedEvents.length}</span><button disabled={eventIndex>=selectedEvents.length-1} onClick={()=>setEventIndex((value)=>Math.min(selectedEvents.length-1,value+1))}><ChevronRight/></button></nav>
        </> : <div className="calendar-empty"><CalendarDays/><b>Jornada despejada</b><span>Álex no ha detectado tareas pendientes. Puedes revisar el equipo o avanzar.</span></div>}</div>
        <footer><span><Sparkles/> {activeEvent?.mandatory ? 'ÁLEX: RESUELVE ESTO ANTES DE AVANZAR' : 'ÁLEX: EL PLAN DEL DÍA ESTÁ BAJO CONTROL'}</span><span>{selectedEvents.reduce((total,item)=>total+item.durationMinutes,0)} MIN DE PREPARACIÓN</span></footer>
      </section>

      <aside className="console-dashboard__side">
        <section className="next-match-tile console-focus-card" tabIndex={0} onClick={()=>navigate('/juego/preparacion')} onKeyDown={(event)=>event.key==='Enter'&&navigate('/juego/preparacion')}>
          <div><small>PRÓXIMO PARTIDO · {next?.group ? `GRUPO ${next.group}` : 'MUNDIAL'}</small><b>{next ? new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(next.date)) : 'POR DEFINIR'}</b><span><MapPin/>{venue?.city ?? 'Sede internacional'}</span></div>
          <section><article>{nation&&<Flag code={nation.flagCode} label={nation.name} size="lg"/>}<b>{nation?.code}</b></article><i>VS</i><article>{opponent&&<Flag code={opponent.flagCode} label={opponent.name} size="lg"/>}<b>{opponent?.code??'TBD'}</b></article></section>
          <button>PREPARAR PARTIDO <ChevronRight/></button>
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
      <section className="player-carousel-console">
        <button className="carousel-arrow" onClick={()=>setFocusIndex((value)=>Math.max(0,value-1))}><ChevronLeft/></button>
        <div>{visible.map((player) => { const chosen=selected.has(player.id); const active=player.id===focused?.id; return <button key={player.id} className={`console-player-card ${active?'is-active':''} ${chosen?'is-chosen':''}`} onFocus={()=>setFocusIndex(filtered.indexOf(player))} onClick={()=>setFocusIndex(filtered.indexOf(player))}><header><span>{player.position}</span><b>{playerOverall(player)}</b></header><PlayerPortrait playerId={player.id} nationId={player.nationId} label={playerName(player)} size="hero" number={campaign.shirtNumbers[player.id]??filtered.indexOf(player)+1}/><strong>{player.shirtName}</strong><small>{playerClub(player)}</small><footer><span><Activity/>{82+(player.id.length*7%16)}%</span><i>{chosen?<Check/>:<Plus/>}</i></footer></button> })}</div>
        <button className="carousel-arrow" onClick={()=>setFocusIndex((value)=>Math.min(filtered.length-1,value+1))}><ChevronRight/></button>
      </section>
      {focused&&<aside className="console-player-report"><header><div><small>INFORME TÉCNICO</small><h2>{playerName(focused)}</h2><span>{focused.position} · {focused.positions.join(' / ')}</span></div><b>{playerOverall(focused)}</b></header><section><small>VEREDICTO DE ÁLEX</small><h3>{playerOverall(focused)>=86?'Puede decidir una noche grande':playerOverall(focused)>=80?'Solución fiable para el torneo':'Convocatoria ligada a un rol concreto'}</h3><p>{playerCaps(focused)>=45?'Experiencia para soportar presión, viajes y eliminatorias.':'Necesita un contexto estable y responsabilidades claras.'}</p></section><div className="console-report-bars"><span><small>Presión</small><i><em style={{width:`${assessment.pressure}%`}}/></i><b>{assessment.pressure}</b></span><span><small>Polivalencia</small><i><em style={{width:`${assessment.versatility}%`}}/></i><b>{assessment.versatility}</b></span><span><small>Condición</small><i><em style={{width:`${assessment.freshness}%`}}/></i><b>{assessment.freshness}</b></span></div><div className="console-player-actions"><button className={compareIds.includes(focused.id)?'is-active':''} onClick={()=>setCompareIds((ids)=>ids.includes(focused.id)?ids.filter((id)=>id!==focused.id):ids.length<3?[...ids,focused.id]:ids)}><BarChart3/> COMPARAR {compareIds.length}/3</button><button className={selected.has(focused.id)?'is-remove':''} onClick={()=>toggle(focused)}>{selected.has(focused.id)?<><X/> RETIRAR</>:<><Plus/> CONVOCAR</>}</button></div></aside>}
    </div>
    <footer className="squad-console-footer"><div>{campaign.squadIds.slice(-8).map((id)=>{const player=candidates.find((item)=>item.id===id);return player?<span key={id}>{player.shirtName}<button onClick={()=>toggle(player)}><X/></button></span>:null})}</div><button className="confirm-console" disabled={!canConfirm} onClick={confirm}><span><small>{canConfirm?'LISTA EQUILIBRADA':'FALTAN REQUISITOS'}</small><b>{canConfirm?'CONFIRMAR LOS 26':`${campaign.squadIds.length}/26 · ${goalkeepers}/3 POR`}</b></span><ChevronRight/></button></footer>
  </section>
}
