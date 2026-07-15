import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, BarChart3, Camera, Check, ChevronDown, CircleDot, Clock3, CloudSun, Crown,
  Brain, Eye, Gauge, Goal, MapPin, Maximize2, MessageCircle, Pause, Play, RotateCcw, Settings2, Shield,
  SkipForward, Sparkles, Target, Users, Volume2, VolumeX, Wind, X, Zap,
} from 'lucide-react'
import type { MatchEngine } from '../simulation/matchEngine'
import { createMatch } from '../simulation/matchEngine'
import { createDefaultTactic } from '../simulation/formations'
import type { MatchEvent, MatchSnapshot, Player as DomainPlayer, TacticPlan, TournamentStage } from '../domain'
import { domainNations, tournamentData } from '../data'
import { stadiumAudio } from '../audio/stadiumAudio'
import { Brand } from '../components/Brand'
import { Flag } from '../components/Flag'
import { PlayerPortrait, TeamShirt } from '../components/PlayerPortrait'
import { Progress, Segmented } from '../components/UI'
import { useGame } from '../App'
import { deriveCampaignProgress } from './campaignProgress'
import { applyCampaignContext } from './decisionEngine'
import type { CampaignUIState } from './ui-model'
import { validGoalEvents } from '../simulation/matchSummary'
import { fairPlayDeductionFromEvents } from '../simulation/campaign'
import { disciplineEventsFromSimulation, suspendedPlayerIds } from './discipline'
import { injuredPlayerIds, injuryEventsFromSimulation } from './availability'
import { buildMatchEnvironment } from './matchEnvironment'
import { inferTacticalPosition } from '../domain/tacticalIntelligence'
import { acceptBroadcastCue, createBroadcastCue, type BroadcastCue } from './broadcastDirector'

type Speed = 0.5 | 1 | 2 | 4 | 8

interface FeedEvent {
  id: string
  minute: number
  type: 'goal' | 'shot' | 'card' | 'foul' | 'change' | 'info'
  side?: 'home' | 'away'
  text: string
}

function phaseName(phase: MatchSnapshot['phase']) {
  return ({
    'not-started': 'PREPARTIDO', 'first-half': '1ª PARTE', 'half-time': 'DESCANSO',
    'second-half': '2ª PARTE', 'extra-time-first': 'PRÓRROGA', 'extra-time-break': 'PAUSA',
    'extra-time-second': 'PRÓRROGA', 'penalty-shootout': 'PENALTIS', finished: 'FINAL',
  })[phase]
}

function matchMinute(second: number) {
  return second <= 0 ? 0 : Math.min(120, Math.floor(second / 60) + 1)
}

function attackPhaseName(phase: MatchSnapshot['attackPhase']) {
  return ({ restart: 'REINICIO', 'build-up': 'SALIDA', progression: 'PROGRESIÓN', 'final-third': 'ÚLTIMO TERCIO', transition: 'TRANSICIÓN' })[phase]
}

function attackPatternName(pattern: MatchSnapshot['attackPattern']) {
  return ({
    'build-three': 'Salida de tres',
    'third-man': 'Tercer hombre y paredes',
    'wide-overlap': 'Fijar y solapar por fuera',
    'inside-overlap': 'Desdoblamiento interior',
    'switch-play': 'Cambio hacia el lado débil',
    counter: 'Contraataque vertical',
    patient: 'Ataque posicional paciente',
  } as const)[pattern]
}

function feedType(event: MatchEvent): FeedEvent['type'] {
  if (event.type === 'goal' || event.type === 'own-goal' || event.type === 'var-confirmed') return 'goal'
  if (event.type.startsWith('shot') || event.type === 'save' || event.type === 'corner') return 'shot'
  if (event.type.includes('card')) return 'card'
  if (event.type === 'foul' || event.type === 'free-kick' || event.type === 'offside') return 'foul'
  if (event.type === 'substitution' || event.type === 'tactical-shift') return 'change'
  return 'info'
}

function makeTactic(formation: string, mentality: string, settings: CampaignUIState['tacticSettings']): TacticPlan {
  const safeFormation = (['4-3-3','4-2-3-1','4-4-2','4-1-4-1','4-3-1-2','3-4-3','3-4-2-1','3-5-2','5-3-2','5-4-1'].includes(formation) ? formation : '4-3-3') as TacticPlan['formation']
  const safeMentality = ({ Cauta: 'defensive', Equilibrada: 'balanced', Positiva: 'positive', Ofensiva: 'attacking' } as const)[mentality as 'Cauta'|'Equilibrada'|'Positiva'|'Ofensiva'] ?? 'balanced'
  const active = new Set(settings.instructions ?? [])
  const clampSetting = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
  const tactic = createDefaultTactic(safeFormation, {
    mentality: safeMentality,
    width: clampSetting(settings.width + (active.has('overlap') ? 10 : 0) + (active.has('outside-trap') ? 3 : 0)),
    tempo: clampSetting(settings.tempo + (active.has('overlap') ? 4 : 0) - (active.has('work-box') ? 5 : 0) - (active.has('play-out') ? 3 : 0)),
    pressing: clampSetting(settings.pressing + (active.has('counter-press') ? 12 : 0)),
    defensiveLine: clampSetting(settings.defensiveLine + (active.has('counter-press') ? 5 : 0) + (active.has('outside-trap') ? 4 : 0)),
    passingDirectness: clampSetting(settings.passingDirectness - (active.has('play-out') ? 12 : 0) - (active.has('work-box') ? 8 : 0)),
    transition: settings.transition,
    marking: settings.marking,
  })
  return {
    ...tactic,
    slots: tactic.slots.map((slot, index) => {
      const key = `${safeFormation}:${index}`
      const custom = settings.positions[key]
      const role = settings.roles[key]
      const duty = role?.includes('Ataque') || role?.includes('profundo') || role?.includes('móvil')
        ? 'attack'
        : role?.includes('Defensa') || role?.includes('Ancla') || slot.position === 'GK'
          ? 'defend'
          : slot.duty
      return {
        ...slot,
        x: custom ? (100 - custom.y) / 100 : slot.x,
        y: custom ? custom.x / 100 : slot.y,
        position: custom ? inferTacticalPosition(custom.x, custom.y) : slot.position,
        playerId: custom?.playerId,
        role,
        duty,
      }
    }),
  }
}

function aiTactic(nation: (typeof domainNations)[number], oppositionStrength: number): TacticPlan {
  return createDefaultTactic(nation.tacticalIdentity === 'counter' ? '4-2-3-1' : nation.tacticalIdentity === 'low-block' ? '5-3-2' : '4-3-3', {
    mentality: nation.strength > oppositionStrength + 5 ? 'positive' : nation.strength + 8 < oppositionStrength ? 'defensive' : 'balanced',
    pressing: nation.tacticalIdentity === 'high-press' ? 80 : 54,
    tempo: nation.tacticalIdentity === 'vertical' || nation.tacticalIdentity === 'counter' ? 74 : 55,
    width: nation.tacticalIdentity === 'wide' ? 76 : 52,
    transition: nation.tacticalIdentity === 'counter' ? 'counter' : 'balanced',
  })
}

