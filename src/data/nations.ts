import type { Confederation, GroupId, Nation } from './types'

type NationSeed = Omit<Nation, 'id' | 'style' | 'primaryColor' | 'secondaryColor'> & {
  colors: [string, string]
}

const styleByConfederation: Record<Confederation, string> = {
  AFC: 'Bloque disciplinado y transiciones verticales',
  CAF: 'Potencia, ritmo y ataque directo',
  CONCACAF: 'Intensidad, amplitud y presión valiente',
  CONMEBOL: 'Técnica, carácter y control del ritmo',
  OFC: 'Juego directo, energía y duelos aéreos',
  UEFA: 'Estructura táctica y presión coordinada',
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const seeds: NationSeed[] = [
  { name: 'México', shortName: 'México', code: 'MEX', flagCode: 'mx', group: 'A', confederation: 'CONCACAF', worldRanking: 14, teamRating: 81, colors: ['#006847', '#ce1126'] },
  { name: 'Sudáfrica', shortName: 'Sudáfrica', code: 'RSA', flagCode: 'za', group: 'A', confederation: 'CAF', worldRanking: 60, teamRating: 72, colors: ['#007749', '#ffb81c'] },
  { name: 'Corea del Sur', shortName: 'Corea', code: 'KOR', flagCode: 'kr', group: 'A', confederation: 'AFC', worldRanking: 25, teamRating: 78, colors: ['#cd2e3a', '#0047a0'] },
  { name: 'Chequia', shortName: 'Chequia', code: 'CZE', flagCode: 'cz', group: 'A', confederation: 'UEFA', worldRanking: 41, teamRating: 76, colors: ['#d7141a', '#11457e'] },

  { name: 'Canadá', shortName: 'Canadá', code: 'CAN', flagCode: 'ca', group: 'B', confederation: 'CONCACAF', worldRanking: 30, teamRating: 78, colors: ['#d80621', '#ffffff'] },
  { name: 'Bosnia y Herzegovina', shortName: 'Bosnia', code: 'BIH', flagCode: 'ba', group: 'B', confederation: 'UEFA', worldRanking: 64, teamRating: 74, colors: ['#002395', '#fecb00'] },
  { name: 'Catar', shortName: 'Catar', code: 'QAT', flagCode: 'qa', group: 'B', confederation: 'AFC', worldRanking: 56, teamRating: 73, colors: ['#8a1538', '#ffffff'] },
  { name: 'Suiza', shortName: 'Suiza', code: 'SUI', flagCode: 'ch', group: 'B', confederation: 'UEFA', worldRanking: 19, teamRating: 81, colors: ['#d52b1e', '#ffffff'] },

  { name: 'Brasil', shortName: 'Brasil', code: 'BRA', flagCode: 'br', group: 'C', confederation: 'CONMEBOL', worldRanking: 6, teamRating: 87, colors: ['#ffdf00', '#009c3b'] },
  { name: 'Marruecos', shortName: 'Marruecos', code: 'MAR', flagCode: 'ma', group: 'C', confederation: 'CAF', worldRanking: 7, teamRating: 84, colors: ['#c1272d', '#006233'] },
  { name: 'Haití', shortName: 'Haití', code: 'HAI', flagCode: 'ht', group: 'C', confederation: 'CONCACAF', worldRanking: 83, teamRating: 68, colors: ['#00209f', '#d21034'] },
  { name: 'Escocia', shortName: 'Escocia', code: 'SCO', flagCode: 'gb-sct', group: 'C', confederation: 'UEFA', worldRanking: 42, teamRating: 77, colors: ['#005eb8', '#ffffff'] },

  { name: 'Estados Unidos', shortName: 'EE. UU.', code: 'USA', flagCode: 'us', group: 'D', confederation: 'CONCACAF', worldRanking: 17, teamRating: 82, colors: ['#002868', '#bf0a30'] },
  { name: 'Paraguay', shortName: 'Paraguay', code: 'PAR', flagCode: 'py', group: 'D', confederation: 'CONMEBOL', worldRanking: 41, teamRating: 77, colors: ['#d52b1e', '#0038a8'] },
  { name: 'Australia', shortName: 'Australia', code: 'AUS', flagCode: 'au', group: 'D', confederation: 'AFC', worldRanking: 27, teamRating: 78, colors: ['#ffcd00', '#00843d'] },
  { name: 'Turquía', shortName: 'Turquía', code: 'TUR', flagCode: 'tr', group: 'D', confederation: 'UEFA', worldRanking: 22, teamRating: 80, colors: ['#e30a17', '#ffffff'] },

  { name: 'Alemania', shortName: 'Alemania', code: 'GER', flagCode: 'de', group: 'E', confederation: 'UEFA', worldRanking: 10, teamRating: 85, colors: ['#111111', '#dd0000'] },
  { name: 'Curazao', shortName: 'Curazao', code: 'CUW', flagCode: 'cw', group: 'E', confederation: 'CONCACAF', worldRanking: 75, teamRating: 69, colors: ['#002b7f', '#f9e814'] },
  { name: 'Costa de Marfil', shortName: 'C. de Marfil', code: 'CIV', flagCode: 'ci', group: 'E', confederation: 'CAF', worldRanking: 37, teamRating: 78, colors: ['#f77f00', '#009e60'] },
  { name: 'Ecuador', shortName: 'Ecuador', code: 'ECU', flagCode: 'ec', group: 'E', confederation: 'CONMEBOL', worldRanking: 23, teamRating: 80, colors: ['#ffdd00', '#034ea2'] },

  { name: 'Países Bajos', shortName: 'Países Bajos', code: 'NED', flagCode: 'nl', group: 'F', confederation: 'UEFA', worldRanking: 8, teamRating: 85, colors: ['#f36c21', '#1b3c70'] },
  { name: 'Japón', shortName: 'Japón', code: 'JPN', flagCode: 'jp', group: 'F', confederation: 'AFC', worldRanking: 18, teamRating: 81, colors: ['#001f67', '#bc002d'] },
  { name: 'Túnez', shortName: 'Túnez', code: 'TUN', flagCode: 'tn', group: 'F', confederation: 'CAF', worldRanking: 45, teamRating: 74, colors: ['#e70013', '#ffffff'] },
  { name: 'Suecia', shortName: 'Suecia', code: 'SWE', flagCode: 'se', group: 'F', confederation: 'UEFA', worldRanking: 38, teamRating: 79, colors: ['#006aa7', '#fecc02'] },

  { name: 'Bélgica', shortName: 'Bélgica', code: 'BEL', flagCode: 'be', group: 'G', confederation: 'UEFA', worldRanking: 9, teamRating: 84, colors: ['#ef3340', '#ffcd00'] },
  { name: 'Egipto', shortName: 'Egipto', code: 'EGY', flagCode: 'eg', group: 'G', confederation: 'CAF', worldRanking: 29, teamRating: 78, colors: ['#ce1126', '#000000'] },
  { name: 'Irán', shortName: 'Irán', code: 'IRN', flagCode: 'ir', group: 'G', confederation: 'AFC', worldRanking: 20, teamRating: 78, colors: ['#239f40', '#da0000'] },
  { name: 'Nueva Zelanda', shortName: 'N. Zelanda', code: 'NZL', flagCode: 'nz', group: 'G', confederation: 'OFC', worldRanking: 85, teamRating: 70, colors: ['#101820', '#ffffff'] },

  { name: 'España', shortName: 'España', code: 'ESP', flagCode: 'es', group: 'H', confederation: 'UEFA', worldRanking: 2, teamRating: 89, colors: ['#aa151b', '#f1bf00'] },
  { name: 'Cabo Verde', shortName: 'Cabo Verde', code: 'CPV', flagCode: 'cv', group: 'H', confederation: 'CAF', worldRanking: 67, teamRating: 71, colors: ['#003893', '#cf2027'] },
  { name: 'Arabia Saudí', shortName: 'Arabia Saudí', code: 'KSA', flagCode: 'sa', group: 'H', confederation: 'AFC', worldRanking: 61, teamRating: 73, colors: ['#006c35', '#ffffff'] },
  { name: 'Uruguay', shortName: 'Uruguay', code: 'URU', flagCode: 'uy', group: 'H', confederation: 'CONMEBOL', worldRanking: 16, teamRating: 83, colors: ['#5bc0eb', '#111111'] },

  { name: 'Francia', shortName: 'Francia', code: 'FRA', flagCode: 'fr', group: 'I', confederation: 'UEFA', worldRanking: 3, teamRating: 89, colors: ['#002654', '#ed2939'] },
  { name: 'Senegal', shortName: 'Senegal', code: 'SEN', flagCode: 'sn', group: 'I', confederation: 'CAF', worldRanking: 15, teamRating: 81, colors: ['#00853f', '#fdef42'] },
  { name: 'Noruega', shortName: 'Noruega', code: 'NOR', flagCode: 'no', group: 'I', confederation: 'UEFA', worldRanking: 31, teamRating: 82, colors: ['#ba0c2f', '#00205b'] },
  { name: 'Irak', shortName: 'Irak', code: 'IRQ', flagCode: 'iq', group: 'I', confederation: 'AFC', worldRanking: 57, teamRating: 72, colors: ['#ce1126', '#007a3d'] },

  { name: 'Argentina', shortName: 'Argentina', code: 'ARG', flagCode: 'ar', group: 'J', confederation: 'CONMEBOL', worldRanking: 1, teamRating: 89, colors: ['#74acdf', '#ffffff'] },
  { name: 'Argelia', shortName: 'Argelia', code: 'ALG', flagCode: 'dz', group: 'J', confederation: 'CAF', worldRanking: 28, teamRating: 79, colors: ['#006233', '#d21034'] },
  { name: 'Austria', shortName: 'Austria', code: 'AUT', flagCode: 'at', group: 'J', confederation: 'UEFA', worldRanking: 24, teamRating: 80, colors: ['#ed2939', '#ffffff'] },
  { name: 'Jordania', shortName: 'Jordania', code: 'JOR', flagCode: 'jo', group: 'J', confederation: 'AFC', worldRanking: 63, teamRating: 71, colors: ['#ce1126', '#007a3d'] },

  { name: 'Portugal', shortName: 'Portugal', code: 'POR', flagCode: 'pt', group: 'K', confederation: 'UEFA', worldRanking: 5, teamRating: 87, colors: ['#046a38', '#da291c'] },
  { name: 'Uzbekistán', shortName: 'Uzbekistán', code: 'UZB', flagCode: 'uz', group: 'K', confederation: 'AFC', worldRanking: 50, teamRating: 74, colors: ['#0099b5', '#1eb53a'] },
  { name: 'Colombia', shortName: 'Colombia', code: 'COL', flagCode: 'co', group: 'K', confederation: 'CONMEBOL', worldRanking: 13, teamRating: 83, colors: ['#fcd116', '#003893'] },
  { name: 'RD del Congo', shortName: 'RD Congo', code: 'COD', flagCode: 'cd', group: 'K', confederation: 'CAF', worldRanking: 48, teamRating: 76, colors: ['#007fff', '#ce1021'] },

  { name: 'Inglaterra', shortName: 'Inglaterra', code: 'ENG', flagCode: 'gb-eng', group: 'L', confederation: 'UEFA', worldRanking: 4, teamRating: 88, colors: ['#ffffff', '#cf081f'] },
  { name: 'Croacia', shortName: 'Croacia', code: 'CRO', flagCode: 'hr', group: 'L', confederation: 'UEFA', worldRanking: 11, teamRating: 83, colors: ['#ff0000', '#171796'] },
  { name: 'Ghana', shortName: 'Ghana', code: 'GHA', flagCode: 'gh', group: 'L', confederation: 'CAF', worldRanking: 73, teamRating: 74, colors: ['#ce1126', '#fcd116'] },
  { name: 'Panamá', shortName: 'Panamá', code: 'PAN', flagCode: 'pa', group: 'L', confederation: 'CONCACAF', worldRanking: 34, teamRating: 75, colors: ['#da121a', '#072357'] },
]

export const nations: Nation[] = seeds.map(({ colors, ...seed }) => ({
  ...seed,
  id: slugify(seed.code),
  style: styleByConfederation[seed.confederation],
  primaryColor: colors[0],
  secondaryColor: colors[1],
}))

export const groups = Object.fromEntries(
  (Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index)) as GroupId[]).map(
    (group) => [group, nations.filter((nation) => nation.group === group).map((nation) => nation.id)],
  ),
) as Record<GroupId, string[]>

export const nationByCode = Object.fromEntries(nations.map((nation) => [nation.code, nation]))
export const nationById = Object.fromEntries(nations.map((nation) => [nation.id, nation]))
