import type { DisciplinaryRecord, SimulationResult, TournamentStage } from '../domain'
import { tournamentData } from '../data'
import { clearSingleCautions, updateDisciplinaryRecord } from '../simulation/tournament'
import type { CampaignUIState } from './ui-model'

type MatchResults = CampaignUIState['matchResults']

const stageMap: Record<(typeof tournamentData.fixtures)[number]['stage'], TournamentStage> = {
  GROUP: 'group', ROUND_OF_32: 'round-of-32', ROUND_OF_16: 'round-of-16', QUARTER_FINAL: 'quarter-final',
  SEMI_FINAL: 'semi-final', THIRD_PLACE: 'third-place', FINAL: 'final',
}
const lastGroupMatch = Math.max(...tournamentData.fixtures.filter((fixture) => fixture.stage === 'GROUP').map((fixture) => fixture.matchNumber))
const lastQuarterFinal = Math.max(...tournamentData.fixtures.filter((fixture) => fixture.stage === 'QUARTER_FINAL').map((fixture) => fixture.matchNumber))

/** Replays discipline chronologically so suspensions and caution clean-ups stay deterministic. */
export function deriveDisciplinaryRecords(results: MatchResults): DisciplinaryRecord[] {
  const records = new Map<string, DisciplinaryRecord>()
  const playedIds = new Set(Object.keys(results))
  let groupsCleared = false
  let quartersCleared = false

  for (const fixture of [...tournamentData.fixtures].sort((left, right) => left.matchNumber - right.matchNumber)) {
    const result = results[fixture.id]
    if (!result) continue
    const participants = new Set([result.homeNationId, result.awayNationId])
    for (const [playerId, record] of records) {
      if (participants.has(record.nationId) && record.suspensionMatches > 0) {
        records.set(playerId, { ...record, suspensionMatches: record.suspensionMatches - 1 })
      }
    }
    for (const incident of result.discipline ?? []) {
      const current = records.get(incident.playerId) ?? {
        nationId: incident.nationId,
        playerId: incident.playerId,
        yellowCards: 0,
        redCards: 0,
        suspensionMatches: 0,
      }
      records.set(incident.playerId, updateDisciplinaryRecord(current, incident.event, stageMap[fixture.stage]))
    }

    if (!groupsCleared && fixture.matchNumber === lastGroupMatch && tournamentData.fixtures.filter((item) => item.stage === 'GROUP').every((item) => playedIds.has(item.id))) {
      groupsCleared = true
      for (const record of clearSingleCautions([...records.values()])) records.set(record.playerId, record)
    }
    if (!quartersCleared && fixture.matchNumber === lastQuarterFinal && tournamentData.fixtures.filter((item) => item.stage === 'QUARTER_FINAL').every((item) => playedIds.has(item.id))) {
      quartersCleared = true
      for (const record of clearSingleCautions([...records.values()])) records.set(record.playerId, record)
    }
  }
  return [...records.values()].sort((left, right) => right.suspensionMatches - left.suspensionMatches || right.redCards - left.redCards || right.yellowCards - left.yellowCards || left.playerId.localeCompare(right.playerId))
}

export function suspendedPlayerIds(results: MatchResults, nationId: string) {
  return new Set(deriveDisciplinaryRecords(results).filter((record) => record.nationId === nationId && record.suspensionMatches > 0).map((record) => record.playerId))
}

export function disciplineEventsFromSimulation(result: SimulationResult, homeNationId: string, awayNationId: string) {
  return result.events.flatMap((event) => {
    if (!event.playerId || (event.type !== 'yellow-card' && event.type !== 'red-card') || !event.side) return []
    return [{
      playerId: event.playerId,
      nationId: event.side === 'home' ? homeNationId : awayNationId,
      event: event.type === 'yellow-card' ? 'yellow' as const : event.outcome === 'second-yellow' ? 'second-yellow' as const : 'direct-red' as const,
    }]
  })
}
