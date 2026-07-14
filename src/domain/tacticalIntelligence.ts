import type { Position } from './types'

interface ComparableRatings {
  overall?: number
  attack?: number
  passing?: number
  technique?: number
  defending?: number
  goalkeeping?: number
  pace?: number
  stamina?: number
  strength?: number
  composure?: number
  decisions?: number
  positioning?: number
  technical?: number
  physical?: number
  mental?: number
  teamwork?: number
  finishing?: number
  confidence?: string | number
}

export interface PositionalPlayer {
  position?: string
  positions?: string[]
  primaryPosition?: Position
  realStats?: object
  gameRatings: ComparableRatings
}

export interface TacticalAssessment {
  detectedPosition: Position
  suitability: number
  effectiveRating: number
  chemistry: number
  familiarityCost: number
  penalties: string[]
}

export interface TacticalShapeAssessment {
  score: number
  width: number
  verticalBalance: number
  warnings: string[]
}

const equivalents: Record<string, string[]> = {
  GK: ['GK'], RB: ['RB', 'RWB'], RCB: ['CB', 'RCB', 'RB'], CB: ['CB', 'RCB', 'LCB'], LCB: ['CB', 'LCB', 'LB'], LB: ['LB', 'LWB'],
  RWB: ['RWB', 'RB', 'RM'], LWB: ['LWB', 'LB', 'LM'], DM: ['DM', 'CM', 'RCM', 'LCM'], RCM: ['RCM', 'CM', 'DM', 'RM'],
  CM: ['CM', 'RCM', 'LCM', 'DM', 'AM'], LCM: ['LCM', 'CM', 'DM', 'LM'], RM: ['RM', 'RW', 'RWB', 'CM'], LM: ['LM', 'LW', 'LWB', 'CM'],
  AM: ['AM', 'CM', 'SS', 'LW', 'RW'], RW: ['RW', 'RM', 'AM', 'ST'], LW: ['LW', 'LM', 'AM', 'ST'], SS: ['SS', 'AM', 'ST'], ST: ['ST', 'SS', 'RW', 'LW'],
}

function normalize(position: string): string {
  if (position === 'DF') return 'CB'
  if (position === 'MF') return 'CM'
  if (position === 'FW') return 'ST'
  return position
}

export function inferTacticalPosition(x: number, y: number): Position {
  if (y >= 84) return 'GK'
  if (y >= 66) {
    if (x < 24) return y < 72 ? 'LWB' : 'LB'
    if (x > 76) return y < 72 ? 'RWB' : 'RB'
    if (x < 44) return 'LCB'
    if (x > 56) return 'RCB'
    return 'CB'
  }
  if (y >= 51) {
    if (x < 22) return 'LWB'
    if (x > 78) return 'RWB'
    if (x < 39) return 'LCM'
    if (x > 61) return 'RCM'
    return y >= 57 ? 'DM' : 'CM'
  }
  if (y >= 32) {
    if (x < 24) return 'LM'
    if (x > 76) return 'RM'
    if (x < 39) return 'LCM'
    if (x > 61) return 'RCM'
    return 'AM'
  }
  if (y >= 20) {
    if (x < 32) return 'LW'
    if (x > 68) return 'RW'
    return 'SS'
  }
  if (x < 26) return 'LW'
  if (x > 74) return 'RW'
  return 'ST'
}

function knownPositions(player: PositionalPlayer): string[] {
  const factualPositions = (player.realStats as { positions?: Position[] } | undefined)?.positions ?? []
  return [...new Set([
    player.position,
    ...(player.positions ?? []),
    player.primaryPosition,
    ...factualPositions,
  ].filter((value): value is string => Boolean(value)).map(normalize))]
}

export function positionSuitability(player: PositionalPlayer, target: Position): number {
  const known = knownPositions(player)
  const normalizedTarget = normalize(target)
  if (known.includes(normalizedTarget)) return known[0] === normalizedTarget ? 100 : 94
  if (target === 'GK' || known.includes('GK')) return 8
  const neighbours = equivalents[normalizedTarget] ?? [normalizedTarget]
  if (known.some((position) => neighbours.slice(0, 3).includes(position))) return 84
  if (known.some((position) => neighbours.includes(position))) return 74
  const targetUnit = ['RB','RCB','CB','LCB','LB','RWB','LWB'].includes(normalizedTarget) ? 'defence'
    : ['DM','RCM','CM','LCM','RM','LM','AM'].includes(normalizedTarget) ? 'midfield' : 'attack'
  const hasUnit = known.some((position) => targetUnit === 'defence'
    ? ['RB','RCB','CB','LCB','LB','RWB','LWB'].includes(position)
    : targetUnit === 'midfield'
      ? ['DM','RCM','CM','LCM','RM','LM','AM'].includes(position)
      : ['RW','LW','SS','ST'].includes(position))
  return hasUnit ? 62 : 43
}

