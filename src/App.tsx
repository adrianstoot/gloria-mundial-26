import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { CoverPage } from './features/CoverPage'
import { ManagerSetup, NationSelect, Tutorial } from './features/Onboarding'
import { WorldCupDraw } from './features/WorldCupDraw'
import { ConsoleGameShell } from './components/ConsoleGameShell'
import {
  MedicalCenter,
  Preparation,
  PressRoom,
  Tactics,
  Tournament,
} from './features/ManagementScreens'
import { ConsoleDashboard, ConsoleSquad } from './features/ConsoleScenes'
import { MatchCenter } from './features/MatchCenter'
import { ConcentrationHub } from './features/ConcentrationHub'
import { initialCampaign, type CampaignUIState } from './features/ui-model'
import { domainNations, tournamentData } from './data'
import { createDefaultTactic } from './simulation/formations'
import { deriveCampaignProgress, type ResolvedCampaignFixture } from './features/campaignProgress'
import { deleteCampaign, exportCampaign, importCampaign, saveCampaign, SAVE_SCHEMA_VERSION } from './persistence/saveManager'
import type { TournamentStage } from './domain'
import { validGoalEvents } from './simulation/matchSummary'
import { fairPlayDeductionFromEvents } from './simulation/campaign'
import { simulateMatchAsync } from './simulation/workerClient'
import { disciplineEventsFromSimulation, suspendedPlayerIds } from './features/discipline'
import { injuredPlayerIds, injuryEventsFromSimulation } from './features/availability'
import { generateAgenda, generateWorldNotifications } from './features/campaignDirector'
import { defaultCoachProfile, isCoachProfileId } from './features/coachProfiles'

interface GameContextValue {
  campaign: CampaignUIState
  hasSave: boolean
  hasLegacySave: boolean
  updateCampaign: (patch: Partial<CampaignUIState> | ((state: CampaignUIState) => CampaignUIState)) => void
  startNew: () => void
  clearSave: () => void
  continueDay: () => Promise<void>
  exportSave: () => void
  importSave: (file: File) => Promise<void>
  exportLegacySave: () => void
  discardLegacySave: () => void
}

const GameContext = createContext<GameContextValue | null>(null)
const STORAGE_KEY = 'gm26-ui-campaign-v3'
const LEGACY_STORAGE_KEY = 'gm26-ui-campaign-v2'
const SLOT_ID = 'campaign-slot-1'

export function hydrateCampaign(value: Partial<CampaignUIState> = {}): CampaignUIState {
  const hydrated: CampaignUIState = {
    ...initialCampaign,
    ...value,
    experienceVersion: 3,
    prologueComplete: value.prologueComplete ?? value.tutorialComplete ?? false,
    unlockedModules: value.unlockedModules ?? ['squad'],
    assistantVoiceEnabled: false,
    audio: { ...initialCampaign.audio, ...value.audio, voice: 0, voiceEnabled: false, subtitles: true },
    agenda: value.agenda ?? [],
    worldNotifications: value.worldNotifications ?? [],
    assistantMemory: { ...initialCampaign.assistantMemory, ...value.assistantMemory },
    focusMemory: { ...initialCampaign.focusMemory, ...value.focusMemory },
    manager: {
      ...initialCampaign.manager,
      ...value.manager,
      coachId: isCoachProfileId(value.manager?.coachId) ? value.manager.coachId : defaultCoachProfile.id,
    },
    coachAppliedId: isCoachProfileId(value.coachAppliedId) ? value.coachAppliedId : undefined,
    inboxRead: value.inboxRead ?? [],
    squadIds: value.squadIds ?? [],
    squadConfirmed: Boolean(value.squadConfirmed && value.squadIds?.length === 26),
    shirtNumbers: value.shirtNumbers ?? {},
    trainingPlan: initialCampaign.trainingPlan.map((session, index) => value.trainingPlan?.[index] ?? session),
    pressAnswers: value.pressAnswers ?? {},
    decisionLog: value.decisionLog ?? [],
    matchResults: value.matchResults ?? {},
    tacticSettings: {
      ...initialCampaign.tacticSettings,
      ...value.tacticSettings,
      roles: value.tacticSettings?.roles ?? {},
      instructions: value.tacticSettings?.instructions ?? initialCampaign.tacticSettings.instructions,
      positions: value.tacticSettings?.positions ?? {},
    },
  }
  const priorAgendaStatus = new Map((value.agenda ?? []).map((item) => [item.id, item.status]))
  hydrated.agenda = generateAgenda(hydrated).map((item) => ({ ...item, status: priorAgendaStatus.get(item.id) ?? item.status }))
  if (!hydrated.worldNotifications.length) hydrated.worldNotifications = generateWorldNotifications(hydrated)
  return hydrated
}

function loadCampaign(): { state: CampaignUIState; hasSave: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return { state: hydrateCampaign(), hasSave: false }
    const state = hydrateCampaign(JSON.parse(raw) as Partial<CampaignUIState>)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return { state, hasSave: true }
  } catch {
    return { state: hydrateCampaign(), hasSave: false }
  }
}

