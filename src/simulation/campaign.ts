import type {
  CampaignSave,
  DisciplinaryRecord,
  GroupId,
  GroupTableRow,
  MatchResultSummary,
  Nation,
  SimulationResult,
  TacticPlan,
  TournamentFixture,
  TournamentStage,
} from '../domain'
import { createDefaultTactic } from './formations'
import { simulateMatch } from './matchEngine'
import {
  buildRoundOf32Pairings,
  calculateGroupStandings,
  createKnockoutBracket,
  clearSingleCautions,
  GROUP_IDS,
  resolveBracketEntrant,
  qualifyFromGroups,
  updateDisciplinaryRecord,
  type GroupMatchRecord,
  type KnockoutResult,
} from './tournament'

export interface ApplyFixtureOptions {
  groups: Readonly<Record<GroupId, readonly string[]>>
  fairPlay?: { home: number; away: number }
}

/** Official art. 13 conduct deduction: only one category per player/match. */
export function fairPlayDeductionFromEvents(result: SimulationResult, side: 'home' | 'away'): number {
  const byPlayer = new Map<string, { yellows: number; directRed: boolean; secondYellow: boolean }>()
  for (const event of result.events) {
    if (event.side !== side || !event.playerId || (event.type !== 'yellow-card' && event.type !== 'red-card')) continue
    const record = byPlayer.get(event.playerId) ?? { yellows: 0, directRed: false, secondYellow: false }
    if (event.type === 'yellow-card') record.yellows += 1
    if (event.type === 'red-card') {
      if (/segunda amarilla/i.test(event.commentary)) record.secondYellow = true
      else record.directRed = true
    }
    byPlayer.set(event.playerId, record)
  }
  let deduction = 0
  for (const record of byPlayer.values()) {
    if (record.secondYellow || (!record.directRed && record.yellows >= 2)) deduction -= 3
    else if (record.directRed && record.yellows >= 1) deduction -= 5
    else if (record.directRed) deduction -= 4
    else if (record.yellows >= 1) deduction -= 1
  }
  return deduction
}

export function resultFromSimulation(result: SimulationResult, playedAt: string): MatchResultSummary {
  return {
    home: result.score.home,
    away: result.score.away,
    homePenalties: result.score.penalties?.home,
    awayPenalties: result.score.penalties?.away,
    homeFairPlayPoints: fairPlayDeductionFromEvents(result, 'home'),
    awayFairPlayPoints: fairPlayDeductionFromEvents(result, 'away'),
    winnerId: result.winnerId,
    playedAt,
  }
}

export function applyFixtureResult(
  fixtures: readonly TournamentFixture[],
  fixtureId: string,
  result: MatchResultSummary,
): TournamentFixture[] {
  let found = false
  const updated = fixtures.map((fixture) => {
    if (fixture.id !== fixtureId) return { ...fixture, result: fixture.result ? { ...fixture.result } : undefined }
    if (!fixture.homeNationId || !fixture.awayNationId) throw new Error('No se puede guardar un partido sin participantes resueltos.')
    found = true
    return { ...fixture, result: { ...result } }
  })
  if (!found) throw new Error(`No existe el partido ${fixtureId}.`)
  return updated
}

export function groupRecordsFromFixtures(
  fixtures: readonly TournamentFixture[],
  fairPlayByFixture: Readonly<Record<string, { home: number; away: number }>> = {},
): GroupMatchRecord[] {
  return fixtures.flatMap((fixture) => {
    if (fixture.stage !== 'group' || !fixture.group || !fixture.result || !fixture.homeNationId || !fixture.awayNationId) return []
    const fairPlay = fairPlayByFixture[fixture.id]
    return [{
      id: fixture.id,
      group: fixture.group,
      homeNationId: fixture.homeNationId,
      awayNationId: fixture.awayNationId,
      homeGoals: fixture.result.home,
      awayGoals: fixture.result.away,
      homeFairPlay: fairPlay?.home ?? fixture.result.homeFairPlayPoints ?? 0,
      awayFairPlay: fairPlay?.away ?? fixture.result.awayFairPlayPoints ?? 0,
    }]
  })
}

export function recalculateGroupTables(
  groups: Readonly<Record<GroupId, readonly string[]>>,
  fixtures: readonly TournamentFixture[],
  fairPlayByFixture: Readonly<Record<string, { home: number; away: number }>> = {},
): Record<GroupId, GroupTableRow[]> {
  const records = groupRecordsFromFixtures(fixtures, fairPlayByFixture)
  return Object.fromEntries(GROUP_IDS.map((group) => [
    group,
    calculateGroupStandings(groups[group], records.filter((record) => record.group === group)),
  ])) as Record<GroupId, GroupTableRow[]>
}

