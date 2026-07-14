import type {
  FormationName,
  FormationSlot,
  Nation,
  Player,
  Position,
  TacticPlan,
} from '../domain'

type TemplateSlot = readonly [Position, number, number, FormationSlot['duty']]

const FORMATION_TEMPLATES: Record<FormationName, readonly TemplateSlot[]> = {
  '4-3-3': [
    ['GK', 0.07, 0.5, 'defend'], ['RB', 0.25, 0.85, 'support'], ['RCB', 0.2, 0.62, 'defend'],
    ['LCB', 0.2, 0.38, 'defend'], ['LB', 0.25, 0.15, 'support'], ['DM', 0.42, 0.5, 'defend'],
    ['RCM', 0.52, 0.7, 'support'], ['LCM', 0.52, 0.3, 'support'], ['RW', 0.75, 0.82, 'attack'],
    ['LW', 0.75, 0.18, 'attack'], ['ST', 0.82, 0.5, 'attack'],
  ],
  '4-2-3-1': [
    ['GK', 0.07, 0.5, 'defend'], ['RB', 0.25, 0.85, 'support'], ['RCB', 0.2, 0.62, 'defend'],
    ['LCB', 0.2, 0.38, 'defend'], ['LB', 0.25, 0.15, 'support'], ['RCM', 0.42, 0.65, 'defend'],
    ['LCM', 0.42, 0.35, 'defend'], ['RW', 0.66, 0.82, 'attack'], ['AM', 0.65, 0.5, 'support'],
    ['LW', 0.66, 0.18, 'attack'], ['ST', 0.82, 0.5, 'attack'],
  ],
  '4-4-2': [
    ['GK', 0.07, 0.5, 'defend'], ['RB', 0.24, 0.85, 'support'], ['RCB', 0.2, 0.62, 'defend'],
    ['LCB', 0.2, 0.38, 'defend'], ['LB', 0.24, 0.15, 'support'], ['RM', 0.5, 0.84, 'support'],
    ['RCM', 0.46, 0.62, 'support'], ['LCM', 0.46, 0.38, 'support'], ['LM', 0.5, 0.16, 'support'],
    ['ST', 0.78, 0.62, 'attack'], ['ST', 0.78, 0.38, 'attack'],
  ],
  '4-1-4-1': [
    ['GK', 0.07, 0.5, 'defend'], ['RB', 0.24, 0.85, 'support'], ['RCB', 0.2, 0.62, 'defend'],
    ['LCB', 0.2, 0.38, 'defend'], ['LB', 0.24, 0.15, 'support'], ['DM', 0.38, 0.5, 'defend'],
    ['RM', 0.56, 0.84, 'support'], ['RCM', 0.53, 0.62, 'support'], ['LCM', 0.53, 0.38, 'support'],
    ['LM', 0.56, 0.16, 'support'], ['ST', 0.8, 0.5, 'attack'],
  ],
  '4-3-1-2': [
    ['GK', 0.07, 0.5, 'defend'], ['RB', 0.24, 0.85, 'support'], ['RCB', 0.2, 0.62, 'defend'],
    ['LCB', 0.2, 0.38, 'defend'], ['LB', 0.24, 0.15, 'support'], ['DM', 0.4, 0.5, 'defend'],
    ['RCM', 0.5, 0.7, 'support'], ['LCM', 0.5, 0.3, 'support'], ['AM', 0.64, 0.5, 'attack'],
    ['ST', 0.8, 0.63, 'attack'], ['ST', 0.8, 0.37, 'attack'],
  ],
  '3-4-3': [
    ['GK', 0.07, 0.5, 'defend'], ['RCB', 0.2, 0.72, 'defend'], ['CB', 0.18, 0.5, 'defend'],
    ['LCB', 0.2, 0.28, 'defend'], ['RWB', 0.45, 0.88, 'support'], ['RCM', 0.43, 0.62, 'support'],
    ['LCM', 0.43, 0.38, 'support'], ['LWB', 0.45, 0.12, 'support'], ['RW', 0.73, 0.8, 'attack'],
    ['ST', 0.8, 0.5, 'attack'], ['LW', 0.73, 0.2, 'attack'],
  ],
  '3-4-2-1': [
    ['GK', 0.07, 0.5, 'defend'], ['RCB', 0.2, 0.72, 'defend'], ['CB', 0.18, 0.5, 'defend'],
    ['LCB', 0.2, 0.28, 'defend'], ['RWB', 0.45, 0.88, 'support'], ['RCM', 0.43, 0.62, 'support'],
    ['LCM', 0.43, 0.38, 'support'], ['LWB', 0.45, 0.12, 'support'], ['RW', 0.66, 0.67, 'attack'],
    ['LW', 0.66, 0.33, 'attack'], ['ST', 0.82, 0.5, 'attack'],
  ],
  '3-5-2': [
    ['GK', 0.07, 0.5, 'defend'], ['RCB', 0.2, 0.72, 'defend'], ['CB', 0.18, 0.5, 'defend'],
    ['LCB', 0.2, 0.28, 'defend'], ['RWB', 0.46, 0.88, 'support'], ['RCM', 0.5, 0.66, 'support'],
    ['DM', 0.4, 0.5, 'defend'], ['LCM', 0.5, 0.34, 'support'], ['LWB', 0.46, 0.12, 'support'],
    ['ST', 0.8, 0.62, 'attack'], ['ST', 0.8, 0.38, 'attack'],
  ],
  '5-3-2': [
    ['GK', 0.07, 0.5, 'defend'], ['RWB', 0.3, 0.9, 'support'], ['RCB', 0.2, 0.7, 'defend'],
    ['CB', 0.18, 0.5, 'defend'], ['LCB', 0.2, 0.3, 'defend'], ['LWB', 0.3, 0.1, 'support'],
    ['RCM', 0.48, 0.7, 'support'], ['CM', 0.45, 0.5, 'defend'], ['LCM', 0.48, 0.3, 'support'],
    ['ST', 0.78, 0.62, 'attack'], ['ST', 0.78, 0.38, 'attack'],
  ],
  '5-4-1': [
    ['GK', 0.07, 0.5, 'defend'], ['RWB', 0.3, 0.9, 'support'], ['RCB', 0.2, 0.7, 'defend'],
    ['CB', 0.18, 0.5, 'defend'], ['LCB', 0.2, 0.3, 'defend'], ['LWB', 0.3, 0.1, 'support'],
    ['RM', 0.52, 0.82, 'support'], ['RCM', 0.46, 0.62, 'support'], ['LCM', 0.46, 0.38, 'support'],
    ['LM', 0.52, 0.18, 'support'], ['ST', 0.79, 0.5, 'attack'],
  ],
}

