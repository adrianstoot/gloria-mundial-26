import type { GroupId, GroupTableRow } from '../domain'
import type {
  FixtureStage,
  NationId,
  TournamentData,
  TournamentFixture,
} from '../data'
import {
  buildRoundOf32Pairings,
  calculateGroupStandings,
  GROUP_IDS,
  qualifyFromGroups,
  type GroupMatchRecord,
  type GroupQualification,
} from '../simulation/tournament'

/**
 * Structural result accepted from the lightweight UI campaign.  Keeping this
 * contract independent from React makes the progression engine equally useful
 * from App, MatchCenter, the tournament screen and tests.
 */
export interface CampaignMatchResult {
  fixtureId: string
  homeNationId: NationId
  awayNationId: NationId
  home: number
  away: number
  /** Shoot-out score. Required only when a knockout match remains level. */
  homePenalties?: number
  awayPenalties?: number
  /** FIFA fair-play deductions: 0, -1, -3, -4 or -5 per incident. */
  homeFairPlayPoints?: number
  awayFairPlayPoints?: number
  playedAt?: string
}

export type CampaignMatchResults =
  | Readonly<Record<string, CampaignMatchResult>>
  | readonly CampaignMatchResult[]

export type ResolvedFixtureStatus = 'blocked' | 'ready' | 'played' | 'invalid'

export interface ResolvedCampaignFixture extends TournamentFixture {
  homeNationId?: NationId
  awayNationId?: NationId
  status: ResolvedFixtureStatus
  result?: CampaignMatchResult
  winnerNationId?: NationId
  loserNationId?: NationId
}

export interface NationTournamentStats {
  nationId: NationId
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  groupPoints: number
  cleanSheets: number
  knockoutWins: number
  penaltyShootoutWins: number
}

export interface CampaignAggregateStats {
  scheduledMatches: number
  matchesPlayed: number
  matchesRemaining: number
  groupMatchesPlayed: number
  knockoutMatchesPlayed: number
  totalGoals: number
  goalsPerMatch: number
  homeWins: number
  awayWins: number
  draws: number
  penaltyShootouts: number
  matchesByStage: Record<FixtureStage, number>
  byNation: Record<NationId, NationTournamentStats>
  /** Nation ids ordered by goals, goal difference, wins and source ranking. */
  topScoringNationIds: NationId[]
}

export type CampaignProgressIssueCode =
  | 'duplicate-result'
  | 'unknown-fixture'
  | 'invalid-score'
  | 'participant-mismatch'
  | 'unresolved-participants'
  | 'invalid-penalty-shootout'
  | 'unexpected-penalty-shootout'
  | 'invalid-tournament-data'

export interface CampaignProgressIssue {
  code: CampaignProgressIssueCode
  fixtureId?: string
  severity: 'warning' | 'error'
  message: string
}

export interface CampaignProgressOptions {
  /** Enables a direct next-match selector for the user's national team. */
  controlledNationId?: NationId
}

export interface CampaignProgress {
  fixtures: ResolvedCampaignFixture[]
  fixturesById: Record<string, ResolvedCampaignFixture>
  fixturesByMatchNumber: Record<number, ResolvedCampaignFixture>
  groupTables: Record<GroupId, GroupTableRow[]>
  groupComplete: Record<GroupId, boolean>
  groupStageComplete: boolean
  qualification?: GroupQualification
  nextFixture?: ResolvedCampaignFixture
  nextControlledFixture?: ResolvedCampaignFixture
  championNationId?: NationId
  runnerUpNationId?: NationId
  thirdPlaceNationId?: NationId
  fourthPlaceNationId?: NationId
  controlledNationEliminated?: boolean
  completed: boolean
  stats: CampaignAggregateStats
  issues: CampaignProgressIssue[]
}

