import type { DataSource } from './types'

export const dataSources: DataSource[] = [
  {
    id: 'fifa-official-squads',
    name: 'FIFA World Cup 2026 — Squad Lists',
    url: 'https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf',
    license: 'Datos factuales publicados por FIFA; sin redistribución de recursos gráficos',
    retrievedAt: '2026-07-11',
    usage: 'Los 26 convocados oficiales de cada selección: nombre, fecha de nacimiento, club, altura, partidos y goles.',
  },
  {
    id: 'transfermarkt-cc0',
    name: 'transfermarkt-datasets',
    url: 'https://github.com/dcaribou/transfermarkt-datasets',
    license: 'CC0-1.0',
    retrievedAt: '2026-07-11',
    usage: 'Candidatos adicionales, posición específica, pie preferido y datos de club disponibles.',
  },
  {
    id: 'openfootball-worldcup-cc0',
    name: 'openfootball/worldcup.json',
    url: 'https://github.com/openfootball/worldcup.json',
    license: 'CC0-1.0',
    retrievedAt: '2026-07-11',
    usage: 'Fechas, cruces de grupos y sedes. Se eliminaron todos los resultados para la línea temporal alternativa.',
  },
  {
    id: 'wikimedia-cc-by-sa',
    name: 'Wikimedia — Zeus de la Paz',
    url: 'https://en.wikipedia.org/wiki/Zeus_de_la_Paz',
    license: 'CC BY-SA 4.0',
    retrievedAt: '2026-07-11',
    usage: 'Cuarto guardameta internacional histórico del pool ampliado de Curazao.',
  },
  {
    id: 'flag-icons-mit',
    name: 'flag-icons',
    url: 'https://github.com/lipis/flag-icons',
    license: 'MIT',
    retrievedAt: '2026-07-11',
    usage: 'Códigos ISO/territoriales compatibles con las banderas mostradas por la aplicación.',
  },
]

export const dataManifest = {
  id: 'world-cup-2026-v1' as const,
  schemaVersion: 1,
  snapshotDate: '2026-06-02' as const,
  generatedAt: '2026-07-11T00:00:00+02:00',
  language: 'es',
  nationCount: 48,
  candidatesPerNation: 50,
  totalPlayerCount: 2_400,
  officialPlayersPerNation: 26,
  officialPlayerCount: 1_248,
  minimumPoolGoalkeepers: 4,
  scheduleMatchCount: 104,
  resultsIncluded: false,
  gameRatingsModel: 'gm26-original-v1',
  sources: dataSources.map(({ id, license, retrievedAt }) => ({ id, license, retrievedAt })),
}