function fixtureWinnerAndLoser(fixture: TournamentFixture): { winnerId: string; loserId: string } | undefined {
  if (!fixture.result || !fixture.homeNationId || !fixture.awayNationId) return undefined
  if (fixture.result.winnerId) {
    return {
      winnerId: fixture.result.winnerId,
      loserId: fixture.result.winnerId === fixture.homeNationId ? fixture.awayNationId : fixture.homeNationId,
    }
  }
  const homeWon = fixture.result.home > fixture.result.away
    || (fixture.result.home === fixture.result.away
      && (fixture.result.homePenalties ?? -1) > (fixture.result.awayPenalties ?? -1))
  if (fixture.result.home === fixture.result.away && fixture.result.homePenalties === fixture.result.awayPenalties) return undefined
  return {
    winnerId: homeWon ? fixture.homeNationId : fixture.awayNationId,
    loserId: homeWon ? fixture.awayNationId : fixture.homeNationId,
  }
}

/** Resolves every knockout participant currently knowable from completed fixtures. */
export function hydrateKnockoutParticipants(
  fixtures: readonly TournamentFixture[],
  tables: Readonly<Record<GroupId, readonly GroupTableRow[]>>,
): TournamentFixture[] {
  const roundOf32 = new Map(buildRoundOf32Pairings(tables).map((pairing) => [pairing.matchNumber, pairing]))
  const bracket = createKnockoutBracket(tables)
  const updated = fixtures.map((fixture) => ({ ...fixture, result: fixture.result ? { ...fixture.result } : undefined }))
  const fixtureByNumber = new Map(updated.map((fixture) => [fixture.matchNumber, fixture]))

  for (const [number, pairing] of roundOf32) {
    const fixture = fixtureByNumber.get(number)
    if (fixture) {
      fixture.homeNationId = pairing.homeNationId
      fixture.awayNationId = pairing.awayNationId
    }
  }

  const results = (): KnockoutResult[] => updated.flatMap((fixture) => {
    if (!fixture.result || !fixture.homeNationId || !fixture.awayNationId || fixture.stage === 'group') return []
    return [{ matchNumber: fixture.matchNumber, homeNationId: fixture.homeNationId, awayNationId: fixture.awayNationId, result: fixture.result }]
  })
  for (const match of bracket.filter((item) => item.matchNumber >= 89).sort((left, right) => left.matchNumber - right.matchNumber)) {
    const fixture = fixtureByNumber.get(match.matchNumber)
    if (!fixture) continue
    fixture.homeNationId = resolveBracketEntrant(match.home, results())
    fixture.awayNationId = resolveBracketEntrant(match.away, results())
  }
  return updated
}

export function applySimulationToCampaign(
  campaign: CampaignSave,
  fixtureId: string,
  simulation: SimulationResult,
  playedAt: string,
  options: ApplyFixtureOptions,
): CampaignSave {
  const summary = resultFromSimulation(simulation, playedAt)
  if (options.fairPlay) {
    summary.homeFairPlayPoints = options.fairPlay.home
    summary.awayFairPlayPoints = options.fairPlay.away
  }
  let fixtures = applyFixtureResult(campaign.fixtures, fixtureId, summary)
  const fairPlayByFixture: Record<string, { home: number; away: number }> = {
    [fixtureId]: options.fairPlay ?? {
      home: fairPlayDeductionFromEvents(simulation, 'home'),
      away: fairPlayDeductionFromEvents(simulation, 'away'),
    },
  }
  const groupTables = recalculateGroupTables(options.groups, fixtures, fairPlayByFixture)
  const groupStageComplete = fixtures.filter((fixture) => fixture.stage === 'group').every((fixture) => Boolean(fixture.result))
  if (groupStageComplete) fixtures = hydrateKnockoutParticipants(fixtures, groupTables)
  const playedFixture = fixtures.find((fixture) => fixture.id === fixtureId)
  const finalCompleted = playedFixture?.stage === 'final'
  const participatingNations = new Set([playedFixture?.homeNationId, playedFixture?.awayNationId].filter((id): id is string => Boolean(id)))
  let disciplinaryRecords = campaign.disciplinaryRecords.map((record) => ({
    ...record,
    suspensionMatches: participatingNations.has(record.nationId) && record.suspensionMatches > 0
      ? record.suspensionMatches - 1
      : record.suspensionMatches,
  }))
  const recordByPlayer = new Map(disciplinaryRecords.map((record) => [record.playerId, record]))
  const nationByPlayer = new Map(simulation.finalPlayers.map((player) => [player.playerId, player.nationId]))
  for (const event of simulation.events) {
    if (!event.playerId || (event.type !== 'yellow-card' && event.type !== 'red-card')) continue
    const nationId = nationByPlayer.get(event.playerId)
    if (!nationId) continue
    const current: DisciplinaryRecord = recordByPlayer.get(event.playerId) ?? {
      nationId,
      playerId: event.playerId,
      yellowCards: 0,
      redCards: 0,
      suspensionMatches: 0,
    }
    const disciplineEvent = event.type === 'yellow-card'
      ? 'yellow'
      : event.outcome === 'second-yellow' ? 'second-yellow' : 'direct-red'
    recordByPlayer.set(event.playerId, updateDisciplinaryRecord(current, disciplineEvent, playedFixture?.stage ?? 'group'))
  }
  disciplinaryRecords = [...recordByPlayer.values()]
  const quarterFinalsComplete = fixtures.filter((fixture) => fixture.stage === 'quarter-final').length === 4
    && fixtures.filter((fixture) => fixture.stage === 'quarter-final').every((fixture) => Boolean(fixture.result))
  const justCompletedGroups = groupStageComplete
    && campaign.fixtures.filter((fixture) => fixture.stage === 'group').some((fixture) => !fixture.result)
  const justCompletedQuarterFinals = quarterFinalsComplete
    && campaign.fixtures.filter((fixture) => fixture.stage === 'quarter-final').some((fixture) => !fixture.result)
  if (justCompletedGroups || justCompletedQuarterFinals) disciplinaryRecords = clearSingleCautions(disciplinaryRecords)

  let eliminated = campaign.eliminated
  if (groupStageComplete) {
    const qualified = qualifyFromGroups(groupTables)
    const qualifiedIds = new Set([
      ...Object.values(qualified.winners),
      ...Object.values(qualified.runnersUp),
      ...qualified.bestThirds.map((entry) => entry.nationId),
    ])
    if (!qualifiedIds.has(campaign.controlledNationId)) eliminated = true
  }
  if (playedFixture && playedFixture.stage !== 'group'
    && participatingNations.has(campaign.controlledNationId)
    && simulation.winnerId !== campaign.controlledNationId) eliminated = true
  return {
    ...campaign,
    fixtures,
    groupTables,
    disciplinaryRecords,
    eliminated,
    completed: campaign.completed || finalCompleted,
    updatedAt: playedAt,
    pendingMatch: undefined,
    resumableSnapshot: undefined,
  }
}

