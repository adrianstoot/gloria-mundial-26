import type {
  BallState,
  EntityId,
  FormationSlot,
  GameRatings,
  MatchCommand,
  MatchAttackPhase,
  MatchEvent,
  MatchEventType,
  MatchPhase,
  MatchPlayerState,
  MatchScore,
  MatchSetup,
  MatchSnapshot,
  MatchStats,
  Nation,
  Player,
  SimulationResult,
  TacticPlan,
  TeamMatchStats,
  Vector2,
} from '../domain'
import { autoAssignLineup, positionCompatibility, selectMatchSquad } from './formations'
import { DeterministicRandom, hashSeed } from './prng'
import { starProfile } from '../features/starPlayers'
import { effectivePositionRating, positionSuitability } from '../domain/tacticalIntelligence'

export const MATCH_TICK_MS = 100
export const MATCH_TICKS_PER_SECOND = 1000 / MATCH_TICK_MS
export const PITCH_LENGTH = 105
export const PITCH_WIDTH = 68

type Side = 'home' | 'away'
type MovementIntent =
  | 'support' | 'run' | 'cover' | 'press' | 'hold' | 'recover' | 'carry'
  | 'overlap' | 'underlap' | 'drag' | 'track' | 'screen'

type PossessionPattern =
  | 'build-three' | 'third-man' | 'wide-overlap' | 'inside-overlap'
  | 'switch-play' | 'counter' | 'patient'

interface RuntimePlayer extends MatchPlayerState {
  player: Player
  anchor: Vector2
  duty: FormationSlot['duty']
  target: Vector2
  nextIntentTick: number
  motionBias: number
  settleUntilTick: number
  intent: MovementIntent
  orientation: number
}

type TacticalMode = 'protect' | 'balanced' | 'chase'

interface TeamRuntime {
  side: Side
  nation: Nation
  tactic: TacticPlan
  squad: Player[]
  onPitch: RuntimePlayer[]
  bench: Player[]
  substitutionWindows: number
  substitutions: number
  concussionSubstitutions: number
  automaticWindowsUsed: Set<number>
  lastSubstitutionWindowTick?: number
  tacticalMode: TacticalMode
  lastTacticalShiftTick: number
}

interface PeriodBoundaries {
  firstHalfEnd: number
  regulationEnd: number
  extraFirstEnd: number
  extraEnd: number
}

interface LastCompletedPass {
  passerId: EntityId
  receiverId: EntityId
  tick: number
}

interface PossessionRuntime {
  side: Side
  stage: MatchAttackPhase
  startedTick: number
  completedPasses: number
  momentum: number
  pattern: PossessionPattern
  patternStep: number
}

interface PendingPass {
  kind: 'pass'
  side: Side
  passerId: EntityId
  receiverId: EntityId
  interceptorId?: EntityId
  arrivalTick: number
  success: boolean
  target: Vector2
}

interface PendingShot {
  kind: 'shot'
  side: Side
  shooterId: EntityId
  goalkeeperId?: EntityId
  stage: 'flight' | 'keeper' | 'review'
  arrivalTick: number
  location: Vector2
  xg: number
  onTarget: boolean
  blocked: boolean
  goal: boolean
  corner: boolean
  review: boolean
  overturn: boolean
  assistId?: EntityId
}

type PendingBallAction = PendingPass | PendingShot

interface ContextualIntent {
  urgency: number
  risk: number
  press: number
  directness: number
}

