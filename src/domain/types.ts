export type EntityId = string

export type GroupId =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'

export type Position =
  | 'GK'
  | 'RB' | 'RCB' | 'CB' | 'LCB' | 'LB'
  | 'RWB' | 'LWB'
  | 'DM' | 'RCM' | 'CM' | 'LCM'
  | 'RM' | 'AM' | 'LM'
  | 'RW' | 'LW'
  | 'SS' | 'ST'

export type PositionUnit = 'goalkeeper' | 'defence' | 'midfield' | 'attack'

export interface RealStats {
  fullName: string
  knownAs?: string
  birthDate: string
  club: string
  clubCountry?: string
  heightCm: number
  preferredFoot: 'left' | 'right' | 'both'
  positions: Position[]
  caps: number
  internationalGoals: number
}

/** Original 1–100 gameplay estimates, intentionally separate from factual data. */
export interface GameRatings {
  overall: number
  attack: number
  passing: number
  technique: number
  defending: number
  goalkeeping: number
  pace: number
  stamina: number
  strength: number
  composure: number
  decisions: number
  positioning: number
  setPieces: number
  /** 0–1: confidence in the estimate, not a player attribute. */
  confidence: number
}

export interface PortraitAsset {
  playerId: EntityId
  src: string
  author: string
  sourceUrl: string
  license: string
  licenseUrl?: string
}

export interface Player {
  id: EntityId
  nationId: EntityId
  shirtName: string
  shirtNumber?: number
  primaryPosition: Position
  realStats: RealStats
  gameRatings: GameRatings
  officialPreset: boolean
  portrait?: PortraitAsset
  condition: number
  fatigue: number
  form: number
  morale: number
  sharpness: number
  hierarchy: 'leader' | 'influential' | 'regular' | 'prospect'
  selected?: boolean
  suspendedMatches?: number
  injury?: Injury
}

export interface Injury {
  kind: 'knock' | 'muscle' | 'joint' | 'concussion'
  severity: 'minor' | 'moderate' | 'severe'
  occurredAt?: string
  expectedDays: number
  canContinue: boolean
}

export type TacticalIdentity =
  | 'possession' | 'vertical' | 'counter' | 'high-press'
  | 'low-block' | 'wide' | 'balanced'

export interface Nation {
  id: EntityId
  code: string
  name: string
  shortName: string
  flagCode: string
  confederation: 'AFC' | 'CAF' | 'CONCACAF' | 'CONMEBOL' | 'OFC' | 'UEFA'
  group: GroupId
  ranking: number
  strength: number
  stars: number
  objective: string
  tacticalIdentity: TacticalIdentity
  primaryColor: string
  secondaryColor: string
  players: Player[]
}

export interface DataSource {
  id: string
  name: string
  url: string
  license: string
  retrievedAt: string
}

export interface Venue {
  id: EntityId
  name: string
  city: string
  countryCode: 'CA' | 'MX' | 'US'
  capacity: number
  timeZone: string
}

export type TournamentStage =
  | 'group' | 'round-of-32' | 'round-of-16' | 'quarter-final'
  | 'semi-final' | 'third-place' | 'final'

export interface TournamentFixture {
  id: EntityId
  matchNumber: number
  stage: TournamentStage
  group?: GroupId
  kickoff: string
  venueId: EntityId
  homeNationId?: EntityId
  awayNationId?: EntityId
  homeSource?: QualificationSource
  awaySource?: QualificationSource
  result?: MatchResultSummary
}

export type QualificationSource =
  | { kind: 'group-position'; group: GroupId; position: 1 | 2 }
  | { kind: 'best-third'; slot: number; eligibleGroups: GroupId[] }
  | { kind: 'winner'; fixtureId: EntityId }
  | { kind: 'loser'; fixtureId: EntityId }

export interface TournamentConfig {
  id: string
  name: string
  startsAt: string
  endsAt: string
  squadSize: 26
  minimumGoalkeepers: 3
  groups: Record<GroupId, EntityId[]>
  fixtures: TournamentFixture[]
  venues: Venue[]
}

export interface WorldCupDataPack {
  id: string
  schemaVersion: number
  publishedAt: string
  generatedAt: string
  sources: DataSource[]
  nations: Nation[]
  tournament: TournamentConfig
}

export type FormationName =
  | '4-3-3' | '4-2-3-1' | '4-4-2' | '4-1-4-1' | '4-3-1-2'
  | '3-4-3' | '3-4-2-1' | '3-5-2' | '5-3-2' | '5-4-1'

export type PlayerDuty = 'defend' | 'support' | 'attack'

export interface FormationSlot {
  id: string
  position: Position
  x: number
  y: number
  playerId?: EntityId
  duty: PlayerDuty
  role?: string
}

export interface TacticPlan {
  id: EntityId
  name: string
  formation: FormationName
  mentality: 'very-defensive' | 'defensive' | 'balanced' | 'positive' | 'attacking'
  width: number
  tempo: number
  passingDirectness: number
  pressing: number
  defensiveLine: number
  transition: 'hold-shape' | 'balanced' | 'counter'
  marking: 'zonal' | 'mixed' | 'player'
  slots: FormationSlot[]
  captainId?: EntityId
  penaltyTakerIds: EntityId[]
  freeKickTakerIds: EntityId[]
  cornerTakerIds: EntityId[]
}

export interface Vector2 {
  x: number
  y: number
}

export type MatchPhase =
  | 'not-started' | 'first-half' | 'half-time' | 'second-half'
  | 'extra-time-first' | 'extra-time-break' | 'extra-time-second'
  | 'penalty-shootout' | 'finished'

