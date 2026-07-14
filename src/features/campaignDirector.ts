import type { AgendaEvent, AgendaPriority, CampaignUIState, WorldNotification } from './ui-model'

export interface AssistantBriefing {
  id: string
  trigger: 'scene' | 'day' | 'incident' | 'medical' | 'tactical' | 'match'
  urgency: AgendaPriority
  eyebrow: string
  headline: string
  speech: string
  detail: string
  confidence: number
  evidence: string[]
  risks: string[]
  actions: Array<{ id: string; label: string; route: string }>
  repeat: 'once' | 'daily' | 'critical'
}

const DAY = 86_400_000

function addDays(date: string, amount: number) {
  return new Date(new Date(`${date}T12:00:00`).getTime() + amount * DAY).toISOString().slice(0, 10)
}

function event(
  date: string,
  time: string,
  type: AgendaEvent['type'],
  title: string,
  summary: string,
  route: string,
  options: Partial<Pick<AgendaEvent, 'priority' | 'mandatory' | 'durationMinutes' | 'effects' | 'status'>> = {},
): AgendaEvent {
  return {
    id: `${date}-${time}-${type}-${title.toLocaleLowerCase('es-ES').replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    date,
    time,
    type,
    title,
    summary,
    route,
    priority: options.priority ?? 'normal',
    mandatory: options.mandatory ?? false,
    durationMinutes: options.durationMinutes ?? 60,
    effects: options.effects ?? [],
    status: options.status ?? 'pending',
  }
}

export function generateAgenda(campaign: CampaignUIState): AgendaEvent[] {
  const events: AgendaEvent[] = []
  for (let offset = 0; offset < 10; offset += 1) {
    const date = addDays(campaign.date, offset)
    const trainingDone = campaign.decisionLog.some((item) => item.key.startsWith(`training:${date}:`))
    if (offset === 0 && !campaign.squadConfirmed) events.push(event(date, '09:00', 'federation', 'Cerrar la lista de 26', 'La federación necesita una convocatoria equilibrada con tres porteros.', '/juego/convocatoria', { priority: 'critical', mandatory: true, durationMinutes: 90, effects: ['Equilibrio', 'Jerarquía'] }))
    if (offset === 0 && !campaign.hotelId) events.push(event(date, '11:00', 'travel', 'Elegir la base del Mundial', 'Privacidad, viajes y recuperación cambiarán el contexto de cada partido.', '/juego/concentracion?seccion=hotel', { priority: 'high', mandatory: true, durationMinutes: 45, effects: ['Recuperación', 'Apoyo local'] }))
    events.push(event(date, offset % 3 === 0 ? '10:30' : '11:15', trainingDone && offset === 0 ? 'recovery' : 'training', trainingDone && offset === 0 ? 'Recuperación dirigida' : offset % 3 === 1 ? 'Automatismos ofensivos' : offset % 3 === 2 ? 'Bloque y presión' : 'Activación y cohesión', 'Sesión diseñada según carga, momento del torneo y rival.', '/juego/concentracion?seccion=training', { priority: offset === 0 ? 'high' : 'normal', mandatory: offset === 0 && !trainingDone, durationMinutes: 75, effects: ['Fatiga', 'Familiaridad'] }))
    if (offset % 2 === 0) events.push(event(date, '16:30', 'medical', 'Control de disponibilidad', 'El equipo médico revisará fatiga, golpes y riesgo muscular.', '/juego/medico', { durationMinutes: 35, effects: ['Condición', 'Riesgo'] }))
    if (offset % 3 === 1) events.push(event(date, '18:00', 'press', 'Ventana de medios', 'La presión pública puede trasladarse al vestuario.', '/juego/prensa', { priority: 'normal', durationMinutes: 30, effects: ['Presión', 'Confianza'] }))
    if (offset % 3 === 2) events.push(event(date, '18:30', 'leisure', 'Tiempo del grupo', 'Una decisión corta sobre descanso, familia o convivencia.', '/juego/concentracion?seccion=leisure', { durationMinutes: 90, effects: ['Moral', 'Cohesión'] }))
  }
  return events.sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time))
}

export function generateWorldNotifications(campaign: CampaignUIState): WorldNotification[] {
  const notices: WorldNotification[] = []
  const add = (notification: Omit<WorldNotification, 'createdAt' | 'read' | 'playerIds'> & { playerIds?: string[] }) => notices.push({ ...notification, playerIds: notification.playerIds ?? [], createdAt: campaign.date, read: false })
  if (!campaign.squadConfirmed) add({ id: `squad-${campaign.date}`, category: 'federation', headline: 'La lista sigue abierta', summary: `${campaign.squadIds.length}/26 elegidos. Faltan perfiles para cerrar el grupo.`, urgency: 'critical', route: '/juego/convocatoria' })
  if (campaign.fatigue >= 48) add({ id: `fatigue-${campaign.date}`, category: 'medical', headline: 'Carga por encima del plan', summary: 'El cuerpo médico recomienda sustituir intensidad por recuperación.', urgency: 'high', route: '/juego/medico' })
  if (campaign.pressure >= 65) add({ id: `pressure-${campaign.date}`, category: 'press', headline: 'El ruido exterior entra en el vestuario', summary: 'Álex aconseja proteger al grupo antes de la siguiente comparecencia.', urgency: 'high', route: '/juego/prensa' })
  if (campaign.tacticalFamiliarity < 62) add({ id: `tactic-${campaign.date}`, category: 'tactical', headline: 'Automatismos todavía frágiles', summary: 'El once necesita repetir salida, alturas y reacción tras pérdida.', urgency: 'normal', route: '/juego/tacticas' })
  add({ id: `world-${campaign.date}`, category: 'tournament', headline: 'El Mundial despierta', summary: 'Sedes, rivales y aficiones ya preparan la próxima jornada global.', urgency: 'low', route: '/juego/mundial' })
  return notices
}

export function buildContextualBriefing(campaign: CampaignUIState, pathname: string): AssistantBriefing {
  const pending = campaign.agenda.filter((item) => item.date === campaign.date && item.status === 'pending')
  const critical = pending.find((item) => item.mandatory)
  const scene = pathname.includes('convocatoria') ? 'plantilla'
    : pathname.includes('tacticas') ? 'táctica'
      : pathname.includes('concentracion') ? 'concentración'
        : pathname.includes('prensa') ? 'prensa'
          : pathname.includes('medico') ? 'estado médico'
            : pathname.includes('mundial') ? 'Mundial' : 'Centro Mundial'
  if (critical) return {
    id: `alex-critical-${critical.id}`,
    trigger: 'incident', urgency: 'critical', eyebrow: 'DECISIÓN OBLIGATORIA', headline: critical.title,
    speech: `${critical.title}. ${critical.summary}`,
    detail: `Hay ${pending.length} tareas abiertas hoy. Esta decisión debe resolverse antes de continuar.`, confidence: 97,
    evidence: critical.effects, risks: ['Avanzar sin resolverla debilita la preparación'],
    actions: [{ id: `open-${critical.id}`, label: 'Resolver ahora', route: critical.route }], repeat: 'critical',
  }
  const liveAlert = campaign.worldNotifications.find((item) => !item.read
    && !campaign.assistantMemory.appliedActionIds.includes(`alert-${item.id}`)
    && !campaign.assistantMemory.postponedActionIds.includes(`alex-alert-${item.id}`)
    && (item.urgency === 'critical' || item.urgency === 'high'))
  if (liveAlert) return {
    id: `alex-alert-${liveAlert.id}`,
    trigger: liveAlert.category === 'medical' ? 'medical' : 'incident', urgency: liveAlert.urgency,
    eyebrow: liveAlert.category.toUpperCase(), headline: liveAlert.headline,
    speech: `${liveAlert.headline}. ${liveAlert.summary}`,
    detail: `${liveAlert.summary} He priorizado este aviso porque cambia la preparación de hoy y puede llegar al siguiente partido.`,
    confidence: liveAlert.category === 'medical' ? 96 : 91,
    evidence: liveAlert.category === 'medical'
      ? [`Fatiga ${campaign.fatigue}%`, `Recuperación ${campaign.recovery}%`, `Carga acumulada`]
      : [`Presión ${campaign.pressure}%`, `Moral ${campaign.morale}%`, `Cohesión ${campaign.cohesion}%`],
    risks: [liveAlert.category === 'medical' ? 'Una carga mal elegida aumenta lesión y baja ejecución' : 'Ignorar el contexto traslada tensión al vestuario'],
    actions: [{ id: `alert-${liveAlert.id}`, label: 'Revisar y decidir', route: liveAlert.route }], repeat: 'once',
  }
  const sceneCopy: Record<string, [string, string]> = {
    plantilla: ['La lista debe sostener siete partidos', `Tienes ${campaign.squadIds.length} futbolistas elegidos. Busca dos soluciones por línea y protege los perfiles decisivos.`],
    táctica: ['El espacio importa más que el dibujo', `Familiaridad ${campaign.tacticalFamiliarity}%. Mover un jugador cambia apoyos, química y nivel efectivo.`],
    concentración: ['Hoy también se compite fuera del campo', `Fatiga ${campaign.fatigue}%, recuperación ${campaign.recovery}% y presión ${campaign.pressure}%.`],
    prensa: ['Cada respuesta viaja al vestuario', `Moral ${campaign.morale}% y confianza federativa ${campaign.federation}%. El tono debe servir al momento.`],
    'estado médico': ['Disponibilidad antes que nombres', `La carga acumulada está en ${campaign.fatigue}%. Revisa riesgos antes de fijar el once.`],
    Mundial: ['Lee el torneo antes de que cambie', 'El calendario muestra jornadas, viajes, presión y el camino completo hacia la final.'],
    'Centro Mundial': ['Tu día empieza en el calendario', `Hay ${pending.length} eventos pendientes. Te avisaré cuando una decisión cambie el riesgo del equipo.`],
  }
  const [headline, detail] = sceneCopy[scene]
  const sceneAction: Record<string, { id: string; label: string; route: string }> = {
    plantilla: { id: 'alex-balance-squad', label: 'Revisar equilibrio', route: '/juego/convocatoria' },
    táctica: { id: 'alex-fix-shape', label: 'Abrir pizarra', route: '/juego/tacticas' },
    concentración: { id: 'alex-plan-load', label: campaign.fatigue > 50 ? 'Programar recuperación' : 'Elegir sesión', route: '/juego/concentracion?seccion=training' },
    prensa: { id: 'alex-protect-team', label: 'Preparar respuesta', route: '/juego/prensa' },
    'estado médico': { id: 'alex-review-risk', label: 'Revisar disponibilidad', route: '/juego/medico' },
    Mundial: { id: 'alex-read-draw', label: 'Leer el camino', route: '/juego/mundial' },
    'Centro Mundial': { id: 'alex-open-next', label: pending[0] ? 'Abrir siguiente tarea' : 'Revisar calendario', route: pending[0]?.route ?? '/juego/mundial' },
  }
  return {
    id: `alex-${campaign.date}-${scene}`,
    trigger: 'scene', urgency: 'normal', eyebrow: scene.toUpperCase(), headline,
    speech: `${headline}. ${detail}`, detail, confidence: 92,
    evidence: [`Moral ${campaign.morale}%`, `Cohesión ${campaign.cohesion}%`, `Fatiga ${campaign.fatigue}%`],
    risks: campaign.fatigue > 50 ? ['Riesgo físico elevado'] : ['Sin alerta crítica'],
    actions: [sceneAction[scene]], repeat: 'daily',
  }
}