const EMPTY_TEAM_STATS: TeamMatchStats = {
  goals: 0,
  shots: 0,
  shotsOnTarget: 0,
  xg: 0,
  possessionTicks: 0,
  passesAttempted: 0,
  passesCompleted: 0,
  corners: 0,
  fouls: 0,
  offsides: 0,
  yellowCards: 0,
  redCards: 0,
  tacklesWon: 0,
  saves: 0,
  substitutions: 0,
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function turnTowards(current: number, target: number, maximumStep: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + clamp(delta, -maximumStep, maximumStep)
}

function cloneScore(score: MatchScore): MatchScore {
  return {
    home: score.home,
    away: score.away,
    penalties: score.penalties ? { ...score.penalties } : undefined,
  }
}

function cloneTeamStats(stats: TeamMatchStats): TeamMatchStats {
  return { ...stats, xg: round(stats.xg) }
}

function cloneStats(stats: MatchStats): MatchStats {
  return { home: cloneTeamStats(stats.home), away: cloneTeamStats(stats.away) }
}

function opposite(side: Side): Side {
  return side === 'home' ? 'away' : 'home'
}

export interface MatchTensionContext {
  second: number
  score: MatchScore
  knockout: boolean
  momentum?: number
}

/** Pure, deterministic tension curve used by both decisions and presentation. */
export function calculateMatchTension({ second, score, knockout, momentum = 0 }: MatchTensionContext): number {
  const regulationProgress = clamp(second / (90 * 60), 0, 1.25)
  const difference = Math.abs(score.home - score.away)
  const closeGame = difference === 0 ? 20 : difference === 1 ? 12 : 0
  const lateWeight = clamp((regulationProgress - 0.55) / 0.45, 0, 1)
  const knockoutPressure = knockout ? 8 + lateWeight * 13 : 0
  const tiedKnockout = knockout && difference === 0 ? lateWeight * 15 : 0
  const settledPenalty = difference >= 3 ? 18 : difference === 2 ? 7 : 0
  return round(clamp(
    14 + regulationProgress * 30 + closeGame * (0.45 + lateWeight * 0.55)
      + knockoutPressure + tiedKnockout + clamp(momentum, -20, 20) * 0.35 - settledPenalty,
    5,
    100,
  ), 1)
}

function displayedMinute(second: number): number {
  return Math.max(1, Math.min(120, Math.floor(second / 60) + 1))
}

function playerName(player: Player): string {
  return player.realStats.knownAs || player.shirtName || player.realStats.fullName
}

function weightedAverage(ratings: GameRatings, entries: Array<[keyof GameRatings, number]>): number {
  let total = 0
  let weight = 0
  for (const [key, itemWeight] of entries) {
    const value = ratings[key]
    if (typeof value === 'number') {
      total += value * itemWeight
      weight += itemWeight
    }
  }
  return weight === 0 ? ratings.overall : total / weight
}

function playerImpact(player: Player): number {
  const fitness = clamp((player.condition - player.fatigue * 0.45) / 100, 0.35, 1)
  const mood = 0.88 + ((player.morale + player.form) / 2 / 100) * 0.2
  return player.gameRatings.overall * fitness * mood
}

function teamQuality(team: TeamRuntime): number {
  const active = team.onPitch.filter((item) => item.onPitch && !item.redCard)
  if (!active.length) return 1
  return active.reduce((sum, item) => sum + playerImpact(item.player) * clamp(item.stamina / 100, 0.55, 1), 0) / active.length
}

function anchorFromSlot(slot: FormationSlot, side: Side): Vector2 {
  // Domain formations use progress/lateral coordinates in 0–1. The tactics UI
  // historically uses lateral/top-down coordinates in 0–100; accept both.
  const uiCoordinates = slot.x > 1 || slot.y > 1
  const progress = uiCoordinates ? 1 - slot.y / 100 : slot.x
  const lateral = uiCoordinates ? slot.x / 100 : slot.y
  return side === 'home'
    ? { x: progress * PITCH_LENGTH, y: lateral * PITCH_WIDTH }
    : { x: (1 - progress) * PITCH_LENGTH, y: (1 - lateral) * PITCH_WIDTH }
}

function findAssignedLineup(tactic: TacticPlan, squad: Player[]): TacticPlan {
  const known = new Set(squad.map((player) => player.id))
  const assigned = tactic.slots.filter((slot) => slot.playerId && known.has(slot.playerId)).length
  const unique = new Set(tactic.slots.map((slot) => slot.playerId).filter(Boolean)).size
  return assigned === 11 && unique === 11 ? tactic : autoAssignLineup(tactic, squad)
}

function createRuntimeTeam(side: Side, nation: Nation, requestedSquad: Player[] | undefined, tactic: TacticPlan): TeamRuntime {
  const squad = selectMatchSquad(nation, requestedSquad)
  if (squad.length < 11) throw new Error(`${nation.name} no dispone de once futbolistas elegibles.`)
  const prepared = findAssignedLineup(tactic, squad)
  const playerMap = new Map(squad.map((player) => [player.id, player]))
  const shirtNumbers = new Set<number>()
  const onPitch = prepared.slots.map((slot, index): RuntimePlayer => {
    const sourcePlayer = slot.playerId ? playerMap.get(slot.playerId) : undefined
    if (!sourcePlayer) throw new Error(`No se pudo cubrir la posición ${slot.position} de ${nation.name}.`)
    const effectiveOverall = effectivePositionRating(sourcePlayer, slot.position)
    const suitability = positionSuitability(sourcePlayer, slot.position)
    const scale = effectiveOverall / Math.max(1, sourcePlayer.gameRatings.overall)
    const player: Player = suitability >= 94 ? sourcePlayer : {
      ...sourcePlayer,
      gameRatings: Object.fromEntries(Object.entries(sourcePlayer.gameRatings).map(([key, value]) => [
        key,
        key === 'confidence' ? value : Math.max(1, Math.min(99, Math.round(Number(value) * scale))),
      ])) as unknown as GameRatings,
    }
    let shirtNumber = player.shirtNumber ?? index + 1
    while (shirtNumbers.has(shirtNumber)) shirtNumber += 1
    shirtNumbers.add(shirtNumber)
    const anchor = anchorFromSlot(slot, side)
    const movementSeed = hashSeed(`${player.id}:organic-motion`)
    return {
      player,
      playerId: player.id,
      nationId: nation.id,
      side,
      position: slot.position,
      shirtNumber,
      location: { ...anchor },
      velocity: { x: 0, y: 0 },
      stamina: clamp(player.condition || 100, 1, 100),
      rating: 6.5,
      yellowCards: 0,
      redCard: false,
      injured: false,
      onPitch: true,
      anchor,
      duty: slot.duty,
      target: { ...anchor },
      nextIntentTick: movementSeed % 23,
      motionBias: (movementSeed % 10_000) / 10_000,
      settleUntilTick: movementSeed % 11,
      intent: slot.position === 'GK' ? 'hold' : slot.duty === 'attack' ? 'run' : slot.duty === 'defend' ? 'cover' : 'support',
      orientation: side === 'home' ? 0 : Math.PI,
    }
  })
  const starters = new Set(onPitch.map((item) => item.playerId))
  return {
    side,
    nation,
    tactic: prepared,
    squad,
    onPitch,
    bench: squad.filter((player) => !starters.has(player.id)),
    substitutionWindows: 0,
    substitutions: 0,
    concussionSubstitutions: 0,
    automaticWindowsUsed: new Set(),
    lastSubstitutionWindowTick: undefined,
    tacticalMode: 'balanced',
    lastTacticalShiftTick: -10_000,
  }
}

export class MatchEngine {
  readonly setup: MatchSetup
  readonly seed: number
  private readonly random: DeterministicRandom
  private readonly home: TeamRuntime
  private readonly away: TeamRuntime
  private readonly boundaries: PeriodBoundaries
  private readonly snapshotInterval: number
  private tick = 0
  private phase: MatchPhase = 'not-started'
  private score: MatchScore = { home: 0, away: 0 }
  private ball: BallState = { location: { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 }, velocity: { x: 0, y: 0 }, height: 0 }
  private referee: Vector2 = { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 }
  private possession: Side = 'home'
  private stats: MatchStats = { home: { ...EMPTY_TEAM_STATS }, away: { ...EMPTY_TEAM_STATS } }
  private events: MatchEvent[] = []
  private snapshots: MatchSnapshot[] = []
  private finished = false
  private wentToExtraTime = false
  private wentToPenalties = false
  private lastCompletedPass: Partial<Record<Side, LastCompletedPass>> = {}
  private possessionRuntime: PossessionRuntime
  private pendingAction?: PendingBallAction
  private nextDecisionTick = 30
  private lastMomentumEventTick = -10_000

  constructor(setup: MatchSetup) {
    this.setup = setup
    this.seed = hashSeed(setup.seed)
    this.random = new DeterministicRandom(this.seed)
    this.home = createRuntimeTeam('home', setup.home, setup.homeSquad, setup.homeTactic)
    this.away = createRuntimeTeam('away', setup.away, setup.awaySquad, setup.awayTactic)
    this.snapshotInterval = Math.max(1, Math.trunc(setup.snapshotIntervalTicks ?? 20))
    const firstAdded = this.random.int(1, 3) * 60
    const secondAdded = this.random.int(3, 7) * 60
    const extraFirstAdded = this.random.int(0, 2) * 60
    const extraSecondAdded = this.random.int(0, 2) * 60
    this.boundaries = {
      firstHalfEnd: 45 * 60 + firstAdded,
      regulationEnd: 90 * 60 + firstAdded + secondAdded,
      extraFirstEnd: 105 * 60 + firstAdded + secondAdded + extraFirstAdded,
      extraEnd: 120 * 60 + firstAdded + secondAdded + extraFirstAdded + extraSecondAdded,
    }
    const kickoffQuality = teamQuality(this.home) - teamQuality(this.away)
    this.possession = this.random.chance(clamp(0.5 + kickoffQuality / 300, 0.38, 0.62)) ? 'home' : 'away'
    for (const team of [this.home, this.away]) {
      for (const player of team.onPitch) {
        player.location.x = team.side === 'home'
          ? Math.min(player.location.x, PITCH_LENGTH / 2 - 0.45)
          : Math.max(player.location.x, PITCH_LENGTH / 2 + 0.45)
        player.target = { ...player.location }
      }
    }
    this.possessionRuntime = {
      side: this.possession,
      stage: 'restart',
      startedTick: 0,
      completedPasses: 0,
      momentum: 0,
      pattern: 'patient',
      patternStep: 0,
    }
  }

  get currentSnapshot(): MatchSnapshot {
    return this.makeSnapshot()
  }

  get isFinished(): boolean {
    return this.finished
  }

  get eventLog(): readonly MatchEvent[] {
    return this.events
  }

  applyCommand(command: MatchCommand): boolean {
    if (this.finished) return false
    if (command.type === 'substitute') {
      return this.makeSubstitution(command.side, command.playerOutId, command.playerInId, true)
    }
    if (command.type === 'change-tactic') {
      const team = this.getTeam(command.side)
      team.tactic = command.tactic
      const slots = command.tactic.slots
      for (const runtimePlayer of team.onPitch.filter((player) => player.onPitch)) {
        const slot = slots.find((item) => item.playerId === runtimePlayer.playerId)
          ?? slots.find((item) => item.position === runtimePlayer.position)
        if (slot) {
          runtimePlayer.position = slot.position
          runtimePlayer.duty = slot.duty
          runtimePlayer.anchor = anchorFromSlot(slot, command.side)
          runtimePlayer.target = { ...runtimePlayer.anchor }
          runtimePlayer.nextIntentTick = this.tick + 1 + Math.floor(runtimePlayer.motionBias * 12)
        }
      }
      return true
    }
    return command.type === 'pause' || command.type === 'resume' || command.type === 'set-speed'
  }

  step(): MatchSnapshot {
    if (this.finished) return this.makeSnapshot()
    if (this.phase === 'not-started') this.beginMatch()

    this.tick += 1
    this.resolvePendingAction()
    this.advancePhase()
    if (this.finished) return this.makeSnapshot()

    this.updateMovement()
    this.stats[this.possession].possessionTicks += 1
    if (this.tick % MATCH_TICKS_PER_SECOND === 0) this.processSecond()

    if (this.tick % this.snapshotInterval === 0) this.captureSnapshot()
    return this.makeSnapshot()
  }

  runToEnd(): SimulationResult {
    while (!this.finished) this.step()
    if (this.snapshots.at(-1)?.tick !== this.tick) this.captureSnapshot()
    const allPlayers = [...this.home.onPitch, ...this.away.onPitch]
    const ratings = Object.fromEntries(allPlayers.map((item) => [item.playerId, round(clamp(item.rating, 3, 10), 1)]))
    const winnerId = this.score.home === this.score.away
      ? undefined
      : this.score.home > this.score.away ? this.home.nation.id : this.away.nation.id
    const penaltyWinner = this.score.penalties
      ? this.score.penalties.home > this.score.penalties.away ? this.home.nation.id : this.away.nation.id
      : undefined
    return {
      matchId: this.setup.id,
      seed: this.seed,
      score: cloneScore(this.score),
      winnerId: penaltyWinner ?? winnerId,
      phase: 'finished',
      wentToExtraTime: this.wentToExtraTime,
      wentToPenalties: this.wentToPenalties,
      stats: cloneStats(this.stats),
      events: this.events.map((event) => ({ ...event, score: cloneScore(event.score) })),
      snapshots: this.snapshots,
      finalPlayers: allPlayers.map((item) => this.publicPlayerState(item)),
      playerRatings: ratings,
    }
  }

  private beginMatch(): void {
    this.phase = 'first-half'
    this.givePossession(this.possession, true)
    this.emit('period-start', this.possession, undefined, `Comienza el partido en ${this.setup.id}.`)
    this.emit('kick-off', this.possession, this.ball.possessorId, `${this.getTeam(this.possession).nation.shortName} pone el balón en juego.`)
    this.captureSnapshot()
  }

  private advancePhase(): void {
    const second = this.tick / MATCH_TICKS_PER_SECOND
    if (this.phase === 'first-half' && second >= this.boundaries.firstHalfEnd) {
      this.emit('period-end', undefined, undefined, 'Descanso. Los dos equipos se retiran al vestuario.')
      this.phase = 'half-time'
      this.phase = 'second-half'
      this.possession = opposite(this.possession)
      this.givePossession(this.possession, true)
      this.emit('period-start', this.possession, undefined, 'Arranca la segunda parte.')
    }

    if (this.phase === 'second-half' && second >= this.boundaries.regulationEnd) {
      if (this.setup.knockout && this.score.home === this.score.away) {
        this.wentToExtraTime = true
        this.emit('period-end', undefined, undefined, 'Final de los 90 minutos. Habrá prórroga.')
        this.phase = 'extra-time-first'
        this.givePossession(opposite(this.possession), true)
        this.emit('period-start', this.possession, undefined, 'Comienza la primera parte de la prórroga.')
      } else {
        this.finishMatch()
      }
    }

    if (this.phase === 'extra-time-first' && second >= this.boundaries.extraFirstEnd) {
      this.emit('period-end', undefined, undefined, 'Pausa de la prórroga.')
      this.phase = 'extra-time-break'
      this.phase = 'extra-time-second'
      this.givePossession(opposite(this.possession), true)
      this.emit('period-start', this.possession, undefined, 'Comienza la segunda parte de la prórroga.')
    }

    if (this.phase === 'extra-time-second' && second >= this.boundaries.extraEnd) {
      if (this.score.home === this.score.away) this.runPenaltyShootout()
      this.finishMatch()
    }
  }

  private finishMatch(): void {
    if (this.finished) return
    this.phase = 'finished'
    this.finished = true
    this.ball.possessorId = undefined
    this.ball.velocity = { x: 0, y: 0 }
    this.pendingAction = undefined
    const penaltyText = this.score.penalties
      ? ` Tras una tanda dramática: ${this.score.penalties.home}-${this.score.penalties.away} en penaltis.`
      : ''
    const knockoutText = this.setup.knockout && !this.score.penalties && Math.abs(this.score.home - this.score.away) === 1
      ? ' Un margen mínimo decide una noche de máxima tensión.'
      : ''
    this.emit('match-end', undefined, undefined, `Final: ${this.home.nation.shortName} ${this.score.home}-${this.score.away} ${this.away.nation.shortName}.${penaltyText}${knockoutText}`)
  }

  private processSecond(): void {
    this.drainStamina()
    this.updateContextualAI()
    this.maybeAutomaticSubstitutions()
    if (this.pendingAction || this.tick < this.nextDecisionTick) return
    if (this.maybeInjury()) return this.deferNextDecision(24, 45)
    if (this.maybeFoul()) return this.deferNextDecision(22, 42)
    if (this.maybeOffside()) return this.deferNextDecision(20, 38)
    if (this.maybeOrganicShot()) return this.deferNextDecision(28, 52)
    if (this.maybeOrganicDribble()) return this.deferNextDecision(16, 34)
    this.scheduleOrganicPass()
    this.scheduleNextDecision()
  }

  private drainStamina(): void {
    const weatherLoad = this.setup.weather === 'hot' ? 1.12 : this.setup.weather === 'rain' ? 1.04 : 1
    for (const team of [this.home, this.away]) {
      const intensity = 0.72 + team.tactic.tempo / 180 + team.tactic.pressing / 160
      for (const item of team.onPitch) {
        if (!item.onPitch) continue
        const endurance = item.player.gameRatings.stamina / 100
        const drain = intensity * weatherLoad * (0.0068 - endurance * 0.0026)
        item.stamina = clamp(item.stamina - drain, 1, 100)
      }
    }
  }

  private updateMovement(): void {
    for (const team of [this.home, this.away]) {
      for (const runtimePlayer of team.onPitch) {
        if (!runtimePlayer.onPitch) continue
        if (this.tick >= runtimePlayer.nextIntentTick) this.refreshMovementIntent(team, runtimePlayer)
        const dx = runtimePlayer.target.x - runtimePlayer.location.x
        const dy = runtimePlayer.target.y - runtimePlayer.location.y
        const distance = Math.hypot(dx, dy)
        const isGoalkeeper = runtimePlayer.position === 'GK'
        const staminaFactor = runtimePlayer.stamina > 55 ? 1 : clamp(0.72 + runtimePlayer.stamina / 200, 0.72, 1)
        const surfaceFactor = this.setup.weather === 'rain' ? 0.95 : this.setup.weather === 'hot' ? 0.975 : 1
        const intentPace: Record<MovementIntent, number> = {
          support: .9, run: 1.08, cover: .78, press: 1.06, hold: .5, recover: 1.01, carry: .94,
          overlap: 1.08, underlap: 1.04, drag: .97, track: 1.02, screen: .7,
        }
        const maxSpeed = (isGoalkeeper ? 5 : 5.25 + runtimePlayer.player.gameRatings.pace * 0.035) * staminaFactor * surfaceFactor * intentPace[runtimePlayer.intent]
        const isCarrier = this.ball.possessorId === runtimePlayer.playerId
        const settling = !isCarrier && this.tick < runtimePlayer.settleUntilTick && distance < (runtimePlayer.intent === 'hold' ? 2.1 : 1.4)
        const desiredSpeed = settling ? 0 : Math.min(maxSpeed, distance * 1.35)
        const desired = distance > 0.01
          ? { x: dx / distance * desiredSpeed, y: dy / distance * desiredSpeed }
          : { x: 0, y: 0 }
        const velocityDelta = { x: desired.x - runtimePlayer.velocity.x, y: desired.y - runtimePlayer.velocity.y }
        const deltaLength = Math.hypot(velocityDelta.x, velocityDelta.y)
        const accelerationIntent = ['run', 'press', 'overlap', 'underlap', 'track'].includes(runtimePlayer.intent)
          ? 1.12
          : runtimePlayer.intent === 'hold' || runtimePlayer.intent === 'screen' ? .72 : 1
        const acceleration = (isGoalkeeper ? 3.1 : 3.5 + runtimePlayer.player.gameRatings.pace * 0.025) * accelerationIntent * MATCH_TICK_MS / 1000
        if (deltaLength > acceleration) {
          runtimePlayer.velocity.x += velocityDelta.x / deltaLength * acceleration
          runtimePlayer.velocity.y += velocityDelta.y / deltaLength * acceleration
        } else {
          runtimePlayer.velocity = desired
        }
        if (distance < 0.22) {
          runtimePlayer.velocity.x *= 0.64
          runtimePlayer.velocity.y *= 0.64
        }

        // A small local separation force stops team-mates collapsing into one dot.
        for (const neighbour of team.onPitch) {
          if (neighbour === runtimePlayer || !neighbour.onPitch) continue
          const sx = runtimePlayer.location.x - neighbour.location.x
          const sy = runtimePlayer.location.y - neighbour.location.y
          const separation = Math.hypot(sx, sy)
          if (separation > 0.05 && separation < 1.45) {
            const repulsion = (1.45 - separation) * 0.055
            runtimePlayer.velocity.x += sx / separation * repulsion
            runtimePlayer.velocity.y += sy / separation * repulsion
          }
        }
        runtimePlayer.location.x = clamp(runtimePlayer.location.x + runtimePlayer.velocity.x * MATCH_TICK_MS / 1000, 0, PITCH_LENGTH)
        runtimePlayer.location.y = clamp(runtimePlayer.location.y + runtimePlayer.velocity.y * MATCH_TICK_MS / 1000, 0, PITCH_WIDTH)
        const velocityLength = Math.hypot(runtimePlayer.velocity.x, runtimePlayer.velocity.y)
        const desiredOrientation = velocityLength > .32
          ? Math.atan2(runtimePlayer.velocity.y, runtimePlayer.velocity.x)
          : Math.atan2(this.ball.location.y - runtimePlayer.location.y, this.ball.location.x - runtimePlayer.location.x)
        runtimePlayer.orientation = turnTowards(runtimePlayer.orientation, desiredOrientation, velocityLength > .32 ? .12 : .055)
      }
    }

    const possessor = this.findRuntimePlayer(this.ball.possessorId)
    if (possessor?.onPitch) {
      this.ball.location = { ...possessor.location }
      this.ball.velocity = { ...possessor.velocity }
      this.ball.height = 0
    } else {
      this.ball.location.x = clamp(this.ball.location.x + this.ball.velocity.x * MATCH_TICK_MS / 1000, 0, PITCH_LENGTH)
      this.ball.location.y = clamp(this.ball.location.y + this.ball.velocity.y * MATCH_TICK_MS / 1000, 0, PITCH_WIDTH)
      this.ball.velocity.x *= 0.995
      this.ball.velocity.y *= 0.995
      this.ball.height = Math.max(0, this.ball.height - 0.055)
    }
    this.referee.x += (this.ball.location.x - this.referee.x) * 0.012
    this.referee.y += (this.ball.location.y - this.referee.y) * 0.012
  }

  private refreshMovementIntent(team: TeamRuntime, player: RuntimePlayer): void {
    const direction = team.side === 'home' ? 1 : -1
    const hasBall = this.possession === team.side
    const context = this.contextualIntent(team)
    const distanceToBall = Math.hypot(player.location.x - this.ball.location.x, player.location.y - this.ball.location.y)
    const isCarrier = this.ball.possessorId === player.playerId
    const involved = isCarrier || distanceToBall < 12
    const decisionLag = involved
      ? 5 + Math.round((100 - player.player.gameRatings.decisions) / 18) + Math.floor(player.motionBias * 4)
      : 18 + Math.round((100 - player.player.gameRatings.decisions) / 8) + Math.floor(player.motionBias * 12)
    player.nextIntentTick = this.tick + decisionLag

    if (hasBall) {
      const pattern = this.possessionRuntime.pattern
      const stageShift: Record<MatchAttackPhase, number> = {
        restart: -2,
        'build-up': 1.5,
        progression: 5,
        'final-third': 8.5,
        transition: 7,
      }
      const widthScale = 0.7 + team.tactic.width / 165
      const runnerPulse = (Math.floor(this.tick / 58) + Math.floor(player.motionBias * 11)) % 6
      const attackingRole = ['ST', 'SS', 'RW', 'LW', 'AM', 'RM', 'LM'].includes(player.position)
      const dutyRun = player.duty === 'attack' ? 2.4 : player.duty === 'defend' ? -1.2 : 0
      const makesRun = attackingRole && runnerPulse === 0
      const isWideDefender = ['LB', 'RB', 'LWB', 'RWB'].includes(player.position)
      const isCentralRunner = ['CM', 'AM', 'SS'].includes(player.position)
      const farFromBall = Math.sign(player.anchor.y - PITCH_WIDTH / 2) !== Math.sign(this.ball.location.y - PITCH_WIDTH / 2)
      const supportRun = makesRun ? 4.5 + context.risk * 3.5 + dutyRun : dutyRun
      const lineResponsiveness = player.position === 'GK' ? 0.12
        : ['CB','LB','RB','LWB','RWB'].includes(player.position) ? 0.44
          : ['DM','CM','LM','RM'].includes(player.position) ? 0.72 : 1
      const stagger = (player.motionBias - 0.5) * (this.possessionRuntime.stage === 'transition' ? 2.2 : 0.8)
      let targetX = player.anchor.x + direction * (stageShift[this.possessionRuntime.stage] * lineResponsiveness + supportRun + context.risk * 2.4 + stagger)
      let targetY = PITCH_WIDTH / 2 + (player.anchor.y - PITCH_WIDTH / 2) * widthScale
      targetX += (this.ball.location.x - PITCH_LENGTH / 2) * (player.position === 'GK' ? 0.025 : 0.075)
      targetY += (this.ball.location.y - PITCH_WIDTH / 2) * (player.position === 'GK' ? 0.02 : 0.08)
      if (isCarrier) {
        player.intent = 'carry'
        targetX = player.location.x + direction * (2.2 + context.urgency * 4.5)
        targetY = player.location.y + (PITCH_WIDTH / 2 - player.location.y) * 0.08
      } else if (pattern === 'wide-overlap' && isWideDefender && Math.abs(player.anchor.y - PITCH_WIDTH / 2) > 13) {
        player.intent = 'overlap'
        targetX += direction * (7 + context.risk * 4)
        targetY = player.anchor.y < PITCH_WIDTH / 2 ? 3.2 : PITCH_WIDTH - 3.2
      } else if ((pattern === 'inside-overlap' || pattern === 'third-man') && isCentralRunner && runnerPulse <= 1) {
        player.intent = 'underlap'
        targetX += direction * (6 + context.risk * 4)
        targetY += (PITCH_WIDTH / 2 - targetY) * .42
      } else if (pattern === 'switch-play' && farFromBall && ['LW', 'RW', 'LM', 'RM', 'LB', 'RB'].includes(player.position)) {
        player.intent = 'hold'
        targetY = player.anchor.y < PITCH_WIDTH / 2 ? 2.8 : PITCH_WIDTH - 2.8
        targetX += direction * 3.5
      } else if (pattern === 'third-man' && attackingRole && distanceToBall > 9) {
        player.intent = 'drag'
        targetX += direction * 5.5
        targetY += (player.motionBias - .5) * 7
      } else if (makesRun) {
        player.intent = 'run'
      } else if (player.duty === 'defend' || ['CB', 'GK'].includes(player.position)) {
        player.intent = 'cover'
      } else if (distanceToBall < 18 || ['CM', 'DM', 'AM'].includes(player.position)) {
        player.intent = 'support'
      } else {
        player.intent = 'hold'
      }
      player.target = {
        x: clamp(targetX, 1.5, PITCH_LENGTH - 1.5),
        y: clamp(targetY, 1.5, PITCH_WIDTH - 1.5),
      }
      if (!isCarrier && !makesRun && Math.hypot(player.target.x - player.location.x, player.target.y - player.location.y) < 1.25) {
        player.settleUntilTick = this.tick + 8 + Math.floor(player.motionBias * 13)
      }
      return
    }

    const activeDefenders = team.onPitch
      .filter((item) => item.onPitch && item.position !== 'GK')
      .sort((left, right) => Math.hypot(left.location.x - this.ball.location.x, left.location.y - this.ball.location.y)
        - Math.hypot(right.location.x - this.ball.location.x, right.location.y - this.ball.location.y))
    const pressureRank = activeDefenders.findIndex((item) => item.playerId === player.playerId)
    const compactness = team.tactic.marking === 'zonal' ? 0.78 : 0.9
    const blockDrop = direction * -(2.5 + (team.tacticalMode === 'protect' ? 4 : 0))
    const lineHeight = direction * (team.tactic.defensiveLine - 50) * 0.075
    let targetX = player.anchor.x + blockDrop + lineHeight + (this.ball.location.x - PITCH_LENGTH / 2) * 0.095
    let targetY = PITCH_WIDTH / 2 + (player.anchor.y - PITCH_WIDTH / 2) * compactness
      + (this.ball.location.y - PITCH_WIDTH / 2) * 0.13
    const pressesBall = player.position !== 'GK' && pressureRank >= 0 && pressureRank < (context.press > 0.72 ? 2 : 1)
    if (pressesBall) {
      player.intent = 'press'
      targetX = this.ball.location.x - direction * (1.2 + pressureRank * 1.3)
      targetY = this.ball.location.y + (player.motionBias - 0.5) * 2.4
    } else {
      const displaced = Math.hypot(player.location.x - player.anchor.x, player.location.y - player.anchor.y)
      const guardsLane = pressureRank >= 1 && pressureRank <= 3 && ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM'].includes(player.position)
      const tracksWideRun = ['LB', 'RB', 'LWB', 'RWB'].includes(player.position)
        && Math.abs(this.ball.location.y - player.location.y) < 15
      player.intent = displaced > 12
        ? 'recover'
        : tracksWideRun ? 'track'
          : guardsLane ? 'screen'
            : player.duty === 'defend' || ['CB', 'DM'].includes(player.position) ? 'cover' : 'hold'
    }
    if (player.position === 'GK') {
      player.intent = 'hold'
      targetX = player.anchor.x + (this.ball.location.x - PITCH_LENGTH / 2) * 0.035
      targetY = PITCH_WIDTH / 2 + (this.ball.location.y - PITCH_WIDTH / 2) * 0.12
    }
    const numericalLoss = 11 - team.onPitch.filter((item) => item.onPitch && !item.redCard).length
    if (numericalLoss > 0) targetY = PITCH_WIDTH / 2 + (targetY - PITCH_WIDTH / 2) * 0.82
    player.target = { x: clamp(targetX, 1.2, PITCH_LENGTH - 1.2), y: clamp(targetY, 1.2, PITCH_WIDTH - 1.2) }
    if (!pressesBall && Math.hypot(player.target.x - player.location.x, player.target.y - player.location.y) < 1.35) {
      player.settleUntilTick = this.tick + 10 + Math.floor(player.motionBias * 16)
    }
  }

  private contextualIntent(team: TeamRuntime): ContextualIntent {
    const opponent = this.getTeam(opposite(team.side))
    const difference = this.score[team.side] - this.score[opposite(team.side)]
    const minute = this.tick / MATCH_TICKS_PER_SECOND / 60
    const late = clamp((minute - 52) / 40, 0, 1)
    const redDisadvantage = opponent.onPitch.filter((item) => item.onPitch).length - team.onPitch.filter((item) => item.onPitch).length
    const modeUrgency = team.tacticalMode === 'chase' ? 0.34 : team.tacticalMode === 'protect' ? -0.24 : 0
    const urgency = clamp(0.38 + modeUrgency + (difference < 0 ? late * 0.42 : difference > 0 ? -late * 0.18 : late * 0.08), 0.08, 1)
    const risk = clamp(0.3 + urgency * 0.55 + (team.tactic.mentality === 'attacking' ? 0.14 : team.tactic.mentality === 'defensive' ? -0.1 : 0) - redDisadvantage * 0.06, 0.1, 1)
    const press = clamp(team.tactic.pressing / 100 * 0.62 + urgency * 0.38 - redDisadvantage * 0.05, 0.1, 1)
    const directness = clamp(team.tactic.passingDirectness / 100 * 0.65 + urgency * 0.35, 0.08, 1)
    return { urgency, risk, press, directness }
  }

  private choosePossessionPattern(team: TeamRuntime, transition = false): PossessionPattern {
    if (transition || team.tactic.transition === 'counter' && this.random.chance(.56)) return 'counter'
    if (team.tactic.width >= 62 && this.random.chance(.52)) return 'wide-overlap'
    if (team.tactic.width <= 43 && this.random.chance(.5)) return 'inside-overlap'
    if (team.tactic.passingDirectness <= 42 && this.random.chance(.48)) return 'third-man'
    if (team.tactic.passingDirectness >= 63 && this.random.chance(.42)) return 'switch-play'
    if (team.tactic.mentality === 'defensive' || team.tactic.mentality === 'very-defensive') return 'build-three'
    return this.random.pick<PossessionPattern>(['patient', 'third-man', 'switch-play', 'wide-overlap'])
  }

  private pressureAt(team: TeamRuntime, location: Vector2): number {
    const nearby = team.onPitch
      .filter((item) => item.onPitch && !item.redCard)
      .map((item) => Math.hypot(item.location.x - location.x, item.location.y - location.y))
      .sort((left, right) => left - right)
      .slice(0, 3)
    return clamp(nearby.reduce((sum, distance, index) => sum + Math.max(0, 7.5 - distance) / (7.5 * (index + 1)), 0), 0, 1)
  }

  private passingLaneRisk(team: TeamRuntime, from: Vector2, to: Vector2): number {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared < .2) return 1
    let risk = 0
    for (const player of team.onPitch) {
      if (!player.onPitch || player.redCard) continue
      const projection = clamp(((player.location.x - from.x) * dx + (player.location.y - from.y) * dy) / lengthSquared, .08, .94)
      const point = { x: from.x + dx * projection, y: from.y + dy * projection }
      const distance = Math.hypot(player.location.x - point.x, player.location.y - point.y)
      risk = Math.max(risk, clamp((3.4 - distance) / 3.4, 0, 1) * (.58 + projection * .42))
    }
    return risk
  }

  private updateContextualAI(): void {
    const minute = this.tick / MATCH_TICKS_PER_SECOND / 60
    for (const team of [this.home, this.away]) {
      const opponent = this.getTeam(opposite(team.side))
      const difference = this.score[team.side] - this.score[opposite(team.side)]
      const numericalDisadvantage = team.onPitch.filter((item) => item.onPitch).length < opponent.onPitch.filter((item) => item.onPitch).length
      const active = team.onPitch.filter((item) => item.onPitch)
      const opponents = opponent.onPitch.filter((item) => item.onPitch)
      const fatigue = 100 - active.reduce((sum, item) => sum + item.stamina, 0) / Math.max(1, active.length)
      const opponentFatigue = 100 - opponents.reduce((sum, item) => sum + item.stamina, 0) / Math.max(1, opponents.length)
      const cardExposure = active.reduce((sum, item) => sum + item.yellowCards, 0)
      let desired: TacticalMode = 'balanced'
      if (difference < 0 && minute >= 55) desired = 'chase'
      else if (difference > 0 && minute >= 70) desired = 'protect'
      else if (numericalDisadvantage && difference >= 0) desired = 'protect'
      else if (difference > 0 && fatigue > 42 && minute >= 60) desired = 'protect'
      else if (difference === 0 && opponentFatigue > fatigue + 9 && minute >= 67) desired = 'chase'
      else if (difference === 0 && cardExposure >= 4 && minute >= 76) desired = 'protect'
      else if (this.setup.knockout && difference === 0 && minute >= 82 && team.tactic.mentality === 'attacking') desired = 'chase'
      if (desired === team.tacticalMode) continue
      const previous = team.tacticalMode
      team.tacticalMode = desired
      if (minute < 48 || this.tick - team.lastTacticalShiftTick < 300) continue
      team.lastTacticalShiftTick = this.tick
      const commentary = desired === 'chase'
        ? `${team.nation.shortName} detecta debilidad: adelanta líneas, acelera el ritmo y libera a sus atacantes.`
        : desired === 'protect'
          ? `${team.nation.shortName} lee el desgaste y protege el resultado: bloque más compacto y salidas rápidas.`
          : `${team.nation.shortName} recupera su estructura tras el tramo de máxima urgencia.`
      this.emit('tactical-shift', team.side, undefined, commentary, { outcome: `${previous}-to-${desired}` })
    }
  }

  private currentTension(): number {
    return calculateMatchTension({
      second: this.tick / MATCH_TICKS_PER_SECOND,
      score: this.score,
      knockout: this.setup.knockout,
      momentum: this.possessionRuntime.momentum,
    })
  }

  private phaseProgress(side: Side, location: Vector2): number {
    return clamp(side === 'home' ? location.x / PITCH_LENGTH : 1 - location.x / PITCH_LENGTH, 0, 1)
  }

  private isStar(player: RuntimePlayer, team: TeamRuntime): boolean {
    if (starProfile(player.player)) return true
    const active = team.onPitch.filter((item) => item.onPitch)
    const average = active.reduce((sum, item) => sum + item.player.gameRatings.overall, 0) / Math.max(1, active.length)
    return player.player.gameRatings.overall >= Math.max(84, average + 4)
      || (player.player.hierarchy === 'leader' && player.player.gameRatings.overall >= average + 1)
  }

  private deferNextDecision(minimumTicks: number, maximumTicks: number): void {
    this.nextDecisionTick = this.tick + this.random.int(minimumTicks, maximumTicks)
  }

  private scheduleNextDecision(): void {
    const team = this.getTeam(this.possession)
    const context = this.contextualIntent(team)
    const base = 69 - team.tactic.tempo * 0.22 - context.urgency * 10
    this.deferNextDecision(Math.max(28, Math.round(base - 10)), Math.max(42, Math.round(base + 14)))
  }

  private scheduleOrganicPass(): void {
    const team = this.getTeam(this.possession)
    const opposition = this.getTeam(opposite(this.possession))
    const active = team.onPitch.filter((item) => item.onPitch && !item.redCard)
    let passer = this.findRuntimePlayer(this.ball.possessorId)
    if (!passer || passer.side !== team.side || !passer.onPitch) passer = this.random.pick(active)
    const direction = team.side === 'home' ? 1 : -1
    const context = this.contextualIntent(team)
    const candidates = active.filter((item) => item.playerId !== passer?.playerId)
    if (!candidates.length) return
    const ranked = candidates.map((candidate) => {
      const distance = Math.hypot(candidate.location.x - passer!.location.x, candidate.location.y - passer!.location.y)
      const forward = (candidate.location.x - passer!.location.x) * direction
      const nearestOpponent = this.nearestActivePlayer(opposition, candidate.location)
      const space = nearestOpponent ? Math.hypot(nearestOpponent.location.x - candidate.location.x, nearestOpponent.location.y - candidate.location.y) : 8
      const positionalWeakness = nearestOpponent ? clamp((84 - nearestOpponent.player.gameRatings.overall) / 8, 0, 4.5) : 0
      const profile = starProfile(candidate.player)
      const starDemand = this.isStar(candidate, team) && this.currentTension() > 62
        ? 5 + (profile?.pressure ?? 84) / 28
        : 0
      const forwardValue = forward * (0.35 + context.directness * 0.65)
      const distanceFit = -Math.abs(distance - (8 + context.directness * 13)) * 0.32
      const oppositeWing = Math.abs(candidate.location.y - passer!.location.y) > 25
      const previousCombination = this.lastCompletedPass[team.side]
      const wallReturn = this.possessionRuntime.pattern === 'third-man'
        && previousCombination?.receiverId === passer!.playerId
        && previousCombination.passerId === candidate.playerId
      const patternBonus = wallReturn ? 9.5
        : this.possessionRuntime.pattern === 'wide-overlap' && candidate.intent === 'overlap' ? 8
        : this.possessionRuntime.pattern === 'inside-overlap' && candidate.intent === 'underlap' ? 7.5
          : this.possessionRuntime.pattern === 'third-man' && ['underlap', 'run'].includes(candidate.intent) && this.possessionRuntime.completedPasses >= 1 ? 7
            : this.possessionRuntime.pattern === 'switch-play' && oppositeWing ? 8.5
              : this.possessionRuntime.pattern === 'counter' && forward > 8 ? 6.5
                : this.possessionRuntime.pattern === 'patient' && distance >= 6 && distance <= 16 ? 3.5 : 0
      return {
        candidate,
        score: forwardValue + space * 0.75 + positionalWeakness + distanceFit + starDemand + patternBonus + candidate.player.gameRatings.decisions * 0.035,
      }
    }).sort((left, right) => right.score - left.score || left.candidate.playerId.localeCompare(right.candidate.playerId))
    const top = ranked.slice(0, Math.min(3, ranked.length))
    const receiver = top[this.random.chance(0.64) ? 0 : this.random.int(0, top.length - 1)]!.candidate
    const target = {
      x: clamp(receiver.location.x + receiver.velocity.x * .34 + (receiver.target.x - receiver.location.x) * .18, 1.5, PITCH_LENGTH - 1.5),
      y: clamp(receiver.location.y + receiver.velocity.y * .34 + (receiver.target.y - receiver.location.y) * .18, 1.5, PITCH_WIDTH - 1.5),
    }
    const distance = Math.hypot(target.x - passer.location.x, target.y - passer.location.y)
    const passing = weightedAverage(passer.player.gameRatings, [['passing', 0.5], ['decisions', 0.3], ['technique', 0.2]])
    const nearestPresser = this.nearestActivePlayer(opposition, passer.location)
    const pressureDistance = nearestPresser ? Math.hypot(nearestPresser.location.x - passer.location.x, nearestPresser.location.y - passer.location.y) : 10
    const pressure = clamp((7 - pressureDistance) / 7, 0, 1) * this.contextualIntent(opposition).press
    const receivingPressure = this.pressureAt(opposition, target)
    const laneRisk = this.passingLaneRisk(opposition, passer.location, target)
    const weatherPenalty = this.setup.weather === 'rain' ? 0.018 : this.setup.weather === 'windy' ? distance / 650 : 0
    const successProbability = clamp(0.74 + passing / 390 - distance / 290 - pressure * 0.16 - receivingPressure * .055 - laneRisk * .14 - context.directness * 0.04 - (100 - passer.stamina) / 850 - weatherPenalty, 0.42, 0.95)
    const success = this.random.chance(successProbability)
    const interceptor = success ? undefined : this.nearestActivePlayer(opposition, target)
    const ballSpeed = 15 + passing * 0.075 + context.directness * 4
    const flightTicks = Math.max(3, Math.min(17, Math.round(distance / ballSpeed * MATCH_TICKS_PER_SECOND)))
    const stage = this.possessionRuntime.stage
    const isCross = stage === 'final-third'
      && Math.abs(passer.location.y - PITCH_WIDTH / 2) > 15
      && Math.abs(target.y - PITCH_WIDTH / 2) < 13
      && this.phaseProgress(team.side, target) > 0.68
    const previousCombination = this.lastCompletedPass[team.side]
    const isWallReturn = this.possessionRuntime.pattern === 'third-man'
      && previousCombination?.receiverId === passer.playerId
      && previousCombination.passerId === receiver.playerId
    const patternCommentary = isWallReturn
      ? `${playerName(passer.player)} devuelve de primera: pared limpia y ${playerName(receiver.player)} rompe la primera presión.`
      : this.possessionRuntime.pattern === 'third-man' && receiver.intent === 'underlap'
      ? `${playerName(passer.player)} descarga de cara y activa al tercer hombre: ${playerName(receiver.player)} rompe por dentro.`
      : this.possessionRuntime.pattern === 'wide-overlap' && receiver.intent === 'overlap'
        ? `${playerName(passer.player)} fija al lateral y libera el solapamiento de ${playerName(receiver.player)}.`
        : this.possessionRuntime.pattern === 'switch-play' && Math.abs(target.y - passer.location.y) > 24
          ? `${playerName(passer.player)} cambia el juego hacia ${playerName(receiver.player)} y ataca el lado débil.`
          : this.possessionRuntime.pattern === 'counter' && Math.abs(target.x - passer.location.x) > 15
            ? `${playerName(passer.player)} ve la ruptura y lanza el contraataque hacia ${playerName(receiver.player)}.`
            : undefined
    const commentary = patternCommentary ?? (isCross
      ? `${playerName(passer.player)} gana la banda, levanta la cabeza y pone el balón al corazón del área.`
      : stage === 'final-third'
        ? `${playerName(passer.player)} encuentra a ${playerName(receiver.player)} entre líneas. La grada se levanta.`
      : stage === 'transition'
        ? `${playerName(passer.player)} acelera la transición y busca a ${playerName(receiver.player)} al espacio.`
        : stage === 'progression'
          ? `${playerName(passer.player)} rompe una línea con un pase hacia ${playerName(receiver.player)}.`
          : distance > 24
            ? `${playerName(passer.player)} cambia la orientación para escapar de la presión.`
            : `${playerName(passer.player)} atrae la presión y descarga con ${playerName(receiver.player)}.`)
    this.stats[team.side].passesAttempted += 1
    this.emit(isCross ? 'cross' : 'pass', team.side, passer.playerId, commentary, {
      secondaryPlayerId: receiver.playerId,
      location: { ...passer.location },
      outcome: success ? 'completed' : 'intercepted',
    })
    this.ball.possessorId = undefined
    this.ball.velocity = {
      x: (target.x - this.ball.location.x) / (flightTicks / MATCH_TICKS_PER_SECOND),
      y: (target.y - this.ball.location.y) / (flightTicks / MATCH_TICKS_PER_SECOND),
    }
    this.ball.height = isCross ? 2.2 : distance > 22 ? 1.4 : 0.18
    this.pendingAction = {
      kind: 'pass',
      side: team.side,
      passerId: passer.playerId,
      receiverId: receiver.playerId,
      interceptorId: interceptor?.playerId,
      arrivalTick: this.tick + flightTicks,
      success,
      target,
    }
  }

  private maybeOrganicDribble(): boolean {
    const team = this.getTeam(this.possession)
    const carrier = this.findRuntimePlayer(this.ball.possessorId)
    if (!carrier || carrier.side !== team.side || carrier.position === 'GK') return false
    const context = this.contextualIntent(team)
    const technique = weightedAverage(carrier.player.gameRatings, [['technique', 0.45], ['pace', 0.3], ['decisions', 0.25]])
    const starMoment = this.isStar(carrier, team) && this.currentTension() > 68
    if (!this.random.chance(0.065 + technique / 1_900 + context.risk * 0.035 + (starMoment ? 0.045 : 0))) return false
    const opposition = this.getTeam(opposite(team.side))
    const defender = this.nearestActivePlayer(opposition, carrier.location)
    const defending = defender
      ? weightedAverage(defender.player.gameRatings, [['defending', 0.48], ['positioning', 0.3], ['strength', 0.22]])
      : 45
    const duelSuccess = clamp(0.46 + (technique - defending) / 210 + (defender ? Math.hypot(defender.location.x - carrier.location.x, defender.location.y - carrier.location.y) / 45 : 0.18), 0.28, 0.78)
    if (defender && !this.random.chance(duelSuccess)) {
      this.stats[opposition.side].tacklesWon += 1
      defender.rating += 0.035
      carrier.rating -= 0.018
      this.possession = opposition.side
      this.possessionRuntime = {
        side: opposition.side,
        stage: opposition.tactic.transition === 'counter' ? 'transition' : 'build-up',
        startedTick: this.tick,
        completedPasses: 0,
        momentum: opposition.tactic.transition === 'counter' ? -2 : 0,
        pattern: this.choosePossessionPattern(opposition, opposition.tactic.transition === 'counter'),
        patternStep: 0,
      }
      this.lastCompletedPass[team.side] = undefined
      this.ball.possessorId = defender.playerId
      this.ball.location = { ...defender.location }
      this.ball.velocity = { ...defender.velocity }
      this.emit('tackle', opposition.side, defender.playerId, `${playerName(defender.player)} mide el momento exacto, roba limpio y lanza la contra.`, {
        secondaryPlayerId: carrier.playerId,
        location: { ...carrier.location },
        outcome: 'won',
      })
      return true
    }
    const direction = team.side === 'home' ? 1 : -1
    carrier.target = {
      x: clamp(carrier.location.x + direction * this.random.float(3.5, 7.5), 2, PITCH_LENGTH - 2),
      y: clamp(carrier.location.y + this.random.float(-3, 3), 2, PITCH_WIDTH - 2),
    }
    carrier.nextIntentTick = this.tick + this.random.int(12, 22)
    this.possessionRuntime.momentum = clamp(this.possessionRuntime.momentum + (starMoment ? 4 : 2), -20, 20)
    this.emit('dribble', team.side, carrier.playerId, starMoment
      ? `${playerName(carrier.player)} asume la responsabilidad, rompe la primera marca y enciende el estadio.`
      : `${playerName(carrier.player)} supera a su marcador y hace avanzar la jugada.`, {
      location: { ...carrier.location },
      outcome: 'progressive-carry',
    })
    return true
  }

  private maybeOrganicShot(): boolean {
    const attacking = this.getTeam(this.possession)
    const defending = this.getTeam(opposite(this.possession))
    const shooter = this.findRuntimePlayer(this.ball.possessorId)
    if (!shooter || shooter.side !== attacking.side || shooter.position === 'GK') return false
    const progress = this.phaseProgress(attacking.side, shooter.location)
    if (progress < 0.5) return false
    const context = this.contextualIntent(attacking)
    const phaseChance: Record<MatchAttackPhase, number> = {
      restart: 0.001,
      'build-up': 0.002,
      progression: 0.007,
      'final-third': 0.025,
      transition: 0.018,
    }
    const qualityEdge = (teamQuality(attacking) - teamQuality(defending)) / 1_200
    const profile = starProfile(shooter.player)
    const starMoment = this.isStar(shooter, attacking) && this.currentTension() > 65
    const clutchBoost = profile ? Math.max(0, profile.clutch - 85) / 1_700 : 0
    const hazard = clamp(phaseChance[this.possessionRuntime.stage] + (progress - 0.5) * 0.018 + context.risk * 0.004 + qualityEdge + (starMoment ? 0.005 : 0) + clutchBoost, 0.002, 0.085)
    if (!this.random.chance(hazard)) return false

    const location = { ...shooter.location }
    const distanceFromGoal = attacking.side === 'home' ? PITCH_LENGTH - location.x : location.x
    const centrality = 1 - Math.abs(location.y - PITCH_WIDTH / 2) / (PITCH_WIDTH / 2)
    const baseXg = clamp(0.225 - distanceFromGoal * 0.0062 + centrality * 0.052, 0.018, 0.37)
    const shooterSkill = weightedAverage(shooter.player.gameRatings, [['attack', 0.4], ['technique', 0.2], ['composure', 0.27], ['decisions', 0.13]])
    const xg = clamp(baseXg * (0.66 + shooterSkill / 180) * (0.78 + shooter.stamina / 450), 0.012, 0.58)
    const nearestDefender = this.nearestActivePlayer(defending, location)
    const defenderDistance = nearestDefender ? Math.hypot(nearestDefender.location.x - location.x, nearestDefender.location.y - location.y) : 8
    const blocked = this.random.chance(clamp(0.18 - defenderDistance * 0.018 + defending.tactic.pressing / 1_300, 0.035, 0.24))
    const weatherAccuracy = this.setup.weather === 'windy' ? 0.035 : this.setup.weather === 'rain' ? 0.018 : 0
    const onTargetProbability = clamp(0.27 + shooterSkill / 330 + centrality * 0.09 - distanceFromGoal / 260 - weatherAccuracy, 0.23, 0.7)
    const onTarget = !blocked && this.random.chance(onTargetProbability)
    const goalkeeper = defending.onPitch.find((item) => item.onPitch && item.position === 'GK')
    const keeperSkill = goalkeeper
      ? weightedAverage(goalkeeper.player.gameRatings, [['goalkeeping', 0.62], ['positioning', 0.2], ['composure', 0.18]])
      : 25
    const keeperModifier = clamp(1.13 - keeperSkill / 650, 0.88, 1.08)
    const goal = onTarget && this.random.chance(clamp((xg / onTargetProbability) * keeperModifier + clutchBoost * this.currentTension() / 135, 0.022, 0.72))
    const corner = blocked ? this.random.chance(0.42) : !onTarget && this.random.chance(0.13)
    const review = goal && this.random.chance(0.11)
    const previousPass = this.lastCompletedPass[attacking.side]
    const assistId = previousPass
      && previousPass.receiverId === shooter.playerId
      && previousPass.passerId !== shooter.playerId
      && this.tick - previousPass.tick <= 220
      ? previousPass.passerId
      : undefined
    const target = {
      x: attacking.side === 'home' ? PITCH_LENGTH : 0,
      y: onTarget ? PITCH_WIDTH / 2 + this.random.float(-3.4, 3.4) : clamp(PITCH_WIDTH / 2 + this.random.float(-9, 9), 0, PITCH_WIDTH),
    }
    const flightTicks = Math.max(4, Math.min(9, Math.round(distanceFromGoal / (24 + shooterSkill * 0.08) * MATCH_TICKS_PER_SECOND)))
    this.stats[attacking.side].shots += 1
    this.stats[attacking.side].xg += xg
    shooter.rating += 0.025
    const tension = this.currentTension()
    this.emit('shot', attacking.side, shooter.playerId, starMoment
      ? `¡${playerName(shooter.player)} pide el momento grande y arma el disparo!`
      : tension > 78
        ? `¡Todo el estadio contiene el aliento! ${playerName(shooter.player)} encuentra espacio para rematar.`
        : `${playerName(shooter.player)} finaliza una jugada elaborada desde ${Math.round(distanceFromGoal)} metros.`, {
      location,
      xg: round(xg, 3),
    })
    this.ball.possessorId = undefined
    this.ball.velocity = {
      x: (target.x - location.x) / (flightTicks / MATCH_TICKS_PER_SECOND),
      y: (target.y - location.y) / (flightTicks / MATCH_TICKS_PER_SECOND),
    }
    this.ball.height = 0.35
    this.pendingAction = {
      kind: 'shot',
      side: attacking.side,
      shooterId: shooter.playerId,
      goalkeeperId: goalkeeper?.playerId,
      stage: 'flight',
      arrivalTick: this.tick + flightTicks,
      location,
      xg,
      onTarget,
      blocked,
      goal,
      corner,
      review,
      overturn: review && this.random.chance(0.08),
      assistId,
    }
    return true
  }

  private resolvePendingAction(): void {
    const pending = this.pendingAction
    if (!pending || this.tick < pending.arrivalTick) return
    if (pending.kind === 'pass') {
      this.pendingAction = undefined
      const team = this.getTeam(pending.side)
      const opposition = this.getTeam(opposite(pending.side))
      const passer = this.findRuntimePlayer(pending.passerId)
      const receiver = this.findRuntimePlayer(pending.receiverId)
      if (pending.success && receiver?.onPitch) {
        this.stats[pending.side].passesCompleted += 1
        this.ball.possessorId = receiver.playerId
        this.ball.location = { ...receiver.location }
        this.ball.velocity = { ...receiver.velocity }
        this.ball.height = 0
        this.lastCompletedPass[pending.side] = { passerId: pending.passerId, receiverId: receiver.playerId, tick: this.tick }
        if (passer) passer.rating += 0.002
        this.possessionRuntime.completedPasses += 1
        this.possessionRuntime.patternStep += 1
        const oldStage = this.possessionRuntime.stage
        const progress = this.phaseProgress(pending.side, receiver.location)
        if (progress > 0.67) this.possessionRuntime.stage = 'final-third'
        else if (progress > 0.38 || this.possessionRuntime.completedPasses >= 2) this.possessionRuntime.stage = 'progression'
        else this.possessionRuntime.stage = 'build-up'
        this.possessionRuntime.momentum = clamp(this.possessionRuntime.momentum + (this.possessionRuntime.stage === 'final-third' ? 1.4 : 0.35), -20, 20)
        if (this.possessionRuntime.patternStep >= 4 && this.possessionRuntime.stage !== 'final-third') {
          this.possessionRuntime.pattern = this.choosePossessionPattern(team)
          this.possessionRuntime.patternStep = 0
        }
        if (oldStage !== 'final-third' && this.possessionRuntime.stage === 'final-third' && this.tick - this.lastMomentumEventTick > 280) {
          this.lastMomentumEventTick = this.tick
          this.emit('momentum', pending.side, receiver.playerId, `${team.nation.shortName} instala el ataque cerca del área. Crece el ruido y también la presión.`, {
            location: { ...receiver.location },
            outcome: 'final-third-entry',
          })
        }
        return
      }
      const interceptor = this.findRuntimePlayer(pending.interceptorId) ?? this.nearestActivePlayer(opposition, pending.target)
      if (interceptor) {
        this.stats[opposition.side].tacklesWon += 1
        interceptor.rating += 0.025
        this.possession = opposition.side
        this.possessionRuntime = {
          side: opposition.side,
          stage: opposition.tactic.transition === 'counter' ? 'transition' : 'build-up',
          startedTick: this.tick,
          completedPasses: 0,
          momentum: clamp(-this.possessionRuntime.momentum * 0.45, -20, 20),
          pattern: this.choosePossessionPattern(opposition, opposition.tactic.transition === 'counter'),
          patternStep: 0,
        }
        this.lastCompletedPass[pending.side] = undefined
        this.ball.possessorId = interceptor.playerId
        this.ball.location = { ...interceptor.location }
        this.ball.velocity = { ...interceptor.velocity }
        this.ball.height = 0
        this.emit('interception', opposition.side, interceptor.playerId, `${playerName(interceptor.player)} anticipa, roba y activa la transición.`, {
          secondaryPlayerId: pending.passerId,
          location: { ...interceptor.location },
        })
      } else {
        this.givePossession(opposition.side)
      }
      return
    }
    this.resolvePendingShot(pending)
  }

  private resolvePendingShot(pending: PendingShot): void {
    const attacking = this.getTeam(pending.side)
    const defending = this.getTeam(opposite(pending.side))
    const shooter = this.findRuntimePlayer(pending.shooterId)
    const goalkeeper = this.findRuntimePlayer(pending.goalkeeperId)
    if (pending.stage === 'flight') {
      if (pending.blocked) {
        this.emit('shot-blocked', pending.side, pending.shooterId, 'La defensa se lanza al suelo y bloquea el remate.', {
          secondaryPlayerId: this.nearestActivePlayer(defending, pending.location)?.playerId,
          location: pending.location,
          xg: round(pending.xg, 3),
        })
        this.pendingAction = undefined
        if (pending.corner) {
          this.stats[pending.side].corners += 1
          this.emit('corner', pending.side, pending.shooterId, `Córner para ${attacking.nation.shortName}; el estadio vuelve a apretar.`, { location: pending.location })
          this.givePossession(pending.side)
        } else this.givePossession(defending.side)
        return
      }
      if (!pending.onTarget) {
        this.emit('shot-off-target', pending.side, pending.shooterId, pending.xg > 0.18
          ? '¡Se marcha por centímetros! Era una ocasión enorme.'
          : 'El remate sale desviado y la defensa recupera el aliento.', {
          location: pending.location,
          xg: round(pending.xg, 3),
        })
        this.pendingAction = undefined
        if (pending.corner) {
          this.stats[pending.side].corners += 1
          this.emit('corner', pending.side, pending.shooterId, `El desvío concede un córner a ${attacking.nation.shortName}.`, { location: pending.location })
          this.givePossession(pending.side)
        } else this.givePossession(defending.side)
        return
      }
      this.stats[pending.side].shotsOnTarget += 1
      this.emit('shot-on-target', pending.side, pending.shooterId, '¡El balón viaja entre los tres palos!', {
        location: pending.location,
        xg: round(pending.xg, 3),
      })
      pending.stage = 'keeper'
      pending.arrivalTick = this.tick + this.random.int(2, 4)
      this.ball.velocity = { x: 0, y: 0 }
      return
    }
    if (pending.stage === 'keeper') {
      if (!pending.goal) {
        if (goalkeeper) {
          this.stats[defending.side].saves += 1
          goalkeeper.rating += 0.075 + pending.xg * 0.15
          this.emit('save', defending.side, goalkeeper.playerId, pending.xg > 0.2
            ? `¡Parada monumental de ${playerName(goalkeeper.player)} cuando el gol parecía inevitable!`
            : `${playerName(goalkeeper.player)} asegura el remate con autoridad.`, {
            secondaryPlayerId: pending.shooterId,
            location: { ...goalkeeper.location },
            xg: round(pending.xg, 3),
          })
        }
        this.pendingAction = undefined
        this.givePossession(defending.side)
        return
      }
      this.awardGoal(pending, shooter, goalkeeper)
      if (pending.review) {
        this.emit('var-check', pending.side, pending.shooterId, 'Silencio tenso: el VAR revisa el origen de la jugada.', { location: pending.location })
        pending.stage = 'review'
        pending.arrivalTick = this.tick + this.random.int(18, 36)
        return
      }
      this.pendingAction = undefined
      this.givePossession(defending.side, true)
      return
    }
    if (pending.overturn) {
      this.score[pending.side] -= 1
      this.stats[pending.side].goals -= 1
      if (shooter) shooter.rating -= 0.68
      this.emit('var-overturn', pending.side, pending.shooterId, 'El VAR anula el gol. Del delirio al silencio en cuestión de segundos.', {
        location: pending.location,
        outcome: 'goal-overturned',
      })
    } else {
      this.emit('var-confirmed', pending.side, pending.shooterId, '¡Gol confirmado! El rugido vuelve a sacudir el estadio.', {
        location: pending.location,
        outcome: 'goal-confirmed',
      })
    }
    this.pendingAction = undefined
    this.givePossession(defending.side, true)
  }

  private awardGoal(pending: PendingShot, shooter: RuntimePlayer | undefined, goalkeeper: RuntimePlayer | undefined): void {
    const attacking = this.getTeam(pending.side)
    const wasTrailing = this.score[pending.side] < this.score[opposite(pending.side)]
    this.score[pending.side] += 1
    this.stats[pending.side].goals += 1
    if (shooter) shooter.rating += 0.72
    if (goalkeeper) goalkeeper.rating -= 0.18
    const nowLeading = this.score[pending.side] > this.score[opposite(pending.side)]
    const nowLevel = this.score[pending.side] === this.score[opposite(pending.side)]
    const late = this.tick / MATCH_TICKS_PER_SECOND / 60 >= 75
    const star = shooter ? this.isStar(shooter, attacking) : false
    const profile = shooter ? starProfile(shooter.player) : undefined
    const name = shooter ? playerName(shooter.player) : attacking.nation.shortName
    const commentary = late && this.setup.knockout && nowLeading
      ? `¡GOL QUE PUEDE CAMBIAR EL DESTINO DEL TORNEO! ${name} adelanta a ${attacking.nation.shortName}.`
      : late && wasTrailing && nowLevel
        ? `¡DELIRIO! ${name} rescata a ${attacking.nation.shortName} cuando el tiempo se agotaba.`
        : star
          ? `¡APARECE ${profile?.billing?.toUpperCase() ?? 'LA ESTRELLA'}! ${name} convierte la presión en un gol gigantesco para ${attacking.nation.shortName}.`
          : `¡GOOOL de ${name}! Una jugada con paciencia, ruptura y una definición implacable.`
    this.possessionRuntime.momentum = clamp(this.possessionRuntime.momentum + 8, -20, 20)
    this.emit('goal', pending.side, pending.shooterId, commentary, {
      secondaryPlayerId: pending.assistId,
      location: pending.location,
      xg: round(pending.xg, 3),
    })
  }

  private maybeFoul(): boolean {
    const defending = this.getTeam(opposite(this.possession))
    const aggressionFactor = defending.tactic.pressing / 100
    if (!this.random.chance(0.011 + aggressionFactor * 0.011)) return false
    const offenders = defending.onPitch.filter((item) => item.onPitch && !item.redCard)
    const victimTeam = this.getTeam(this.possession)
    const victims = victimTeam.onPitch.filter((item) => item.onPitch && !item.redCard)
    if (!offenders.length || !victims.length) return false
    const offender = this.random.pick(offenders)
    const victim = this.findRuntimePlayer(this.ball.possessorId) ?? this.random.pick(victims)
    const location = { ...this.ball.location }
    this.stats[defending.side].fouls += 1
    this.emit('foul', defending.side, offender.playerId, `Falta de ${playerName(offender.player)} sobre ${playerName(victim.player)}.`, {
      secondaryPlayerId: victim.playerId,
      location,
    })

    const severity = this.random.next()
    if (severity < 0.16) {
      offender.yellowCards += 1
      this.stats[defending.side].yellowCards += 1
      offender.rating -= 0.08
      this.emit('yellow-card', defending.side, offender.playerId, `Tarjeta amarilla para ${playerName(offender.player)}.`, { location })
      if (offender.yellowCards >= 2) this.sendOff(offender, 'Segunda amarilla: queda expulsado.', 'second-yellow')
    } else if (severity > 0.985) {
      this.sendOff(offender, `Roja directa para ${playerName(offender.player)}.`, 'direct-red')
    } else if (severity > 0.55 && this.random.chance(0.28)) {
      this.emit('advantage', victimTeam.side, victim.playerId, 'El árbitro aplica la ley de la ventaja.', { location })
    } else {
      this.emit('free-kick', victimTeam.side, victim.playerId, `Libre directo para ${victimTeam.nation.shortName}.`, { location })
    }
    return true
  }

  private maybeOffside(): boolean {
    if (this.possessionRuntime.stage !== 'final-third') return false
    if (!this.random.chance(0.007 + this.getTeam(this.possession).tactic.passingDirectness / 18_000)) return false
    const team = this.getTeam(this.possession)
    const forwards = team.onPitch.filter((item) => item.onPitch && ['ST', 'SS', 'RW', 'LW', 'AM'].includes(item.position))
    if (!forwards.length) return false
    const player = this.random.pick(forwards)
    this.stats[team.side].offsides += 1
    this.emit('offside', team.side, player.playerId, `Fuera de juego de ${playerName(player.player)}.`, { location: { ...player.location } })
    this.givePossession(opposite(team.side))
    return true
  }

  private maybeInjury(): boolean {
    const active = [...this.home.onPitch, ...this.away.onPitch].filter((item) => item.onPitch && !item.injured && !item.redCard)
    const workload = active.length
      ? active.reduce((sum, item) => sum + item.player.fatigue * 0.58 + (100 - item.stamina) * 0.42, 0) / active.length
      : 0
    const heatCost = this.setup.weather === 'hot' ? 0.00013 : 0
    const injuryHazard = clamp(0.00035 + workload / 100 * 0.00075 + heatCost, 0.0003, 0.00125)
    if (!this.random.chance(injuryHazard)) return false
    const team = this.random.chance(0.5) ? this.home : this.away
    const candidates = team.onPitch.filter((item) => item.onPitch && !item.injured && !item.redCard)
    if (!candidates.length) return false
    const player = this.random.pick(candidates)
    const cannotContinue = this.random.chance(0.4)
    const concussion = this.random.chance(0.08)
    player.injured = true
    player.rating -= 0.06
    this.emit('injury', team.side, player.playerId, cannotContinue
      ? `${playerName(player.player)} no puede continuar${concussion ? ' por protocolo de conmoción' : ''}.`
      : `${playerName(player.player)} recibe atención y parece que podrá seguir.`, {
      location: { ...player.location },
      outcome: concussion ? 'concussion' : cannotContinue ? 'cannot-continue' : 'minor',
    })
    if (cannotContinue) {
      const replacement = this.bestReplacement(team, player)
      if (replacement) this.makeSubstitution(team.side, player.playerId, replacement.id, !concussion, concussion)
    }
    return true
  }

  private sendOff(player: RuntimePlayer, commentary: string, outcome: 'second-yellow' | 'direct-red'): void {
    if (player.redCard) return
    player.redCard = true
    player.onPitch = false
    player.rating -= 0.45
    this.stats[player.side].redCards += 1
    this.emit('red-card', player.side, player.playerId, commentary, { location: { ...player.location }, outcome })
    if (this.ball.possessorId === player.playerId) this.givePossession(opposite(player.side))
  }

  private maybeAutomaticSubstitutions(): void {
    const elapsedMinute = this.tick / MATCH_TICKS_PER_SECOND / 60
    const windows: Array<[number, number]> = [[56, 1], [68, 2], [79, 3], [106, 4]]
    for (const team of [this.home, this.away]) {
      const context = this.contextualIntent(team)
      for (const [minute, window] of windows) {
        if (elapsedMinute < minute || team.automaticWindowsUsed.has(window)) continue
        const normalLimit = this.wentToExtraTime ? 6 : 5
        if (team.substitutions >= normalLimit || (window <= 3 && team.substitutionWindows >= 3)) {
          team.automaticWindowsUsed.add(window)
          continue
        }
        const candidates = team.onPitch
          .filter((item) => item.onPitch && item.position !== 'GK')
          .sort((left, right) => {
            const leftNeed = (100 - left.stamina) * 0.65 + (6.7 - left.rating) * 9
              + (team.tacticalMode === 'chase' ? 100 - left.player.gameRatings.attack : 100 - left.player.gameRatings.defending) * 0.12
            const rightNeed = (100 - right.stamina) * 0.65 + (6.7 - right.rating) * 9
              + (team.tacticalMode === 'chase' ? 100 - right.player.gameRatings.attack : 100 - right.player.gameRatings.defending) * 0.12
            return rightNeed - leftNeed
          })
        const tired = candidates[0]
        const threshold = context.urgency > 0.72 ? 75 : window < 3 ? 67 : 82
        if (!tired || (tired.stamina > threshold && tired.rating >= 6.45)) continue
        const replacement = this.bestReplacement(team, tired)
        if (replacement && this.makeSubstitution(team.side, tired.playerId, replacement.id, true)) team.automaticWindowsUsed.add(window)
      }
    }
  }

  private bestReplacement(team: TeamRuntime, outgoing: RuntimePlayer): Player | undefined {
    const context = this.contextualIntent(team)
    return [...team.bench]
      .filter((player) => !player.suspendedMatches && (!player.injury || player.injury.canContinue))
      .sort((left, right) => {
        const leftScore = playerImpact(left) * positionCompatibility(left, outgoing.position)
          + left.gameRatings.attack * context.risk * 0.16
          + left.gameRatings.defending * (1 - context.risk) * 0.13
          + left.gameRatings.pace * context.urgency * 0.07
        const rightScore = playerImpact(right) * positionCompatibility(right, outgoing.position)
          + right.gameRatings.attack * context.risk * 0.16
          + right.gameRatings.defending * (1 - context.risk) * 0.13
          + right.gameRatings.pace * context.urgency * 0.07
        return rightScore - leftScore || left.id.localeCompare(right.id)
      })[0]
  }

  private makeSubstitution(
    side: Side,
    playerOutId: EntityId,
    playerInId: EntityId,
    countWindow: boolean,
    concussion = false,
  ): boolean {
    const team = this.getTeam(side)
    const outgoing = team.onPitch.find((item) => item.playerId === playerOutId && item.onPitch)
    const replacementIndex = team.bench.findIndex((item) => item.id === playerInId)
    if (!outgoing || replacementIndex < 0) return false
    const allowedNormal = this.wentToExtraTime ? 6 : 5
    if (concussion ? team.concussionSubstitutions >= 1 : team.substitutions >= allowedNormal) return false
    const allowedWindows = this.wentToExtraTime ? 4 : 3
    const opensWindow = !concussion && countWindow && team.lastSubstitutionWindowTick !== this.tick
    if (opensWindow && team.substitutionWindows >= allowedWindows) return false
    const replacement = team.bench[replacementIndex]!
    if (replacement.suspendedMatches || (replacement.injury && !replacement.injury.canContinue)) return false

    outgoing.onPitch = false
    const runtime: RuntimePlayer = {
      ...outgoing,
      player: replacement,
      playerId: replacement.id,
      shirtNumber: replacement.shirtNumber ?? outgoing.shirtNumber,
      stamina: clamp(replacement.condition || 100, 1, 100),
      rating: 6.5,
      yellowCards: 0,
      redCard: false,
      injured: false,
      onPitch: true,
      velocity: { x: 0, y: 0 },
      location: { ...outgoing.location },
      anchor: { ...outgoing.anchor },
      target: { ...outgoing.anchor },
      nextIntentTick: this.tick + 3 + Math.floor(outgoing.motionBias * 7),
      settleUntilTick: this.tick + 4,
      intent: 'recover',
    }
    team.onPitch.push(runtime)
    team.bench.splice(replacementIndex, 1)
    team.bench.push(outgoing.player)
    if (concussion) team.concussionSubstitutions += 1
    else team.substitutions += 1
    if (opensWindow) {
      team.substitutionWindows += 1
      team.lastSubstitutionWindowTick = this.tick
    }
    this.stats[side].substitutions += 1
    this.emit('substitution', side, replacement.id, `Entra ${playerName(replacement)} y sale ${playerName(outgoing.player)}.`, {
      secondaryPlayerId: outgoing.playerId,
      outcome: concussion ? 'concussion-substitution' : 'normal',
    })
    if (this.ball.possessorId === outgoing.playerId) this.ball.possessorId = runtime.playerId
    return true
  }

  private runPenaltyShootout(): void {
    this.wentToPenalties = true
    this.phase = 'penalty-shootout'
    this.score.penalties = { home: 0, away: 0 }
    this.emit('period-start', undefined, undefined, 'Todo el estadio en pie. El pase se decidirá desde el punto de penalti.')
    const takers = {
      home: this.penaltyTakers(this.home),
      away: this.penaltyTakers(this.away),
    }
    let round = 0
    while (round < 5 || this.score.penalties.home === this.score.penalties.away) {
      for (const side of ['home', 'away'] as const) {
        this.tick += this.random.int(32, 52)
        const taker = takers[side][round % takers[side].length]!
        const keeper = this.getTeam(opposite(side)).onPitch.find((item) => item.onPitch && item.position === 'GK')
        const takerProfile = starProfile(taker.player)
        const keeperProfile = keeper ? starProfile(keeper.player) : undefined
        const scoring = weightedAverage(taker.player.gameRatings, [['setPieces', 0.45], ['composure', 0.35], ['technique', 0.2]])
        const saving = keeper?.player.gameRatings.goalkeeping ?? 45
        const clutch = takerProfile ? (takerProfile.clutch - 85) / 500 : 0
        const keeperClutch = keeperProfile ? (keeperProfile.clutch - 85) / 600 : 0
        const converted = this.random.chance(clamp(0.66 + scoring / 500 - saving / 900 + clutch - keeperClutch, 0.6, 0.92))
        if (converted) this.score.penalties[side] += 1
        const suddenDeath = round >= 5
        this.emit(converted ? 'penalty-scored' : 'penalty-missed', side, taker.playerId, converted
          ? suddenDeath
            ? `${playerName(taker.player)} soporta una presión insoportable y marca en la muerte súbita.`
            : `${playerName(taker.player)} respira, engaña al portero y convierte.`
          : suddenDeath
            ? `¡Drama absoluto! ${playerName(taker.player)} falla en la muerte súbita.`
            : `${playerName(taker.player)} no puede convertir; la tensión se dispara.`, {
          secondaryPlayerId: keeper?.playerId,
          outcome: converted ? 'scored' : 'missed',
        })

        if (round < 5) {
          const remainingHome = 4 - round
          const remainingAway = 5 - round - (side === 'away' ? 1 : 0)
          if (this.score.penalties.home > this.score.penalties.away + remainingAway
            || this.score.penalties.away > this.score.penalties.home + remainingHome) return
        }
      }
      round += 1
      if (round >= 5 && this.score.penalties.home !== this.score.penalties.away) return
      if (round >= 20) {
        const winner = this.random.chance(0.5) ? 'home' : 'away'
        this.score.penalties[winner] += 1
        return
      }
    }
  }

  private penaltyTakers(team: TeamRuntime): RuntimePlayer[] {
    const active = team.onPitch.filter((item) => item.onPitch && !item.redCard)
    const preferred = team.tactic.penaltyTakerIds
      .map((id) => active.find((item) => item.playerId === id))
      .filter((item): item is RuntimePlayer => Boolean(item))
    const remaining = active
      .filter((item) => !preferred.includes(item))
      .sort((left, right) => right.player.gameRatings.setPieces - left.player.gameRatings.setPieces)
    return [...preferred, ...remaining]
  }

  private givePossession(side: Side, centre = false): void {
    const retainsFinalThird = !centre && side === this.possession && this.possessionRuntime.stage === 'final-third'
    this.lastCompletedPass[opposite(side)] = undefined
    if (centre) this.lastCompletedPass[side] = undefined
    this.possession = side
    const team = this.getTeam(side)
    const candidates = team.onPitch.filter((item) => item.onPitch && !item.redCard)
    const preferred = candidates.filter((item) => centre
      ? ['ST', 'SS', 'AM', 'CM'].includes(item.position)
      : retainsFinalThird
        ? team.tactic.cornerTakerIds.includes(item.playerId) || ['RW', 'LW', 'RM', 'LM'].includes(item.position)
        : item.position === 'GK')
    const receiver = this.random.pick(preferred.length ? preferred : candidates)
    if (centre) receiver.location = { x: PITCH_LENGTH / 2 + (side === 'home' ? -0.6 : 0.6), y: PITCH_WIDTH / 2 }
    this.ball.possessorId = receiver.playerId
    this.ball.location = { ...receiver.location }
    this.ball.velocity = { x: 0, y: 0 }
    this.ball.height = 0
    this.possessionRuntime = {
      side,
      stage: centre ? 'restart' : retainsFinalThird ? 'final-third' : 'build-up',
      startedTick: this.tick,
      completedPasses: 0,
      momentum: retainsFinalThird ? clamp(this.possessionRuntime.momentum * 0.7, -20, 20) : 0,
      pattern: this.choosePossessionPattern(team, !centre && team.tactic.transition === 'counter'),
      patternStep: 0,
    }
    this.nextDecisionTick = Math.max(this.nextDecisionTick, this.tick + (centre ? 24 : 16))
  }

  private nearestActivePlayer(team: TeamRuntime, location: Vector2): RuntimePlayer | undefined {
    return team.onPitch
      .filter((item) => item.onPitch && !item.redCard)
      .sort((left, right) => {
        const leftDistance = Math.hypot(left.location.x - location.x, left.location.y - location.y)
        const rightDistance = Math.hypot(right.location.x - location.x, right.location.y - location.y)
        return leftDistance - rightDistance
      })[0]
  }

  private findRuntimePlayer(id: EntityId | undefined): RuntimePlayer | undefined {
    if (!id) return undefined
    return [...this.home.onPitch, ...this.away.onPitch].find((item) => item.playerId === id && item.onPitch)
  }

  private getTeam(side: Side): TeamRuntime {
    return side === 'home' ? this.home : this.away
  }

  private emit(
    type: MatchEventType,
    side: Side | undefined,
    playerId: EntityId | undefined,
    commentary: string,
    extra: Partial<Omit<MatchEvent, 'id' | 'tick' | 'second' | 'type' | 'side' | 'playerId' | 'commentary' | 'score'>> = {},
  ): void {
    this.events.push({
      id: `${this.setup.id}-event-${this.events.length + 1}`,
      tick: this.tick,
      second: round(this.tick / MATCH_TICKS_PER_SECOND, 1),
      type,
      side,
      playerId,
      commentary: `${displayedMinute(this.tick / MATCH_TICKS_PER_SECOND)}' ${commentary}`,
      score: cloneScore(this.score),
      ...extra,
    })
  }

  private captureSnapshot(): void {
    this.snapshots.push(this.makeSnapshot())
  }

  private publicPlayerState(item: RuntimePlayer): MatchPlayerState {
    return {
      playerId: item.playerId,
      nationId: item.nationId,
      side: item.side,
      position: item.position,
      shirtNumber: item.shirtNumber,
      location: { ...item.location },
      velocity: { ...item.velocity },
      target: { ...item.target },
      orientation: round(item.orientation, 3),
      movementIntent: item.intent,
      stamina: round(item.stamina, 1),
      rating: round(clamp(item.rating, 3, 10), 1),
      yellowCards: item.yellowCards,
      redCard: item.redCard,
      injured: item.injured,
      onPitch: item.onPitch,
    }
  }

  private makeSnapshot(): MatchSnapshot {
    return {
      tick: this.tick,
      second: round(this.tick / MATCH_TICKS_PER_SECOND, 1),
      phase: this.phase,
      score: cloneScore(this.score),
      ball: {
        location: { ...this.ball.location },
        velocity: { ...this.ball.velocity },
        height: round(this.ball.height, 2),
        possessorId: this.ball.possessorId,
      },
      players: [...this.home.onPitch, ...this.away.onPitch].map((item) => this.publicPlayerState(item)),
      referee: { ...this.referee },
      stats: cloneStats(this.stats),
      possession: this.possession,
      attackPhase: this.possessionRuntime.stage,
      attackPattern: this.possessionRuntime.pattern,
      patternStep: this.possessionRuntime.patternStep,
      momentum: round(this.possessionRuntime.momentum, 1),
      tension: this.currentTension(),
      latestEventId: this.events.at(-1)?.id,
    }
  }
}

export function createMatch(setup: MatchSetup): MatchEngine {
  return new MatchEngine(setup)
}

export function simulateMatch(setup: MatchSetup): SimulationResult {
  return createMatch(setup).runToEnd()
}
