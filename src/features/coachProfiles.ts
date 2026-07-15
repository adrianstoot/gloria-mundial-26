import type { MetricEffects } from './concentrationData'
import { assetUrl } from '../utils/assetUrl'

export type CoachProfileId = 'amine-el-mansouri' | 'lukas-varga' | 'tomas-ferreyra'

export interface CoachProfile {
  id: CoachProfileId
  name: string
  origin: string
  archetype: string
  philosophy: string
  strength: string
  risk: string
  visual: string
  accent: 'cyan' | 'gold' | 'coral'
  indicators: Array<{ label: string; value: number }>
  modifiers: MetricEffects
  objectPosition?: string
}

export const coachProfiles: CoachProfile[] = [
  {
    id: 'amine-el-mansouri',
    name: 'Amine El Mansouri',
    origin: 'Norte de África',
    archetype: 'El estratega',
    philosophy: 'Analiza al rival, protege el centro y prepara cada escenario antes de asumir riesgos.',
    strength: 'Lectura táctica y control de la presión',
    risk: 'Puede ralentizar la toma de decisiones ofensivas.',
    visual: assetUrl('assets/coaches/amine-el-mansouri.webp'),
    accent: 'cyan',
    indicators: [
      { label: 'Táctica', value: 92 },
      { label: 'Gestión', value: 84 },
      { label: 'Impulso', value: 72 },
    ],
    modifiers: { tacticalFamiliarity: 2, cohesion: 1, pressure: -1 },
    objectPosition: 'center 10%',
  },
  {
    id: 'lukas-varga',
    name: 'Lukas Varga',
    origin: 'Europa Central',
    archetype: 'El arquitecto',
    philosophy: 'Construye estructuras fiables, exige distancias cortas y convierte la disciplina en ventaja.',
    strength: 'Cohesión y organización colectiva',
    risk: 'Su exigencia inicial puede reducir ligeramente la moral.',
    visual: assetUrl('assets/coaches/lukas-varga.webp'),
    accent: 'gold',
    indicators: [
      { label: 'Táctica', value: 87 },
      { label: 'Gestión', value: 91 },
      { label: 'Impulso', value: 70 },
    ],
    modifiers: { tacticalFamiliarity: 1, cohesion: 2, morale: -1 },
    objectPosition: 'center 0%',
  },
  {
    id: 'tomas-ferreyra',
    name: 'Tomás Ferreyra',
    origin: 'Sudamérica',
    archetype: 'El motivador',
    philosophy: 'Libera el talento, acelera los ataques y convierte la emoción del torneo en energía competitiva.',
    strength: 'Moral, creatividad y conexión del vestuario',
    risk: 'Eleva ligeramente la presión cuando el entorno se enciende.',
    visual: assetUrl('assets/coaches/tomas-ferreyra.webp'),
    accent: 'coral',
    indicators: [
      { label: 'Táctica', value: 78 },
      { label: 'Gestión', value: 86 },
      { label: 'Impulso', value: 94 },
    ],
    modifiers: { morale: 2, cohesion: 1, pressure: 1 },
    objectPosition: 'center 0%',
  },
]

export const defaultCoachProfile = coachProfiles[0]

export function coachProfileById(id?: string) {
  return coachProfiles.find((profile) => profile.id === id) ?? defaultCoachProfile
}

export function isCoachProfileId(value?: string): value is CoachProfileId {
  return coachProfiles.some((profile) => profile.id === value)
}

export interface CoachMetricSnapshot {
  morale: number
  cohesion: number
  pressure: number
  tacticalFamiliarity: number
}

export function applyCoachModifiers(metrics: CoachMetricSnapshot, nextId: CoachProfileId, previousId?: CoachProfileId): CoachMetricSnapshot {
  const previous = previousId ? coachProfileById(previousId).modifiers : {}
  const next = coachProfileById(nextId).modifiers
  const adjust = (key: keyof CoachMetricSnapshot) => Math.max(0, Math.min(100, metrics[key] - (previous[key] ?? 0) + (next[key] ?? 0)))
  return {
    morale: adjust('morale'),
    cohesion: adjust('cohesion'),
    pressure: adjust('pressure'),
    tacticalFamiliarity: adjust('tacticalFamiliarity'),
  }
}
