import { describe, expect, it } from 'vitest'
import { countryPress, dailyDecisionGroups, hotels, PLAYABLE_NATION_CODES, trainingExercises } from './concentrationData'

describe('playable nations and concentration content', () => {
  it('limits management to the five requested national teams', () => {
    expect([...PLAYABLE_NATION_CODES]).toEqual(['ESP', 'FRA', 'MAR', 'ENG', 'ARG'])
  })

  it.each(PLAYABLE_NATION_CODES)('%s has specific media and several compatible bases', (code) => {
    expect(countryPress[code]).toHaveLength(10)
    expect(new Set(countryPress[code]!.map((question) => question.outlet)).size).toBe(10)
    expect(countryPress[code]!.every((question) => question.answers.length === 4)).toBe(true)
    expect(hotels.filter((hotel) => hotel.nationCodes.includes(code)).length).toBeGreaterThanOrEqual(3)
  })

  it('offers a broad exercise catalogue with measurable effects', () => {
    expect(trainingExercises.length).toBeGreaterThanOrEqual(10)
    expect(new Set(trainingExercises.map((exercise) => exercise.category)).size).toBe(5)
    expect(trainingExercises.every((exercise) => Object.keys(exercise.effects).length > 0)).toBe(true)
  })

  it('offers five daily off-pitch decisions with four real alternatives each', () => {
    expect(dailyDecisionGroups).toHaveLength(5)
    expect(dailyDecisionGroups.every((group) => group.options.length === 4)).toBe(true)
    expect(new Set(dailyDecisionGroups.flatMap((group) => group.options.map((option) => option.id))).size).toBe(20)
  })
})
