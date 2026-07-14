import type { CampaignUIState } from './ui-model'
import type { MetricEffects, TeamMetric } from './concentrationData'
import type { Nation } from '../domain'
import type { MatchEnvironment } from './matchEnvironment'

export interface CampDecision {
  key: string
  type: 'hotel' | 'training' | 'leisure' | 'press' | 'talk' | 'recovery' | 'nutrition' | 'media' | 'operations' | 'leadership'
  label: string
  effects: MetricEffects
  madeAt: string
}

const boundedMetrics: TeamMetric[] = ['morale', 'federation', 'cohesion', 'fatigue', 'pressure', 'tacticalFamiliarity', 'climateAdaptation', 'localSupport', 'recovery']
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export function applyCampDecision(campaign: CampaignUIState, decision: CampDecision): CampaignUIState {
  if (decision.type === 'hotel' && campaign.hotelId) return campaign
  const previous = campaign.decisionLog.find((item) => item.key === decision.key)
  if (previous) return campaign
  const next = { ...campaign, decisionLog: [...campaign.decisionLog, decision] }
  for (const metric of boundedMetrics) {
    const delta = decision.effects[metric]
    if (delta === undefined) continue
    next[metric] = clamp(next[metric] + delta)
  }
  if (decision.type === 'hotel') next.hotelId = decision.key.replace(/^hotel:/, '')
  return next
}

export function teamReadiness(campaign: CampaignUIState) {
  const mental = campaign.morale * 0.28 + campaign.cohesion * 0.28 + campaign.tacticalFamiliarity * 0.24
  const environment = campaign.climateAdaptation * 0.08 + campaign.localSupport * 0.06 + campaign.recovery * 0.06
  const cost = campaign.fatigue * 0.18 + campaign.pressure * 0.08
  return clamp(mental + environment - cost + 16)
}

export function applyCampaignContext(nation: Nation, campaign: CampaignUIState, environment?: MatchEnvironment): Nation {
  const difficultyModifier = campaign.difficulty === 'accesible' ? 2.5 : campaign.difficulty === 'leyenda' ? -1.5 : 0
  const familiarityBoost = (campaign.tacticalFamiliarity - 50) / 12 + difficultyModifier
  const supportBoost = (campaign.localSupport - 50) / 25
  const climateCost = Math.max(0, 55 - campaign.climateAdaptation) / 5
  const environmentFatigue = environment?.fatigueDelta ?? 0
  const environmentCondition = environment?.conditionDelta ?? 0
  const environmentDecision = environment?.decisionDelta ?? 0
  const environmentMorale = environment?.moraleDelta ?? 0
  return {
    ...nation,
    players: nation.players.map((player) => ({
      ...player,
      condition: clamp(92 + campaign.recovery * 0.08 - campaign.fatigue * 0.16 - climateCost + environmentCondition),
      fatigue: clamp(campaign.fatigue + climateCost + environmentFatigue),
      morale: clamp(campaign.morale + supportBoost + environmentMorale),
      sharpness: clamp(player.sharpness + familiarityBoost),
      gameRatings: {
        ...player.gameRatings,
        decisions: clamp(player.gameRatings.decisions + familiarityBoost + environmentDecision),
        positioning: clamp(player.gameRatings.positioning + familiarityBoost),
        passing: clamp(player.gameRatings.passing + familiarityBoost * 0.6),
      },
    })),
  }
}
