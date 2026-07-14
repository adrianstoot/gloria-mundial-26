export type GroupId =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'

export type Confederation = 'AFC' | 'CAF' | 'CONCACAF' | 'CONMEBOL' | 'OFC' | 'UEFA'

export type Position = 'GK' | 'RB' | 'CB' | 'LB' | 'DM' | 'CM' | 'AM' | 'RW' | 'LW' | 'ST'

export type NationId = string

export interface Nation {
  id: NationId
  name: string
  shortName: string
  code: string
  flagCode: string
  group: GroupId
  confederation: Confederation
  worldRanking: number
  teamRating: number
  style: string
  primaryColor: string
  secondaryColor: string
}

export interface RealStats {
  fullName: string
  dateOfBirth: string
  club: string
  heightCm: number
  caps: number
  goals: number
  primaryPosition: Position
  preferredFoot: 'left' | 'right' | 'both' | 'unknown'
  marketValueEur?: number
}

export interface GameRatings {
  overall: number
  technique: number
  passing: number
  finishing: number
  defending: number
  dribbling: number
  decisions: number
  composure: number
  teamwork: number
  pace: number
  stamina: number
  strength: number
  goalkeeping: number
  confidence: 'modeled'
}

export type PlayerDataStatus =
  | 'verified-official'
  | 'open-data-candidate'
  | 'synthetic-fallback'

export interface Player {
  id: string
  nationId: NationId
  displayName: string
  firstName: string
  lastName: string
  shirtName: string
  official2026: boolean
  squadNumber?: number
  position: Position
  positions: Position[]
  realStats: RealStats
  gameRatings: GameRatings
  dataStatus: PlayerDataStatus
  sourceIds: string[]
}

export interface DataSource {
  id: string
  name: string
  url: string
  license: string
  retrievedAt: string
  usage: string
}

export type FixtureStage =
  | 'GROUP'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL'

export interface TournamentFixture {
  id: string
  matchNumber: number
  stage: FixtureStage
  date: string
  venueId: string
  group?: GroupId
  homeNationId?: NationId
  awayNationId?: NationId
  homeSlot?: string
  awaySlot?: string
}

export interface Venue {
  id: string
  name: string
  city: string
  country: 'Canada' | 'Mexico' | 'United States'
  capacity: number
}

export interface TournamentData {
  id: 'world-cup-2026-v1'
  snapshotDate: '2026-06-02'
  campaignStart: '2026-05-25'
  tournamentStart: '2026-06-11'
  tournamentEnd: '2026-07-19'
  groups: Record<GroupId, NationId[]>
  nations: Nation[]
  playersByNation: Record<NationId, Player[]>
  venues: Venue[]
  fixtures: TournamentFixture[]
  sources: DataSource[]
}

export interface PlayerSeed {
  nationId: NationId
  displayName: string
  shirtName: string
  official2026: boolean
  squadNumber?: number
  dateOfBirth: string
  club: string
  heightCm: number
  caps: number
  goals: number
  position: Position
  preferredFoot: 'left' | 'right' | 'both' | 'unknown'
  marketValueEur?: number
  source: 'fifa-official-squads' | 'transfermarkt-cc0' | 'wikimedia-cc-by-sa'
}