function simulationStage(stage: ResolvedCampaignFixture['stage']): TournamentStage {
  return ({
    GROUP: 'group', ROUND_OF_32: 'round-of-32', ROUND_OF_16: 'round-of-16',
    QUARTER_FINAL: 'quarter-final', SEMI_FINAL: 'semi-final',
    THIRD_PLACE: 'third-place', FINAL: 'final',
  } as const)[stage]
}

async function simulateAIFixture(fixture: ResolvedCampaignFixture, playedAt: string, priorResults: CampaignUIState['matchResults']): Promise<CampaignUIState['matchResults'][string] | undefined> {
  if (!fixture.homeNationId || !fixture.awayNationId) return undefined
  const home = domainNations.find((nation) => nation.id === fixture.homeNationId)
  const away = domainNations.find((nation) => nation.id === fixture.awayNationId)
  if (!home || !away) return undefined
  const homeSuspended = suspendedPlayerIds(priorResults, home.id)
  const awaySuspended = suspendedPlayerIds(priorResults, away.id)
  const homeInjured = injuredPlayerIds(priorResults, playedAt, home.id)
  const awayInjured = injuredPlayerIds(priorResults, playedAt, away.id)
  const result = await simulateMatchAsync({
    id: fixture.id,
    seed: `ai-${fixture.id}-gm26-v1`,
    home,
    away,
    homeTactic: createDefaultTactic(home.tacticalIdentity === 'counter' ? '4-2-3-1' : '4-3-3', {
      mentality: home.strength > away.strength + 5 ? 'positive' : 'balanced',
      pressing: home.tacticalIdentity === 'high-press' ? 78 : 54,
      tempo: home.tacticalIdentity === 'vertical' ? 73 : 55,
    }),
    awayTactic: createDefaultTactic(away.tacticalIdentity === 'low-block' ? '5-3-2' : '4-2-3-1', {
      mentality: away.strength > home.strength + 5 ? 'positive' : 'balanced',
      pressing: away.tacticalIdentity === 'high-press' ? 78 : 53,
      tempo: away.tacticalIdentity === 'vertical' ? 73 : 54,
    }),
    stage: simulationStage(fixture.stage),
    knockout: fixture.stage !== 'GROUP',
    homeSquad: home.players.filter((player) => player.officialPreset && !homeSuspended.has(player.id) && !homeInjured.has(player.id)),
    awaySquad: away.players.filter((player) => player.officialPreset && !awaySuspended.has(player.id) && !awayInjured.has(player.id)),
    snapshotIntervalTicks: 1_000,
  })
  return {
    fixtureId: fixture.id,
    homeNationId: home.id,
    awayNationId: away.id,
    home: result.score.home,
    away: result.score.away,
    homePenalties: result.score.penalties?.home,
    awayPenalties: result.score.penalties?.away,
    homeXg: result.stats.home.xg,
    awayXg: result.stats.away.xg,
    homeYellowCards: result.stats.home.yellowCards,
    awayYellowCards: result.stats.away.yellowCards,
    homeRedCards: result.stats.home.redCards,
    awayRedCards: result.stats.away.redCards,
    homeFairPlayPoints: fairPlayDeductionFromEvents(result, 'home'),
    awayFairPlayPoints: fairPlayDeductionFromEvents(result, 'away'),
    discipline: disciplineEventsFromSimulation(result, home.id, away.id),
    injuries: injuryEventsFromSimulation(result, home.id, away.id),
    goals: validGoalEvents(result.events)
      .map((event) => ({
        playerId: event.playerId,
        assistId: event.secondaryPlayerId,
        nationId: event.side === 'home' ? home.id : away.id,
        minute: Math.max(1, Math.floor(event.second / 60) + 1),
      })),
    playedAt,
  }
}

