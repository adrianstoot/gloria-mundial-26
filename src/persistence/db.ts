import Dexie, { type EntityTable } from 'dexie'

export interface StoredCampaign {
  id: string
  name: string
  managerName: string
  nationId: string
  dataPackId: string
  schemaVersion: number
  currentDate: string
  updatedAt: number
  payload: string
  backupPayload?: string
}

export interface StoredDataPack {
  id: string
  schemaVersion: number
  snapshotDate: string
  installedAt: number
  manifest: string
  payload: string
}

export interface StoredSetting {
  key: string
  value: string
}

class GloriaMundialDatabase extends Dexie {
  campaigns!: EntityTable<StoredCampaign, 'id'>
  dataPacks!: EntityTable<StoredDataPack, 'id'>
  settings!: EntityTable<StoredSetting, 'key'>

  constructor() {
    super('gloria-mundial-26')
    this.version(1).stores({
      campaigns: 'id, updatedAt, nationId, dataPackId',
      dataPacks: 'id, snapshotDate, installedAt',
      settings: 'key',
    })
  }
}

export const db = new GloriaMundialDatabase()
