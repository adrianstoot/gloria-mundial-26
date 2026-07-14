import type { SimulationResult } from '../domain'
import type { CampaignUIState } from './ui-model'

type MatchResults = CampaignUIState['matchResults']

export function injuryEventsFromSimulation(result: SimulationResult, homeNationId: string, awayNationId: string) {
  return result.events.flatMap((event) => {
    if (event.type !== 'injury' || !event.playerId || !event.side) return []
    const concussion = event.outcome === 'concussion'
    const cannotContinue = event.outcome === 'cannot-continue'
    return [{
      playerId: event.playerId,
      nationId: event.side === 'home' ? homeNationId : awayNationId,
      kind: concussion ? 'concussion' as const : cannotContinue ? 'muscle' as const : 'knock' as const,
      days: concussion ? 7 : cannotContinue ? 5 : 2,
    }]
  })
}

export function activeInjuries(results: MatchResults, onDate: string, nationId?: string) {
  const target = new Date(`${onDate}T12:00:00`).getTime()
  return Object.values(results).flatMap((result) => (result.injuries ?? []).flatMap((injury) => {
    if (nationId && injury.nationId !== nationId) return []
    const injuredAt = new Date(`${result.playedAt}T12:00:00`).getTime()
    return target < injuredAt + injury.days * 86_400_000 ? [{ ...injury, injuredAt: result.playedAt }] : []
  }))
}

export function injuredPlayerIds(results: MatchResults, onDate: string, nationId: string) {
  return new Set(activeInjuries(results, onDate, nationId).map((injury) => injury.playerId))
}
