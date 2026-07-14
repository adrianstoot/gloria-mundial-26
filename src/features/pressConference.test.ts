import { describe, expect, it } from 'vitest'
import { tournamentData } from '../data'
import { deriveCampaignProgress } from './campaignProgress'
import { buildPressConference, pressConferenceComplete } from './pressConference'
import { initialCampaign } from './ui-model'

describe('country press conferences', () => {
  it('creates a new contextual conference for each controlled fixture', () => {
    const campaign = { ...initialCampaign, nationId: 'esp' }
    const before = deriveCampaignProgress(tournamentData, {}, { controlledNationId: 'esp' })
    const opening = buildPressConference(campaign, before)
    const fixture = before.nextControlledFixture!

    expect(opening.id).toContain(fixture.id)
    expect(opening.questions).toHaveLength(5)
    expect(opening.questions.every((question) => question.id.startsWith(`${opening.id}:`))).toBe(true)
    expect(pressConferenceComplete(campaign, opening)).toBe(false)

    const result = {
      fixtureId: fixture.id,
      homeNationId: fixture.homeNationId!,
      awayNationId: fixture.awayNationId!,
      home: 2,
      away: 0,
      playedAt: fixture.date,
    }
    const after = deriveCampaignProgress(tournamentData, { [fixture.id]: result }, { controlledNationId: 'esp' })
    const next = buildPressConference({ ...campaign, matchResults: { [fixture.id]: result } }, after)
    expect(next.id).not.toBe(opening.id)
    expect(next.context).toContain('después de')
    expect(next.questions[0]?.question).toContain('Después de')
  })

  it('is complete only when all questions in the current conference are answered', () => {
    const campaign = { ...initialCampaign, nationId: 'fra' }
    const progress = deriveCampaignProgress(tournamentData, {}, { controlledNationId: 'fra' })
    const conference = buildPressConference(campaign, progress)
    const pressAnswers = Object.fromEntries(conference.questions.map((question) => [question.id, 'calmada']))
    expect(pressConferenceComplete({ ...campaign, pressAnswers }, conference)).toBe(true)
  })
})
