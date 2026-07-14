import { describe, expect, it } from 'vitest'
import type { Nation, Player } from '../domain'
import { createDefaultTactic } from './formations'
import { calculateMatchTension, createMatch, simulateMatch } from './matchEngine'

function player(nationId: string, index: number): Player {
  const position = index < 4 ? 'GK' : index < 12 ? 'CB' : index < 20 ? 'CM' : 'ST'
  const overall = 68 + index % 18
  return {
    id: `${nationId}-p${index}`,
    nationId,
    shirtName: `P${index}`,
    shirtNumber: index + 1,
    primaryPosition: position,
    realStats: {
      fullName: `Futbolista ${index}`,
      birthDate: '1998-01-01',
      club: 'Club de prueba',
      heightCm: 180,
      preferredFoot: 'right',
      positions: [position],
      caps: 20,
      internationalGoals: position === 'ST' ? 5 : 0,
    },
    gameRatings: {
      overall,
      attack: position === 'ST' ? overall + 5 : overall - 8,
      passing: overall,
      technique: overall,
      defending: position === 'CB' ? overall + 4 : overall - 8,
      goalkeeping: position === 'GK' ? overall + 6 : 5,
      pace: overall,
      stamina: overall,
      strength: overall,
      composure: overall,
      decisions: overall,
      positioning: overall,
      setPieces: overall,
      confidence: 0.7,
    },
    officialPreset: index < 26,
    condition: 96,
    fatigue: 5,
    form: 75,
    morale: 78,
    sharpness: 88,
    hierarchy: index < 3 ? 'leader' : 'regular',
  }
}

function nation(id: string, strength: number): Nation {
  return {
    id,
    code: id.toUpperCase().slice(0, 3),
    name: `Selección ${id}`,
    shortName: id,
    flagCode: 'es',
    confederation: 'UEFA',
    group: id === 'home' ? 'A' : 'B',
    ranking: 10,
    strength,
    stars: 4,
    objective: 'Competir',
    tacticalIdentity: 'balanced',
    primaryColor: '#123456',
    secondaryColor: '#ffffff',
    players: Array.from({ length: 26 }, (_, index) => player(id, index)),
  }
}

function setup(seed: number | string) {
  return {
    id: 'test-match',
    seed,
    home: nation('home', 84),
    away: nation('away', 81),
    homeTactic: createDefaultTactic('4-3-3'),
    awayTactic: createDefaultTactic('4-2-3-1'),
    stage: 'group' as const,
    knockout: false,
    snapshotIntervalTicks: 1000,
  }
}

