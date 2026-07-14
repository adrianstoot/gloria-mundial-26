import type {
  DisciplinaryRecord,
  EntityId,
  GroupId,
  GroupTableRow,
  MatchResultSummary,
  TournamentStage,
} from '../domain'
import annexCData from './annex-c.generated.json'

export const GROUP_IDS: readonly GroupId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export interface GroupMatchRecord {
  id: string
  group: GroupId
  homeNationId: EntityId
  awayNationId: EntityId
  homeGoals: number
  awayGoals: number
  /** Fair-play deductions earned in this match (0, -1, -3, -4 or -5 per incident). */
  homeFairPlay?: number
  awayFairPlay?: number
}

export interface GroupQualification {
  winners: Record<GroupId, EntityId>
  runnersUp: Record<GroupId, EntityId>
  bestThirds: Array<{ group: GroupId; nationId: EntityId; row: GroupTableRow }>
  eliminatedThirds: Array<{ group: GroupId; nationId: EntityId; row: GroupTableRow }>
}

export interface ResolvedRoundOf32Pairing {
  matchNumber: number
  stage: 'round-of-32'
  homeNationId: EntityId
  awayNationId: EntityId
  label: string
}

export type BracketEntrant =
  | { kind: 'nation'; nationId: EntityId }
  | { kind: 'winner'; matchNumber: number }
  | { kind: 'loser'; matchNumber: number }

export interface KnockoutBracketMatch {
  matchNumber: number
  stage: Exclude<TournamentStage, 'group'>
  home: BracketEntrant
  away: BracketEntrant
}

export interface KnockoutResult {
  matchNumber: number
  homeNationId: EntityId
  awayNationId: EntityId
  result: MatchResultSummary
}

function blankRow(nationId: EntityId): GroupTableRow {
  return {
    nationId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    fairPlayPoints: 0,
  }
}

function applyResult(
  rows: Map<EntityId, GroupTableRow>,
  homeId: EntityId,
  awayId: EntityId,
  homeGoals: number,
  awayGoals: number,
  homeFairPlay = 0,
  awayFairPlay = 0,
): void {
  const home = rows.get(homeId)
  const away = rows.get(awayId)
  if (!home || !away) throw new Error('El partido incluye una selección que no pertenece al grupo.')
  home.played += 1
  away.played += 1
  home.goalsFor += homeGoals
  home.goalsAgainst += awayGoals
  away.goalsFor += awayGoals
  away.goalsAgainst += homeGoals
  home.goalDifference = home.goalsFor - home.goalsAgainst
  away.goalDifference = away.goalsFor - away.goalsAgainst
  home.fairPlayPoints += homeFairPlay
  away.fairPlayPoints += awayFairPlay
  if (homeGoals > awayGoals) {
    home.won += 1
    away.lost += 1
    home.points += 3
  } else if (awayGoals > homeGoals) {
    away.won += 1
    home.lost += 1
    away.points += 3
  } else {
    home.drawn += 1
    away.drawn += 1
    home.points += 1
    away.points += 1
  }
}

function compareKeys(left: GroupTableRow, right: GroupTableRow): number {
  return right.points - left.points
    || right.goalDifference - left.goalDifference
    || right.goalsFor - left.goalsFor
}

function sameCompetitiveKeys(left: GroupTableRow, right: GroupTableRow): boolean {
  return left.points === right.points
    && left.goalDifference === right.goalDifference
    && left.goalsFor === right.goalsFor
}

function groupEqualRows(rows: GroupTableRow[]): GroupTableRow[][] {
  const groups: GroupTableRow[][] = []
  for (const row of rows) {
    const previous = groups.at(-1)
    if (previous && sameCompetitiveKeys(previous[0]!, row)) previous.push(row)
    else groups.push([row])
  }
  return groups
}

function groupRowsByPoints(rows: GroupTableRow[]): GroupTableRow[][] {
  const groups: GroupTableRow[][] = []
  for (const row of rows) {
    const previous = groups.at(-1)
    if (previous && previous[0]!.points === row.points) previous.push(row)
    else groups.push([row])
  }
  return groups
}

function headToHeadRows(nationIds: readonly EntityId[], matches: readonly GroupMatchRecord[]): Map<EntityId, GroupTableRow> {
  const rows = new Map(nationIds.map((id) => [id, blankRow(id)]))
  const selected = new Set(nationIds)
  for (const match of matches) {
    if (selected.has(match.homeNationId) && selected.has(match.awayNationId)) {
      applyResult(rows, match.homeNationId, match.awayNationId, match.homeGoals, match.awayGoals)
    }
  }
  return rows
}

