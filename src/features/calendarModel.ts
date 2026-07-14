import type { FixtureStage } from '../data'
import type { ResolvedCampaignFixture } from './campaignProgress'

export type CalendarScope = 'ALL' | 'MY_TEAM' | 'UPCOMING' | 'PLAYED'
export type CalendarStage = 'ALL' | FixtureStage
export type FixtureUrgency = 'final' | 'today' | 'imminent' | 'scheduled' | 'pending' | 'blocked' | 'invalid'
export type FormResult = 'W' | 'D' | 'L'

export interface CalendarFilters {
  query: string
  stage: CalendarStage
  scope: CalendarScope
  controlledNationId?: string
  nationLabels?: Readonly<Record<string, string>>
  venueLabels?: Readonly<Record<string, string>>
}

export interface CalendarDay {
  date: string
  fixtures: ResolvedCampaignFixture[]
  isCampaignDay: boolean
  containsSpotlight: boolean
}

export interface StageCalendarSummary {
  stage: FixtureStage
  total: number
  played: number
  startDate: string
  endDate: string
}

const stageOrder: readonly FixtureStage[] = [
  'GROUP',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
]

function dayValue(value: string): number {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return Date.UTC(year!, month! - 1, day!)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayValue(to) - dayValue(from)) / 86_400_000)
}

export function fixtureUrgency(
  fixture: ResolvedCampaignFixture,
  campaignDate: string,
): { key: FixtureUrgency; label: string; days: number | null } {
  if (fixture.status === 'played') return { key: 'final', label: 'FINAL', days: null }
  if (fixture.status === 'blocked') return { key: 'blocked', label: 'POR DEFINIR', days: null }
  if (fixture.status === 'invalid') return { key: 'invalid', label: 'REVISAR', days: null }

  const days = daysBetween(campaignDate, fixture.date)
  if (days < 0) return { key: 'pending', label: 'PENDIENTE', days }
  if (days === 0) return { key: 'today', label: 'HOY', days }
  if (days <= 2) return { key: 'imminent', label: `EN ${days} DÍA${days === 1 ? '' : 'S'}`, days }
  return { key: 'scheduled', label: 'PROGRAMADO', days }
}

export function nationForm(
  fixtures: readonly ResolvedCampaignFixture[],
  nationId: string | undefined,
  limit = 5,
): FormResult[] {
  if (!nationId) return []
  return fixtures
    .filter((fixture) => fixture.status === 'played'
      && fixture.result
      && (fixture.homeNationId === nationId || fixture.awayNationId === nationId))
    .sort((left, right) => left.matchNumber - right.matchNumber)
    .slice(-limit)
    .map((fixture) => {
      const isHome = fixture.homeNationId === nationId
      const own = isHome ? fixture.result!.home : fixture.result!.away
      const rival = isHome ? fixture.result!.away : fixture.result!.home
      if (own === rival) return 'D'
      return own > rival ? 'W' : 'L'
    })
}

export function selectSpotlightFixture(
  fixtures: readonly ResolvedCampaignFixture[],
  controlledNationId?: string,
): ResolvedCampaignFixture | undefined {
  const ordered = [...fixtures].sort((left, right) => left.matchNumber - right.matchNumber)
  const unplayed = ordered.filter((fixture) => fixture.status !== 'played')
  const controlled = controlledNationId
    ? unplayed.find((fixture) => fixture.homeNationId === controlledNationId || fixture.awayNationId === controlledNationId)
    : undefined
  return controlled
    ?? unplayed.find((fixture) => fixture.status === 'ready')
    ?? unplayed[0]
    ?? [...ordered].reverse().find((fixture) => fixture.stage === 'FINAL')
    ?? ordered.at(-1)
}

export function filterCalendarFixtures(
  fixtures: readonly ResolvedCampaignFixture[],
  filters: CalendarFilters,
): ResolvedCampaignFixture[] {
  const query = filters.query.trim().toLocaleLowerCase('es')
  return fixtures
    .filter((fixture) => filters.stage === 'ALL' || fixture.stage === filters.stage)
    .filter((fixture) => {
      if (filters.scope === 'ALL') return true
      if (filters.scope === 'PLAYED') return fixture.status === 'played'
      if (filters.scope === 'UPCOMING') return fixture.status !== 'played'
      return Boolean(filters.controlledNationId)
        && (fixture.homeNationId === filters.controlledNationId || fixture.awayNationId === filters.controlledNationId)
    })
    .filter((fixture) => {
      if (!query) return true
      const home = fixture.homeNationId ? filters.nationLabels?.[fixture.homeNationId] : fixture.homeSlot
      const away = fixture.awayNationId ? filters.nationLabels?.[fixture.awayNationId] : fixture.awaySlot
      const venue = filters.venueLabels?.[fixture.venueId]
      return [home, away, venue, fixture.stage, fixture.group, `partido ${fixture.matchNumber}`]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es')
        .includes(query)
    })
    .sort((left, right) => left.matchNumber - right.matchNumber)
}

export function groupCalendarDays(
  fixtures: readonly ResolvedCampaignFixture[],
  campaignDate: string,
  spotlightFixtureId?: string,
): CalendarDay[] {
  const groups = new Map<string, ResolvedCampaignFixture[]>()
  fixtures.forEach((fixture) => {
    const date = fixture.date.slice(0, 10)
    groups.set(date, [...(groups.get(date) ?? []), fixture])
  })
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayFixtures]) => ({
      date,
      fixtures: dayFixtures.sort((left, right) => left.date.localeCompare(right.date)),
      isCampaignDay: date === campaignDate.slice(0, 10),
      containsSpotlight: dayFixtures.some((fixture) => fixture.id === spotlightFixtureId),
    }))
}

export function stageCalendarSummaries(fixtures: readonly ResolvedCampaignFixture[]): StageCalendarSummary[] {
  return stageOrder.map((stage) => {
    const stageFixtures = fixtures.filter((fixture) => fixture.stage === stage)
    const dates = stageFixtures.map((fixture) => fixture.date.slice(0, 10)).sort()
    return {
      stage,
      total: stageFixtures.length,
      played: stageFixtures.filter((fixture) => fixture.status === 'played').length,
      startDate: dates[0] ?? '',
      endDate: dates.at(-1) ?? '',
    }
  })
}
