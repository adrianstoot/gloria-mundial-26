import type { CampaignUIState } from './ui-model'

export type PrologueStage = 'squad' | 'hotel' | 'training' | 'tactics' | 'press' | 'hub'
export type AdvicePriority = 'critical' | 'high' | 'medium' | 'low'

export interface AssistantAdvice {
  id: string
  stage: PrologueStage | 'context'
  priority: AdvicePriority
  context: string
  diagnosis: string
  recommendation: string
  benefit: string
  risk: string
  confidence: number
  actions: Array<{ id: string; label: string; target: string }>
}

export function prologueStage(campaign: CampaignUIState, pressComplete: boolean): PrologueStage {
  if (!campaign.squadConfirmed) return 'squad'
  if (!campaign.hotelId) return 'hotel'
  if (!campaign.decisionLog.some((item) => item.key === `training:${campaign.date}:primary`)) return 'training'
  if (!campaign.decisionLog.some((item) => item.type === 'tactic')) return 'tactics'
  if (!pressComplete) return 'press'
  return 'hub'
}

export const prologueStages: Array<{ id: PrologueStage; label: string; target: string }> = [
  { id: 'squad', label: 'Los 26', target: '/juego/convocatoria' },
  { id: 'hotel', label: 'Base', target: '/juego/concentracion?seccion=hotel' },
  { id: 'training', label: 'Entrenamiento', target: '/juego/concentracion?seccion=training' },
  { id: 'tactics', label: 'Plan de juego', target: '/juego/tacticas' },
  { id: 'press', label: 'Prensa', target: '/juego/prensa' },
  { id: 'hub', label: 'Centro Mundial', target: '/juego' },
]

export function stageTarget(stage: PrologueStage) {
  return prologueStages.find((item) => item.id === stage)!.target
}

export function buildAssistantAdvice(campaign: CampaignUIState, stage: PrologueStage): AssistantAdvice {
  const fatigueRisk = campaign.fatigue > 48
  const pressureRisk = campaign.pressure > 65
  const advice: Record<PrologueStage, Omit<AssistantAdvice, 'id' | 'stage'>> = {
    squad: {
      priority: 'critical', context: 'Primera decisión como seleccionador',
      diagnosis: `Has elegido ${campaign.squadIds.length} de 26 futbolistas. La lista debe resistir siete partidos, viajes y escenarios tácticos distintos.`,
      recommendation: 'Construye una columna vertebral y cubre después dos perfiles diferentes por línea.',
      benefit: 'Equilibrio, alternativas y menor coste de adaptación.', risk: 'Una lista desequilibrada limita los cambios durante el torneo.', confidence: 96,
      actions: [{ id: 'open-squad', label: 'Analizar candidatos', target: '/juego/convocatoria' }],
    },
    hotel: {
      priority: 'high', context: 'Entorno de rendimiento',
      diagnosis: 'La base condicionará desplazamientos, sueño, adaptación climática, privacidad y apoyo local durante toda la campaña.',
      recommendation: 'Prioriza recuperación y distancia si quieres sostener una presión alta; prioriza apoyo si el grupo necesita impulso emocional.',
      benefit: 'Efectos diarios acumulativos.', risk: 'La decisión queda fijada al confirmarla.', confidence: 91,
      actions: [{ id: 'compare-hotels', label: 'Comparar bases', target: '/juego/concentracion?seccion=hotel' }],
    },
    training: {
      priority: fatigueRisk ? 'critical' : 'high', context: 'Primer microciclo',
      diagnosis: `Fatiga ${campaign.fatigue}% · recuperación ${campaign.recovery}% · familiaridad ${campaign.tacticalFamiliarity}%.`,
      recommendation: fatigueRisk ? 'Reduce la carga y protege las piernas antes de añadir complejidad.' : 'Trabaja automatismos sin comprometer la frescura.',
      benefit: 'El ejercicio modifica ejecución, cohesión y condición.', risk: fatigueRisk ? 'Riesgo físico elevado con una sesión intensa.' : 'La carga alta aparecerá en días posteriores.', confidence: 93,
      actions: [{ id: 'choose-training', label: 'Diseñar sesión', target: '/juego/concentracion?seccion=training' }],
    },
    tactics: {
      priority: 'high', context: 'Identidad competitiva',
      diagnosis: `Familiaridad táctica ${campaign.tacticalFamiliarity}%. Cada movimiento cambia demarcación, encaje y rendimiento efectivo.`,
      recommendation: 'Construye primero una estructura sin huecos; después asigna roles y riesgos.',
      benefit: 'Mejor ocupación del espacio y decisiones más rápidas.', risk: 'Las estrellas fuera de posición pierden referencias y eficacia.', confidence: 94,
      actions: [{ id: 'open-board', label: 'Construir el once', target: '/juego/tacticas' }],
    },
    press: {
      priority: pressureRisk ? 'critical' : 'medium', context: 'Presión del país',
      diagnosis: `Presión exterior ${campaign.pressure}% · moral ${campaign.morale}% · confianza federativa ${campaign.federation}%.`,
      recommendation: pressureRisk ? 'Protege al vestuario y absorbe la responsabilidad.' : 'Proyecta ambición sin regalar titulares innecesarios.',
      benefit: 'Control del relato y respuesta emocional.', risk: 'Un tono extremo aumenta presión y fractura relaciones.', confidence: 88,
      actions: [{ id: 'enter-press', label: 'Entrar en la sala', target: '/juego/prensa' }],
    },
    hub: {
      priority: 'low', context: 'Prólogo completado', diagnosis: 'La selección ya tiene lista, base, carga, identidad y mensaje público.',
      recommendation: 'Usa el calendario como centro de mando y revisa las alertas antes de continuar.', benefit: 'Control completo de la campaña.', risk: 'Avanzar con tareas abiertas traslada problemas al partido.', confidence: 99,
      actions: [{ id: 'open-hub', label: 'Entrar al Centro Mundial', target: '/juego' }],
    },
  }
  return { id: `alex-${stage}-${campaign.date}`, stage, ...advice[stage] }
}

