import { describe, expect, it } from 'vitest'
import type { MatchEvent, SimulationResult } from '../domain'
import { fairPlayDeductionFromEvents } from './campaign'

const event = (type: 'yellow-card' | 'red-card', playerId: string, commentary: string): MatchEvent => ({
  id: `${type}-${playerId}-${commentary}`,
  tick: 1,
  second: 1,
  type,
  side: 'home',
  playerId,
  commentary,
  score: { home: 0, away: 0 },
})

describe('official conduct score', () => {
  it('applies one deduction category per player and match', () => {
    const result = {
      events: [
        event('yellow-card', 'cautioned', 'Amarilla.'),
        event('yellow-card', 'second-yellow', 'Primera amarilla.'),
        event('yellow-card', 'second-yellow', 'Segunda amarilla.'),
        event('red-card', 'second-yellow', 'Segunda amarilla: queda expulsado.'),
        event('red-card', 'direct', 'Roja directa.'),
        event('yellow-card', 'yellow-direct', 'Amarilla.'),
        event('red-card', 'yellow-direct', 'Roja directa posterior.'),
      ],
    } as SimulationResult
    expect(fairPlayDeductionFromEvents(result, 'home')).toBe(-13)
    expect(fairPlayDeductionFromEvents(result, 'away')).toBe(0)
  })
})