const POSITION_GROUPS: Record<Position, readonly Position[]> = {
  GK: ['GK'], RB: ['RB', 'RWB', 'RCB'], RCB: ['RCB', 'CB', 'RB'], CB: ['CB', 'RCB', 'LCB'],
  LCB: ['LCB', 'CB', 'LB'], LB: ['LB', 'LWB', 'LCB'], RWB: ['RWB', 'RB', 'RM'], LWB: ['LWB', 'LB', 'LM'],
  DM: ['DM', 'CM', 'RCM', 'LCM'], RCM: ['RCM', 'CM', 'DM', 'RM'], CM: ['CM', 'RCM', 'LCM', 'DM'],
  LCM: ['LCM', 'CM', 'DM', 'LM'], RM: ['RM', 'RW', 'RWB', 'RCM'], AM: ['AM', 'SS', 'CM'],
  LM: ['LM', 'LW', 'LWB', 'LCM'], RW: ['RW', 'RM', 'SS', 'ST'], LW: ['LW', 'LM', 'SS', 'ST'],
  SS: ['SS', 'AM', 'ST', 'RW', 'LW'], ST: ['ST', 'SS', 'RW', 'LW'],
}

export function createFormationSlots(formation: FormationName): FormationSlot[] {
  return FORMATION_TEMPLATES[formation].map(([position, x, y, duty], index) => ({
    id: `${formation}-${index + 1}`,
    position,
    x,
    y,
    duty,
  }))
}