function resolveHeadToHead(
  tied: GroupTableRow[],
  matches: readonly GroupMatchRecord[],
  drawingOrder: Readonly<Record<EntityId, number>>,
  depth = 0,
): GroupTableRow[] {
  if (tied.length <= 1) return tied
  const mini = headToHeadRows(tied.map((row) => row.nationId), matches)
  const ordered = [...tied].sort((left, right) => compareKeys(mini.get(left.nationId)!, mini.get(right.nationId)!))
  const miniGroups = groupEqualRows(ordered.map((row) => ({ ...row, ...mini.get(row.nationId), nationId: row.nationId })))
  const separated = miniGroups.length > 1

  if (separated && depth < 4) {
    return miniGroups.flatMap((miniGroup) => {
      const originals = miniGroup.map((row) => tied.find((item) => item.nationId === row.nationId)!)
      return originals.length === tied.length ? originals : resolveHeadToHead(originals, matches, drawingOrder, depth + 1)
    })
  }

  // FIFA 2026 step 2: once the head-to-head criteria can no longer separate
  // the remaining teams, use overall goal difference/goals, then conduct and
  // finally the supplied ranking order. Do not restart the overall criteria.
  return [...tied].sort((left, right) =>
    right.goalDifference - left.goalDifference
    || right.goalsFor - left.goalsFor
    || right.fairPlayPoints - left.fairPlayPoints
    || (drawingOrder[left.nationId] ?? Number.MAX_SAFE_INTEGER) - (drawingOrder[right.nationId] ?? Number.MAX_SAFE_INTEGER)
    || left.nationId.localeCompare(right.nationId))
}

/**
 * Ranks a four-team group using the 2026 order: total points, head-to-head
 * points/goal difference/goals (recursively among teams still tied), overall
 * goal difference/goals, conduct and finally the supplied FIFA ranking order.
 */
export function calculateGroupStandings(
  nationIds: readonly EntityId[],
  matches: readonly GroupMatchRecord[],
  drawingOrder: Readonly<Record<EntityId, number>> = {},
): GroupTableRow[] {
  if (new Set(nationIds).size !== 4) throw new Error('Cada grupo debe contener exactamente cuatro selecciones distintas.')
  const nationSet = new Set(nationIds)
  const relevant = matches.filter((match) => nationSet.has(match.homeNationId) && nationSet.has(match.awayNationId))
  const rows = new Map(nationIds.map((id) => [id, blankRow(id)]))
  for (const match of relevant) {
    applyResult(
      rows,
      match.homeNationId,
      match.awayNationId,
      match.homeGoals,
      match.awayGoals,
      match.homeFairPlay,
      match.awayFairPlay,
    )
  }
  const sorted = [...rows.values()].sort((left, right) => right.points - left.points)
  const resolved = groupRowsByPoints(sorted).flatMap((tied) => resolveHeadToHead(tied, relevant, drawingOrder))
  return resolved.map((row, index) => ({ ...row, rank: index + 1 }))
}

function compareBestThird(
  left: { group: GroupId; nationId: EntityId; row: GroupTableRow },
  right: { group: GroupId; nationId: EntityId; row: GroupTableRow },
): number {
  return compareKeys(left.row, right.row)
    || right.row.fairPlayPoints - left.row.fairPlayPoints
    || GROUP_IDS.indexOf(left.group) - GROUP_IDS.indexOf(right.group)
    || left.nationId.localeCompare(right.nationId)
}

export function rankBestThirdPlaced(
  tables: Readonly<Partial<Record<GroupId, readonly GroupTableRow[]>>>,
): Array<{ group: GroupId; nationId: EntityId; row: GroupTableRow }> {
  const candidates = GROUP_IDS.flatMap((group) => {
    const row = tables[group]?.[2]
    return row ? [{ group, nationId: row.nationId, row: { ...row } }] : []
  })
  return candidates.sort(compareBestThird)
}

export function qualifyFromGroups(
  tables: Readonly<Record<GroupId, readonly GroupTableRow[]>>,
): GroupQualification {
  const winners = {} as Record<GroupId, EntityId>
  const runnersUp = {} as Record<GroupId, EntityId>
  for (const group of GROUP_IDS) {
    const table = tables[group]
    if (!table || table.length !== 4) throw new Error(`La tabla del grupo ${group} no está completa.`)
    winners[group] = table[0]!.nationId
    runnersUp[group] = table[1]!.nationId
  }
  const thirds = rankBestThirdPlaced(tables)
  return { winners, runnersUp, bestThirds: thirds.slice(0, 8), eliminatedThirds: thirds.slice(8) }
}

