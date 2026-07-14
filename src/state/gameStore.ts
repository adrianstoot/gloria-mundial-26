import { addDays, formatISO } from 'date-fns'
import { create } from 'zustand'
import type { CampaignSave, FormationSlot, Nation, Player, TacticPlan, TournamentFixture } from '../domain'
import { saveCampaign } from '../persistence/saveManager'

export type GameView =
  | 'inbox' | 'squad' | 'tactics' | 'training' | 'medical'
  | 'calendar' | 'tournament' | 'opposition' | 'press' | 'match'

export type TrainingFocus = 'recovery' | 'cohesion' | 'attack' | 'defence' | 'pressing' | 'set-pieces' | 'penalties'

interface GameUiState {
  campaign?: CampaignSave
  activeView: GameView
  tutorialOpen: boolean
  tutorialStep: number
  trainingFocus: TrainingFocus
  cohesion: number
  federationTrust: number
  mediaPressure: number
  notifications: string[]
  createCampaign: (args: {
    nation: Nation
    managerName: string
    difficulty: CampaignSave['difficulty']
    fixtures: TournamentFixture[]
    dataPackId: string
    dataPackPublishedAt: string
  }) => void
  setView: (view: GameView) => void
  togglePlayerSelection: (player: Player) => void
  useOfficialPreset: (nation: Nation) => void
  finalizeSquad: (nation: Nation) => { ok: boolean; message: string }
  updateTactic: (patch: Partial<TacticPlan>) => void
  assignPlayer: (slotId: string, playerId?: string) => void
  chooseTraining: (focus: TrainingFocus) => void
  answerPress: (tone: 'calm' | 'ambitious' | 'protective' | 'confrontational') => void
  continueDay: () => Promise<void>
  nextTutorialStep: () => void
  skipTutorial: () => void
  autosave: () => Promise<void>
}

const formation433: FormationSlot[] = [
  { id: 'gk', position: 'GK', x: 50, y: 91, duty: 'defend', role: 'Portero' },
  { id: 'rb', position: 'RB', x: 82, y: 72, duty: 'support', role: 'Lateral' },
  { id: 'rcb', position: 'RCB', x: 62, y: 80, duty: 'defend', role: 'Central' },
  { id: 'lcb', position: 'LCB', x: 38, y: 80, duty: 'defend', role: 'Central' },
  { id: 'lb', position: 'LB', x: 18, y: 72, duty: 'support', role: 'Lateral' },
  { id: 'rcm', position: 'RCM', x: 68, y: 54, duty: 'support', role: 'Interior' },
  { id: 'cm', position: 'CM', x: 50, y: 62, duty: 'defend', role: 'Pivote' },
  { id: 'lcm', position: 'LCM', x: 32, y: 54, duty: 'support', role: 'Organizador' },
  { id: 'rw', position: 'RW', x: 82, y: 28, duty: 'attack', role: 'Extremo' },
  { id: 'st', position: 'ST', x: 50, y: 17, duty: 'attack', role: 'Delantero' },
  { id: 'lw', position: 'LW', x: 18, y: 28, duty: 'attack', role: 'Extremo' },
]

export const defaultTactic: TacticPlan = {
  id: 'tactic-primary',
  name: 'Identidad nacional',
  formation: '4-3-3',
  mentality: 'positive',
  width: 58,
  tempo: 62,
  passingDirectness: 44,
  pressing: 66,
  defensiveLine: 58,
  transition: 'counter',
  marking: 'zonal',
  slots: formation433,
  penaltyTakerIds: [],
  freeKickTakerIds: [],
  cornerTakerIds: [],
}

function initialCampaign(args: Parameters<GameUiState['createCampaign']>[0]): CampaignSave {
  const official = args.nation.players.filter((player) => player.officialPreset).slice(0, 26)
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    slot: 1,
    schemaVersion: 1,
    name: `${args.managerName} · ${args.nation.shortName}`,
    managerName: args.managerName,
    controlledNationId: args.nation.id,
    dataPackId: args.dataPackId,
    dataPackPublishedAt: args.dataPackPublishedAt,
    currentDate: '2026-05-25',
    createdAt: now,
    updatedAt: now,
    rngSeed: Math.floor(Math.random() * 2_147_483_647),
    difficulty: args.difficulty,
    tutorial: { enabled: true, currentStep: 0, completedSteps: [], completed: false },
    selectedPlayerIds: official.map((player) => player.id),
    tactic: structuredClone(defaultTactic),
    fixtures: structuredClone(args.fixtures),
    groupTables: {},
    disciplinaryRecords: [],
    eliminated: false,
    completed: false,
  }
}

