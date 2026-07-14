import { describe, expect, it } from 'vitest'
import { starProfile } from './starPlayers'

describe('star profiles', () => {
  it('recognises headline players independently of accents and shirt-name form', () => {
    expect(starProfile({ shirtName:'MBAPPE',realStats:{ fullName:'Kylian Mbappe' } })?.tier).toBe(3)
    expect(starProfile({ shirtName:'ÁLVAREZ',realStats:{ fullName:'Julián Alvarez' } })?.billing).toContain('Delantero')
    expect(starProfile({ shirtName:'MAC ALLISTER',realStats:{} })?.clutch).toBeGreaterThan(90)
  })
})
