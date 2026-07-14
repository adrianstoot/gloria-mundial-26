import { toDomainDataPack, toDomainNation, toDomainTournamentConfig } from './domainAdapter'
import { dataSources } from './metadata'
import { groups, nationByCode, nationById, nations } from './nations'
import { players, playersByNation } from './players'
import { fixtures, venues } from './tournament'
import type { TournamentData } from './types'

export * from './types'
export { dataManifest, dataSources } from './metadata'
export { groups, nationByCode, nationById, nations } from './nations'
export { getNationPlayers, getOfficialSquad, players, playersByNation } from './players'
export { fixtures, venues } from './tournament'
export { toDomainDataPack, toDomainFixture, toDomainNation, toDomainPlayer, toDomainTournamentConfig } from './domainAdapter'

export const tournamentData: TournamentData = {
  id: 'world-cup-2026-v1',
  snapshotDate: '2026-06-02',
  campaignStart: '2026-05-25',
  tournamentStart: '2026-06-11',
  tournamentEnd: '2026-07-19',
  groups,
  nations,
  playersByNation,
  venues,
  fixtures,
  sources: dataSources,
}

export const domainNations = nations.map((nation) =>
  toDomainNation(nation, playersByNation[nation.id]),
)

export const domainTournament = toDomainTournamentConfig(tournamentData)
export const worldCupDataPack = toDomainDataPack(tournamentData)

export const getNation = (nationIdOrCode: string) =>
  nationById[nationIdOrCode.toLowerCase()] ?? nationByCode[nationIdOrCode.toUpperCase()]

export const playerCount = players.length
