import rawGroupFixtures from './group-fixtures.generated.json'
import rawKnockoutFixtures from './knockout-fixtures.generated.json'
import type { GroupId, TournamentFixture, Venue } from './types'

export const venues: Venue[] = [
  { id: 'atlanta', name: 'Atlanta Stadium', city: 'Atlanta', country: 'United States', capacity: 75_000 },
  { id: 'boston', name: 'Boston Stadium', city: 'Foxborough', country: 'United States', capacity: 65_878 },
  { id: 'dallas', name: 'Dallas Stadium', city: 'Arlington', country: 'United States', capacity: 80_000 },
  { id: 'guadalajara', name: 'Guadalajara Stadium', city: 'Zapopan', country: 'Mexico', capacity: 48_071 },
  { id: 'houston', name: 'Houston Stadium', city: 'Houston', country: 'United States', capacity: 72_220 },
  { id: 'kansas-city', name: 'Kansas City Stadium', city: 'Kansas City', country: 'United States', capacity: 73_000 },
  { id: 'los-angeles', name: 'Los Angeles Stadium', city: 'Inglewood', country: 'United States', capacity: 70_240 },
  { id: 'mexico-city', name: 'Mexico City Stadium', city: 'Ciudad de México', country: 'Mexico', capacity: 83_264 },
  { id: 'miami', name: 'Miami Stadium', city: 'Miami Gardens', country: 'United States', capacity: 64_767 },
  { id: 'monterrey', name: 'Monterrey Stadium', city: 'Guadalupe', country: 'Mexico', capacity: 53_500 },
  { id: 'new-york', name: 'New York New Jersey Stadium', city: 'East Rutherford', country: 'United States', capacity: 82_500 },
  { id: 'philadelphia', name: 'Philadelphia Stadium', city: 'Philadelphia', country: 'United States', capacity: 69_796 },
  { id: 'sf-bay', name: 'San Francisco Bay Area Stadium', city: 'Santa Clara', country: 'United States', capacity: 68_500 },
  { id: 'seattle', name: 'Seattle Stadium', city: 'Seattle', country: 'United States', capacity: 68_740 },
  { id: 'toronto', name: 'Toronto Stadium', city: 'Toronto', country: 'Canada', capacity: 45_736 },
  { id: 'vancouver', name: 'BC Place Vancouver', city: 'Vancouver', country: 'Canada', capacity: 54_500 },
]

const fixtureId = (matchNumber: number) => `match-${String(matchNumber).padStart(3, '0')}`

const groupFixtures = rawGroupFixtures.map((fixture) => ({
  ...fixture,
  group: fixture.group as GroupId,
  id: fixtureId(fixture.matchNumber),
  stage: 'GROUP' as const,
})) satisfies TournamentFixture[]

const knockoutFixtures = rawKnockoutFixtures.map((fixture) => ({
  ...fixture,
  id: fixtureId(fixture.matchNumber),
})) as TournamentFixture[]

export const fixtures: TournamentFixture[] = [...groupFixtures, ...knockoutFixtures].sort(
  (left, right) => left.matchNumber - right.matchNumber,
)
