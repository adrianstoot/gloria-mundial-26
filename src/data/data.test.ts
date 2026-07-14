import { describe, expect, it } from 'vitest'
import {
  dataManifest,
  dataSources,
  fixtures,
  groups,
  nations,
  players,
  playersByNation,
} from './index'

const expectedGroups = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'],
  B: ['CAN', 'BIH', 'QAT', 'SUI'],
  C: ['BRA', 'MAR', 'HAI', 'SCO'],
  D: ['USA', 'PAR', 'AUS', 'TUR'],
  E: ['GER', 'CUW', 'CIV', 'ECU'],
  F: ['NED', 'JPN', 'TUN', 'SWE'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'],
  H: ['ESP', 'CPV', 'KSA', 'URU'],
  I: ['FRA', 'SEN', 'NOR', 'IRQ'],
  J: ['ARG', 'ALG', 'AUT', 'JOR'],
  K: ['POR', 'UZB', 'COL', 'COD'],
  L: ['ENG', 'CRO', 'GHA', 'PAN'],
}

describe('world-cup-2026-v1', () => {
  it('contains the exact official field and groups', () => {
    expect(nations).toHaveLength(48)
    expect(new Set(nations.map((nation) => nation.id)).size).toBe(48)
    expect(new Set(nations.map((nation) => nation.code)).size).toBe(48)

    for (const [group, codes] of Object.entries(expectedGroups)) {
      const actualCodes = groups[group as keyof typeof groups].map(
        (nationId) => nations.find((nation) => nation.id === nationId)?.code,
      )
      expect(actualCodes).toEqual(codes)
    }
  })

  it('contains 50 unique candidates and 26 official players per nation', () => {
    expect(players).toHaveLength(2_400)
    expect(new Set(players.map((player) => player.id)).size).toBe(2_400)

    for (const nation of nations) {
      const pool = playersByNation[nation.id]
      expect(pool, nation.code).toHaveLength(50)
      expect(pool.filter((player) => player.official2026), nation.code).toHaveLength(26)
      expect(pool.filter((player) => player.position === 'GK').length, nation.code).toBeGreaterThanOrEqual(4)
      expect(pool.filter((player) => player.official2026 && player.position === 'GK').length, nation.code).toBeGreaterThanOrEqual(3)
      expect(pool.every((player) => player.nationId === nation.id), nation.code).toBe(true)
    }
  })

  it('does not need synthetic names in the bundled snapshot', () => {
    expect(players.filter((player) => player.dataStatus === 'synthetic-fallback')).toHaveLength(0)
    expect(players.filter((player) => player.dataStatus === 'verified-official')).toHaveLength(1_248)
    expect(players.find((player) => player.nationId === 'alg' && player.squadNumber === 1)?.displayName).toBe('Melvin Mastil')
  })

  it('keeps gameplay estimates in range and apart from factual stats', () => {
    for (const player of players) {
      expect(player.realStats.fullName.length).toBeGreaterThan(1)
      expect(player.realStats.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(player.gameRatings.overall).toBeGreaterThanOrEqual(1)
      expect(player.gameRatings.overall).toBeLessThanOrEqual(100)
      expect(player.gameRatings.confidence).toBe('modeled')
    }
  })

  it('provides the full clean 104-match schedule', () => {
    expect(fixtures).toHaveLength(104)
    expect(new Set(fixtures.map((fixture) => fixture.matchNumber)).size).toBe(104)
    expect(fixtures.filter((fixture) => fixture.stage === 'GROUP')).toHaveLength(72)
    expect(fixtures.find((fixture) => fixture.matchNumber === 104)).toMatchObject({
      stage: 'FINAL',
      homeSlot: 'W101',
      awaySlot: 'W102',
    })
  })

  it('publishes auditable source metadata and manifest totals', () => {
    expect(dataManifest.totalPlayerCount).toBe(2_400)
    expect(dataManifest.officialPlayerCount).toBe(1_248)
    expect(dataManifest.resultsIncluded).toBe(false)
    expect(dataSources.every((source) => source.url.startsWith('https://'))).toBe(true)
    expect(dataSources.every((source) => source.license.length > 2)).toBe(true)
    const sourceIds = new Set(dataSources.map((source) => source.id))
    expect(players.every((player) => player.sourceIds.every((sourceId) => sourceIds.has(sourceId)))).toBe(true)
  })
})
