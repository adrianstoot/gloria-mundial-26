import { nations as sourceNations, playersByNation as sourcePlayersByNation, type Nation, type TournamentFixture } from '../data'

export interface UINation {
  id: string
  name: string
  shortName: string
  code: string
  flagCode: string
  group: Nation['group']
  confederation: Nation['confederation']
  worldRanking: number
  teamRating: number
  style: string
  primaryColor: string
  secondaryColor: string
}

export interface UIPlayer {
  id: string
  nationId: string
  shirtName: string
  official2026: boolean
  position: string
  positions: string[]
  realStats: {
    fullName?: string
    name?: string
    club?: string
    birthDate?: string
    dateOfBirth?: string
    heightCm?: number
    caps?: number
    internationalCaps?: number
    goals?: number
  }
  gameRatings: {
    overall?: number
    technical?: number
    physical?: number
    mental?: number
    technique?: number
    passing?: number
    finishing?: number
    defending?: number
    decisions?: number
    composure?: number
    teamwork?: number
    goalkeeping?: number
    confidence?: string | number
  }
}

export const uiNations = sourceNations as unknown as UINation[]
export const uiPlayersByNation = sourcePlayersByNation as unknown as Record<string, UIPlayer[]>

export function playersFor(nationId: string | undefined): UIPlayer[] {
  if (!nationId) return []
  return uiPlayersByNation[nationId] ?? []
}

export function playerName(player: UIPlayer): string {
  return player.realStats.fullName ?? player.realStats.name ?? player.shirtName
}

export function playerClub(player: UIPlayer): string {
  return player.realStats.club ?? 'Club no indicado'
}

export function playerCaps(player: UIPlayer): number {
  return player.realStats.caps ?? player.realStats.internationalCaps ?? 0
}

export function playerOverall(player: UIPlayer): number {
  const direct = player.gameRatings.overall
  if (typeof direct === 'number') return direct
  const ratings = [player.gameRatings.technical, player.gameRatings.physical, player.gameRatings.mental]
    .filter((value): value is number => typeof value === 'number')
  return ratings.length ? Math.round(ratings.reduce((total, value) => total + value, 0) / ratings.length) : 70
}

export const defaultNation = uiNations.find((nation) => nation.flagCode === 'ma') ?? uiNations[0]

export interface ManagerProfile {
  name: string
  surname: string
  nationality: string
  experience: 'novato' | 'profesional' | 'leyenda'
  coachId: import('./coachProfiles').CoachProfileId
  specialization?: 'tactica' | 'gestion' | 'impulso'
}

export type AgendaEventType = 'match' | 'travel' | 'training' | 'recovery' | 'press' | 'medical' | 'meeting' | 'leisure' | 'federation' | 'news'
export type AgendaPriority = 'critical' | 'high' | 'normal' | 'low'

export interface AgendaEvent {
  id: string
  date: string
  time: string
  type: AgendaEventType
  priority: AgendaPriority
  title: string
  summary: string
  durationMinutes: number
  mandatory: boolean
  status: 'pending' | 'completed' | 'expired'
  route: string
  effects: string[]
}

export interface WorldNotification {
  id: string
  category: 'team' | 'medical' | 'tactical' | 'press' | 'tournament' | 'federation'
  headline: string
  summary: string
  urgency: AgendaPriority
  playerIds: string[]
  createdAt: string
  expiresAt?: string
  route: string
  read: boolean
}

export interface AssistantMemory {
  heardBriefingIds: string[]
  appliedActionIds: string[]
  dismissedActionIds: string[]
  postponedActionIds: string[]
  lastContext?: string
  lastSpokenAt?: number
}

export interface AudioSettings {
  master: number
  music: number
  interface: number
  voice: number
  stadium: number
  muted: boolean
  voiceEnabled: boolean
  subtitles: boolean
  preferredVoice?: string
}

