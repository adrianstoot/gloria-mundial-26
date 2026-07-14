import { describe, expect, it } from 'vitest'
import { assessTacticalPlayer, assessTacticalShape, effectivePositionRating, inferTacticalPosition, positionSuitability } from './tacticalIntelligence'

const winger = { position: 'RW', positions: ['RW', 'RM'], gameRatings: { overall: 86, pace: 91, technique: 87, passing: 82, attack: 84, defending: 35 } }

describe('tactical intelligence', () => {
  it('infers positions from a freely moved pitch coordinate', () => {
    expect(inferTacticalPosition(88, 27)).toBe('RW')
    expect(inferTacticalPosition(50, 77)).toBe('CB')
    expect(inferTacticalPosition(50, 89)).toBe('GK')
  })

  it('rewards natural roles and penalises incompatible placements', () => {
    expect(positionSuitability(winger, 'RW')).toBe(100)
    expect(positionSuitability(winger, 'CB')).toBeLessThan(50)
    expect(effectivePositionRating(winger, 'RW')).toBeGreaterThan(effectivePositionRating(winger, 'CB'))
  })

  it('reports shape and adaptation costs', () => {
    expect(assessTacticalPlayer(winger, 50, 75).penalties).toContain('Fuera de posición')
    expect(assessTacticalShape([{x:45,y:75,position:'CB'},{x:50,y:52,position:'CM'},{x:55,y:20,position:'ST'}]).warnings).toContain('Falta amplitud: el rival puede cerrar el carril central')
  })
})
