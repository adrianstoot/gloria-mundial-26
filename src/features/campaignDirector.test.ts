import { describe, expect, it } from 'vitest'
import { buildContextualBriefing, generateAgenda, generateWorldNotifications } from './campaignDirector'
import { initialCampaign } from './ui-model'

describe('CampaignV3 director', () => {
  it('builds a deterministic, ordered agenda with mandatory opening decisions', () => {
    const first = generateAgenda(initialCampaign)
    const second = generateAgenda(initialCampaign)

    expect(second).toEqual(first)
    expect(first.length).toBeGreaterThan(20)
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length)
    expect(first).toEqual([...first].sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time)))
    expect(first.filter((item) => item.date === initialCampaign.date && item.mandatory).map((item) => item.type)).toEqual(expect.arrayContaining(['federation', 'travel', 'training']))
  })

  it('prioritises a mandatory agenda event and gives Álex one concrete route', () => {
    const campaign = { ...initialCampaign, agenda: generateAgenda(initialCampaign) }
    const briefing = buildContextualBriefing(campaign, '/juego')

    expect(briefing.urgency).toBe('critical')
    expect(briefing.actions).toHaveLength(1)
    expect(briefing.actions[0]?.route).toBe('/juego/convocatoria')
    expect(briefing.confidence).toBeGreaterThanOrEqual(90)
  })

  it('reacts to medical load and public pressure without network data', () => {
    const notices = generateWorldNotifications({ ...initialCampaign, squadConfirmed: true, fatigue: 64, pressure: 72 })

    expect(notices.some((item) => item.category === 'medical' && item.urgency === 'high')).toBe(true)
    expect(notices.some((item) => item.category === 'press' && item.urgency === 'high')).toBe(true)
    expect(notices.every((item) => item.createdAt === initialCampaign.date && item.read === false)).toBe(true)
  })
})