const STAGES: readonly FixtureStage[] = [
  'GROUP',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
]

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function normalizeResults(
  input: CampaignMatchResults,
  fixtureIds: ReadonlySet<string>,
  issues: CampaignProgressIssue[],
): Map<string, CampaignMatchResult> {
  const entries: Array<[string, CampaignMatchResult]> = Array.isArray(input)
    ? input.map((result) => [result.fixtureId, result])
    : Object.entries(input)
  const normalized = new Map<string, CampaignMatchResult>()

  for (const [storageKey, result] of entries) {
    const fixtureId = result?.fixtureId || storageKey
    if (!fixtureIds.has(fixtureId)) {
      issues.push({
        code: 'unknown-fixture',
        fixtureId,
        severity: 'warning',
        message: `El resultado ${fixtureId} no corresponde a ningún partido del torneo.`,
      })
      continue
    }
    if (normalized.has(fixtureId)) {
      issues.push({
        code: 'duplicate-result',
        fixtureId,
        severity: 'warning',
        message: `Hay más de un resultado para ${fixtureId}; se conserva el último.`,
      })
    }
    normalized.set(fixtureId, { ...result, fixtureId })
  }
  return normalized
}

interface ResultResolution {
  valid: boolean
  winnerNationId?: NationId
  loserNationId?: NationId
}

function resolveResult(
  fixture: TournamentFixture,
  homeNationId: NationId | undefined,
  awayNationId: NationId | undefined,
  result: CampaignMatchResult | undefined,
  issues: CampaignProgressIssue[],
): ResultResolution {
  if (!result) return { valid: false }
  if (!homeNationId || !awayNationId) {
    issues.push({
      code: 'unresolved-participants',
      fixtureId: fixture.id,
      severity: 'error',
      message: `El resultado de ${fixture.id} se recibió antes de resolver sus participantes.`,
    })
    return { valid: false }
  }
  if (result.homeNationId !== homeNationId || result.awayNationId !== awayNationId) {
    issues.push({
      code: 'participant-mismatch',
      fixtureId: fixture.id,
      severity: 'error',
      message: `Los participantes guardados para ${fixture.id} no coinciden con el cuadro resuelto.`,
    })
    return { valid: false }
  }
  if (!isNonNegativeInteger(result.home) || !isNonNegativeInteger(result.away)) {
    issues.push({
      code: 'invalid-score',
      fixtureId: fixture.id,
      severity: 'error',
      message: `El marcador de ${fixture.id} debe contener enteros no negativos.`,
    })
    return { valid: false }
  }

  const isKnockout = fixture.stage !== 'GROUP'
  const hasHomePenalties = result.homePenalties !== undefined
  const hasAwayPenalties = result.awayPenalties !== undefined
  const hasAnyPenalties = hasHomePenalties || hasAwayPenalties
  const validPenaltyValues = hasHomePenalties && hasAwayPenalties
    && isNonNegativeInteger(result.homePenalties)
    && isNonNegativeInteger(result.awayPenalties)

  if (!isKnockout) {
    if (hasAnyPenalties) {
      issues.push({
        code: 'unexpected-penalty-shootout',
        fixtureId: fixture.id,
        severity: 'warning',
        message: `Se ignoran los penaltis guardados para el partido de grupo ${fixture.id}.`,
      })
    }
    if (result.home === result.away) return { valid: true }
  } else if (result.home === result.away) {
    if (!validPenaltyValues || result.homePenalties === result.awayPenalties) {
      issues.push({
        code: 'invalid-penalty-shootout',
        fixtureId: fixture.id,
        severity: 'error',
        message: `El empate de ${fixture.id} necesita una tanda de penaltis válida y con ganador.`,
      })
      return { valid: false }
    }
    const homePenalties = result.homePenalties as number
    const awayPenalties = result.awayPenalties as number
    const homeWon = homePenalties > awayPenalties
    return {
      valid: true,
      winnerNationId: homeWon ? homeNationId : awayNationId,
      loserNationId: homeWon ? awayNationId : homeNationId,
    }
  } else if (hasAnyPenalties) {
    issues.push({
      code: 'unexpected-penalty-shootout',
      fixtureId: fixture.id,
      severity: 'warning',
      message: `Se ignora la tanda de ${fixture.id} porque el marcador ya tiene ganador.`,
    })
  }

  const homeWon = result.home > result.away
  return {
    valid: true,
    winnerNationId: homeWon ? homeNationId : awayNationId,
    loserNationId: homeWon ? awayNationId : homeNationId,
  }
}