export const useGameStore = create<GameUiState>((set, get) => ({
  activeView: 'inbox',
  tutorialOpen: true,
  tutorialStep: 0,
  trainingFocus: 'cohesion',
  cohesion: 62,
  federationTrust: 70,
  mediaPressure: 44,
  notifications: ['La federación espera tu lista definitiva de 26 jugadores.'],

  createCampaign: (args) => set({
    campaign: initialCampaign(args),
    activeView: 'inbox',
    tutorialOpen: true,
    tutorialStep: 0,
    notifications: [`Bienvenido a la concentración de ${args.nation.name}.`, 'Revisa los 50 candidatos antes de confirmar la convocatoria.'],
  }),

  setView: (activeView) => set({ activeView }),

  togglePlayerSelection: (player) => set((state) => {
    if (!state.campaign) return state
    const selected = new Set(state.campaign.selectedPlayerIds)
    if (selected.has(player.id)) selected.delete(player.id)
    else if (selected.size < 26) selected.add(player.id)
    return { campaign: { ...state.campaign, selectedPlayerIds: [...selected], updatedAt: new Date().toISOString() } }
  }),

  useOfficialPreset: (nation) => set((state) => state.campaign ? ({
    campaign: {
      ...state.campaign,
      selectedPlayerIds: nation.players.filter((player) => player.officialPreset).slice(0, 26).map((player) => player.id),
      updatedAt: new Date().toISOString(),
    },
  }) : state),

  finalizeSquad: (nation) => {
    const campaign = get().campaign
    if (!campaign) return { ok: false, message: 'No hay una campaña activa.' }
    const selected = nation.players.filter((player) => campaign.selectedPlayerIds.includes(player.id))
    if (selected.length !== 26) return { ok: false, message: `Debes elegir exactamente 26 jugadores (${selected.length}/26).` }
    if (selected.filter((player) => player.primaryPosition === 'GK').length < 3) {
      return { ok: false, message: 'La convocatoria necesita al menos tres porteros.' }
    }
    set((state) => ({ notifications: ['Convocatoria final registrada. Ya puedes preparar tu plan táctico.', ...state.notifications] }))
    return { ok: true, message: 'Convocatoria confirmada.' }
  },

  updateTactic: (patch) => set((state) => state.campaign ? ({
    campaign: { ...state.campaign, tactic: { ...state.campaign.tactic, ...patch }, updatedAt: new Date().toISOString() },
  }) : state),

  assignPlayer: (slotId, playerId) => set((state) => state.campaign ? ({
    campaign: {
      ...state.campaign,
      tactic: {
        ...state.campaign.tactic,
        slots: state.campaign.tactic.slots.map((slot) => slot.id === slotId ? { ...slot, playerId } : slot),
      },
      updatedAt: new Date().toISOString(),
    },
  }) : state),

  chooseTraining: (trainingFocus) => set((state) => ({
    trainingFocus,
    cohesion: Math.min(100, state.cohesion + (trainingFocus === 'cohesion' ? 3 : 1)),
    notifications: [`Sesión de ${trainingFocus} programada.`, ...state.notifications],
  })),

  answerPress: (tone) => set((state) => ({
    federationTrust: Math.max(0, Math.min(100, state.federationTrust + (tone === 'ambitious' ? 2 : tone === 'confrontational' ? -2 : 1))),
    mediaPressure: Math.max(0, Math.min(100, state.mediaPressure + (tone === 'confrontational' ? 5 : tone === 'protective' ? -3 : 1))),
    notifications: ['La rueda de prensa ha terminado. El vestuario ya conoce tu mensaje.', ...state.notifications],
  })),

  continueDay: async () => {
    const campaign = get().campaign
    if (!campaign) return
    const next = formatISO(addDays(new Date(`${campaign.currentDate}T12:00:00Z`), 1), { representation: 'date' })
    set((state) => state.campaign ? ({
      campaign: { ...state.campaign, currentDate: next, updatedAt: new Date().toISOString() },
      notifications: [`Nuevo día de concentración: ${next}.`, ...state.notifications].slice(0, 8),
    }) : state)
    await get().autosave()
  },

  nextTutorialStep: () => set((state) => {
    const next = state.tutorialStep + 1
    return { tutorialStep: next, tutorialOpen: next < 9 }
  }),
  skipTutorial: () => set({ tutorialOpen: false }),

  autosave: async () => {
    const campaign = get().campaign
    if (!campaign) return
    await saveCampaign({
      id: campaign.id,
      name: campaign.name,
      managerName: campaign.managerName,
      nationId: campaign.controlledNationId,
      dataPackId: campaign.dataPackId,
      currentDate: campaign.currentDate,
    }, campaign)
  },
}))