function stageForEngine(stage: (typeof tournamentData.fixtures)[number]['stage'] | undefined): TournamentStage {
  return ({ GROUP: 'group', ROUND_OF_32: 'round-of-32', ROUND_OF_16: 'round-of-16', QUARTER_FINAL: 'quarter-final', SEMI_FINAL: 'semi-final', THIRD_PLACE: 'third-place', FINAL: 'final' } as const)[stage ?? 'GROUP']
}

function stageTitlesForBroadcast(stage: (typeof tournamentData.fixtures)[number]['stage'] | undefined) {
  return ({ GROUP: 'FASE DE GRUPOS', ROUND_OF_32: 'DIECISEISAVOS', ROUND_OF_16: 'OCTAVOS DE FINAL', QUARTER_FINAL: 'CUARTOS DE FINAL', SEMI_FINAL: 'SEMIFINAL', THIRD_PLACE: 'TERCER PUESTO', FINAL: 'GRAN FINAL' } as const)[stage ?? 'GROUP']
}

export function MatchCenter() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { campaign, updateCampaign } = useGame()
  const rawControlled = domainNations.find((nation) => nation.id === campaign.nationId) ?? domainNations[0]!
  const progress = useMemo(() => {
    const customData = {
      ...tournamentData,
      nations: campaign.customNations ?? tournamentData.nations,
      fixtures: campaign.customFixtures ?? tournamentData.fixtures,
    }
    return deriveCampaignProgress(customData, campaign.matchResults, { controlledNationId: campaign.nationId })
  }, [campaign.matchResults, campaign.nationId, campaign.customNations, campaign.customFixtures])
  const requestedFixture = searchParams.get('fixture')
  const fixture = (requestedFixture ? progress.fixturesById[requestedFixture] : undefined)
    ?? (progress.nextControlledFixture && progress.nextControlledFixture.date.slice(0, 10) <= campaign.date ? progress.nextControlledFixture : undefined)
  const venue = tournamentData.venues.find((item) => item.id === fixture?.venueId)
  const previousMatchDates = useMemo(() => Object.values(campaign.matchResults)
    .filter((result) => result.homeNationId === campaign.nationId || result.awayNationId === campaign.nationId)
    .map((result) => result.playedAt), [campaign.matchResults, campaign.nationId])
  const environment = useMemo(() => buildMatchEnvironment({
    fixtureId: fixture?.id ?? `preview-${rawControlled.id}`,
    kickoff: fixture?.date ?? `${campaign.date}T20:00:00Z`,
    city: venue?.city ?? 'Dallas',
    hotelId: campaign.hotelId,
    nationCode: rawControlled.code,
    localSupport: campaign.localSupport,
    climateAdaptation: campaign.climateAdaptation,
    previousMatchDates,
  }), [campaign.climateAdaptation, campaign.date, campaign.hotelId, campaign.localSupport, fixture?.date, fixture?.id, previousMatchDates, rawControlled.code, rawControlled.id, venue?.city])
  const controlled = useMemo(() => applyCampaignContext(rawControlled, campaign, environment), [campaign.difficulty, campaign.fatigue, campaign.localSupport, campaign.morale, campaign.recovery, campaign.tacticalFamiliarity, environment, rawControlled])
  const fallbackOpponent = domainNations.find((nation) => nation.group === rawControlled.group && nation.id !== rawControlled.id) ?? domainNations[1]!
  const rawHome = fixture?.homeNationId ? (domainNations.find((nation) => nation.id === fixture.homeNationId) ?? rawControlled) : rawControlled
  const rawAway = fixture?.awayNationId ? (domainNations.find((nation) => nation.id === fixture.awayNationId) ?? fallbackOpponent) : fallbackOpponent
  const home = rawHome.id === controlled.id ? controlled : rawHome
  const away = rawAway.id === controlled.id ? controlled : rawAway
  const spectator = home.id !== controlled.id && away.id !== controlled.id
  const userSide: 'home' | 'away' = home.id === controlled.id || spectator ? 'home' : 'away'
  const homeSuspended = useMemo(() => suspendedPlayerIds(campaign.matchResults, home.id), [campaign.matchResults, home.id])
  const awaySuspended = useMemo(() => suspendedPlayerIds(campaign.matchResults, away.id), [away.id, campaign.matchResults])
  const homeInjured = useMemo(() => injuredPlayerIds(campaign.matchResults, campaign.date, home.id), [campaign.date, campaign.matchResults, home.id])
  const awayInjured = useMemo(() => injuredPlayerIds(campaign.matchResults, campaign.date, away.id), [away.id, campaign.date, campaign.matchResults])
  const userSquad = useMemo(() => {
    const suspended = controlled.id === home.id ? homeSuspended : awaySuspended
    const injured = controlled.id === home.id ? homeInjured : awayInjured
    const selected = controlled.players.filter((player) => campaign.squadIds.includes(player.id) && !suspended.has(player.id) && !injured.has(player.id))
    return (selected.length >= 11 ? selected : controlled.players.filter((player) => player.officialPreset && !suspended.has(player.id) && !injured.has(player.id)))
      .map((player) => ({ ...player, shirtNumber: campaign.shirtNumbers[player.id] ?? player.shirtNumber }))
  }, [awayInjured, awaySuspended, campaign.shirtNumbers, campaign.squadIds, controlled, home.id, homeInjured, homeSuspended])
  const engineRef = useRef<MatchEngine | null>(null)
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [muted, setMuted] = useState(false)
  const [camera, setCamera] = useState<'Táctica'|'Dinámica'>('Dinámica')
  const [view, setView] = useState<'partido'|'estadisticas'|'formaciones'>('partido')
  const [showSettings, setShowSettings] = useState(false)
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('gm26-master-volume') ?? 55))
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [feedFilter, setFeedFilter] = useState<'Todos'|'Claves'>('Todos')
  const [feed, setFeed] = useState<FeedEvent[]>([{ id:'kickoff', minute:0, type:'info', text:'Los equipos están preparados. Todo listo para el saque inicial.' }])
  const [subModal, setSubModal] = useState(false)
  const [selectedOut, setSelectedOut] = useState<string>()
  const [selectedIn, setSelectedIn] = useState<string>()
  const [subCount, setSubCount] = useState(0)
  const [subWindows, setSubWindows] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [broadcastCue, setBroadcastCue] = useState<BroadcastCue>()
  const [replaying, setReplaying] = useState(false)
  const frameRef = useRef<number>(0)
  const replayFrameRef = useRef<number>(0)
  const replayBufferRef = useRef<MatchSnapshot[]>([])
  const lastFrameRef = useRef(0)
  const tickCarryRef = useRef(0)
  const resultSavedRef = useRef(false)
  const lastSubWindowTickRef = useRef<number | undefined>(undefined)
  const eventCursorRef = useRef(0)
  const lastRoutineNarrationTickRef = useRef(-1_000)
  const lastNarrationSignatureRef = useRef('')
  const broadcastSignaturesRef = useRef<string[]>([])
  const broadcastTimerRef = useRef<number | undefined>(undefined)

  const playerMap = useMemo(() => new Map([...home.players, ...away.players].map((player) => [player.id, player])), [away.players, home.players])
  const initEngine = useCallback(() => {
    const userTactic = {
      ...makeTactic(campaign.tactic, campaign.mentality, campaign.tacticSettings),
      captainId: campaign.captainId,
      penaltyTakerIds: campaign.penaltyTakerId ? [campaign.penaltyTakerId] : [],
      cornerTakerIds: campaign.cornerTakerId ? [campaign.cornerTakerId] : [],
      freeKickTakerIds: campaign.freeKickTakerId ? [campaign.freeKickTakerId] : [],
    }
    const homeTactic = home.id === controlled.id ? userTactic : aiTactic(home, away.strength)
    const awayTactic = away.id === controlled.id ? userTactic : aiTactic(away, home.strength)
    const engine = createMatch({
      id: fixture?.id ?? `gm26-${home.id}-${away.id}`,
      seed: spectator && fixture ? `ai-${fixture.id}-gm26-v1` : `${campaign.nationId}-${fixture?.id ?? 'preview'}`,
      home,
      away,
      homeTactic,
      awayTactic,
      homeSquad: home.id === controlled.id ? userSquad : home.players.filter((player) => player.officialPreset && !homeSuspended.has(player.id) && !homeInjured.has(player.id)),
      awaySquad: away.id === controlled.id ? userSquad : away.players.filter((player) => player.officialPreset && !awaySuspended.has(player.id) && !awayInjured.has(player.id)),
      stage: stageForEngine(fixture?.stage),
      knockout: fixture ? fixture.stage !== 'GROUP' : false,
      weather: environment.weather,
      snapshotIntervalTicks: 1,
    })
    engineRef.current = engine
    eventCursorRef.current = 0
    lastRoutineNarrationTickRef.current = -1_000
    lastNarrationSignatureRef.current = ''
    broadcastSignaturesRef.current = []
    setBroadcastCue(undefined)
    const initial = engine.currentSnapshot
    replayBufferRef.current = [initial]
    setSnapshot(initial)
    setFeed([{ id:'ready', minute:0, type:'info', text:`El estadio ruge. ${home.shortName} y ${away.shortName} ya esperan el silbato.` }])
    resultSavedRef.current = Boolean(fixture && campaign.matchResults[fixture.id])
    setPlaying(false); setShowResult(false); setSubCount(0); setSubWindows(0); lastSubWindowTickRef.current = undefined
  }, [away, awayInjured, awaySuspended, campaign.captainId, campaign.cornerTakerId, campaign.freeKickTakerId, campaign.mentality, campaign.nationId, campaign.penaltyTakerId, campaign.tactic, campaign.tacticSettings, controlled.id, environment.weather, fixture?.id, fixture?.stage, home, homeInjured, homeSuspended, spectator, userSquad])

  useEffect(() => { initEngine(); return () => { window.cancelAnimationFrame(frameRef.current); window.cancelAnimationFrame(replayFrameRef.current) } }, [initEngine])
  useEffect(() => { stadiumAudio.setEnabled(!muted) }, [muted])
  useEffect(() => { stadiumAudio.setVolume(volume / 100); localStorage.setItem('gm26-master-volume', String(volume)) }, [volume])
  useEffect(() => {
    if (!snapshot) return
    const phaseBoost = snapshot.attackPhase === 'final-third' ? 0.1 : snapshot.attackPhase === 'transition' ? 0.07 : 0
    stadiumAudio.setIntensity(0.11 + snapshot.tension / 230 + phaseBoost)
  }, [snapshot?.attackPhase, snapshot?.tension])
  useEffect(() => () => { stadiumAudio.destroy(); window.clearTimeout(broadcastTimerRef.current) }, [])

  const consumeEngineEvents = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const unseen = engine.eventLog.slice(eventCursorRef.current)
    eventCursorRef.current = engine.eventLog.length
    const importantTypes = new Set(['goal','own-goal','shot','shot-on-target','shot-off-target','shot-blocked','save','foul','yellow-card','red-card','injury','substitution','offside','penalty-awarded','var-check','var-confirmed','var-overturn','tactical-shift','momentum','penalty-scored','penalty-missed','match-end'])
    const visible = unseen.filter((event) => {
      if (['period-start','kick-off'].includes(event.type) && event.second > 1) return false
      const signature = event.commentary.replace(/^\d+'\s*/, '').replace(/\b\d+\b/g, '#')
      if (importantTypes.has(event.type)) {
        lastNarrationSignatureRef.current = signature
        return true
      }
      if (event.tick-lastRoutineNarrationTickRef.current < 160 || signature === lastNarrationSignatureRef.current) return false
      lastRoutineNarrationTickRef.current = event.tick
      lastNarrationSignatureRef.current = signature
      return true
    })
    if (!visible.length) return
    const next: FeedEvent[] = visible.map((event) => ({
      id: event.id,
      minute: matchMinute(event.second),
      type: feedType(event),
      side: event.side,
      text: event.commentary.replace(/^\d+'\s*/, ''),
    }))
    setFeed((current) => [...next.reverse(), ...current].slice(0, 20))
    const cueEvent = [...visible].reverse().find((event) => !['pass', 'cross', 'dribble', 'interception'].includes(event.type)) ?? visible.at(-1)
    if (!cueEvent) return
    const cue = createBroadcastCue(cueEvent, {
      stage: fixture?.stage && fixture.stage !== 'GROUP' ? 'knockout' : 'group',
      homeName: home.shortName,
      awayName: away.shortName,
      tension: engine.currentSnapshot.tension,
    })
    const accepted = acceptBroadcastCue(broadcastSignaturesRef.current, cue)
    broadcastSignaturesRef.current = accepted.signatures
    if (!accepted.accepted || cue.importance === 'routine') return
    window.clearTimeout(broadcastTimerRef.current)
    setBroadcastCue(cue)
    broadcastTimerRef.current = window.setTimeout(() => setBroadcastCue((current) => current?.id === cue.id ? undefined : current), cue.durationMs)
    void stadiumAudio.cue(cue.audio)
  }, [away.shortName, fixture?.stage, home.shortName])

  const saveResult = useCallback((final: MatchSnapshot) => {
    if (!fixture || resultSavedRef.current) return
    resultSavedRef.current = true
    const result = engineRef.current?.runToEnd()
    updateCampaign((current) => {
      const matchResults = {
        ...current.matchResults,
        [fixture.id]: {
          fixtureId: fixture.id,
          homeNationId: home.id,
          awayNationId: away.id,
          home: final.score.home,
          away: final.score.away,
          homePenalties: final.score.penalties?.home,
          awayPenalties: final.score.penalties?.away,
          homeXg: final.stats.home.xg,
          awayXg: final.stats.away.xg,
          homeYellowCards: final.stats.home.yellowCards,
          awayYellowCards: final.stats.away.yellowCards,
          homeRedCards: final.stats.home.redCards,
          awayRedCards: final.stats.away.redCards,
          homeFairPlayPoints: result ? fairPlayDeductionFromEvents(result, 'home') : 0,
          awayFairPlayPoints: result ? fairPlayDeductionFromEvents(result, 'away') : 0,
          discipline: result ? disciplineEventsFromSimulation(result, home.id, away.id) : [],
          injuries: result ? injuryEventsFromSimulation(result, home.id, away.id) : [],
          goals: result && validGoalEvents(result.events)
            .map((event) => ({ playerId: event.playerId, assistId: event.secondaryPlayerId, nationId: event.side === 'home' ? home.id : away.id, minute: matchMinute(event.second) })),
          playedAt: current.date,
        },
      }
      const customData = {
        ...tournamentData,
        nations: current.customNations ?? tournamentData.nations,
        fixtures: current.customFixtures ?? tournamentData.fixtures,
      }
      const nextProgress = deriveCampaignProgress(customData, matchResults, { controlledNationId: current.nationId })
      return { ...current, matchResults, completed: nextProgress.completed }
    })
  }, [away.id, fixture, home.id, updateCampaign])

  useEffect(() => {
    if (!playing || !engineRef.current || snapshot?.phase === 'finished') return
    lastFrameRef.current = performance.now()
    const loop = (now:number) => {
      const engine = engineRef.current
      if (!engine) return
      const delta = Math.min(50, now-lastFrameRef.current)
      lastFrameRef.current = now
      tickCarryRef.current += delta * 0.06 * speed
      const steps = Math.floor(tickCarryRef.current)
      tickCarryRef.current -= steps
      let next = engine.currentSnapshot
      for(let index=0;index<steps && !engine.isFinished;index+=1) next=engine.step()
      if(steps>0){
        consumeEngineEvents()
        replayBufferRef.current = [...replayBufferRef.current.filter((item) => item.tick >= next.tick - 120), next].slice(-150)
        setSnapshot(next)
      }
      if(engine.isFinished){ saveResult(next); setPlaying(false); setShowResult(true); return }
      frameRef.current=window.requestAnimationFrame(loop)
    }
    frameRef.current=window.requestAnimationFrame(loop)
    return ()=>window.cancelAnimationFrame(frameRef.current)
  }, [consumeEngineEvents, playing, saveResult, snapshot?.phase, speed])

  const startReplay = useCallback(() => {
    if (replaying || replayBufferRef.current.length < 2) return
    const frames = [...replayBufferRef.current]
    const resumeAfter = playing
    setPlaying(false)
    setReplaying(true)
    let index = 0
    let previous = performance.now()
    const loop = (now: number) => {
      if (now - previous >= 34) {
        previous = now
        setSnapshot(frames[index]!)
        index += 1
      }
      if (index < frames.length) {
        replayFrameRef.current = window.requestAnimationFrame(loop)
        return
      }
      setSnapshot(engineRef.current?.currentSnapshot ?? frames.at(-1)!)
      setReplaying(false)
      if (resumeAfter) setPlaying(true)
    }
    replayFrameRef.current = window.requestAnimationFrame(loop)
  }, [playing, replaying])
  const togglePlay = async () => { if(replaying)return;await stadiumAudio.unlock(); if(snapshot?.phase==='finished'){initEngine();return} setPlaying((value)=>!value) }
  const instant = () => { const engine=engineRef.current;if(!engine)return;const result=engine.runToEnd();const final=result.snapshots.at(-1)??engine.currentSnapshot;setSnapshot(final);saveResult(final);setFeed(result.events.slice(-20).reverse().map(event=>({id:event.id,minute:matchMinute(event.second),type:feedType(event),side:event.side,text:event.commentary.replace(/^\d+'\s*/, '')})));setPlaying(false);setShowResult(true) }
  const possessionTotal=(snapshot?.stats.home.possessionTicks??0)+(snapshot?.stats.away.possessionTicks??0)
  const homePoss=possessionTotal?Math.round((snapshot!.stats.home.possessionTicks/possessionTotal)*100):50
  const homeOnPitch=snapshot?.players.filter(player=>player.side==='home'&&player.onPitch)??[]
  const userOnPitch=snapshot?.players.filter(player=>player.side===userSide&&player.onPitch)??[]
  const oppositionSide: 'home' | 'away' = userSide === 'home' ? 'away' : 'home'
  const oppositionOnPitch=snapshot?.players.filter(player=>player.side===oppositionSide&&player.onPitch)??[]
  const displayNation = userSide === 'home' ? home : away
  const oppositionNation = oppositionSide === 'home' ? home : away
  const displayPossession = userSide === 'home' ? homePoss : 100-homePoss
  const onPitchIds=new Set(userOnPitch.map(player=>player.playerId))
  const bench=spectator ? [] : userSquad.filter(player=>!onPitchIds.has(player.id))
  const visibleFeed = feedFilter === 'Todos' ? feed : feed.filter((event) => ['goal', 'card', 'shot', 'change'].includes(event.type))
  const extraTimeActive = snapshot?.phase === 'extra-time-first' || snapshot?.phase === 'extra-time-break' || snapshot?.phase === 'extra-time-second' || snapshot?.phase === 'penalty-shootout'
  const substitutionLimit = extraTimeActive ? 6 : 5
  const substitutionWindowLimit = extraTimeActive ? 4 : 3

  const makeSubstitution=()=>{if(spectator||!selectedOut||!selectedIn||!engineRef.current)return;const windowTick=engineRef.current.currentSnapshot.tick;const ok=engineRef.current.applyCommand({type:'substitute',side:userSide,playerOutId:selectedOut,playerInId:selectedIn});if(ok){const next=engineRef.current.currentSnapshot;setSnapshot(next);setSubCount(count=>count+1);if(lastSubWindowTickRef.current!==windowTick){lastSubWindowTickRef.current=windowTick;setSubWindows(count=>count+1)}setFeed(current=>[{id:`sub-ui-${next.tick}-${selectedIn}`,minute:matchMinute(next.second),type:'change',side:userSide,text:`Entra ${playerMap.get(selectedIn)?.shirtName}; sale ${playerMap.get(selectedOut)?.shirtName}.`},...current]);setSelectedOut(undefined);setSelectedIn(undefined)}}
  const applyLivePlan = (plan: 'proteger' | 'equilibrar' | 'remontar') => {
    if (spectator || !engineRef.current) return
    const modifiers = plan === 'proteger'
      ? { mentality: 'Cauta', tempo: -18, pressing: -10, defensiveLine: -16 }
      : plan === 'remontar'
        ? { mentality: 'Ofensiva', tempo: 18, pressing: 15, defensiveLine: 12 }
        : { mentality: campaign.mentality, tempo: 0, pressing: 0, defensiveLine: 0 }
    const settings = {
      ...campaign.tacticSettings,
      tempo: Math.max(0, Math.min(100, campaign.tacticSettings.tempo + modifiers.tempo)),
      pressing: Math.max(0, Math.min(100, campaign.tacticSettings.pressing + modifiers.pressing)),
      defensiveLine: Math.max(0, Math.min(100, campaign.tacticSettings.defensiveLine + modifiers.defensiveLine)),
    }
    const tactic = {
      ...makeTactic(campaign.tactic, modifiers.mentality, settings),
      captainId: campaign.captainId,
      penaltyTakerIds: campaign.penaltyTakerId ? [campaign.penaltyTakerId] : [],
      cornerTakerIds: campaign.cornerTakerId ? [campaign.cornerTakerId] : [],
      freeKickTakerIds: campaign.freeKickTakerId ? [campaign.freeKickTakerId] : [],
    }
    engineRef.current.applyCommand({ type: 'change-tactic', side: userSide, tactic })
    const currentSnapshot = engineRef.current.currentSnapshot
    setFeed((current) => [{ id:`plan-${plan}-${currentSnapshot.tick}`, minute:matchMinute(currentSnapshot.second), type:'change' as const, side:userSide, text:`El banquillo activa el plan «${plan}». La estructura y la intensidad cambian.` }, ...current].slice(0, 16))
  }
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      setFeed((current) => [{ id:`fullscreen-${snapshot?.tick ?? 0}`, minute:matchMinute(snapshot?.second ?? 0), type:'info' as const, text:'El navegador ha bloqueado el modo de pantalla completa.' }, ...current])
    }
  }
  const statRows = snapshot ? [['Tiros',snapshot.stats.home.shots,snapshot.stats.away.shots],['A puerta',snapshot.stats.home.shotsOnTarget,snapshot.stats.away.shotsOnTarget],['xG',snapshot.stats.home.xg.toFixed(2),snapshot.stats.away.xg.toFixed(2)],['Posesión',`${homePoss}%`,`${100-homePoss}%`],['Pases',snapshot.stats.home.passesCompleted,snapshot.stats.away.passesCompleted],['Córners',snapshot.stats.home.corners,snapshot.stats.away.corners],['Faltas',snapshot.stats.home.fouls,snapshot.stats.away.fouls]] : []
  const weatherLabel = ({ clear:'Despejado',rain:'Lluvia',hot:'Calor intenso',windy:'Viento fuerte' } as const)[environment.weather]
  const currentTension = snapshot?.tension ?? 0
  const tensionBand = currentTension >= 82 ? 'extreme' : currentTension >= 62 ? 'high' : currentTension >= 40 ? 'medium' : 'calm'
  const liveRead = snapshot
    ? snapshot.tension >= 82
      ? 'Zona crítica: cualquier duelo, rebote o pérdida puede decidir el partido.'
      : snapshot.attackPhase === 'transition'
        ? `${snapshot.possession === 'home' ? home.shortName : away.shortName} corre con el bloque rival desordenado.`
        : snapshot.attackPhase === 'final-third'
          ? `${snapshot.possession === 'home' ? home.shortName : away.shortName} instala la posesión cerca del área.`
          : snapshot.attackPhase === 'build-up'
            ? `${snapshot.possession === 'home' ? home.shortName : away.shortName} atrae la presión para encontrar una salida limpia.`
            : 'Los dos bloques disputan el control territorial del partido.'
    : ''

  if(!home||!away||!snapshot)return <main className="match-loading"><Brand/><span/><p>Preparando el estadio y las alineaciones…</p></main>
  return <main className={`match-center match-center--tension-${tensionBand}`}>
    <header className="match-topbar"><button className="match-exit" onClick={()=>navigate('/juego')}><ArrowLeft/> VOLVER AL VESTUARIO</button><div className="match-score"><div><Flag code={home.flagCode} label={home.name}/><b>{home.code}</b></div><span><small>{phaseName(snapshot.phase)} · {matchMinute(snapshot.second)}'</small><strong>{snapshot.score.home}<i>—</i>{snapshot.score.away}</strong>{snapshot.score.penalties&&<em>Pen. {snapshot.score.penalties.home}-{snapshot.score.penalties.away}</em>}<i className="score-tension" title={`Tensión ${Math.round(snapshot.tension)}%`}><span style={{width:`${snapshot.tension}%`}}/></i></span><div><b>{away.code}</b><Flag code={away.flagCode} label={away.name}/></div></div><div className="match-topbar__actions"><button className="icon-button" onClick={()=>setMuted(value=>!value)} aria-label={muted?'Activar audio':'Silenciar'}>{muted?<VolumeX/>:<Volume2/>}</button><button className={`icon-button ${showSettings ? 'is-active' : ''}`} onClick={() => setShowSettings((value) => !value)} aria-label="Ajustes de partido"><Settings2/></button><button className="icon-button" onClick={toggleFullscreen} aria-label="Pantalla completa"><Maximize2/></button></div></header>
    {snapshot.phase==='not-started'&&!playing&&<section className="match-stadium-intro"><div className="match-stadium-intro__light"/><span><Sparkles/> NOCHE DE MUNDIAL · TÚNEL DE VESTUARIOS</span><h1>{home.shortName} <em>contra</em> {away.shortName}</h1><p>{stageTitlesForBroadcast(fixture?.stage)} · {venue?.name ?? 'Gran estadio internacional'} · {environment.temperatureC}°</p><div><article><Flag code={home.flagCode} label={home.name} size="lg"/><b>{home.name}</b><small>{home.tacticalIdentity.replace('-', ' ').toUpperCase()}</small></article><i><Crown/><small>GLORIA<br/>MUNDIAL 26</small></i><article><Flag code={away.flagCode} label={away.name} size="lg"/><b>{away.name}</b><small>{away.tacticalIdentity.replace('-', ' ').toUpperCase()}</small></article></div><button onClick={togglePlay}><Play/> SALIR AL CÉSPED <ArrowLeft/></button></section>}
    {showSettings&&<section className="match-settings-popover"><header><b>PARTIDO, ENTORNO Y ACCESIBILIDAD</b><button onClick={() => setShowSettings(false)}><X/></button></header><label><span><Volume2/><b>Volumen del estadio</b></span><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))}/><em>{volume}%</em></label><label><span><Activity/><b>Reducir movimiento</b></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)}/></label><div className="match-context-grid"><span><CloudSun/><b>Clima</b><em>{weatherLabel} · {environment.temperatureC} °C</em></span><span><Wind/><b>Aire</b><em>{environment.humidity}% humedad · {environment.windKph} km/h</em></span><span><MapPin/><b>Altitud</b><em>{environment.altitudeM.toLocaleString('es-ES')} m</em></span><span><ArrowLeft/><b>Desplazamiento</b><em>{environment.travelKm.toLocaleString('es-ES')} km</em></span><span><Clock3/><b>Descanso</b><em>{environment.restDays} días</em></span><span><Users/><b>Apoyo previsto</b><em>{environment.supporterShare}%</em></span><span><Gauge/><b>Estado del césped</b><em>{environment.pitchQuality}/100</em></span><span><Sparkles/><b>Impacto físico</b><em>Fatiga {environment.fatigueDelta>=0?'+':''}{environment.fatigueDelta}</em></span></div><p><Sparkles/> Viaje, descanso, clima, altitud, césped y apoyo ya modifican condición y decisiones.</p></section>}
    <div className="match-toolbar"><div><button className={view==='partido'?'is-active':''} onClick={()=>setView('partido')}><Play/> Partido</button><button className={view==='estadisticas'?'is-active':''} onClick={()=>setView('estadisticas')}><BarChart3/> Estadísticas</button><button className={view==='formaciones'?'is-active':''} onClick={()=>setView('formaciones')}><Users/> Formaciones</button></div><span><CircleDot/> {attackPhaseName(snapshot.attackPhase)} · Tensión {Math.round(snapshot.tension)}% · {venue?.name??'Sede internacional'} · {weatherLabel} {environment.temperatureC}°</span><Segmented value={camera} onChange={setCamera} options={['Táctica','Dinámica']} label="Cámara"/></div>
    <div className="match-layout">
      <aside className="match-side match-side--home"><TeamFormation title={displayNation.shortName} players={userOnPitch} playerMap={playerMap} color="cyan"/>{spectator?<div className="spectator-badge"><Eye/> MODO ESPECTADOR · IA CONTRA IA</div>:<button className="button button--cyan button--wide" onClick={()=>{setPlaying(false);setShowSettings(false);setSubModal(true)}} disabled={subCount>=substitutionLimit}><RotateCcw/> TÁCTICAS Y CAMBIOS <span>{subCount}/{substitutionLimit}</span></button>}<div className="dugout"><header><span className="avatar">{spectator?'TV':'AV'}</span><div><b>{spectator?'Cabina táctica':'Álex Vega · Asistente'}</b><small>{spectator?'ANÁLISIS EN VIVO':'BANQUILLO'}</small></div><MessageCircle/></header><p>{spectator?`${displayNation.shortName} tiene el ${displayPossession}% de posesión. Puedes pausar, acelerar o revisar cualquier dato del encuentro.`:displayPossession<45?'Nos están quitando el balón. Bajaría el ritmo y juntaría el bloque.':(userSide==='home'?snapshot.stats.home.shots<snapshot.stats.away.shots:snapshot.stats.away.shots<snapshot.stats.home.shots)?'Necesitamos pisar más el área. Hay espacio a la espalda de sus laterales.':'El plan está funcionando. Mantengamos la concentración.'}</p>{!spectator&&<div><button onClick={()=>applyLivePlan(displayPossession<45?'proteger':'remontar')}>APLICAR CONSEJO</button><button onClick={()=>setFeed(current=>[{id:`ignored-${snapshot.tick}`,minute:matchMinute(snapshot.second),type:'info' as const,text:'El seleccionador mantiene el plan actual pese al consejo del asistente.'},...current].slice(0,16))}>IGNORAR</button></div>}</div></aside>
      <section className="match-main">
        {view==='partido'&&<><div className={`match-canvas-wrap match-canvas-wrap--${camera.toLowerCase()} ${replaying?'is-replaying':''}`}><MatchCanvas snapshot={snapshot} homeColor={home.primaryColor} homeSecondary={home.secondaryColor} awayColor={away.primaryColor} awaySecondary={away.secondaryColor} reducedMotion={reducedMotion} camera={camera}/><div className="match-clock"><span className="live-dot"/> {replaying?'REPETICIÓN 12 S':'EN DIRECTO'} · {phaseName(snapshot.phase)}</div><div className="match-canvas__score"><Flag code={home.flagCode} label={home.name} size="sm"/><b>{snapshot.score.home} — {snapshot.score.away}</b><Flag code={away.flagCode} label={away.name} size="sm"/></div><div className="camera-badge"><Camera/> {camera}</div>{broadcastCue&&<div className={`match-drama-overlay match-drama-overlay--${broadcastCue.importance}`}><Crown/><span>{broadcastCue.headline}</span><b>{broadcastCue.narration}</b>{broadcastCue.replay&&<button type="button" onClick={startReplay} disabled={replaying}><Camera/> {replaying?'REPRODUCIENDO':'VER REPETICIÓN 12 S'}</button>}</div>}<div className="match-live-read"><span><Brain /> JUGADA EN CONSTRUCCIÓN</span><b>{attackPatternName(snapshot.attackPattern)}</b><em>{liveRead} · Secuencia {snapshot.patternStep + 1} · Momentum {snapshot.momentum > 0 ? '+' : ''}{snapshot.momentum}</em></div><div className="match-context-ribbon"><span><CloudSun/> {environment.temperatureC}° · {environment.humidity}%</span><span><Wind/> {environment.windKph} km/h</span><span><MapPin/> {environment.altitudeM.toLocaleString('es-ES')} m</span><span><Users/> {environment.supporterShare}% apoyo</span></div></div><div className="match-feed"><header><span><Sparkles/> COMENTARIO EN DIRECTO</span><button onClick={() => setFeedFilter((value) => value === 'Todos' ? 'Claves' : 'Todos')}>{feedFilter === 'Todos' ? 'Todos los eventos' : 'Momentos clave'} <ChevronDown/></button></header><div>{visibleFeed.length ? visibleFeed.map((event,index)=><article key={event.id} className={`match-event match-event--${event.type} ${index===0?'is-latest':''}`}><time>{event.minute}'</time><span>{event.type==='goal'?<Goal/>:event.type==='card'?<span className="yellow-card"/>:event.type==='shot'?<Target/>:event.type==='change'?<RotateCcw/>:<CircleDot/>}</span><p>{event.text}</p></article>) : <article className="match-event"><time>—</time><span><CircleDot/></span><p>Aún no hay momentos clave.</p></article>}</div></div></>}
        {view==='estadisticas'&&<div className="full-stats"><header><span className="eyebrow">DATOS EN DIRECTO</span><h2>Radiografía del partido</h2></header>{statRows.map(([label,h,a])=><div key={String(label)}><b>{h}</b><span>{label}</span><b>{a}</b><i><em style={{width:`${(Number.parseFloat(String(h))||0)/Math.max(1,(Number.parseFloat(String(h))||0)+(Number.parseFloat(String(a))||0))*100}%`}}/></i></div>)}</div>}
        {view==='formaciones'&&<div className="formation-comparison"><TeamFormation title={home.shortName} players={homeOnPitch} playerMap={playerMap} color="cyan"/><span><Zap/> VS</span><TeamFormation title={away.shortName} players={snapshot.players.filter(player=>player.side==='away'&&player.onPitch)} playerMap={playerMap} color="gold"/></div>}
      </section>
      <aside className="match-side match-side--away"><TeamFormation title={oppositionNation.shortName} players={oppositionOnPitch} playerMap={playerMap} color="gold"/><section className="live-stats"><header><span>ESTADÍSTICAS</span><Gauge/></header>{statRows.slice(0,6).map(([label,h,a])=><div key={String(label)}><b>{h}</b><span>{label}<i><em style={{width:`${(Number.parseFloat(String(h))||0)/Math.max(1,(Number.parseFloat(String(h))||0)+(Number.parseFloat(String(a))||0))*100}%`}}/></i></span><b>{a}</b></div>)}</section></aside>
    </div>
    <footer className="match-controls"><div className="match-controls__left"><button className="icon-button" onClick={togglePlay}>{playing?<Pause/>:<Play/>}</button><div className="match-progress"><span style={{width:`${Math.min(100,snapshot.second/(90*60)*100)}%`}}/><i style={{left:`${Math.min(100,snapshot.second/(90*60)*100)}%`}}/></div><span>{matchMinute(snapshot.second)}:00 / 90:00</span></div><div className="speed-controls"><span>VELOCIDAD</span>{([0.5,1,2,4,8] as Speed[]).map(value=><button key={value} className={speed===value?'is-active':''} onClick={()=>setSpeed(value)} title={value===8?'Modo rápido: partido completo en unos dos minutos':undefined}>{value}×</button>)}</div><button className="instant-button" onClick={instant}><SkipForward/> RESULTADO INSTANTÁNEO</button></footer>
    {subModal&&<div className="modal-backdrop"><section className="sub-modal modal">
      <header><div><span className="eyebrow">VENTANA DE CAMBIOS · PARTIDO PAUSADO</span><h2>Tácticas y sustituciones</h2></div><button className="icon-button" onClick={()=>setSubModal(false)}><X/></button></header>
      <div className="sub-modal__summary"><span><RotateCcw/> Cambios usados <b>{subCount}/{substitutionLimit}</b></span><span><Clock3/> Ventanas <b>{subWindows}/{substitutionWindowLimit}</b></span><div className="live-plan-buttons"><button onClick={() => applyLivePlan('proteger')}><Shield/> PROTEGER</button><button onClick={() => applyLivePlan('equilibrar')}><CircleDot/> EQUILIBRAR</button><button onClick={() => applyLivePlan('remontar')}><Zap/> REMONTAR</button></div></div>
      <div className="sub-columns"><section><h3><span>SALIR</span> Once actual</h3>{userOnPitch.map(state=>{const player=playerMap.get(state.playerId);return <button key={state.playerId} className={selectedOut===state.playerId?'is-selected':''} onClick={()=>setSelectedOut(state.playerId)}><PlayerPortrait playerId={state.playerId} nationId={state.nationId} label={player?.shirtName??'Jugador'} number={state.shirtNumber}/><span><b>{player?.shirtName}</b><small>{state.position} · Nota {state.rating.toFixed(1)}</small><Progress value={state.stamina} tone={state.stamina<60?'red':'green'}/></span>{selectedOut===state.playerId&&<Check/>}</button>})}</section><ArrowLeft className="sub-arrow"/><section><h3><span>ENTRAR</span> Banquillo</h3>{bench.map(player=><button key={player.id} className={selectedIn===player.id?'is-selected':''} onClick={()=>setSelectedIn(player.id)}><PlayerPortrait playerId={player.id} nationId={player.nationId} label={player.shirtName} number={player.shirtNumber??'—'}/><span><b>{player.shirtName}</b><small>{player.primaryPosition} · Nivel {player.gameRatings.overall}</small><Progress value={player.condition} tone="green"/></span>{selectedIn===player.id&&<Check/>}</button>)}</section></div>
      <button className="button button--gold button--wide" disabled={!selectedOut||!selectedIn||subCount>=substitutionLimit} onClick={makeSubstitution}>CONFIRMAR SUSTITUCIÓN <RotateCcw/></button>
    </section></div>}
    {showResult&&<div className="result-overlay"><div className="result-overlay__confetti"/><section><span className="eyebrow"><Crown/> FINAL DEL PARTIDO</span><div className="result-score"><div><Flag code={home.flagCode} label={home.name} size="lg"/><b>{home.shortName}</b></div><strong>{snapshot.score.home}<i>—</i>{snapshot.score.away}</strong><div><Flag code={away.flagCode} label={away.name} size="lg"/><b>{away.shortName}</b></div></div><p>{snapshot.score.home>snapshot.score.away?'Una victoria para creer. El camino acaba de empezar.':snapshot.score.home===snapshot.score.away?'Un punto y muchas lecciones para el siguiente desafío.':'Duele, pero el torneo continúa. Toca responder.'}</p><div className="result-actions"><button className="button button--glass" onClick={()=>setShowResult(false)}><BarChart3/> VER ESTADÍSTICAS</button><button className="button button--gold" onClick={()=>navigate('/juego/mundial')}>CONTINUAR CAMPAÑA <ArrowLeft/></button></div></section></div>}
  </main>
}

function TeamFormation({title,players,playerMap,color}:{title:string;players:MatchSnapshot['players'];playerMap:Map<string,DomainPlayer>;color:'cyan'|'gold'}){
  return <section className={`team-formation team-formation--${color}`}><header><span>{title}</span><b>ESTRUCTURA EN VIVO</b></header><div className="team-formation__pitch">{players.map(player=>{const profile=playerMap.get(player.playerId);return <span key={player.playerId} style={{left:`${player.location.y/68*88+6}%`,top:`${player.side==='home'?(105-player.location.x)/105*84+8:player.location.x/105*84+8}%`}} title={profile?.shirtName}><TeamShirt nationId={player.nationId} number={player.shirtNumber} label={profile?.shirtName} className="formation-shirt"/><small>{profile?.shirtName}</small>{player.yellowCards>0&&<em/>}</span>})}</div></section>
}

function MatchCanvas({snapshot,homeColor,homeSecondary,awayColor,awaySecondary,reducedMotion,camera}:{snapshot:MatchSnapshot;homeColor:string;homeSecondary:string;awayColor:string;awaySecondary:string;reducedMotion:boolean;camera:'Táctica'|'Dinámica'}){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const targetRef=useRef(snapshot)
  const displayRef=useRef(snapshot)
  useEffect(()=>{targetRef.current=snapshot},[snapshot])
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d');if(!ctx)return
    let frame=0
    const ballTrail:Array<{x:number;y:number}>=[]
    const resize=()=>{const ratio=Math.min(window.devicePixelRatio||1,2);const rect=canvas.getBoundingClientRect();canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0)}
    resize();window.addEventListener('resize',resize)
    const draw=()=>{
      const target=targetRef.current;const display=displayRef.current
      const ballBlend = reducedMotion ? 1 : .19
      const playerBlend = reducedMotion ? 1 : .17
      const displayMap=new Map(display.players.map(player=>[player.playerId,player]))
      displayRef.current={
        ...target,
        ball:{...target.ball,location:{x:display.ball.location.x+(target.ball.location.x-display.ball.location.x)*ballBlend,y:display.ball.location.y+(target.ball.location.y-display.ball.location.y)*ballBlend}},
        players:target.players.map(next=>{const player=displayMap.get(next.playerId)??next;return {...next,location:{x:player.location.x+(next.location.x-player.location.x)*playerBlend,y:player.location.y+(next.location.y-player.location.y)*playerBlend}}}),
      }
      const s=displayRef.current;const w=canvas.clientWidth,h=canvas.clientHeight
      const zoom=camera==='Dinámica'&&!reducedMotion?1.28:1
      const focusX=zoom===1?52.5:Math.max(41,Math.min(64,s.ball.location.x))
      const focusY=zoom===1?34:Math.max(27,Math.min(41,s.ball.location.y))
      const px=(x:number)=>w/2+((x-focusX)/105)*(w-48)*zoom,py=(y:number)=>h/2+((y-focusY)/68)*(h-40)*zoom
      const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#0d7b51');gradient.addColorStop(.5,'#086443');gradient.addColorStop(1,'#064e38');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h)
      for(let stripe=0;stripe<10;stripe+=1){ctx.fillStyle=stripe%2?'rgba(255,255,255,.018)':'rgba(0,0,0,.045)';ctx.fillRect(px(stripe*10.5),py(0),px((stripe+1)*10.5)-px(stripe*10.5),py(68)-py(0))}
      ctx.strokeStyle='rgba(231,255,244,.66)';ctx.lineWidth=1.4;ctx.strokeRect(px(0),py(0),px(105)-px(0),py(68)-py(0));ctx.beginPath();ctx.moveTo(px(52.5),py(0));ctx.lineTo(px(52.5),py(68));ctx.stroke();ctx.beginPath();ctx.arc(px(52.5),py(34),Math.abs(px(61.65)-px(52.5)),0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(px(52.5),py(34),2,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.75)';ctx.fill()
      ctx.strokeRect(px(0),py(13.84),px(16.5)-px(0),py(54.16)-py(13.84));ctx.strokeRect(px(88.5),py(13.84),px(105)-px(88.5),py(54.16)-py(13.84));ctx.strokeRect(px(0),py(24.84),px(5.5)-px(0),py(43.16)-py(24.84));ctx.strokeRect(px(99.5),py(24.84),px(105)-px(99.5),py(43.16)-py(24.84))
      ;(['home','away'] as const).forEach(side=>{const linePlayers=s.players.filter(player=>player.onPitch&&player.side===side&&['CB','LB','RB','LWB','RWB'].includes(player.position));if(!linePlayers.length)return;const lineX=linePlayers.reduce((sum,player)=>sum+player.location.x,0)/linePlayers.length;ctx.save();ctx.setLineDash([5,7]);ctx.strokeStyle=side==='home'?`${homeColor}55`:`${awayColor}55`;ctx.beginPath();ctx.moveTo(px(lineX),py(4));ctx.lineTo(px(lineX),py(64));ctx.stroke();ctx.restore()})
      s.players.filter(player=>player.onPitch&&player.target&&['run','overlap','underlap','press'].includes(player.movementIntent??'')&&Math.hypot(player.location.x-s.ball.location.x,player.location.y-s.ball.location.y)<24).sort((left,right)=>Math.hypot(left.location.x-s.ball.location.x,left.location.y-s.ball.location.y)-Math.hypot(right.location.x-s.ball.location.x,right.location.y-s.ball.location.y)).slice(0,5).forEach(player=>{const tx=px(player.target!.x),ty=py(player.target!.y),x=px(player.location.x),y=py(player.location.y);ctx.save();ctx.setLineDash(player.movementIntent==='press'?[3,5]:[7,5]);ctx.strokeStyle=player.movementIntent==='press'?'rgba(255,134,117,.5)':'rgba(98,230,237,.48)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();const angle=Math.atan2(ty-y,tx-x);ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx-Math.cos(angle-.55)*7,ty-Math.sin(angle-.55)*7);ctx.lineTo(tx-Math.cos(angle+.55)*7,ty-Math.sin(angle+.55)*7);ctx.closePath();ctx.fillStyle=player.movementIntent==='press'?'rgba(255,134,117,.66)':'rgba(98,230,237,.68)';ctx.fill();ctx.restore()})
      if(!ballTrail.length||Math.hypot(ballTrail.at(-1)!.x-s.ball.location.x,ballTrail.at(-1)!.y-s.ball.location.y)>.12){ballTrail.push({...s.ball.location});if(ballTrail.length>18)ballTrail.shift()}
      ballTrail.forEach((point,index)=>{const alpha=(index+1)/ballTrail.length*.24;ctx.beginPath();ctx.arc(px(point.x),py(point.y),1.2+index/ballTrail.length*1.8,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${alpha})`;ctx.fill()})
      s.players.filter(player=>player.onPitch).forEach(player=>{
        const x=px(player.location.x),y=py(player.location.y)
        const primary=player.side==='home'?homeColor:awayColor
        const secondary=player.side==='home'?homeSecondary:awaySecondary
        const marker=camera==='Dinámica'?11:10
        if(x<marker||x>w-marker||y<marker||y>h-marker)return
        const velocity=Math.hypot(player.velocity.x,player.velocity.y)
        const orientation=player.orientation??(velocity>.1?Math.atan2(player.velocity.y,player.velocity.x):(player.side==='home'?0:Math.PI))
        if(velocity>.25){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-player.velocity.x*1.25,y-player.velocity.y*1.25);ctx.strokeStyle='rgba(255,255,255,.26)';ctx.lineWidth=2;ctx.stroke()}
        if(s.ball.possessorId===player.playerId){ctx.beginPath();ctx.arc(x,y,marker+5+Math.sin(performance.now()/180)*1.2,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=1.4;ctx.stroke()}
        ctx.save();ctx.translate(x,y);ctx.rotate(orientation);ctx.shadowColor=primary;ctx.shadowBlur=10
        ctx.beginPath();ctx.moveTo(marker*.95,0);ctx.lineTo(marker*.4,-marker*.72);ctx.lineTo(-marker*.42,-marker*.86);ctx.lineTo(-marker*.78,-marker*.42);ctx.lineTo(-marker*.72,marker*.42);ctx.lineTo(-marker*.42,marker*.86);ctx.lineTo(marker*.4,marker*.72);ctx.closePath();ctx.fillStyle=primary;ctx.fill();ctx.shadowBlur=0
        ctx.beginPath();ctx.moveTo(marker*.34,-marker*.72);ctx.lineTo(-marker*.55,-marker*.8);ctx.lineTo(-marker*.55,marker*.8);ctx.lineTo(marker*.34,marker*.72);ctx.closePath();ctx.fillStyle=secondary;ctx.globalAlpha=.78;ctx.fill();ctx.globalAlpha=1
        ctx.strokeStyle='rgba(255,255,255,.86)';ctx.lineWidth=1.35;ctx.stroke();ctx.restore()
        ctx.font='800 9px Archivo,system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=getContrast(primary);ctx.fillText(String(player.shirtNumber),x,y+.3)
        if(player.redCard){ctx.fillStyle='#ff3959';ctx.fillRect(x+7,y-12,5,8)}else if(player.yellowCards){ctx.fillStyle='#ffd63d';ctx.fillRect(x+7,y-12,5,8)}
      })
      const bx=px(s.ball.location.x),by=py(s.ball.location.y);ctx.beginPath();ctx.ellipse(bx+2,by+4,4.8,2.2,0,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,.28)';ctx.fill();ctx.shadowColor='#fff';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(bx,by-s.ball.height*2.2,4.2+s.ball.height*.35,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#142131';ctx.stroke();ctx.shadowBlur=0
      const rx=px(s.referee.x),ry=py(s.referee.y);ctx.beginPath();ctx.arc(rx,ry,6,0,Math.PI*2);ctx.fillStyle='#ee4cff';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke()
      frame=requestAnimationFrame(draw)
    }
    frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize)}
  },[awayColor,awaySecondary,camera,homeColor,homeSecondary,reducedMotion])
  return <canvas ref={canvasRef} aria-label="Representación táctica en directo del partido"/>
}

function getContrast(hex:string){const clean=hex.replace('#','');if(clean.length!==6)return'#fff';const r=parseInt(clean.slice(0,2),16),g=parseInt(clean.slice(2,4),16),b=parseInt(clean.slice(4,6),16);return r*.299+g*.587+b*.114>150?'#07111f':'#fff'}