describe('MatchEngine', () => {
  it('is deterministic for an identical seed and decisions', () => {
    const first = simulateMatch(setup('same-seed'))
    const second = simulateMatch(setup('same-seed'))
    expect(second.score).toEqual(first.score)
    expect(second.stats).toEqual(first.stats)
    expect(second.events).toEqual(first.events)
    expect(second.playerRatings).toEqual(first.playerRatings)
  })

  it('starts with 22 players and advances continuous positions at fixed 100 ms ticks', () => {
    const engine = createMatch(setup(42))
    const initial = engine.currentSnapshot
    const after = engine.step()
    expect(initial.players).toHaveLength(22)
    expect(after.tick).toBe(1)
    expect(after.second).toBe(0.1)
    expect(after.players.some((item, index) => item.location.x !== initial.players[index]?.location.x)).toBe(true)
  })

  it('staggers player reactions and accelerates with inertia instead of moving the whole block at once', () => {
    const engine = createMatch(setup('organic-motion'))
    const first = engine.step()
    const movingAtKickoff = first.players.filter((item) => Math.hypot(item.velocity.x, item.velocity.y) > 0.05)
    expect(movingAtKickoff.length).toBeGreaterThan(0)
    expect(movingAtKickoff.length).toBeLessThan(12)

    const second = engine.step()
    const firstById = new Map(first.players.map((item) => [item.playerId, item]))
    const largestVelocityChange = Math.max(...second.players.map((item) => {
      const previous = firstById.get(item.playerId)!
      return Math.hypot(item.velocity.x - previous.velocity.x, item.velocity.y - previous.velocity.y)
    }))
    expect(largestVelocityChange).toBeLessThan(0.75)
  })

  it('builds possessions through recognisable phases and exposes rising match tension', () => {
    const engine = createMatch(setup('phased-possession'))
    const phases = new Set<string>()
    for (let tick = 0; tick < 2_400; tick += 1) phases.add(engine.step().attackPhase)
    expect(phases.has('restart')).toBe(true)
    expect([...phases].some((phase) => ['progression', 'final-third', 'transition'].includes(phase))).toBe(true)
    expect(engine.currentSnapshot.tension).toBeGreaterThan(5)
    expect(['home', 'away']).toContain(engine.currentSnapshot.possession)
  })

  it('separates the strike, ball flight and outcome in the event timeline', () => {
    const result = simulateMatch(setup('separated-actions'))
    const shots = result.events.filter((event) => event.type === 'shot')
    const outcomes = result.events.filter((event) => ['shot-on-target', 'shot-off-target', 'shot-blocked'].includes(event.type))
    expect(shots.length).toBeGreaterThan(5)
    expect(outcomes).toHaveLength(shots.length)
    for (const outcome of outcomes) {
      const origin = [...shots].reverse().find((shot) => shot.side === outcome.side && shot.playerId === outcome.playerId && shot.tick < outcome.tick)
      expect(origin).toBeDefined()
      expect(outcome.tick - origin!.tick).toBeGreaterThanOrEqual(4)
    }
  })

  it('makes a late tied knockout materially tenser than an early group match', () => {
    const early = calculateMatchTension({ second: 8 * 60, score: { home: 0, away: 0 }, knockout: false })
    const lateKnockout = calculateMatchTension({ second: 88 * 60, score: { home: 1, away: 1 }, knockout: true, momentum: 8 })
    const settled = calculateMatchTension({ second: 88 * 60, score: { home: 4, away: 0 }, knockout: false })
    expect(lateKnockout).toBeGreaterThan(early + 35)
    expect(lateKnockout).toBeGreaterThan(settled + 20)
  })

  it('derives score and aggregate statistics from its event log', () => {
    const result = simulateMatch(setup(7))
    const homeGoals = result.events.filter((event) => event.type === 'goal' && event.side === 'home').length
      - result.events.filter((event) => event.type === 'var-overturn' && event.side === 'home').length
    const awayGoals = result.events.filter((event) => event.type === 'goal' && event.side === 'away').length
      - result.events.filter((event) => event.type === 'var-overturn' && event.side === 'away').length
    expect(result.score.home).toBe(homeGoals)
    expect(result.score.away).toBe(awayGoals)
    const totalShots = result.stats.home.shots + result.stats.away.shots
    const totalPasses = result.stats.home.passesAttempted + result.stats.away.passesAttempted
    const totalFouls = result.stats.home.fouls + result.stats.away.fouls
    expect(totalShots).toBeGreaterThanOrEqual(12)
    expect(totalShots).toBeLessThanOrEqual(38)
    expect(totalPasses).toBeGreaterThanOrEqual(500)
    expect(totalPasses).toBeLessThanOrEqual(1_150)
    expect(totalFouls).toBeGreaterThanOrEqual(5)
    expect(totalFouls).toBeLessThanOrEqual(32)
    expect(result.stats.home.passesCompleted).toBeLessThanOrEqual(result.stats.home.passesAttempted)
    expect(result.events.some((event) => event.type === 'momentum')).toBe(true)
    expect(result.events.some((event) => event.type === 'tactical-shift')).toBe(true)
    expect(result.events.some((event) => event.type === 'pass' && /línea|transición|presión|orientación|grada/i.test(event.commentary))).toBe(true)
    expect(result.events.at(-1)?.type).toBe('match-end')
  })

  it('allows five changes inside one substitution window', () => {
    const matchSetup = setup('five-in-one-window')
    const engine = createMatch(matchSetup)
    engine.step()
    const onPitch = engine.currentSnapshot.players.filter((item) => item.side === 'home' && item.onPitch)
    const activeIds = new Set(onPitch.map((item) => item.playerId))
    const bench = matchSetup.home.players.filter((item) => !activeIds.has(item.id))
    for (let index = 0; index < 5; index += 1) {
      expect(engine.applyCommand({ type: 'substitute', side: 'home', playerOutId: onPitch[index]!.playerId, playerInId: bench[index]!.id })).toBe(true)
    }
    expect(engine.currentSnapshot.stats.home.substitutions).toBe(5)
    expect(engine.applyCommand({ type: 'substitute', side: 'home', playerOutId: onPitch[5]!.playerId, playerInId: bench[5]!.id })).toBe(false)
  })

  it('enforces three normal substitution windows in regulation time', () => {
    const matchSetup = setup('three-windows')
    const engine = createMatch(matchSetup)
    engine.step()
    const onPitch = engine.currentSnapshot.players.filter((item) => item.side === 'home' && item.onPitch)
    const activeIds = new Set(onPitch.map((item) => item.playerId))
    const bench = matchSetup.home.players.filter((item) => !activeIds.has(item.id))
    for (let window = 0; window < 3; window += 1) {
      expect(engine.applyCommand({ type: 'substitute', side: 'home', playerOutId: onPitch[window]!.playerId, playerInId: bench[window]!.id })).toBe(true)
      for (let tick = 0; tick < 600; tick += 1) engine.step()
    }
    expect(engine.applyCommand({ type: 'substitute', side: 'home', playerOutId: onPitch[3]!.playerId, playerInId: bench[3]!.id })).toBe(false)
  })
})
