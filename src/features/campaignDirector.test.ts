import { describe, expect, it } from 'vitest'
import { buildContextualBriefing, generateAgenda, generateWorldNotifications } from './campaignDirector'
import { initialCampaign } from './ui-model'
import { tournamentData } from '../data'

describe('CampaignV3 director', () => {
  it('builds a deterministic, ordered agenda whose preparation missions are optional', () => {
    const first = generateAgenda(initialCampaign)
    const second = generateAgenda(initialCampaign)

    expect(second).toEqual(first)
    expect(first.length).toBeGreaterThan(20)
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length)
    expect(first).toEqual([...first].sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time)))
    expect(first.filter((item) => item.type !== 'match').every((item) => item.mandatory === false)).toBe(true)
    expect(first.some((item) => item.type === 'training' && item.summary.includes('estado del equipo no cambia'))).toBe(true)
  })

  it('guides the player to the next optional daily mission without blocking the calendar', () => {
    const campaign = { ...initialCampaign, agenda: generateAgenda(initialCampaign) }
    const briefing = buildContextualBriefing(campaign, '/juego')

    expect(briefing.urgency).toBe('normal')
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

  it('turns the controlled fixture into a directly playable calendar mission', () => {
    const fixture = tournamentData.fixtures.find((item) => item.homeNationId === initialCampaign.nationId || item.awayNationId === initialCampaign.nationId)
    expect(fixture).toBeTruthy()
    const agenda = generateAgenda({ ...initialCampaign, date: fixture!.date.slice(0, 10) })
    const match = agenda.find((item) => item.type === 'match')

    expect(match?.route).toBe(`/partido?fixture=${fixture!.id}`)
    expect(match?.priority).toBe('critical')
    expect(match?.mandatory).toBe(false)
  })
})
