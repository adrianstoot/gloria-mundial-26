import { describe, expect, it } from 'vitest'
import type { GroupId, GroupTableRow } from '../domain'
import {
  calculateGroupStandings,
  combinations,
  generateThirdPlaceAllocation,
  GROUP_IDS,
  rankBestThirdPlaced,
  THIRD_PLACE_ELIGIBILITY,
  type GroupMatchRecord,
} from './tournament'

describe('World Cup 2026 tournament rules', () => {
  it('uses head-to-head before overall goal difference for teams level on points', () => {
    const matches: GroupMatchRecord[] = [
      { id: '1', group: 'A', homeNationId: 'a', awayNationId: 'b', homeGoals: 1, awayGoals: 0 },
      { id: '2', group: 'A', homeNationId: 'a', awayNationId: 'c', homeGoals: 0, awayGoals: 5 },
      { id: '3', group: 'A', homeNationId: 'a', awayNationId: 'd', homeGoals: 0, awayGoals: 0 },
      { id: '4', group: 'A', homeNationId: 'b', awayNationId: 'c', homeGoals: 5, awayGoals: 0 },
      { id: '5', group: 'A', homeNationId: 'b', awayNationId: 'd', homeGoals: 0, awayGoals: 0 },
      { id: '6', group: 'A', homeNationId: 'c', awayNationId: 'd', homeGoals: 1, awayGoals: 0 },
    ]
    const table = calculateGroupStandings(['a', 'b', 'c', 'd'], matches)
    expect(table.map((row) => row.nationId)).toEqual(['c', 'a', 'b', 'd'])
    expect(table.find((row) => row.nationId === 'a')!.goalDifference).toBeLessThan(
      table.find((row) => row.nationId === 'b')!.goalDifference,
    )
    expect(table.map((row) => row.rank)).toEqual([1, 2, 3, 4])
  })

  it('ranks the eight strongest third-placed teams across 12 groups', () => {
    const tables = Object.fromEntries(GROUP_IDS.map((group, groupIndex) => [group, Array.from({ length: 4 }, (_, index): GroupTableRow => ({
      nationId: `${group}-${index}`,
      played: 3,
      won: 1,
      drawn: 0,
      lost: 2,
      goalsFor: groupIndex + 1,
      goalsAgainst: 3,
      goalDifference: groupIndex - 2,
      points: index === 2 ? groupIndex : 10 - index,
      fairPlayPoints: 0,
      rank: index + 1,
    }))])) as Record<GroupId, GroupTableRow[]>
    const thirds = rankBestThirdPlaced(tables)
    expect(thirds).toHaveLength(12)
    expect(thirds.slice(0, 8).map((entry) => entry.group)).toEqual(['L', 'K', 'J', 'I', 'H', 'G', 'F', 'E'])
  })

  it('resolves all 495 possible combinations of qualifying thirds', () => {
    const possible = combinations(GROUP_IDS, 8)
    expect(possible).toHaveLength(495)
    for (const groups of possible) {
      const allocation = generateThirdPlaceAllocation(groups)
      const assigned = Object.entries(allocation) as Array<[GroupId, GroupId]>
      expect(assigned).toHaveLength(8)
      expect(new Set(assigned.map(([, third]) => third)).size).toBe(8)
      for (const [winner, third] of assigned) expect(THIRD_PLACE_ELIGIBILITY[winner]).toContain(third)
    }
    expect(generateThirdPlaceAllocation(['D', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])).toEqual({
      A: 'H', B: 'G', D: 'I', E: 'D', G: 'J', I: 'F', K: 'L', L: 'K',
    })
  })
})
