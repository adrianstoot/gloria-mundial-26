import { describe, expect, it } from 'vitest'
import { domainNations } from '../data'
import { applyCampDecision, applyCampaignContext, teamReadiness } from './decisionEngine'
import { initialCampaign } from './ui-model'

describe('campaign decisions feed the match model', () => {
  it('applies each decision once and locks the chosen hotel', () => {
    const first = applyCampDecision(initialCampaign, {
      key: 'hotel:test-base', type: 'hotel', label: 'Base de prueba', madeAt: initialCampaign.date,
      effects: { climateAdaptation: 8, localSupport: 5, pressure: -3 },
    })
    const repeated = applyCampDecision(first, {
      key: 'hotel:other-base', type: 'hotel', label: 'Otra base', madeAt: initialCampaign.date,
      effects: { morale: 99 },
    })
    expect(first.hotelId).toBe('test-base')
    expect(first.climateAdaptation).toBe(initialCampaign.climateAdaptation + 8)
    expect(repeated).toBe(first)
  })

  it('turns morale, recovery, fatigue, familiarity and difficulty into player state', () => {
    const nation = domainNations[0]!
    const prepared = { ...initialCampaign, difficulty: 'accesible' as const, morale: 90, recovery: 92, fatigue: 12, tacticalFamiliarity: 88 }
    const depleted = { ...initialCampaign, difficulty: 'leyenda' as const, morale: 48, recovery: 45, fatigue: 72, tacticalFamiliarity: 38 }
    const strongPlayer = applyCampaignContext(nation, prepared).players[0]!
    const tiredPlayer = applyCampaignContext(nation, depleted).players[0]!
    expect(strongPlayer.condition).toBeGreaterThan(tiredPlayer.condition)
    expect(strongPlayer.gameRatings.decisions).toBeGreaterThan(tiredPlayer.gameRatings.decisions)
    expect(teamReadiness(prepared)).toBeGreaterThan(teamReadiness(depleted))
  })
})