export interface CampaignUIState {
  experienceVersion: 3
  prologueComplete: boolean
  unlockedModules: Array<'squad' | 'hotel' | 'training' | 'tactics' | 'press' | 'hub'>
  assistantVoiceEnabled: boolean
  audio: AudioSettings
  agenda: AgendaEvent[]
  worldNotifications: WorldNotification[]
  assistantMemory: AssistantMemory
  focusMemory: Record<string, string>
  manager: ManagerProfile
  coachAppliedId?: import('./coachProfiles').CoachProfileId
  nationId: string
  difficulty: 'accesible' | 'realista' | 'leyenda'
  squadIds: string[]
  squadConfirmed: boolean
  shirtNumbers: Record<string, number>
  captainId?: string
  penaltyTakerId?: string
  cornerTakerId?: string
  freeKickTakerId?: string
  tactic: string
  mentality: string
  date: string
  tutorialComplete: boolean
  customFixtures?: TournamentFixture[]
  customNations?: Nation[]
  inboxRead: string[]
  trainingPlan: string[]
  pressAnswers: Record<string, string>
  morale: number
  federation: number
  cohesion: number
  fatigue: number
  pressure: number
  tacticalFamiliarity: number
  climateAdaptation: number
  localSupport: number
  recovery: number
  hotelId?: string
  decisionLog: Array<{
    key: string
    type: 'hotel' | 'training' | 'leisure' | 'press' | 'talk' | 'recovery' | 'nutrition' | 'media' | 'operations' | 'leadership' | 'tactic'
    label: string
    effects: Partial<Record<'morale' | 'federation' | 'cohesion' | 'fatigue' | 'pressure' | 'tacticalFamiliarity' | 'climateAdaptation' | 'localSupport' | 'recovery', number>>
    madeAt: string
  }>
  tacticSettings: {
    width: number
    tempo: number
    pressing: number
    defensiveLine: number
    passingDirectness: number
    transition: 'hold-shape' | 'balanced' | 'counter'
    marking: 'zonal' | 'mixed' | 'player'
    roles: Record<string, string>
    instructions: string[]
    positions: Record<string, { x: number; y: number; playerId?: string }>
  }
  matchResults: Record<string, {
    fixtureId: string
    homeNationId: string
    awayNationId: string
    home: number
    away: number
    homePenalties?: number
    awayPenalties?: number
    homeXg?: number
    awayXg?: number
    homeYellowCards?: number
    awayYellowCards?: number
    homeRedCards?: number
    awayRedCards?: number
    homeFairPlayPoints?: number
    awayFairPlayPoints?: number
    discipline?: Array<{ playerId: string; nationId: string; event: 'yellow' | 'second-yellow' | 'direct-red' }>
    injuries?: Array<{ playerId: string; nationId: string; kind: 'knock' | 'muscle' | 'concussion'; days: number }>
    goals?: Array<{ playerId?: string; nationId: string; minute: number; assistId?: string }>
    playedAt: string
  }>
  completed: boolean
}

export const initialCampaign: CampaignUIState = {
  experienceVersion: 3,
  prologueComplete: false,
  unlockedModules: ['squad'],
  assistantVoiceEnabled: false,
  audio: { master: 72, music: 52, interface: 70, voice: 0, stadium: 68, muted: false, voiceEnabled: false, subtitles: true },
  agenda: [],
  worldNotifications: [],
  assistantMemory: { heardBriefingIds: [], appliedActionIds: [], dismissedActionIds: [], postponedActionIds: [] },
  focusMemory: { hub: 'calendar' },
  manager: { name: '', surname: '', nationality: 'España', experience: 'novato', coachId: 'amine-el-mansouri', specialization: 'tactica' },
  nationId: defaultNation?.id ?? '',
  difficulty: 'realista',
  squadIds: [],
  squadConfirmed: false,
  shirtNumbers: {},
  tactic: '4-3-3',
  mentality: 'Equilibrada',
  date: '2026-05-25',
  tutorialComplete: false,
  inboxRead: [],
  trainingPlan: ['Recuperación', 'Cohesión', 'Ataque', 'Balón parado', 'Defensa', 'Penaltis', 'Recuperación'],
  pressAnswers: {},
  morale: 76,
  federation: 71,
  cohesion: 64,
  fatigue: 18,
  pressure: 44,
  tacticalFamiliarity: 56,
  climateAdaptation: 50,
  localSupport: 50,
  recovery: 72,
  decisionLog: [],
  tacticSettings: {
    width: 58,
    tempo: 62,
    pressing: 66,
    defensiveLine: 58,
    passingDirectness: 46,
    transition: 'balanced',
    marking: 'zonal',
    roles: {},
    instructions: ['play-out', 'work-box', 'counter-press'],
    positions: {},
  },
  matchResults: {},
  completed: false,
}
