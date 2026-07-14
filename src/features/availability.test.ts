import { describe, expect, it } from 'vitest'
import { activeInjuries, injuredPlayerIds } from './availability'

describe('persistent tournament injuries', () => {
  const result = {
    fixtureId: 'match-test', homeNationId: 'esp', awayNationId: 'fra', home: 1, away: 0, playedAt: '2026-06-10',
    injuries: [{ playerId: 'esp-injured', nationId: 'esp', kind: 'muscle' as const, days: 5 }],
  }

  it('keeps the player unavailable during the recovery period', () => {
    expect(injuredPlayerIds({ [result.fixtureId]: result }, '2026-06-14', 'esp').has('esp-injured')).toBe(true)
    expect(activeInjuries({ [result.fixtureId]: result }, '2026-06-14', 'fra')).toHaveLength(0)
  })

  it('returns the player when the recovery period ends', () => {
    expect(injuredPlayerIds({ [result.fixtureId]: result }, '2026-06-15', 'esp').has('esp-injured')).toBe(false)
  })
})
