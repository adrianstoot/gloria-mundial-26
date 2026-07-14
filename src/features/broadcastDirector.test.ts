import { describe, expect, it } from 'vitest'
import type { MatchEvent } from '../domain'
import { acceptBroadcastCue, createBroadcastCue } from './broadcastDirector'

const goal: MatchEvent = {
  id: 'goal-88', tick: 52_800, second: 5_280, type: 'goal', side: 'home', playerId: 'p1',
  commentary: "88' El capitán aparece en el área y marca.", score: { home: 2, away: 1 },
}

describe('broadcast director', () => {
  it('creates late knockout drama with replay and goal audio', () => {
    const cue = createBroadcastCue(goal, { stage: 'knockout', homeName: 'España', awayName: 'Francia', tension: 91 })
    expect(cue.importance).toBe('critical')
    expect(cue.replay).toBe(true)
    expect(cue.audio).toBe('goal')
    expect(cue.narration).toContain('No hay margen')
  })

  it('rejects repeated narration signatures', () => {
    const cue = createBroadcastCue(goal, { stage: 'group', homeName: 'España', awayName: 'Francia', tension: 50 })
    const first = acceptBroadcastCue([], cue)
    const second = acceptBroadcastCue(first.signatures, cue)
    expect(first.accepted).toBe(true)
    expect(second.accepted).toBe(false)
  })
})
