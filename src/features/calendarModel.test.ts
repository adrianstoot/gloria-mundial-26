import { describe, expect, it } from 'vitest'
import type { ResolvedCampaignFixture } from './campaignProgress'
import {
  filterCalendarFixtures,
  fixtureUrgency,
  groupCalendarDays,
  nationForm,
  selectSpotlightFixture,
  stageCalendarSummaries,
} from './calendarModel'

const fixtures: ResolvedCampaignFixture[] = [
  { id: 'm1', matchNumber: 1, stage: 'GROUP', group: 'A', date: '2026-06-11T13:00:00-06:00', venueId: 'mex', homeNationId: 'esp', awayNationId: 'fra', status: 'played', result: { fixtureId: 'm1', homeNationId: 'esp', awayNationId: 'fra', home: 2, away: 1 } },
  { id: 'm2', matchNumber: 2, stage: 'GROUP', group: 'A', date: '2026-06-12T18:00:00-04:00', venueId: 'mia', homeNationId: 'arg', awayNationId: 'esp', status: 'played', result: { fixtureId: 'm2', homeNationId: 'arg', awayNationId: 'esp', home: 0, away: 0 } },
  { id: 'm3', matchNumber: 3, stage: 'GROUP', group: 'A', date: '2026-06-15T18:00:00-04:00', venueId: 'mia', homeNationId: 'esp', awayNationId: 'mar', status: 'ready' },
  { id: 'm4', matchNumber: 73, stage: 'ROUND_OF_32', date: '2026-06-28T18:00:00-04:00', venueId: 'atl', homeSlot: '1A', awaySlot: '3C/D/E/F/I', status: 'blocked' },
]

describe('calendar model', () => {
  it('prioritises the next match involving the controlled team', () => {
    expect(selectSpotlightFixture(fixtures, 'esp')?.id).toBe('m3')
  })

  it('derives urgency relative to the campaign day', () => {
    expect(fixtureUrgency(fixtures[2]!, '2026-06-15')).toMatchObject({ key: 'today', label: 'HOY' })
    expect(fixtureUrgency(fixtures[2]!, '2026-06-13')).toMatchObject({ key: 'imminent', days: 2 })
    expect(fixtureUrgency(fixtures[0]!, '2026-06-15').key).toBe('final')
  })

  it('combines phase, team and text filters without losing fixture order', () => {
    const labels = { esp: 'España', fra: 'Francia', arg: 'Argentina', mar: 'Marruecos' }
    const filtered = filterCalendarFixtures(fixtures, {
      query: 'marruecos', stage: 'GROUP', scope: 'MY_TEAM', controlledNationId: 'esp', nationLabels: labels,
    })
    expect(filtered.map((fixture) => fixture.id)).toEqual(['m3'])
  })

  it('groups a jornada and preserves form in chronological order', () => {
    expect(groupCalendarDays(fixtures, '2026-06-15', 'm3').find((day) => day.date === '2026-06-15')).toMatchObject({ isCampaignDay: true, containsSpotlight: true })
    expect(nationForm(fixtures, 'esp')).toEqual(['W', 'D'])
  })

  it('summarises the complete route including empty later rounds', () => {
    const summary = stageCalendarSummaries(fixtures)
    expect(summary).toHaveLength(7)
    expect(summary.find((item) => item.stage === 'GROUP')).toMatchObject({ total: 3, played: 2 })
    expect(summary.at(-1)?.stage).toBe('FINAL')
  })
})