function fixtureStatus(
  homeNationId: NationId | undefined,
  awayNationId: NationId | undefined,
  result: CampaignMatchResult | undefined,
  validResult: boolean,
): ResolvedFixtureStatus {
  if (result) return validResult ? 'played' : 'invalid'
  return homeNationId && awayNationId ? 'ready' : 'blocked'
}

function resolveDependentSlot(
  slot: string | undefined,
  resolvedByNumber: ReadonlyMap<number, ResolvedCampaignFixture>,
): NationId | undefined {
  if (!slot) return undefined
  const match = /^([WL])(\d+)$/.exec(slot)
  if (!match) return undefined
  const source = resolvedByNumber.get(Number(match[2]))
  return match[1] === 'W' ? source?.winnerNationId : source?.loserNationId
}

function blankNationStats(nationId: NationId): NationTournamentStats {
  return {
    nationId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    groupPoints: 0,
    cleanSheets: 0,
    knockoutWins: 0,
    penaltyShootoutWins: 0,
  }
}

function aggregateStats(
  data: TournamentData,
  fixtures: readonly ResolvedCampaignFixture[],
): CampaignAggregateStats {
  const byNation: Record<NationId, NationTournamentStats> = Object.fromEntries(
    data.nations.map((nation) => [nation.id, blankNationStats(nation.id)]),
  )
  const matchesByStage = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<FixtureStage, number>
  let totalGoals = 0
  let homeWins = 0
  let awayWins = 0
  let draws = 0
  let penaltyShootouts = 0
  let groupMatchesPlayed = 0
  let knockoutMatchesPlayed = 0

  for (const fixture of fixtures) {
    if (fixture.status !== 'played' || !fixture.result || !fixture.homeNationId || !fixture.awayNationId) continue
    const home = byNation[fixture.homeNationId] ?? (byNation[fixture.homeNationId] = blankNationStats(fixture.homeNationId))
    const away = byNation[fixture.awayNationId] ?? (byNation[fixture.awayNationId] = blankNationStats(fixture.awayNationId))
    const result = fixture.result
    matchesByStage[fixture.stage] += 1
    totalGoals += result.home + result.away
    home.played += 1
    away.played += 1
    home.goalsFor += result.home
    home.goalsAgainst += result.away
    away.goalsFor += result.away
    away.goalsAgainst += result.home
    if (result.away === 0) home.cleanSheets += 1
    if (result.home === 0) away.cleanSheets += 1

    if (result.home > result.away) {
      home.won += 1
      away.lost += 1
      homeWins += 1
      if (fixture.stage === 'GROUP') home.groupPoints += 3
    } else if (result.away > result.home) {
      away.won += 1
      home.lost += 1
      awayWins += 1
      if (fixture.stage === 'GROUP') away.groupPoints += 3
    } else {
      home.drawn += 1
      away.drawn += 1
      draws += 1
      if (fixture.stage === 'GROUP') {
        home.groupPoints += 1
        away.groupPoints += 1
      }
    }

    if (fixture.stage === 'GROUP') {
      groupMatchesPlayed += 1
    } else {
      knockoutMatchesPlayed += 1
      if (fixture.winnerNationId) byNation[fixture.winnerNationId]!.knockoutWins += 1
      if (result.home === result.away) {
        penaltyShootouts += 1
        if (fixture.winnerNationId) byNation[fixture.winnerNationId]!.penaltyShootoutWins += 1
      }
    }
  }

  for (const stats of Object.values(byNation)) {
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst
  }
  const sourceOrder = new Map(data.nations.map((nation, index) => [nation.id, index]))
  const topScoringNationIds = Object.values(byNation)
    .sort((left, right) => right.goalsFor - left.goalsFor
      || right.goalDifference - left.goalDifference
      || right.won - left.won
      || (sourceOrder.get(left.nationId) ?? Number.MAX_SAFE_INTEGER)
        - (sourceOrder.get(right.nationId) ?? Number.MAX_SAFE_INTEGER))
    .map((stats) => stats.nationId)
  const matchesPlayed = groupMatchesPlayed + knockoutMatchesPlayed

  return {
    scheduledMatches: fixtures.length,
    matchesPlayed,
    matchesRemaining: fixtures.length - matchesPlayed,
    groupMatchesPlayed,
    knockoutMatchesPlayed,
    totalGoals,
    goalsPerMatch: matchesPlayed ? totalGoals / matchesPlayed : 0,
    homeWins,
    awayWins,
    draws,
    penaltyShootouts,
    matchesByStage,
    byNation,
    topScoringNationIds,
  }
}

