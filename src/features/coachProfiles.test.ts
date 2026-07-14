import { describe, expect, it } from 'vitest'
import { hydrateCampaign } from '../App'
import { applyCoachModifiers, coachProfiles, defaultCoachProfile } from './coachProfiles'
import { initialCampaign } from './ui-model'

describe('coach profiles', () => {
  it('defines three unique fictional profiles with bounded effects', () => {
    expect(coachProfiles).toHaveLength(3)
    expect(new Set(coachProfiles.map((coach) => coach.id)).size).toBe(3)
    for (const coach of coachProfiles) {
      expect(coach.visual).toMatch(/^\/assets\/coaches\/.+\.webp$/)
      for (const value of Object.values(coach.modifiers)) expect(Math.abs(value ?? 0)).toBeLessThanOrEqual(2)
    }
  })

  it('replaces prior coach effects instead of stacking them', () => {
    const base = { morale: 70, cohesion: 70, pressure: 40, tacticalFamiliarity: 60 }
    const withAmine = applyCoachModifiers(base, 'amine-el-mansouri')
    const changed = applyCoachModifiers(withAmine, 'tomas-ferreyra', 'amine-el-mansouri')
    expect(changed).toEqual({ morale: 72, cohesion: 71, pressure: 41, tacticalFamiliarity: 60 })
  })

  it('hydrates old campaigns with the default coach without losing manager data', () => {
    const legacy = hydrateCampaign({
      ...initialCampaign,
      manager: { name: 'Adrián', surname: 'Prueba', nationality: 'España', experience: 'novato' } as never,
    })
    expect(legacy.manager.name).toBe('Adrián')
    expect(legacy.manager.coachId).toBe(defaultCoachProfile.id)
  })
})