/** Winners whose R32 opponent is a qualifying third-placed team. */
export const THIRD_PLACE_ELIGIBILITY: Readonly<Record<GroupId, readonly GroupId[]>> = {
  A: ['C', 'E', 'F', 'H', 'I'],
  B: ['E', 'F', 'G', 'I', 'J'],
  C: [],
  D: ['B', 'E', 'F', 'I', 'J'],
  E: ['A', 'B', 'C', 'D', 'F'],
  F: [],
  G: ['A', 'E', 'H', 'I', 'J'],
  H: [],
  I: ['C', 'D', 'F', 'G', 'H'],
  J: [],
  K: ['D', 'E', 'I', 'J', 'L'],
  L: ['E', 'H', 'I', 'J', 'K'],
}

type AnnexCRow = { option: number; allocation: Record<string, GroupId> }
const ANNEX_C = annexCData as Record<string, AnnexCRow>

/**
 * Resolves any of the C(12,8)=495 possible sets using the literal row from
 * Annex C of the May 2026 tournament regulations.
 */
export function generateThirdPlaceAllocation(qualifyingGroups: readonly GroupId[]): Partial<Record<GroupId, GroupId>> {
  const selected = [...new Set(qualifyingGroups)].sort((left, right) => GROUP_IDS.indexOf(left) - GROUP_IDS.indexOf(right))
  if (selected.length !== 8) throw new Error('Deben clasificarse exactamente ocho terceros de grupos distintos.')
  const row = ANNEX_C[selected.join('')]
  if (!row) throw new Error(`No existe la opción oficial del Anexo C para ${selected.join(', ')}.`)
  return Object.fromEntries(Object.entries(row.allocation).map(([winner, third]) => [winner as GroupId, third]))
}

export function buildRoundOf32Pairings(
  tables: Readonly<Record<GroupId, readonly GroupTableRow[]>>,
): ResolvedRoundOf32Pairing[] {
  const qualification = qualifyFromGroups(tables)
  const thirdByGroup = new Map(qualification.bestThirds.map((entry) => [entry.group, entry.nationId]))
  const thirdAllocation = generateThirdPlaceAllocation(qualification.bestThirds.map((entry) => entry.group))
  const thirdForWinner = (winner: GroupId): EntityId => {
    const group = thirdAllocation[winner]
    const nationId = group ? thirdByGroup.get(group) : undefined
    if (!group || !nationId) throw new Error(`No se pudo resolver el rival del ganador del grupo ${winner}.`)
    return nationId
  }
  const winner = (group: GroupId) => qualification.winners[group]
  const runner = (group: GroupId) => qualification.runnersUp[group]
  const pairing = (matchNumber: number, homeNationId: EntityId, awayNationId: EntityId, label: string): ResolvedRoundOf32Pairing => ({
    matchNumber,
    stage: 'round-of-32',
    homeNationId,
    awayNationId,
    label,
  })
  return [
    pairing(73, runner('A'), runner('B'), '2A–2B'),
    pairing(74, winner('E'), thirdForWinner('E'), '1E–3º'),
    pairing(75, winner('F'), runner('C'), '1F–2C'),
    pairing(76, winner('C'), runner('F'), '1C–2F'),
    pairing(77, winner('I'), thirdForWinner('I'), '1I–3º'),
    pairing(78, runner('E'), runner('I'), '2E–2I'),
    pairing(79, winner('A'), thirdForWinner('A'), '1A–3º'),
    pairing(80, winner('L'), thirdForWinner('L'), '1L–3º'),
    pairing(81, winner('D'), thirdForWinner('D'), '1D–3º'),
    pairing(82, winner('G'), thirdForWinner('G'), '1G–3º'),
    pairing(83, runner('K'), runner('L'), '2K–2L'),
    pairing(84, winner('H'), runner('J'), '1H–2J'),
    pairing(85, winner('B'), thirdForWinner('B'), '1B–3º'),
    pairing(86, winner('J'), runner('H'), '1J–2H'),
    pairing(87, winner('K'), thirdForWinner('K'), '1K–3º'),
    pairing(88, runner('D'), runner('G'), '2D–2G'),
  ]
}