function tacticForNation(nation: Nation): TacticPlan {
  const formation = nation.tacticalIdentity === 'low-block' ? '5-4-1'
    : nation.tacticalIdentity === 'counter' ? '4-2-3-1'
      : nation.tacticalIdentity === 'wide' ? '4-3-3'
        : nation.tacticalIdentity === 'possession' ? '4-3-3'
          : nation.tacticalIdentity === 'high-press' ? '4-3-3'
            : '4-2-3-1'
  return createDefaultTactic(formation, {
    id: `ai-${nation.id}`,
    name: `Identidad de ${nation.shortName}`,
    mentality: nation.strength >= 84 ? 'positive' : nation.strength < 73 ? 'defensive' : 'balanced',
    pressing: nation.tacticalIdentity === 'high-press' ? 76 : nation.tacticalIdentity === 'low-block' ? 35 : 53,
    defensiveLine: nation.tacticalIdentity === 'low-block' ? 32 : nation.tacticalIdentity === 'high-press' ? 68 : 51,
    passingDirectness: nation.tacticalIdentity === 'vertical' || nation.tacticalIdentity === 'counter' ? 68 : nation.tacticalIdentity === 'possession' ? 34 : 50,
    transition: nation.tacticalIdentity === 'counter' || nation.tacticalIdentity === 'vertical' ? 'counter' : 'balanced',
  })
}

export interface SimulateAiFixtureOptions {
  seed: number | string
  homeTactic?: TacticPlan
  awayTactic?: TacticPlan
  snapshotIntervalTicks?: number
}

/** Simulates any resolved fixture with the same deterministic engine used by the player. */
export function simulateAiFixture(
  fixture: TournamentFixture,
  nations: readonly Nation[],
  options: SimulateAiFixtureOptions,
): SimulationResult {
  if (!fixture.homeNationId || !fixture.awayNationId) throw new Error(`Los participantes del partido ${fixture.matchNumber} aún no están resueltos.`)
  const home = nations.find((nation) => nation.id === fixture.homeNationId)
  const away = nations.find((nation) => nation.id === fixture.awayNationId)
  if (!home || !away) throw new Error('No se han encontrado las selecciones del partido.')
  return simulateMatch({
    id: fixture.id,
    seed: options.seed,
    home,
    away,
    homeTactic: options.homeTactic ?? tacticForNation(home),
    awayTactic: options.awayTactic ?? tacticForNation(away),
    stage: fixture.stage,
    knockout: fixture.stage !== 'group',
    snapshotIntervalTicks: options.snapshotIntervalTicks ?? 100,
  })
}

export function resolveFixtureResultParticipant(fixture: TournamentFixture, kind: 'winner' | 'loser'): string | undefined {
  return fixtureWinnerAndLoser(fixture)?.[kind === 'winner' ? 'winnerId' : 'loserId']
}

export function isKnockoutStage(stage: TournamentStage): boolean {
  return stage !== 'group'
}
