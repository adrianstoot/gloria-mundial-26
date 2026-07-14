import type { MatchEvent } from '../domain'

export type BroadcastImportance = 'routine' | 'notable' | 'critical'
export type BroadcastAudio = 'whistle' | 'kick' | 'tackle' | 'save' | 'card' | 'goal' | 'boo'

export interface BroadcastCue {
  id: string
  eventId: string
  importance: BroadcastImportance
  headline: string
  narration: string
  replay: boolean
  audio: BroadcastAudio
  durationMs: number
}

export interface BroadcastContext {
  stage: 'group' | 'knockout'
  homeName: string
  awayName: string
  tension: number
}

const criticalEvents = new Set(['goal', 'own-goal', 'red-card', 'penalty-awarded', 'var-confirmed', 'var-overturn', 'penalty-scored', 'penalty-missed', 'match-end'])
const notableEvents = new Set(['shot-on-target', 'save', 'yellow-card', 'injury', 'substitution', 'tactical-shift', 'momentum', 'var-check'])

function cleanNarration(value: string) {
  return value.replace(/^\d+'\s*/, '').replace(/\s+/g, ' ').trim()
}

function headlineFor(event: MatchEvent, context: BroadcastContext) {
  const minute = Math.floor(event.second / 60) + 1
  const late = minute >= 82
  if (event.type === 'goal' || event.type === 'own-goal') return late && context.stage === 'knockout' ? 'UN GOL PARA LA HISTORIA' : 'EL ESTADIO EXPLOTA'
  if (event.type === 'var-check') return 'EL MUNDIAL CONTIENE EL ALIENTO'
  if (event.type === 'var-overturn') return 'EL VAR CAMBIA LA NOCHE'
  if (event.type === 'var-confirmed') return 'DECISIÓN CONFIRMADA'
  if (event.type === 'red-card') return 'EL PARTIDO SE ROMPE'
  if (event.type === 'penalty-awarded') return 'TODO DESDE ONCE METROS'
  if (event.type === 'penalty-scored') return 'PULSO DE ACERO'
  if (event.type === 'penalty-missed') return 'EL DRAMA DEL PUNTO DE PENALTI'
  if (event.type === 'save') return context.tension > 72 ? 'UNA PARADA QUE VALE UN MUNDIAL' : 'RESPUESTA DEL GUARDAMETA'
  if (event.type === 'momentum' || event.type === 'tactical-shift') return 'EL PARTIDO CAMBIA DE DUEÑO'
  if (event.type === 'match-end') return context.stage === 'knockout' ? 'LA HISTORIA DICTA SENTENCIA' : 'FINAL EN EL ESTADIO'
  return 'MOMENTO CLAVE'
}

function audioFor(event: MatchEvent): BroadcastAudio {
  if (['goal', 'own-goal', 'var-confirmed', 'penalty-scored'].includes(event.type)) return 'goal'
  if (['yellow-card', 'red-card'].includes(event.type)) return 'card'
  if (event.type === 'save' || event.type === 'penalty-missed') return 'save'
  if (['var-overturn', 'offside'].includes(event.type)) return 'boo'
  if (['foul', 'tackle'].includes(event.type)) return 'tackle'
  if (['period-start', 'period-end', 'match-end'].includes(event.type)) return 'whistle'
  return 'kick'
}

export function createBroadcastCue(event: MatchEvent, context: BroadcastContext): BroadcastCue {
  const minute = Math.floor(event.second / 60) + 1
  let importance: BroadcastImportance = criticalEvents.has(event.type) ? 'critical' : notableEvents.has(event.type) ? 'notable' : 'routine'
  // Los cambios de inercia forman parte del relato continuo. Solo merecen un
  // rótulo de realización cuando el encuentro ya tiene tensión significativa.
  if (event.type === 'momentum' && (minute < 10 || context.tension < 55)) importance = 'routine'
  const lateDrama = minute >= 82 && Math.abs(event.score.home - event.score.away) <= 1
  const stageCopy = context.stage === 'knockout' && lateDrama ? ' No hay margen: una acción puede separar la gloria del adiós.' : ''
  const tensionCopy = context.tension >= 82 && importance !== 'routine' ? ' La tensión ya se siente en cada pase y en cada duelo.' : ''
  return {
    id: `broadcast-${event.id}`,
    eventId: event.id,
    importance: lateDrama && importance === 'notable' ? 'critical' : importance,
    headline: headlineFor(event, context),
    narration: `${cleanNarration(event.commentary)}${stageCopy}${tensionCopy}`,
    replay: ['goal', 'own-goal', 'red-card', 'penalty-awarded', 'var-confirmed', 'var-overturn', 'shot-on-target', 'save'].includes(event.type),
    audio: audioFor(event),
    durationMs: importance === 'critical' || lateDrama ? 5200 : importance === 'notable' ? 3200 : 1800,
  }
}

export function broadcastSignature(cue: BroadcastCue) {
  return `${cue.headline}:${cue.narration}`.toLocaleLowerCase('es-ES').replace(/\b\d+\b/g, '#').replace(/[^a-záéíóúñü#]+/g, ' ')
}

export function acceptBroadcastCue(recentSignatures: string[], cue: BroadcastCue, limit = 10) {
  const signature = broadcastSignature(cue)
  if (recentSignatures.includes(signature)) return { accepted: false, signatures: recentSignatures }
  return { accepted: true, signatures: [signature, ...recentSignatures].slice(0, limit) }
}
