import type {
  Nation as DomainNation,
  Player as DomainPlayer,
  Position as DomainPosition,
  QualificationSource,
  TacticalIdentity,
  TournamentConfig,
  TournamentFixture as DomainFixture,
  TournamentStage,
  WorldCupDataPack,
} from '../domain'
import type { Nation, Player, Position, TournamentData, TournamentFixture } from './types'

const positionMap: Record<Position, DomainPosition> = {
  GK: 'GK',
  RB: 'RB',
  CB: 'CB',
  LB: 'LB',
  DM: 'DM',
  CM: 'CM',
  AM: 'AM',
  RW: 'RW',
  LW: 'LW',
  ST: 'ST',
}

const identityByStyle = (style: string): TacticalIdentity => {
  const value = style.toLowerCase()
  if (value.includes('posesi') || value.includes('control')) return 'possession'
  if (value.includes('contra') || value.includes('transici')) return 'counter'
  if (value.includes('presi')) return 'high-press'
  if (value.includes('direct')) return 'vertical'
  if (value.includes('amplitud')) return 'wide'
  if (value.includes('bloque')) return 'low-block'
  return 'balanced'
}

export function toDomainPlayer(player: Player): DomainPlayer {
  const ratings = player.gameRatings
  return {
    id: player.id,
    nationId: player.nationId,
    shirtName: player.shirtName,
    shirtNumber: player.squadNumber,
    primaryPosition: positionMap[player.position],
    realStats: {
      fullName: player.realStats.fullName,
      knownAs: player.displayName,
      birthDate: player.realStats.dateOfBirth,
      club: player.realStats.club,
      heightCm: player.realStats.heightCm,
      preferredFoot: player.realStats.preferredFoot === 'unknown' ? 'right' : player.realStats.preferredFoot,
      positions: player.positions.map((position) => positionMap[position]),
      caps: player.realStats.caps,
      internationalGoals: player.realStats.goals,
    },
    gameRatings: {
      overall: ratings.overall,
      attack: Math.round((ratings.finishing + ratings.dribbling + ratings.technique) / 3),
      passing: ratings.passing,
      technique: ratings.technique,
      defending: ratings.defending,
      goalkeeping: ratings.goalkeeping,
      pace: ratings.pace,
      stamina: ratings.stamina,
      strength: ratings.strength,
      composure: ratings.composure,
      decisions: ratings.decisions,
      positioning: Math.round((ratings.decisions + ratings.teamwork + ratings.defending) / 3),
      setPieces: Math.round((ratings.passing + ratings.technique + ratings.composure) / 3),
      confidence: 0.72,
    },
    officialPreset: player.official2026,
    condition: 94,
    fatigue: 12,
    form: Math.max(55, Math.min(95, ratings.overall + 2)),
    morale: 76,
    sharpness: 88,
    hierarchy: ratings.overall >= 85 ? 'leader' : ratings.overall >= 79 ? 'influential' : ratings.overall >= 70 ? 'regular' : 'prospect',
  }
}

export function toDomainNation(nation: Nation, players: Player[]): DomainNation {
  return {
    id: nation.id,
    code: nation.code,
    name: nation.name,
    shortName: nation.shortName,
    flagCode: nation.flagCode,
    confederation: nation.confederation,
    group: nation.group,
    ranking: nation.worldRanking,
    strength: nation.teamRating,
    stars: Math.max(1, Math.min(5, Math.round((nation.teamRating - 55) / 7))),
    objective: nation.teamRating >= 86 ? 'Luchar por el título' : nation.teamRating >= 80 ? 'Alcanzar los cuartos de final' : nation.teamRating >= 74 ? 'Superar la fase de grupos' : 'Competir con orgullo',
    tacticalIdentity: identityByStyle(nation.style),
    primaryColor: nation.primaryColor,
    secondaryColor: nation.secondaryColor,
    players: players.map(toDomainPlayer),
  }
}

const stageMap: Record<TournamentFixture['stage'], TournamentStage> = {
  GROUP: 'group',
  ROUND_OF_32: 'round-of-32',
  ROUND_OF_16: 'round-of-16',
  QUARTER_FINAL: 'quarter-final',
  SEMI_FINAL: 'semi-final',
  THIRD_PLACE: 'third-place',
  FINAL: 'final',
}

const bestThirdSlotByMatch: Partial<Record<number, number>> = {
  74: 1,
  77: 2,
  79: 3,
  80: 4,
  81: 5,
  82: 6,
  85: 7,
  87: 8,
}

const fixtureId = (matchNumber: number) => `match-${String(matchNumber).padStart(3, '0')}`

function qualificationSource(slot: string, matchNumber: number): QualificationSource | undefined {
  const groupPosition = slot.match(/^([12])([A-L])$/)
  if (groupPosition) {
    return {
      kind: 'group-position',
      group: groupPosition[2] as import('../domain').GroupId,
      position: Number(groupPosition[1]) as 1 | 2,
    }
  }

  const bestThird = slot.match(/^3([A-L]+)$/)
  if (bestThird) {
    return {
      kind: 'best-third',
      slot: bestThirdSlotByMatch[matchNumber] ?? 1,
      eligibleGroups: [...bestThird[1]] as import('../domain').GroupId[],
    }
  }

  const dependent = slot.match(/^([WL])(\d+)$/)
  if (dependent) {
    return {
      kind: dependent[1] === 'W' ? 'winner' : 'loser',
      fixtureId: fixtureId(Number(dependent[2])),
    }
  }

  return undefined
}

export function toDomainFixture(fixture: TournamentFixture): DomainFixture {
  return {
    id: fixture.id,
    matchNumber: fixture.matchNumber,
    stage: stageMap[fixture.stage],
    group: fixture.group,
    kickoff: fixture.date,
    venueId: fixture.venueId,
    homeNationId: fixture.homeNationId,
    awayNationId: fixture.awayNationId,
    homeSource: fixture.homeSlot ? qualificationSource(fixture.homeSlot, fixture.matchNumber) : undefined,
    awaySource: fixture.awaySlot ? qualificationSource(fixture.awaySlot, fixture.matchNumber) : undefined,
  }
}

export function toDomainTournamentConfig(data: TournamentData): TournamentConfig {
  return {
    id: data.id,
    name: 'Gloria Mundial 26',
    startsAt: data.tournamentStart,
    endsAt: data.tournamentEnd,
    squadSize: 26,
    minimumGoalkeepers: 3,
    groups: data.groups,
    fixtures: data.fixtures.map(toDomainFixture),
    venues: data.venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      city: venue.city,
      countryCode: venue.country === 'Canada' ? 'CA' : venue.country === 'Mexico' ? 'MX' : 'US',
      capacity: venue.capacity,
      timeZone: venue.country === 'Canada' ? 'America/Toronto' : venue.country === 'Mexico' ? 'America/Mexico_City' : 'America/New_York',
    })),
  }
}

export function toDomainDataPack(data: TournamentData): WorldCupDataPack {
  return {
    id: data.id,
    schemaVersion: 1,
    publishedAt: data.snapshotDate,
    generatedAt: '2026-07-11T00:00:00+02:00',
    sources: data.sources.map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      license: source.license,
      retrievedAt: source.retrievedAt,
    })),
    nations: data.nations.map((nation) => toDomainNation(nation, data.playersByNation[nation.id] ?? [])),
    tournament: toDomainTournamentConfig(data),
  }
}
