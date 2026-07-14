import { describe, expect, it } from 'vitest'
import { tournamentData } from '../data'
import type { GroupId } from '../domain'
import {
  deriveCampaignProgress,
  nextMatchForNation,
  type CampaignMatchResult,
} from './campaignProgress'

function resultForGroupFixture(fixture: (typeof tournamentData.fixtures)[number]): CampaignMatchResult {
  const group = fixture.group as GroupId
  const order = tournamentData.groups[group]
  const homeIndex = order.indexOf(fixture.homeNationId!)
  const awayIndex = order.indexOf(fixture.awayNationId!)
  const homeWins = homeIndex < awayIndex
  return {
    fixtureId: fixture.id,
    homeNationId: fixture.homeNationId!,
    awayNationId: fixture.awayNationId!,
    home: homeWins ? 2 : 0,
    away: homeWins ? 0 : 2,
    playedAt: fixture.date,
  }
}

function completedGroups(): Record<string, CampaignMatchResult> {
  return Object.fromEntries(
    tournamentData.fixtures
      .filter((fixture) => fixture.stage === 'GROUP')
      .map((fixture) => [fixture.id, resultForGroupFixture(fixture)]),
  )
}

describe('campaign progression', () => {
  it('calculates partial official tables and selects the next global and controlled fixtures', () => {
    const first = tournamentData.fixtures[0]!
    const results = { [first.id]: resultForGroupFixture(first) }
    const progress = deriveCampaignProgress(tournamentData, results, { controlledNationId: 'kor' })

    expect(progress.groupTables.A.find((row) => row.nationId === 'mex')).toMatchObject({
      played: 1,
      points: 3,
      goalsFor: 2,
    })
    expect(progress.groupStageComplete).toBe(false)
    expect(progress.fixturesByMatchNumber[73].status).toBe('blocked')
    expect(progress.nextFixture?.matchNumber).toBe(2)
    expect(progress.nextControlledFixture?.matchNumber).toBe(2)
    expect(nextMatchForNation(progress, 'mex')?.matchNumber).toBe(28)
    expect(progress.stats).toMatchObject({ matchesPlayed: 1, totalGoals: 2, matchesRemaining: 103 })
  })

  it('resolves all 16 round-of-32 participants with the official allocation', () => {
    const progress = deriveCampaignProgress(tournamentData, completedGroups())
    const roundOf32 = progress.fixtures.filter((fixture) => fixture.stage === 'ROUND_OF_32')

    expect(progress.groupStageComplete).toBe(true)
    expect(progress.qualification?.bestThirds).toHaveLength(8)
    expect(roundOf32).toHaveLength(16)
    expect(roundOf32.every((fixture) => fixture.homeNationId && fixture.awayNationId && fixture.status === 'ready')).toBe(true)
    expect(new Set(roundOf32.flatMap((fixture) => [fixture.homeNationId, fixture.awayNationId])).size).toBe(32)
    expect(progress.nextFixture?.matchNumber).toBe(73)
  })

  it('propagates winners and semi-final losers through matches 89-104 and crowns a champion', () => {
    const results = completedGroups()
    let penaltyWinner: string | undefined

    for (let matchNumber = 73; matchNumber <= 104; matchNumber += 1) {
      const before = deriveCampaignProgress(tournamentData, results)
      const fixture = before.fixturesByMatchNumber[matchNumber]
      expect(fixture.homeNationId, `local del partido ${matchNumber}`).toBeTruthy()
      expect(fixture.awayNationId, `visitante del partido ${matchNumber}`).toBeTruthy()
      const onPenalties = matchNumber === 73
      const result: CampaignMatchResult = {
        fixtureId: fixture.id,
        homeNationId: fixture.homeNationId!,
        awayNationId: fixture.awayNationId!,
        home: onPenalties ? 1 : 2,
        away: onPenalties ? 1 : 0,
        homePenalties: onPenalties ? 5 : undefined,
        awayPenalties: onPenalties ? 4 : undefined,
        playedAt: fixture.date,
      }
      if (onPenalties) penaltyWinner = fixture.homeNationId
      results[fixture.id] = result
    }

    const progress = deriveCampaignProgress(tournamentData, results)
    const semiOne = progress.fixturesByMatchNumber[101]
    const semiTwo = progress.fixturesByMatchNumber[102]
    const bronze = progress.fixturesByMatchNumber[103]
    const final = progress.fixturesByMatchNumber[104]

    expect(bronze.homeNationId).toBe(semiOne.loserNationId)
    expect(bronze.awayNationId).toBe(semiTwo.loserNationId)
    expect(final.homeNationId).toBe(semiOne.winnerNationId)
    expect(final.awayNationId).toBe(semiTwo.winnerNationId)
    expect(progress.championNationId).toBe(final.homeNationId)
    expect(progress.runnerUpNationId).toBe(final.awayNationId)
    expect(progress.thirdPlaceNationId).toBe(bronze.homeNationId)
    expect(progress.fourthPlaceNationId).toBe(bronze.awayNationId)
    expect(progress.completed).toBe(true)
    expect(progress.nextFixture).toBeUndefined()
    expect(progress.stats).toMatchObject({
      scheduledMatches: 104,
      matchesPlayed: 104,
      groupMatchesPlayed: 72,
      knockoutMatchesPlayed: 32,
      penaltyShootouts: 1,
    })
    expect(progress.stats.byNation[penaltyWinner!].penaltyShootoutWins).toBe(1)
    expect(progress.issues).toEqual([])
  })

  it('blocks dependent fixtures when a knockout draw has no shoot-out winner', () => {
    const results = completedGroups()
    const groupsDone = deriveCampaignProgress(tournamentData, results)
    const match74 = groupsDone.fixturesByMatchNumber[74]
    results[match74.id] = {
      fixtureId: match74.id,
      homeNationId: match74.homeNationId!,
      awayNationId: match74.awayNationId!,
      home: 1,
      away: 1,
      playedAt: match74.date,
    }

    const progress = deriveCampaignProgress(tournamentData, results)
    expect(progress.fixturesByMatchNumber[74].status).toBe('invalid')
    expect(progress.fixturesByMatchNumber[89].homeNationId).toBeUndefined()
    expect(progress.fixturesByMatchNumber[89].status).toBe('blocked')
    expect(progress.issues).toContainEqual(expect.objectContaining({
      code: 'invalid-penalty-shootout',
      fixtureId: match74.id,
    }))
  })

  it('ignores mismatched and malformed UI results without corrupting standings', () => {
    const first = tournamentData.fixtures[0]!
    const progress = deriveCampaignProgress(tournamentData, {
      [first.id]: {
        ...resultForGroupFixture(first),
        awayNationId: 'not-the-opponent',
      },
      ghost: {
        fixtureId: 'match-999',
        homeNationId: 'a',
        awayNationId: 'b',
        home: -1,
        away: 0,
      },
    })

    expect(progress.fixturesById[first.id].status).toBe('invalid')
    expect(progress.groupTables.A.every((row) => row.played === 0)).toBe(true)
    expect(progress.stats.matchesPlayed).toBe(0)
    expect(progress.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'participant-mismatch',
      'unknown-fixture',
    ]))
  })
})