function byKickoff(left: ResolvedCampaignFixture, right: ResolvedCampaignFixture): number {
  return left.date.localeCompare(right.date) || left.matchNumber - right.matchNumber
}

function determineControlledNationEliminated(
  controlledNationId: NationId | undefined,
  groupStageComplete: boolean,
  qualification: GroupQualification | undefined,
  fixtures: readonly ResolvedCampaignFixture[],
): boolean | undefined {
  if (!controlledNationId) return undefined
  if (!groupStageComplete || !qualification) return false
  const qualified = new Set<NationId>([
    ...Object.values(qualification.winners),
    ...Object.values(qualification.runnersUp),
    ...qualification.bestThirds.map((entry) => entry.nationId),
  ])
  if (!qualified.has(controlledNationId)) return true
  return fixtures.some((fixture) => fixture.stage !== 'GROUP'
    && fixture.status === 'played'
    && fixture.loserNationId === controlledNationId)
}

/**
 * Derives every piece of tournament progression from immutable tournament data
 * plus the UI's result map. No state is cached or mutated, so saves can always
 * be reconstructed and repaired after loading.
 */
export function deriveCampaignProgress(
  data: TournamentData,
  matchResults: CampaignMatchResults,
  options: CampaignProgressOptions = {},
): CampaignProgress {
  const issues: CampaignProgressIssue[] = []
  const sourceFixtures = [...data.fixtures].sort((left, right) => left.matchNumber - right.matchNumber)
  const fixtureIds = new Set(sourceFixtures.map((fixture) => fixture.id))
  const resultsById = normalizeResults(matchResults, fixtureIds, issues)
  const resolvedByNumber = new Map<number, ResolvedCampaignFixture>()
  const acceptedGroupResults = new Set<string>()
  const groupRecords: GroupMatchRecord[] = []

  for (const fixture of sourceFixtures.filter((item) => item.stage === 'GROUP')) {
    const result = resultsById.get(fixture.id)
    const resolution = resolveResult(
      fixture,
      fixture.homeNationId,
      fixture.awayNationId,
      result,
      issues,
    )
    if (resolution.valid && result && fixture.group && fixture.homeNationId && fixture.awayNationId) {
      acceptedGroupResults.add(fixture.id)
      groupRecords.push({
        id: fixture.id,
        group: fixture.group,
        homeNationId: fixture.homeNationId,
        awayNationId: fixture.awayNationId,
        homeGoals: result.home,
        awayGoals: result.away,
        homeFairPlay: result.homeFairPlayPoints ?? 0,
        awayFairPlay: result.awayFairPlayPoints ?? 0,
      })
    }
    resolvedByNumber.set(fixture.matchNumber, {
      ...fixture,
      status: fixtureStatus(fixture.homeNationId, fixture.awayNationId, result, resolution.valid),
      result: resolution.valid ? result : undefined,
      winnerNationId: resolution.winnerNationId,
      loserNationId: resolution.loserNationId,
    })
  }

  const drawingOrder: Record<NationId, number> = Object.fromEntries(
    data.nations.map((nation, index) => [nation.id, nation.worldRanking || index + 1]),
  )
  const groupTables = {} as Record<GroupId, GroupTableRow[]>
  const groupComplete = {} as Record<GroupId, boolean>
  for (const group of GROUP_IDS) {
    const nationIds = data.groups[group]
    if (!nationIds || new Set(nationIds).size !== 4) {
      issues.push({
        code: 'invalid-tournament-data',
        severity: 'error',
        message: `El grupo ${group} no contiene cuatro selecciones distintas.`,
      })
      groupTables[group] = []
      groupComplete[group] = false
      continue
    }
    const groupFixtures = sourceFixtures.filter((fixture) => fixture.stage === 'GROUP' && fixture.group === group)
    groupTables[group] = calculateGroupStandings(
      nationIds,
      groupRecords.filter((record) => record.group === group),
      drawingOrder,
    )
    groupComplete[group] = groupFixtures.length === 6
      && groupFixtures.every((fixture) => acceptedGroupResults.has(fixture.id))
  }

  const groupStageComplete = GROUP_IDS.every((group) => groupComplete[group])
  let qualification: GroupQualification | undefined
  let roundOf32 = new Map<number, ReturnType<typeof buildRoundOf32Pairings>[number]>()
  if (groupStageComplete) {
    try {
      qualification = qualifyFromGroups(groupTables)
      roundOf32 = new Map(buildRoundOf32Pairings(groupTables).map((pairing) => [pairing.matchNumber, pairing]))
    } catch (error) {
      issues.push({
        code: 'invalid-tournament-data',
        severity: 'error',
        message: error instanceof Error ? error.message : 'No se pudo construir la ronda de 32.',
      })
    }
  }

  for (const fixture of sourceFixtures.filter((item) => item.stage !== 'GROUP')) {
    const pairing = fixture.stage === 'ROUND_OF_32' ? roundOf32.get(fixture.matchNumber) : undefined
    const homeNationId = pairing?.homeNationId
      ?? fixture.homeNationId
      ?? resolveDependentSlot(fixture.homeSlot, resolvedByNumber)
    const awayNationId = pairing?.awayNationId
      ?? fixture.awayNationId
      ?? resolveDependentSlot(fixture.awaySlot, resolvedByNumber)
    const result = resultsById.get(fixture.id)
    const resolution = resolveResult(fixture, homeNationId, awayNationId, result, issues)
    resolvedByNumber.set(fixture.matchNumber, {
      ...fixture,
      homeNationId,
      awayNationId,
      status: fixtureStatus(homeNationId, awayNationId, result, resolution.valid),
      result: resolution.valid ? result : undefined,
      winnerNationId: resolution.winnerNationId,
      loserNationId: resolution.loserNationId,
    })
  }

  const fixtures = sourceFixtures.map((fixture) => resolvedByNumber.get(fixture.matchNumber)!)
  const fixturesById = Object.fromEntries(fixtures.map((fixture) => [fixture.id, fixture]))
  const fixturesByMatchNumber = Object.fromEntries(fixtures.map((fixture) => [fixture.matchNumber, fixture]))
  const playable = fixtures
    .filter((fixture) => fixture.status === 'ready' || (fixture.status === 'invalid' && fixture.homeNationId && fixture.awayNationId))
    .sort(byKickoff)
  const nextFixture = playable[0]
  const nextControlledFixture = options.controlledNationId
    ? playable.find((fixture) => fixture.homeNationId === options.controlledNationId
      || fixture.awayNationId === options.controlledNationId)
    : undefined
  const final = resolvedByNumber.get(104)
  const thirdPlace = resolvedByNumber.get(103)
  const championNationId = final?.status === 'played' ? final.winnerNationId : undefined
  const runnerUpNationId = final?.status === 'played' ? final.loserNationId : undefined
  const thirdPlaceNationId = thirdPlace?.status === 'played' ? thirdPlace.winnerNationId : undefined
  const fourthPlaceNationId = thirdPlace?.status === 'played' ? thirdPlace.loserNationId : undefined

  return {
    fixtures,
    fixturesById,
    fixturesByMatchNumber,
    groupTables,
    groupComplete,
    groupStageComplete,
    qualification,
    nextFixture,
    nextControlledFixture,
    championNationId,
    runnerUpNationId,
    thirdPlaceNationId,
    fourthPlaceNationId,
    controlledNationEliminated: determineControlledNationEliminated(
      options.controlledNationId,
      groupStageComplete,
      qualification,
      fixtures,
    ),
    completed: Boolean(championNationId),
    stats: aggregateStats(data, fixtures),
    issues,
  }
}

/** Convenient selector for callers that already hold a derived progression. */
export function nextMatchForNation(
  progress: Pick<CampaignProgress, 'fixtures'>,
  nationId: NationId,
): ResolvedCampaignFixture | undefined {
  return progress.fixtures
    .filter((fixture) => (fixture.status === 'ready' || fixture.status === 'invalid')
      && (fixture.homeNationId === nationId || fixture.awayNationId === nationId))
    .sort(byKickoff)[0]
}
