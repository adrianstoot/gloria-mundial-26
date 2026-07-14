import rawPlayerSeeds from './player-seeds.generated.json'
import { nationById, nations } from './nations'
import type { GameRatings, Nation, Player, PlayerSeed, Position } from './types'

const seeds = rawPlayerSeeds as unknown as PlayerSeed[]

const clamp = (value: number, minimum = 1, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, Math.round(value)))

/** FNV-1a: stable across browsers and deliberately independent from Math.random. */
const hashString = (value: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const noise = (key: string, salt: number, spread = 8) =>
  (hashString(`${key}:${salt}`) % (spread * 2 + 1)) - spread

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const positionBias: Record<Position, Partial<Record<keyof GameRatings, number>>> = {
  GK: { goalkeeping: 15, defending: -8, passing: -3, finishing: -20, dribbling: -12 },
  RB: { defending: 5, pace: 7, stamina: 6, finishing: -8 },
  CB: { defending: 11, strength: 8, pace: -3, finishing: -11, dribbling: -7 },
  LB: { defending: 5, pace: 7, stamina: 6, finishing: -8 },
  DM: { defending: 7, passing: 5, decisions: 6, teamwork: 6, finishing: -5 },
  CM: { passing: 8, technique: 5, decisions: 5, teamwork: 6 },
  AM: { passing: 8, technique: 9, dribbling: 8, finishing: 4, defending: -8 },
  RW: { pace: 10, dribbling: 9, finishing: 5, defending: -10, strength: -3 },
  LW: { pace: 10, dribbling: 9, finishing: 5, defending: -10, strength: -3 },
  ST: { finishing: 12, composure: 7, strength: 4, defending: -13, passing: -3 },
}

const makeRatings = (
  key: string,
  nation: Nation,
  position: Position,
  official: boolean,
  marketValueEur?: number,
): GameRatings => {
  const marketBoost = marketValueEur
    ? clamp((Math.log10(Math.max(100_000, marketValueEur)) - 5) * 2.2, 0, 9)
    : 0
  const overall = clamp(
    nation.teamRating - (official ? 6 : 13) + marketBoost + noise(key, 0, official ? 4 : 6),
    48,
    95,
  )
  const bias = positionBias[position]
  const attribute = (name: keyof GameRatings, salt: number, baseOffset = 0) =>
    clamp(overall + baseOffset + (bias[name] as number | undefined ?? 0) + noise(key, salt, 6), 20, 98)

  return {
    overall,
    technique: attribute('technique', 1),
    passing: attribute('passing', 2),
    finishing: attribute('finishing', 3),
    defending: attribute('defending', 4),
    dribbling: attribute('dribbling', 5),
    decisions: attribute('decisions', 6),
    composure: attribute('composure', 7),
    teamwork: attribute('teamwork', 8),
    pace: attribute('pace', 9),
    stamina: attribute('stamina', 10),
    strength: attribute('strength', 11),
    goalkeeping: position === 'GK' ? attribute('goalkeeping', 12) : clamp(8 + noise(key, 12, 5)),
    confidence: 'modeled',
  }
}

const splitDisplayName = (displayName: string) => {
  const [firstName, ...lastNameParts] = displayName.trim().split(/\s+/)
  return {
    firstName: firstName || displayName,
    lastName: lastNameParts.join(' ') || firstName || displayName,
  }
}

const cleanImportedName = (displayName: string) => displayName
  .replace(/^AlexisAlexis\s+/, 'Alexis ')
  .replace(/^Jean-Philippe\s+Jean-Philippe\s+/, 'Jean-Philippe ')

/** Curated primary/secondary roles for the five playable nations. Generic
 * source labels such as "defender" previously collapsed full-backs into CB. */
const auditedPositions: Record<string, Position[]> = {
  'Marc Pubill':['RB','CB'], 'Alex Grimaldo':['LB','LW'], 'Marcos Llorente':['CM','RW','RB'],
  'Dani Olmo':['AM','LW','RW'], 'Álex Baena':['AM','LW','CM'], 'Mikel Oyarzabal':['ST','LW','AM'],
  'Marc Cucurella':['LB','CB'], 'Pedro Porro':['RB','RW'], 'Lamine Yamal':['RW','AM'], 'Pedri':['CM','AM'],
  'Ousmane Dembélé':['RW','ST','LW'], 'Désiré Doué':['LW','RW','AM'], 'Jules Koundé':['RB','CB'],
  'Eduardo Camavinga':['CM','DM','LB'], 'Christopher Nkunku':['AM','ST','LW'], 'Randal Kolo Muani':['ST','RW'],
  'Theo Hernández':['LB','LW'], 'Lucas Hernández':['CB','LB'], 'Michael Olise':['RW','AM'],
  'Achraf Hakimi':['RB','RW'], 'Noussair Mazraoui':['RB','LB'], 'Brahim Díaz':['AM','RW','ST'],
  'Ismael Saibari':['AM','CM','RW'], 'Bilal El Khannouss':['AM','CM'], 'Eliesse Ben Seghir':['LW','AM'],
  'Declan Rice':['DM','CM'], 'Jude Bellingham':['AM','CM'], 'Bukayo Saka':['RW','LW'], 'Phil Foden':['AM','RW','LW'],
  'Cole Palmer':['AM','RW'], 'Trent Alexander-Arnold':['RB','CM','DM'], 'Reece James':['RB','CB'],
  'Nico O\'Reilly':['LB','CM'], 'Morgan Rogers':['AM','LW'], 'Eberechi Eze':['AM','LW'],
  'Lionel Messi':['RW','AM','ST'], 'Julián Alvarez':['ST','AM','RW'], 'Valentín Barco':['LB','LW','CM'],
  'Alexis Mac Allister':['CM','AM','DM'], 'Enzo Fernández':['CM','DM'], 'Thiago Almada':['AM','LW'],
  'Nico González':['LW','CM'], 'Juan Foyth':['RB','CB'], 'Ángel Correa':['AM','RW','ST'],
}

const seedToPlayer = (seed: PlayerSeed, poolIndex: number): Player => {
  const nation = nationById[seed.nationId]
  if (!nation) throw new Error(`Unknown nation in player seed: ${seed.nationId}`)
  const displayName = cleanImportedName(seed.displayName)
  const positions = auditedPositions[displayName] ?? [seed.position]
  const position = positions[0]!
  const { firstName, lastName } = splitDisplayName(displayName)
  const marker = seed.official2026 ? `o${String(seed.squadNumber).padStart(2, '0')}` : `c${String(poolIndex + 1).padStart(2, '0')}`
  const id = `${seed.nationId}-${marker}-${slugify(displayName)}`

  return {
    id,
    nationId: seed.nationId,
    displayName,
    firstName,
    lastName,
    shirtName: seed.shirtName,
    official2026: seed.official2026,
    squadNumber: seed.squadNumber,
    position,
    positions,
    realStats: {
      fullName: displayName,
      dateOfBirth: seed.dateOfBirth,
      club: seed.club,
      heightCm: seed.heightCm,
      caps: seed.caps,
      goals: seed.goals,
      primaryPosition: position,
      preferredFoot: seed.preferredFoot,
      ...(seed.marketValueEur ? { marketValueEur: seed.marketValueEur } : {}),
    },
    gameRatings: makeRatings(id, nation, position, seed.official2026, seed.marketValueEur),
    dataStatus: seed.official2026 ? 'verified-official' : 'open-data-candidate',
    sourceIds: seed.official2026
      ? ['fifa-official-squads', 'transfermarkt-cc0']
      : [seed.source],
  }
}

const fallbackPositions: Position[] = ['CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST']

const makeSyntheticPlayer = (nation: Nation, poolIndex: number, forceGoalkeeper: boolean): Player => {
  const serial = poolIndex + 1
  const position = forceGoalkeeper ? 'GK' : fallbackPositions[(serial + hashString(nation.id)) % fallbackPositions.length]
  const displayName = `Candidato ${nation.code} ${serial}`
  const id = `${nation.id}-s${String(serial).padStart(2, '0')}`
  const birthYear = 1994 + (hashString(id) % 12)
  const heightCm = position === 'GK' ? 184 + (hashString(`${id}:height`) % 13) : 170 + (hashString(`${id}:height`) % 20)

  return {
    id,
    nationId: nation.id,
    displayName,
    firstName: 'Candidato',
    lastName: `${nation.code} ${serial}`,
    shirtName: `${nation.code} ${serial}`,
    official2026: false,
    position,
    positions: [position],
    realStats: {
      fullName: displayName,
      dateOfBirth: `${birthYear}-${String(1 + (serial % 12)).padStart(2, '0')}-${String(1 + (serial % 27)).padStart(2, '0')}`,
      club: `Programa nacional de ${nation.shortName}`,
      heightCm,
      caps: 0,
      goals: 0,
      primaryPosition: position,
      preferredFoot: 'unknown',
    },
    gameRatings: makeRatings(id, nation, position, false),
    dataStatus: 'synthetic-fallback',
    sourceIds: ['deterministic-fallback-v1'],
  }
}

const buildNationPool = (nation: Nation): Player[] => {
  const nationSeeds = seeds
    .filter((seed) => seed.nationId === nation.id)
    .sort((left, right) => {
      if (left.official2026 !== right.official2026) return left.official2026 ? -1 : 1
      return (left.squadNumber ?? 99) - (right.squadNumber ?? 99)
    })
    .slice(0, 50)
  const players = nationSeeds.map(seedToPlayer)

  // A full real-data pool with only three keepers sacrifices its final non-official
  // outfielder so the game can always present four selectable goalkeepers.
  if (players.length === 50 && players.filter((player) => player.position === 'GK').length < 4) {
    let replaceAt = -1
    for (let index = players.length - 1; index >= 0; index -= 1) {
      if (!players[index].official2026 && players[index].position !== 'GK') {
        replaceAt = index
        break
      }
    }
    if (replaceAt >= 0) players.splice(replaceAt, 1)
  }

  while (players.length < 50) {
    const needsGoalkeeper = players.filter((player) => player.position === 'GK').length < 4
    players.push(makeSyntheticPlayer(nation, players.length, needsGoalkeeper))
  }

  return players
}

export const playersByNation: Record<string, Player[]> = Object.fromEntries(
  nations.map((nation) => [nation.id, buildNationPool(nation)]),
)

export const players: Player[] = nations.flatMap((nation) => playersByNation[nation.id])

export const getNationPlayers = (nationId: string) => playersByNation[nationId] ?? []

export const getOfficialSquad = (nationId: string) =>
  getNationPlayers(nationId).filter((player) => player.official2026)
