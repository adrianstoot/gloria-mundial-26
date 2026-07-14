import { describe, expect, it } from 'vitest'
import { runMonteCarloCalibration } from './calibration'

describe('Monte Carlo calibration', () => {
  it('runs 10,000 deterministic tournament-level samples in realistic ranges', () => {
    const teams = Array.from({ length: 48 }, (_, index) => ({ id: `n${index}`, strength: 68 + (index % 22) }))
    const report = runMonteCarloCalibration(teams, 10_000, 'official-calibration')
    const repeated = runMonteCarloCalibration(teams, 10_000, 'official-calibration')
    expect(repeated).toEqual(report)
    expect(report.simulations).toBe(10_000)
    expect(report.averageGoals).toBeGreaterThan(2)
    expect(report.averageGoals).toBeLessThan(3.4)
    expect(report.averageShots).toBeGreaterThan(19)
    expect(report.averageShots).toBeLessThan(30)
    expect(report.drawRate).toBeGreaterThan(0.15)
    expect(report.drawRate).toBeLessThan(0.35)
  })
})

