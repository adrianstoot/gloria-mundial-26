import { countryPress, type CountryPressQuestion } from './concentrationData'
import type { CampaignProgress } from './campaignProgress'
import { uiNations, type CampaignUIState } from './ui-model'

export interface PressConference {
  id: string
  title: string
  context: string
  questions: CountryPressQuestion[]
}

const stageLabels: Record<string, string> = {
  GROUP: 'fase de grupos', ROUND_OF_32: 'dieciseisavos', ROUND_OF_16: 'octavos',
  QUARTER_FINAL: 'cuartos de final', SEMI_FINAL: 'semifinales', THIRD_PLACE: 'partido por el bronce', FINAL: 'final',
}

function resultPhrase(campaign: CampaignUIState, progress: CampaignProgress) {
  const played = progress.fixtures
    .filter((fixture) => fixture.result && (fixture.homeNationId === campaign.nationId || fixture.awayNationId === campaign.nationId))
    .sort((left, right) => right.matchNumber - left.matchNumber)[0]
  if (!played?.result) return undefined
  const controlledHome = played.homeNationId === campaign.nationId
  const own = controlledHome ? played.result.home : played.result.away
  const rival = controlledHome ? played.result.away : played.result.home
  const opponentId = controlledHome ? played.awayNationId : played.homeNationId
  const opponent = uiNations.find((nation) => nation.id === opponentId)?.name ?? 'el rival'
  const outcome = own > rival ? 'la victoria' : own < rival ? 'la derrota' : 'el empate'
  return `${outcome} ${own}–${rival} ante ${opponent}`
}

export function buildPressConference(campaign: CampaignUIState, progress: CampaignProgress): PressConference {
  const nation = uiNations.find((item) => item.id === campaign.nationId)
  const base = countryPress[nation?.code ?? 'ESP'] ?? countryPress.ESP
  const next = progress.nextControlledFixture
  const opponentId = next?.homeNationId === campaign.nationId ? next.awayNationId : next?.homeNationId
  const opponent = uiNations.find((item) => item.id === opponentId)?.name
  const previous = resultPhrase(campaign, progress)
  const id = next ? `previa-${next.id}` : progress.controlledNationEliminated ? 'despedida' : progress.completed ? 'campeonato-cerrado' : 'concentracion-inicial'
  const title = next ? `Previa: ${opponent ?? 'próximo rival'}` : progress.controlledNationEliminated ? 'Balance tras la eliminación' : progress.completed ? 'Balance del Mundial' : 'Primera comparecencia'
  const context = next
    ? `${stageLabels[next.stage] ?? 'Mundial'} · partido ${next.matchNumber}${previous ? ` · después de ${previous}` : ''}`
    : progress.controlledNationEliminated ? 'La selección se despide del torneo y responde ante sus medios.' : 'La selección presenta su proyecto antes del debut.'

  const scoreQuestion = (value: string) => {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
    return hash >>> 0
  }
  const selectedBase = [...base]
    .sort((left, right) => scoreQuestion(`${id}:${left.id}`) - scoreQuestion(`${id}:${right.id}`))
    .slice(0, 5)
  const questions = selectedBase.map((question, index) => {
    let text = question.question
    if (previous && next && opponent) {
      if (index === 0) text = `Después de ${previous}, ¿qué debe cambiar o conservar el equipo para enfrentarse a ${opponent}?`
      if (index === 1) text = `${question.question} ¿Condicionará esa decisión el plan específico contra ${opponent}?`
      if (index === 2) text = `La exigencia crece en ${stageLabels[next.stage] ?? 'esta ronda'}: ¿qué mensaje envía a la afición antes de jugar contra ${opponent}?`
    } else if (progress.controlledNationEliminated) {
      if (index === 0) text = `¿Cuál es su explicación principal para la eliminación y qué decisión asume personalmente?`
      if (index === 1) text = `${question.question} Mirando el torneo completo, ¿qué balance hace ahora?`
      if (index === 2) text = `¿Qué le dice hoy a la afición y a la federación después de quedar fuera del Mundial?`
    }
    return { ...question, id: `${id}:${question.id}`, question: text }
  })

  return { id, title, context, questions }
}

export function pressConferenceComplete(campaign: CampaignUIState, conference: PressConference) {
  return conference.questions.every((question) => Boolean(campaign.pressAnswers[question.id]))
}
