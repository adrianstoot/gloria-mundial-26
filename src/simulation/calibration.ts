import { DeterministicRandom } from './prng'

export interface CalibrationTeam {
  id: string
  strength: number
}

export interface CalibrationReport {
  simulations: number
  averageGoals: number
  averageShots: number
  drawRate: number
  upsetRate: number
  homeWinRate: number
}

function poisson(random: DeterministicRandom, lambda: number): number {
  const limit = Math.exp(-lambda)
  let product = 1
  let value = 0
  do {
    value += 1
    product *= random.next()
  } while (product > limit)
  return value - 1
}

/** Fast Monte Carlo harness for calibrating the full engine's scoring hazard. */
export function runMonteCarloCalibration(
  teams: readonly CalibrationTeam[],
  simulations = 10_000,
  seed: number | string = 'gm26-calibration-v1',
): CalibrationReport {
  if (teams.length < 2) throw new Error('La calibración necesita al menos dos selecciones.')
  const random = new DeterministicRandom(seed)
  let goals = 0
  let shots = 0
  let draws = 0
  let upsets = 0
  let homeWins = 0
  for (let index = 0; index < simulations; index += 1) {
    const homeIndex = random.int(0, teams.length - 1)
    let awayIndex = random.int(0, teams.length - 2)
    if (awayIndex >= homeIndex) awayIndex += 1
    const home = teams[homeIndex]!
    const away = teams[awayIndex]!
    const difference = home.strength - away.strength
    const homeLambda = Math.max(0.35, Math.min(3.2, 1.38 * Math.exp(difference / 42)))
    const awayLambda = Math.max(0.3, Math.min(3, 1.18 * Math.exp(-difference / 42)))
    const homeGoals = poisson(random, homeLambda)
    const awayGoals = poisson(random, awayLambda)
    const totalGoals = homeGoals + awayGoals
    goals += totalGoals
    shots += poisson(random, 20.5 + totalGoals * 1.35)
    if (homeGoals === awayGoals) draws += 1
    else {
      if (homeGoals > awayGoals) homeWins += 1
      const strongerWon = difference > 3 ? homeGoals > awayGoals : difference < -3 ? awayGoals > homeGoals : true
      if (!strongerWon) upsets += 1
    }
  }
  return {
    simulations,
    averageGoals: goals / simulations,
    averageShots: shots / simulations,
    drawRate: draws / simulations,
    upsetRate: upsets / simulations,
    homeWinRate: homeWins / simulations,
  }
}

