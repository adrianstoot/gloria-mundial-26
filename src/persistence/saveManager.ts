import { db, type StoredCampaign } from './db'

export const SAVE_SCHEMA_VERSION = 1

export interface CampaignEnvelope<T = unknown> {
  schemaVersion: number
  dataPackId: string
  savedAt: string
  state: T
}

export async function saveCampaign<T>(metadata: Omit<StoredCampaign, 'payload' | 'updatedAt' | 'schemaVersion'>, state: T) {
  const existing = await db.campaigns.get(metadata.id)
  const envelope: CampaignEnvelope<T> = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    dataPackId: metadata.dataPackId,
    savedAt: new Date().toISOString(),
    state,
  }
  const payload = JSON.stringify(envelope)
  await db.campaigns.put({
    ...metadata,
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    payload,
    backupPayload: existing?.payload,
  })
}

export async function loadCampaign<T>(id: string): Promise<CampaignEnvelope<T> | undefined> {
  const stored = await db.campaigns.get(id)
  if (!stored) return undefined
  try {
    return migrateEnvelope(JSON.parse(stored.payload) as CampaignEnvelope<T>)
  } catch {
    if (!stored.backupPayload) throw new Error('La partida está dañada y no existe una copia recuperable.')
    return migrateEnvelope(JSON.parse(stored.backupPayload) as CampaignEnvelope<T>)
  }
}

function migrateEnvelope<T>(envelope: CampaignEnvelope<T>): CampaignEnvelope<T> {
  if (envelope.schemaVersion > SAVE_SCHEMA_VERSION) {
    throw new Error('Esta partida fue creada con una versión más reciente de Gloria Mundial 26.')
  }
  return { ...envelope, schemaVersion: SAVE_SCHEMA_VERSION }
}

export async function listCampaigns() {
  return db.campaigns.orderBy('updatedAt').reverse().limit(5).toArray()
}

export async function deleteCampaign(id: string) {
  await db.campaigns.delete(id)
}

export function exportCampaign<T>(envelope: CampaignEnvelope<T>, filename: string) {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${filename.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()}.gm26save`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function importCampaign<T>(file: File): Promise<CampaignEnvelope<T>> {
  if (file.size > 20 * 1024 * 1024) throw new Error('El archivo supera el límite de 20 MB.')
  const parsed = JSON.parse(await file.text()) as CampaignEnvelope<T>
  if (!parsed || typeof parsed !== 'object' || !('state' in parsed) || !('schemaVersion' in parsed)) {
    throw new Error('El archivo no es una partida válida de Gloria Mundial 26.')
  }
  return migrateEnvelope(parsed)
}
