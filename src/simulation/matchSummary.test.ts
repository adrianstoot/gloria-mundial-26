import { describe, expect, it } from 'vitest'
import type { MatchEvent } from '../domain'
import { validGoalEvents } from './matchSummary'

const event = (type: MatchEvent['type'], id: string, outcome?: string): MatchEvent => ({
  id, tick: Number(id), second: Number(id), type, side: 'home', playerId: 'p1', commentary: id,
  score: { home: type === 'goal' ? 1 : 0, away: 0 }, outcome,
})

describe('match summary', () => {
  it('removes only the goal cancelled by VAR and preserves valid goals', () => {
    expect(validGoalEvents([
      event('goal', '1'),
      event('var-check', '2'),
      event('var-overturn', '3', 'goal-overturned'),
      event('goal', '4'),
    ]).map((item) => item.id)).toEqual(['4'])
  })
})
