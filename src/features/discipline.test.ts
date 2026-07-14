import { describe, expect, it } from 'vitest'
import { tournamentData } from '../data'
import { deriveDisciplinaryRecords } from './discipline'
import type { CampaignUIState } from './ui-model'

function result(fixture: (typeof tournamentData.fixtures)[number], discipline: NonNullable<CampaignUIState['matchResults'][string]['discipline']>) {
  return {
    fixtureId: fixture.id,
    homeNationId: fixture.homeNationId!,
    awayNationId: fixture.awayNationId!,
    home: 1,
    away: 0,
    discipline,
    playedAt: fixture.date,
  }
}

describe('campaign discipline', () => {
  it('suspends a player after two cautions and consumes the ban in the next national-team match', () => {
    const fixtures = tournamentData.fixtures.filter((fixture) => fixture.stage === 'GROUP' && (fixture.homeNationId === 'esp' || fixture.awayNationId === 'esp'))
    const playerId = 'esp-player-test'
    const first = result(fixtures[0]!, [{ playerId, nationId: 'esp', event: 'yellow' }])
    const second = result(fixtures[1]!, [{ playerId, nationId: 'esp', event: 'yellow' }])
    const suspended = deriveDisciplinaryRecords({ [first.fixtureId]: first, [second.fixtureId]: second })
    expect(suspended.find((record) => record.playerId === playerId)).toMatchObject({ yellowCards: 2, suspensionMatches: 1 })

    const third = result(fixtures[2]!, [])
    const served = deriveDisciplinaryRecords({ [first.fixtureId]: first, [second.fixtureId]: second, [third.fixtureId]: third })
    expect(served.find((record) => record.playerId === playerId)?.suspensionMatches).toBe(0)
  })

  it('creates an immediate one-match ban for a direct red card', () => {
    const fixture = tournamentData.fixtures.find((item) => item.homeNationId === 'fra' || item.awayNationId === 'fra')!
    const playerId = 'fra-player-test'
    const records = deriveDisciplinaryRecords({
      [fixture.id]: result(fixture, [{ playerId, nationId: 'fra', event: 'direct-red' }]),
    })
    expect(records.find((record) => record.playerId === playerId)).toMatchObject({ redCards: 1, suspensionMatches: 1 })
  })
})
