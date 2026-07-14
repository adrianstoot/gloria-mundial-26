import JSZip from 'jszip'
import { z } from 'zod'
import { db } from './db'

const sourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  license: z.string().min(1),
})

export const dataPackManifestSchema = z.object({
  id: z.string().regex(/^world-cup-2026-[a-z0-9-]+$/),
  schemaVersion: z.number().int().positive(),
  snapshotDate: z.string().date(),
  title: z.string().min(1),
  sources: z.array(sourceSchema).min(1),
  hashes: z.record(z.string()).default({}),
})

export interface DataPackPreview {
  manifest: z.infer<typeof dataPackManifestSchema>
  nationCount: number
  playerCount: number
  fixtureCount: number
  rawPayload: string
}

export async function previewDataPack(file: File): Promise<DataPackPreview> {
  if (file.size > 100 * 1024 * 1024) throw new Error('El pack supera el límite de 100 MB.')
  const zip = await JSZip.loadAsync(file)
  const manifestEntry = zip.file('manifest.json')
  const payloadEntry = zip.file('data.json')
  if (!manifestEntry || !payloadEntry) throw new Error('El pack necesita manifest.json y data.json.')
  const manifest = dataPackManifestSchema.parse(JSON.parse(await manifestEntry.async('string')))
  const rawPayload = await payloadEntry.async('string')
  const payload = JSON.parse(rawPayload) as { nations?: unknown[]; players?: unknown[]; fixtures?: unknown[] }
  return {
    manifest,
    nationCount: payload.nations?.length ?? 0,
    playerCount: payload.players?.length ?? 0,
    fixtureCount: payload.fixtures?.length ?? 0,
    rawPayload,
  }
}

export async function installDataPack(preview: DataPackPreview) {
  if (preview.nationCount !== 48 || preview.playerCount !== 2400 || preview.fixtureCount !== 104) {
    throw new Error('El pack debe contener 48 selecciones, 2.400 jugadores y 104 partidos.')
  }
  await db.dataPacks.put({
    id: preview.manifest.id,
    schemaVersion: preview.manifest.schemaVersion,
    snapshotDate: preview.manifest.snapshotDate,
    installedAt: Date.now(),
    manifest: JSON.stringify(preview.manifest),
    payload: preview.rawPayload,
  })
}
