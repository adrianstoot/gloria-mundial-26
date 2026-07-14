import { describe, expect, it } from 'vitest'
import { initialCampaign } from './ui-model'
import { prologueStage } from './experienceDirector'

describe('v2 experience director', () => {
  it('enforces the complete prologue order', () => {
    expect(prologueStage(initialCampaign, false)).toBe('squad')
    const squad = { ...initialCampaign, squadConfirmed: true }
    expect(prologueStage(squad, false)).toBe('hotel')
    const hotel = { ...squad, hotelId: 'base-1' }
    expect(prologueStage(hotel, false)).toBe('training')
  })
})