function GameProvider({ children }: { children: ReactNode }) {
  const loaded = useMemo(loadCampaign, [])
  const [campaign, setCampaign] = useState(loaded.state)
  const [hasSave, setHasSave] = useState(loaded.hasSave)
  const [hasLegacySave, setHasLegacySave] = useState(() => Boolean(localStorage.getItem(LEGACY_STORAGE_KEY)))
  const campaignRef = useRef(loaded.state)

  useEffect(() => {
    if (!hasSave || !campaign.manager.name || !campaign.nationId) return
    void saveCampaign({
      id: SLOT_ID,
      name: `${campaign.manager.name} · Mundial 2026`,
      managerName: `${campaign.manager.name} ${campaign.manager.surname}`.trim(),
      nationId: campaign.nationId,
      dataPackId: tournamentData.id,
      currentDate: campaign.date,
    }, campaign)
  }, [campaign, hasSave])

  const updateCampaign = useCallback((patch: Partial<CampaignUIState> | ((state: CampaignUIState) => CampaignUIState)) => {
    setCampaign((current) => {
      const changed = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
      const shouldRefresh = changed.date !== current.date
        || changed.squadConfirmed !== current.squadConfirmed
        || changed.hotelId !== current.hotelId
        || changed.fatigue !== current.fatigue
        || changed.pressure !== current.pressure
        || changed.decisionLog.length !== current.decisionLog.length
        || Object.keys(changed.pressAnswers).length !== Object.keys(current.pressAnswers).length
      const next = shouldRefresh
        ? { ...changed, agenda: generateAgenda(changed), worldNotifications: generateWorldNotifications(changed) }
        : changed
      campaignRef.current = next
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setHasSave(true)
      return next
    })
  }, [])

  const startNew = useCallback(() => {
    const next = hydrateCampaign()
    campaignRef.current = next
    setCampaign(next)
    setHasSave(false)
  }, [])

  const clearSave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    void deleteCampaign(SLOT_ID)
    const next = hydrateCampaign()
    campaignRef.current = next
    setCampaign(next)
    setHasSave(false)
  }, [])

  const exportSave = useCallback(() => {
    const current = campaignRef.current
    exportCampaign({
      schemaVersion: SAVE_SCHEMA_VERSION,
      dataPackId: tournamentData.id,
      savedAt: new Date().toISOString(),
      state: current,
    }, `${current.manager.name || 'seleccionador'}-${current.date}`)
  }, [])

  const exportLegacySave = useCallback(() => {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `gloria-mundial-26-campana-v2-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const discardLegacySave = useCallback(() => {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    setHasLegacySave(false)
  }, [])

  const importSave = useCallback(async (file: File) => {
    const envelope = await importCampaign<Partial<CampaignUIState>>(file)
    if (envelope.dataPackId !== tournamentData.id) throw new Error('La partida utiliza un pack de datos diferente.')
    const next = hydrateCampaign(envelope.state)
    campaignRef.current = next
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setCampaign(next)
    setHasSave(true)
  }, [])

  const continueDay = useCallback(async () => {
    const base = campaignRef.current
    if (base.completed) return
    const date = new Date(`${base.date}T12:00:00`)
    date.setDate(date.getDate() + 1)
    const nextDate = date.toISOString().slice(0, 10)
    const results = { ...base.matchResults }
    let simulatedAny = true
    let safety = 0
    const customData = {
      ...tournamentData,
      nations: base.customNations ?? tournamentData.nations,
      fixtures: base.customFixtures ?? tournamentData.fixtures,
    }
    while (simulatedAny && safety < 110) {
      simulatedAny = false
      safety += 1
      const progress = deriveCampaignProgress(customData, results, { controlledNationId: base.nationId })
      const readyAI = progress.fixtures.filter((fixture) =>
        fixture.status === 'ready'
        && fixture.date.slice(0, 10) <= nextDate
        && fixture.homeNationId !== base.nationId
        && fixture.awayNationId !== base.nationId
        && !results[fixture.id],
      )
      const simulated = await Promise.all(readyAI.map((fixture) => simulateAIFixture(fixture, nextDate, results)))
      readyAI.forEach((fixture, index) => {
        const result = simulated[index]
        if (!result) return
        results[fixture.id] = result
        simulatedAny = true
      })
    }
    const progress = deriveCampaignProgress(customData, results, { controlledNationId: base.nationId })
    updateCampaign((current) => {
      if (current.date !== base.date) return current
      return { ...current, date: nextDate, matchResults: results, completed: progress.completed }
    })
  }, [updateCampaign])

  return <GameContext.Provider value={{ campaign, hasSave, hasLegacySave, updateCampaign, startNew, clearSave, continueDay, exportSave, importSave, exportLegacySave, discardLegacySave }}>{children}</GameContext.Provider>
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) throw new Error('useGame debe utilizarse dentro de GameProvider')
  return context
}

function RequireCampaign({ children }: { children: ReactNode }) {
  const { campaign } = useGame()
  if (!campaign.manager.name || !campaign.nationId) return <Navigate to="/crear-seleccionador" replace />
  return children
}

function NewGameEntry() {
  const navigate = useNavigate()
  const { startNew } = useGame()
  useEffect(() => {
    startNew()
    navigate('/crear-seleccionador', { replace: true })
  }, [navigate, startNew])
  return null
}

export function App() {
  return (
    <GameProvider>
      <Routes>
        <Route path="/" element={<CoverPage />} />
        <Route path="/nueva-partida" element={<NewGameEntry />} />
        <Route path="/crear-seleccionador" element={<ManagerSetup />} />
        <Route path="/elegir-seleccion" element={<NationSelect />} />
        <Route path="/sorteo" element={<RequireCampaign><WorldCupDraw /></RequireCampaign>} />
        <Route path="/tutorial" element={<RequireCampaign><Tutorial /></RequireCampaign>} />
        <Route path="/partido" element={<RequireCampaign><MatchCenter /></RequireCampaign>} />
        <Route path="/juego" element={<RequireCampaign><ConsoleGameShell /></RequireCampaign>}>
          <Route index element={<ConsoleDashboard />} />
          <Route path="convocatoria" element={<ConsoleSquad />} />
          <Route path="concentracion" element={<ConcentrationHub />} />
          <Route path="tacticas" element={<Tactics />} />
          <Route path="preparacion" element={<Preparation />} />
          <Route path="medico" element={<MedicalCenter />} />
          <Route path="prensa" element={<PressRoom />} />
          <Route path="mundial" element={<Tournament />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </GameProvider>
  )
}
