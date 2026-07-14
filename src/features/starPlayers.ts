import type { UIPlayer } from './ui-model'

export interface StarProfile {
  tier: 1 | 2 | 3
  billing: string
  pressure: number
  clutch: number
}

const normalize = (value: string) => value
  .trim()
  .replace(/\s+/g, ' ')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleUpperCase('es-ES')

const rawStarProfiles: Record<string, StarProfile> = {
  'LIONEL MESSI': { tier: 3, billing: 'Leyenda mundial', pressure: 100, clutch: 98 },
  'KYLIAN MBAPPÉ': { tier: 3, billing: 'Superestrella mundial', pressure: 98, clutch: 96 },
  'LAMINE YAMAL': { tier: 3, billing: 'Fenómeno generacional', pressure: 95, clutch: 93 },
  'JUDE BELLINGHAM': { tier: 3, billing: 'Líder total', pressure: 95, clutch: 94 },
  'HARRY KANE': { tier: 3, billing: 'Capitán y goleador', pressure: 96, clutch: 95 },
  'ACHRAF HAKIMI': { tier: 3, billing: 'Capitán referente', pressure: 94, clutch: 92 },
  'RODRI': { tier: 3, billing: 'Director del juego', pressure: 93, clutch: 94 },
  'OUSMANE DEMBÉLÉ': { tier: 2, billing: 'Desequilibrio mundial', pressure: 90, clutch: 90 },
  'PEDRI': { tier: 2, billing: 'Cerebro creativo', pressure: 88, clutch: 91 },
  'NICO WILLIAMS': { tier: 2, billing: 'Amenaza al espacio', pressure: 86, clutch: 88 },
  'BUKAYO SAKA': { tier: 2, billing: 'Extremo decisivo', pressure: 90, clutch: 91 },
  'DECLAN RICE': { tier: 2, billing: 'Motor del equipo', pressure: 86, clutch: 89 },
  'COLE PALMER': { tier: 2, billing: 'Especialista bajo presión', pressure: 89, clutch: 94 },
  'PHIL FODEN': { tier: 2, billing: 'Talento diferencial', pressure: 87, clutch: 89 },
  'BRAHIM DÍAZ': { tier: 2, billing: 'Talento entre líneas', pressure: 88, clutch: 90 },
  'YASSINE BOUNOU': { tier: 2, billing: 'Guardameta de noches grandes', pressure: 89, clutch: 95 },
  'JULIÁN ALVAREZ': { tier: 2, billing: 'Delantero total', pressure: 91, clutch: 93 },
  'LAUTARO MARTÍNEZ': { tier: 2, billing: 'Goleador de élite', pressure: 91, clutch: 92 },
  'EMILIANO MARTÍNEZ': { tier: 3, billing: 'Especialista en momentos límite', pressure: 94, clutch: 99 },
  'ALEXIS MAC ALLISTER': { tier: 2, billing: 'Equilibrio campeón', pressure: 86, clutch: 91 },
  'WILLIAM SALIBA': { tier: 2, billing: 'Central dominante', pressure: 85, clutch: 90 },
  'MIKE MAIGNAN': { tier: 2, billing: 'Portero de élite', pressure: 87, clutch: 94 },
}

const starProfiles: Record<string, StarProfile> = Object.fromEntries(
  Object.entries(rawStarProfiles).map(([name, profile]) => [normalize(name), profile]),
)

export function starProfile(player: Pick<UIPlayer, 'shirtName' | 'realStats'>): StarProfile | undefined {
  const fullName = player.realStats.fullName ?? player.realStats.name ?? player.shirtName
  const shirtName = normalize(player.shirtName)
  return starProfiles[normalize(fullName)]
    ?? starProfiles[shirtName]
    ?? Object.entries(starProfiles).find(([name]) => shirtName.length >= 5 && name.endsWith(` ${shirtName}`))?.[1]
}

export function isStarPlayer(player: Pick<UIPlayer, 'shirtName' | 'realStats'>) {
  return Boolean(starProfile(player))
}

export const featuredStarNames = Object.keys(rawStarProfiles)