export function createDefaultTactic(
  formation: FormationName = '4-3-3',
  overrides: Partial<Omit<TacticPlan, 'formation' | 'slots'>> = {},
): TacticPlan {
  return {
    id: overrides.id ?? `tactic-${formation}`,
    name: overrides.name ?? `Plan ${formation}`,
    formation,
    mentality: overrides.mentality ?? 'balanced',
    width: overrides.width ?? 50,
    tempo: overrides.tempo ?? 50,
    passingDirectness: overrides.passingDirectness ?? 50,
    pressing: overrides.pressing ?? 50,
    defensiveLine: overrides.defensiveLine ?? 50,
    transition: overrides.transition ?? 'balanced',
    marking: overrides.marking ?? 'zonal',
    captainId: overrides.captainId,
    penaltyTakerIds: overrides.penaltyTakerIds ?? [],
    freeKickTakerIds: overrides.freeKickTakerIds ?? [],
    cornerTakerIds: overrides.cornerTakerIds ?? [],
    slots: createFormationSlots(formation),
  }
}

export function positionCompatibility(player: Player, position: Position): number {
  const playerPositions = new Set([player.primaryPosition, ...player.realStats.positions])
  if (playerPositions.has(position)) return 1
  const alternatives = POSITION_GROUPS[position]
  const alternativeIndex = alternatives.findIndex((item) => playerPositions.has(item))
  if (alternativeIndex >= 0) return Math.max(0.58, 0.88 - alternativeIndex * 0.08)
  if (position === 'GK' || player.primaryPosition === 'GK') return 0.05
  return 0.35
}

function fitnessScore(player: Player): number {
  const unavailable = player.injury && !player.injury.canContinue ? 0.15 : 1
  return unavailable * (
    player.gameRatings.overall * 0.68
    + player.condition * 0.15
    + player.form * 0.08
    + player.morale * 0.05
    + player.sharpness * 0.04
    - player.fatigue * 0.12
  )
}

export function autoAssignLineup(tactic: TacticPlan, players: readonly Player[]): TacticPlan {
  const available = players.filter((player) => !player.suspendedMatches && (!player.injury || player.injury.canContinue))
  const used = new Set<string>()
  const orderedSlots = [...tactic.slots].sort((left, right) => Number(right.position === 'GK') - Number(left.position === 'GK'))
  const assignments = new Map<string, string>()

  for (const slot of orderedSlots) {
    const selected = available
      .filter((player) => !used.has(player.id))
      .map((player) => ({ player, score: fitnessScore(player) * positionCompatibility(player, slot.position) }))
      .sort((left, right) => right.score - left.score || left.player.id.localeCompare(right.player.id))[0]?.player
    if (selected) {
      used.add(selected.id)
      assignments.set(slot.id, selected.id)
    }
  }

  return {
    ...tactic,
    slots: tactic.slots.map((slot) => ({ ...slot, playerId: assignments.get(slot.id) })),
  }
}

export function selectMatchSquad(nation: Nation, requested?: readonly Player[]): Player[] {
  const pool = requested?.length ? [...requested] : nation.players.filter((player) => player.selected || player.officialPreset)
  const unique = [...new Map(pool.map((player) => [player.id, player])).values()]
  const eligible = unique.filter((player) => !player.suspendedMatches && (!player.injury || player.injury.canContinue))
  const sorted = [...eligible].sort((left, right) => fitnessScore(right) - fitnessScore(left) || left.id.localeCompare(right.id))
  const goalkeepers = sorted.filter((player) => player.primaryPosition === 'GK').slice(0, 3)
  const mandatoryIds = new Set(goalkeepers.map((player) => player.id))
  const remaining = sorted.filter((player) => !mandatoryIds.has(player.id)).slice(0, Math.max(0, 26 - goalkeepers.length))
  return [...goalkeepers, ...remaining].slice(0, 26)
}

export interface SquadValidation {
  valid: boolean
  errors: string[]
}

export function validateTournamentSquad(players: readonly Player[]): SquadValidation {
  const errors: string[] = []
  if (players.length !== 26) errors.push('La convocatoria debe contener exactamente 26 futbolistas.')
  if (new Set(players.map((player) => player.id)).size !== players.length) errors.push('La convocatoria contiene futbolistas duplicados.')
  if (players.filter((player) => player.primaryPosition === 'GK').length < 3) errors.push('La convocatoria necesita al menos tres porteros.')
  return { valid: errors.length === 0, errors }
}

export { FORMATION_TEMPLATES }
