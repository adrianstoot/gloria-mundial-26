import { describe, expect, it } from 'vitest'
import { buildMatchEnvironment } from './matchEnvironment'

describe('match environment', () => {
  it('is deterministic and keeps physical values bounded', () => {
    const input = { fixtureId:'m1',kickoff:'2026-06-18T20:00:00Z',city:'Dallas',hotelId:'boston-harbor',nationCode:'ENG',localSupport:55,climateAdaptation:43,previousMatchDates:['2026-06-13'] }
    const first = buildMatchEnvironment(input)
    expect(buildMatchEnvironment(input)).toEqual(first)
    expect(first.temperatureC).toBeGreaterThanOrEqual(30)
    expect(first.supporterShare).toBeGreaterThanOrEqual(26)
    expect(first.pitchQuality).toBeLessThanOrEqual(97)
    expect(first.travelKm).toBeGreaterThan(1_000)
  })

  it('rewards acclimatisation in the same hot, high-altitude context', () => {
    const base = { fixtureId:'m2',kickoff:'2026-06-22T20:00:00Z',city:'Mexico City',hotelId:'miami-community',nationCode:'ARG',localSupport:70,previousMatchDates:['2026-06-19'] }
    const adapted = buildMatchEnvironment({ ...base,climateAdaptation:90 })
    const unadapted = buildMatchEnvironment({ ...base,climateAdaptation:20 })
    expect(adapted.fatigueDelta).toBeLessThan(unadapted.fatigueDelta)
    expect(adapted.altitudeM).toBe(2_240)
  })
})