function attributeScore(player: PositionalPlayer, target: Position): number {
  const ratings = player.gameRatings
  const overall = ratings.overall ?? 70
  const value = (...keys: Array<keyof ComparableRatings>) => {
    const available = keys.map((key) => ratings[key]).filter((item): item is number => typeof item === 'number')
    return available.length ? available.reduce((sum, item) => sum + item, 0) / available.length : overall
  }
  if (target === 'GK') return value('goalkeeping', 'positioning', 'decisions', 'composure')
  if (['RB','RCB','CB','LCB','LB','RWB','LWB'].includes(target)) return value('defending', 'positioning', 'strength', 'decisions')
  if (['DM','RCM','CM','LCM'].includes(target)) return value('passing', 'technique', 'decisions', 'stamina')
  if (['RM','LM','RW','LW'].includes(target)) return value('pace', 'technique', 'passing', 'attack')
  return value('attack', 'finishing', 'composure', 'technique')
}

export function effectivePositionRating(player: PositionalPlayer, target: Position): number {
  const overall = player.gameRatings.overall ?? 70
  const suitability = positionSuitability(player, target)
  const roleQuality = attributeScore(player, target)
  const penalty = (100 - suitability) * 0.28
  return Math.max(20, Math.min(99, Math.round(overall * 0.8 + roleQuality * 0.2 - penalty)))
}

export function tacticalFitLabel(suitability: number): 'Natural' | 'Competente' | 'Adaptación' | 'Fuera de posición' {
  if (suitability >= 94) return 'Natural'
  if (suitability >= 80) return 'Competente'
  if (suitability >= 60) return 'Adaptación'
  return 'Fuera de posición'
}

export function assessTacticalPlayer(player: PositionalPlayer, x: number, y: number, teamFamiliarity = 60): TacticalAssessment {
  const detectedPosition = inferTacticalPosition(x, y)
  const suitability = positionSuitability(player, detectedPosition)
  const effectiveRating = effectivePositionRating(player, detectedPosition)
  const familiarityCost = Math.max(0, Math.round((100 - suitability) * (1 - teamFamiliarity / 180)))
  const chemistry = Math.max(20, Math.min(100, Math.round(suitability * 0.72 + teamFamiliarity * 0.28)))
  const penalties = [
    ...(suitability < 60 ? ['Fuera de posición'] : suitability < 90 ? ['Necesita adaptación'] : []),
    ...(y < 32 && ['RB','CB','LB','DM'].includes(player.position ?? '') ? ['Riesgo en transición defensiva'] : []),
    ...(y > 63 && ['ST','SS','RW','LW'].includes(player.position ?? '') ? ['Lejos de su zona de influencia'] : []),
  ]
  return { detectedPosition, suitability, effectiveRating, chemistry, familiarityCost, penalties }
}

export function assessTacticalShape(points: Array<{ x: number; y: number; position: Position }>): TacticalShapeAssessment {
  if (!points.length) return { score:0, width:0, verticalBalance:0, warnings:['Once incompleto'] }
  const outfield = points.filter((point) => point.position !== 'GK')
  const minX = Math.min(...outfield.map((point) => point.x))
  const maxX = Math.max(...outfield.map((point) => point.x))
  const width = Math.round(maxX - minX)
  const thirds = [0,0,0]
  outfield.forEach((point) => { thirds[point.y < 34 ? 0 : point.y < 64 ? 1 : 2] += 1 })
  const warnings: string[] = []
  if (width < 48) warnings.push('Falta amplitud: el rival puede cerrar el carril central')
  if (width > 82) warnings.push('Equipo demasiado abierto: aumentan las distancias de ayuda')
  if (thirds[1]! < 3) warnings.push('Hueco entre defensa y ataque')
  if (thirds[2]! < 3) warnings.push('Poca protección tras pérdida')
  if (thirds[0]! < 2) warnings.push('Escasa presencia para fijar la última línea')
  const verticalBalance = Math.max(0,100-Math.abs(thirds[0]!-3)*11-Math.abs(thirds[1]!-4)*9-Math.abs(thirds[2]!-3)*11)
  return { score:Math.max(25,Math.min(99,Math.round(100-warnings.length*13-Math.abs(64-width)*0.35))), width, verticalBalance, warnings }
}
