import type { MatchEvent } from '../domain'

/** Returns scoring events that survived VAR review, in chronological order. */
export function validGoalEvents(events: readonly MatchEvent[]): MatchEvent[] {
  const goals: MatchEvent[] = []
  for (const event of events) {
    if (event.type === 'goal' || event.type === 'own-goal') {
      goals.push(event)
      continue
    }
    if (event.type !== 'var-overturn' || event.outcome !== 'goal-overturned') continue
    let index = -1
    for (let candidate = goals.length - 1; candidate >= 0; candidate -= 1) {
      const goal = goals[candidate]!
      if (goal.side === event.side && goal.playerId === event.playerId) {
        index = candidate
        break
      }
    }
    if (index >= 0) goals.splice(index, 1)
  }
  return goals
}