export interface MatchPlayerState {
  playerId: EntityId
  nationId: EntityId
  side: 'home' | 'away'
  position: Position
  shirtNumber: number
  location: Vector2
  velocity: Vector2
  /** Immediate spatial objective; only nearby high-intensity intentions are drawn. */
  target?: Vector2
  /** Radians. Used by the broadcast renderer to show the player's body orientation. */
  orientation?: number
  /** Current off-ball purpose, exposed for deterministic tactical visualisation. */
  movementIntent?: string
  stamina: number
  rating: number
  yellowCards: number
  redCard: boolean
  injured: boolean
  onPitch: boolean
}

export interface BallState {
  location: Vector2
  velocity: Vector2
  height: number
  possessorId?: EntityId
}

export interface MatchScore {
  home: number
  away: number
  penalties?: { home: number; away: number }
}

export type MatchEventType =
  | 'kick-off' | 'pass' | 'cross' | 'dribble' | 'tackle' | 'interception'
  | 'shot' | 'shot-on-target' | 'shot-off-target' | 'shot-blocked' | 'save' | 'goal' | 'own-goal'
  | 'offside' | 'foul' | 'advantage' | 'yellow-card' | 'red-card'
  | 'injury' | 'substitution' | 'corner' | 'free-kick' | 'penalty-awarded'
  | 'var-check' | 'var-confirmed' | 'var-overturn' | 'tactical-shift' | 'momentum'
  | 'period-start' | 'period-end'
  | 'penalty-scored' | 'penalty-missed' | 'match-end'

export interface MatchEvent {
  id: string
  tick: number
  second: number
  type: MatchEventType
  side?: 'home' | 'away'
  playerId?: EntityId
  secondaryPlayerId?: EntityId
  location?: Vector2
  xg?: number
  outcome?: string
  commentary: string
  score: MatchScore
}

export interface TeamMatchStats {
  goals: number
  shots: number
  shotsOnTarget: number
  xg: number
  possessionTicks: number
  passesAttempted: number
  passesCompleted: number
  corners: number
  fouls: number
  offsides: number
  yellowCards: number
  redCards: number
  tacklesWon: number
  saves: number
  substitutions: number
}

export interface MatchStats {
  home: TeamMatchStats
  away: TeamMatchStats
}

export type MatchAttackPhase = 'restart' | 'build-up' | 'progression' | 'final-third' | 'transition'
export type MatchAttackPattern = 'build-three' | 'third-man' | 'wide-overlap' | 'inside-overlap' | 'switch-play' | 'counter' | 'patient'

export interface MatchSnapshot {
  tick: number
  second: number
  phase: MatchPhase
  score: MatchScore
  ball: BallState
  players: MatchPlayerState[]
  referee: Vector2
  stats: MatchStats
  possession: 'home' | 'away'
  attackPhase: MatchAttackPhase
  attackPattern: MatchAttackPattern
  patternStep: number
  momentum: number
  /** 0–100, derived from minute, score, stage and recent momentum. */
  tension: number
  latestEventId?: string
}

export type MatchCommand =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'set-speed'; speed: 0.5 | 1 | 2 | 4 | 8 }
  | { type: 'change-tactic'; side: 'home' | 'away'; tactic: TacticPlan }
  | { type: 'substitute'; side: 'home' | 'away'; playerOutId: EntityId; playerInId: EntityId }

export interface MatchSetup {
  id: EntityId
  seed: number | string
  home: Nation
  away: Nation
  homeTactic: TacticPlan
  awayTactic: TacticPlan
  homeSquad?: Player[]
  awaySquad?: Player[]
  stage: TournamentStage | 'friendly'
  knockout: boolean
  weather?: 'clear' | 'rain' | 'hot' | 'windy'
  snapshotIntervalTicks?: number
}

export interface MatchResultSummary {
  home: number
  away: number
  homePenalties?: number
  awayPenalties?: number
  homeFairPlayPoints?: number
  awayFairPlayPoints?: number
  winnerId?: EntityId
  playedAt: string
}

export interface SimulationResult {
  matchId: EntityId
  seed: number
  score: MatchScore
  winnerId?: EntityId
  phase: 'finished'
  wentToExtraTime: boolean
  wentToPenalties: boolean
  stats: MatchStats
  events: MatchEvent[]
  snapshots: MatchSnapshot[]
  finalPlayers: MatchPlayerState[]
  playerRatings: Record<EntityId, number>
}

export interface DisciplinaryRecord {
  nationId: EntityId
  playerId: EntityId
  yellowCards: number
  redCards: number
  suspensionMatches: number
}

export interface GroupTableRow {
  nationId: EntityId
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  fairPlayPoints: number
  rank?: number
}

export interface CampaignSave {
  id: EntityId
  slot: 1 | 2 | 3 | 4 | 5
  schemaVersion: number
  name: string
  managerName: string
  controlledNationId: EntityId
  dataPackId: string
  dataPackPublishedAt: string
  currentDate: string
  createdAt: string
  updatedAt: string
  rngSeed: number
  difficulty: 'accessible' | 'normal' | 'expert'
  tutorial: { enabled: boolean; currentStep: number; completedSteps: string[]; completed: boolean }
  selectedPlayerIds: EntityId[]
  tactic: TacticPlan
  fixtures: TournamentFixture[]
  groupTables: Partial<Record<GroupId, GroupTableRow[]>>
  disciplinaryRecords: DisciplinaryRecord[]
  eliminated: boolean
  completed: boolean
  pendingMatch?: MatchSetup
  resumableSnapshot?: MatchSnapshot
}