export function createKnockoutBracket(
  tables: Readonly<Record<GroupId, readonly GroupTableRow[]>>,
): KnockoutBracketMatch[] {
  const roundOf32: KnockoutBracketMatch[] = buildRoundOf32Pairings(tables).map((match) => ({
    matchNumber: match.matchNumber,
    stage: 'round-of-32',
    home: { kind: 'nation', nationId: match.homeNationId },
    away: { kind: 'nation', nationId: match.awayNationId },
  }))
  const winner = (matchNumber: number): BracketEntrant => ({ kind: 'winner', matchNumber })
  const loser = (matchNumber: number): BracketEntrant => ({ kind: 'loser', matchNumber })
  const later: KnockoutBracketMatch[] = [
    { matchNumber: 89, stage: 'round-of-16', home: winner(74), away: winner(77) },
    { matchNumber: 90, stage: 'round-of-16', home: winner(73), away: winner(75) },
    { matchNumber: 91, stage: 'round-of-16', home: winner(76), away: winner(78) },
    { matchNumber: 92, stage: 'round-of-16', home: winner(79), away: winner(80) },
    { matchNumber: 93, stage: 'round-of-16', home: winner(83), away: winner(84) },
    { matchNumber: 94, stage: 'round-of-16', home: winner(81), away: winner(82) },
    { matchNumber: 95, stage: 'round-of-16', home: winner(86), away: winner(88) },
    { matchNumber: 96, stage: 'round-of-16', home: winner(85), away: winner(87) },
    { matchNumber: 97, stage: 'quarter-final', home: winner(89), away: winner(90) },
    { matchNumber: 98, stage: 'quarter-final', home: winner(93), away: winner(94) },
    { matchNumber: 99, stage: 'quarter-final', home: winner(91), away: winner(92) },
    { matchNumber: 100, stage: 'quarter-final', home: winner(95), away: winner(96) },
    { matchNumber: 101, stage: 'semi-final', home: winner(97), away: winner(98) },
    { matchNumber: 102, stage: 'semi-final', home: winner(99), away: winner(100) },
    { matchNumber: 103, stage: 'third-place', home: loser(101), away: loser(102) },
    { matchNumber: 104, stage: 'final', home: winner(101), away: winner(102) },
  ]
  return [...roundOf32, ...later]
}

export function resolveBracketEntrant(
  entrant: BracketEntrant,
  results: readonly KnockoutResult[],
): EntityId | undefined {
  if (entrant.kind === 'nation') return entrant.nationId
  const previous = results.find((result) => result.matchNumber === entrant.matchNumber)
  if (!previous) return undefined
  const penaltyHome = previous.result.homePenalties
  const penaltyAway = previous.result.awayPenalties
  const homeWon = previous.result.home > previous.result.away
    || (previous.result.home === previous.result.away && penaltyHome !== undefined && penaltyAway !== undefined && penaltyHome > penaltyAway)
  const winner = homeWon ? previous.homeNationId : previous.awayNationId
  const loser = homeWon ? previous.awayNationId : previous.homeNationId
  return entrant.kind === 'winner' ? winner : loser
}

export function fairPlayDeduction(card: 'yellow' | 'second-yellow' | 'direct-red' | 'yellow-and-direct-red'): number {
  return { yellow: -1, 'second-yellow': -3, 'direct-red': -4, 'yellow-and-direct-red': -5 }[card]
}

export function updateDisciplinaryRecord(
  record: DisciplinaryRecord,
  event: 'yellow' | 'second-yellow' | 'direct-red',
  _stage: TournamentStage,
): DisciplinaryRecord {
  const next = { ...record }
  if (event === 'yellow') {
    next.yellowCards += 1
    if (next.yellowCards === 2) next.suspensionMatches += 1
  } else if (event === 'second-yellow') {
    next.redCards += 1
    // The second caution may already have triggered the suspension above.
    if (next.yellowCards < 2) next.suspensionMatches += 1
  } else {
    next.redCards += 1
    next.suspensionMatches += 1
  }
  return next
}

/** Article 10.3: single cautions are cancelled after the group stage and quarter-finals. */
export function clearSingleCautions(records: readonly DisciplinaryRecord[]): DisciplinaryRecord[] {
  return records.map((record) => ({ ...record, yellowCards: 0 }))
}

export function combinations<T>(items: readonly T[], choose: number): T[][] {
  if (choose === 0) return [[]]
  if (choose > items.length || choose < 0) return []
  const result: T[][] = []
  for (let index = 0; index <= items.length - choose; index += 1) {
    const head = items[index]!
    for (const tail of combinations(items.slice(index + 1), choose - 1)) result.push([head, ...tail])
  }
  return result
}
