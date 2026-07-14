import { assetUrl } from '../utils/assetUrl'

export type TeamMetric =
  | 'morale' | 'federation' | 'cohesion' | 'fatigue' | 'pressure'
  | 'tacticalFamiliarity' | 'climateAdaptation' | 'localSupport' | 'recovery'

export type MetricEffects = Partial<Record<TeamMetric, number>>

export interface HotelOption {
  id: string
  nationCodes: string[]
  name: string
  location: string
  profile: string
  climate: string
  travel: string
  effects: MetricEffects
  visual?: string
  identity?: string
  tradeoff?: string
}

export interface ActivityOption {
  id: string
  name: string
  description: string
  duration: string
  effects: MetricEffects
}

export interface TrainingExercise extends ActivityOption {
  category: 'recovery' | 'technical' | 'tactical' | 'physical' | 'set-pieces'
  intensity: 'baja' | 'media' | 'alta'
}

export type DailyDecisionType = 'recovery' | 'nutrition' | 'media' | 'operations' | 'leadership'

export interface DailyDecisionGroup {
  id: DailyDecisionType
  name: string
  description: string
  options: ActivityOption[]
}

export interface PressAnswer {
  tone: 'calmada' | 'ambiciosa' | 'protectora' | 'confrontativa'
  text: string
  effects: MetricEffects
}

export interface CountryPressQuestion {
  id: string
  outlet: string
  journalist: string
  topic: string
  question: string
  answers: PressAnswer[]
  sourceUrl?: string
}

export const PLAYABLE_NATION_CODES = ['ESP', 'FRA', 'MAR', 'ENG', 'ARG'] as const

export const hotels: HotelOption[] = [
  { id: 'atlantic-performance', nationCodes: ['ESP', 'FRA', 'MAR', 'ENG', 'ARG'], name: 'Atlantic Performance Campus', location: 'Fort Lauderdale, Florida', profile: 'Complejo aislado junto al mar, con campos privados y recuperación de élite.', climate: 'Calor húmedo; aclimatación excelente para Miami y Atlanta.', travel: 'Más desplazamiento hacia sedes del norte.', effects: { recovery: 6, climateAdaptation: 8, fatigue: -3, pressure: -2, localSupport: 4 }, visual: assetUrl('assets/hotel-coastal-v3.webp'), identity: 'RECUPERACIÓN Y CLIMA', tradeoff: 'Más horas de viaje si el cuadro te lleva al norte.' },
  { id: 'dallas-central', nationCodes: ['ESP', 'FRA', 'MAR', 'ENG', 'ARG'], name: 'Lone Star High Performance', location: 'Dallas, Texas', profile: 'Centro deportivo central con máxima calidad de césped y análisis.', climate: 'Calor seco y sesiones controladas.', travel: 'Ubicación equilibrada para el cuadro continental.', effects: { tacticalFamiliarity: 6, climateAdaptation: 5, recovery: 3, fatigue: -2, localSupport: 1 }, visual: assetUrl('assets/hotel-urban-v3.webp'), identity: 'RENDIMIENTO Y ANÁLISIS', tradeoff: 'Menos privacidad y menor conexión con la afición.' },
  { id: 'new-york-urban', nationCodes: ['ESP', 'FRA', 'ENG', 'MAR', 'ARG'], name: 'Metropolitan Football Residence', location: 'New Jersey', profile: 'Hotel urbano premium, cerca de medios, patrocinadores y gran afición.', climate: 'Templado y variable.', travel: 'Óptimo para la costa este.', effects: { localSupport: 8, federation: 3, pressure: 6, fatigue: 1 } },
  { id: 'boston-harbor', nationCodes: ['FRA', 'MAR', 'ENG'], name: 'Harbor Elite Retreat', location: 'Boston, Massachusetts', profile: 'Entorno tranquilo, seguridad alta y acceso limitado a prensa.', climate: 'Más fresco; menor carga térmica.', travel: 'Muy favorable en sedes del nordeste.', effects: { recovery: 7, pressure: -5, cohesion: 3, climateAdaptation: -1, localSupport: 2 } },
  { id: 'miami-community', nationCodes: ['ARG', 'ESP', 'MAR'], name: 'South Florida Community Base', location: 'Miami, Florida', profile: 'Base integrada en una comunidad futbolera con entrenamientos abiertos puntuales.', climate: 'Calor y humedad intensos.', travel: 'Ideal para partidos del sudeste.', effects: { localSupport: 12, morale: 5, climateAdaptation: 7, pressure: 4, recovery: -1 } },
  { id: 'secluded-mountain', nationCodes: ['ESP', 'FRA', 'MAR', 'ENG', 'ARG'], name: 'Blue Ridge Quiet Camp', location: 'Carolina del Norte', profile: 'Privacidad total, naturaleza y cero distracciones exteriores.', climate: 'Altitud moderada y noches frescas.', travel: 'Traslados medios a todas las sedes.', effects: { pressure: -9, cohesion: 6, recovery: 4, localSupport: -5, federation: -1 }, visual: assetUrl('assets/hotel-mountain-v3.webp'), identity: 'PRIVACIDAD Y COHESIÓN', tradeoff: 'Menos apoyo local y adaptación más lenta al calor.' },
]

export const leisureActivities: ActivityOption[] = [
  { id: 'family-afternoon', name: 'Tarde con las familias', description: 'Reduce la tensión, aunque rompe parte de la rutina competitiva.', duration: '4 h', effects: { morale: 7, pressure: -6, cohesion: -1, fatigue: -2 } },
  { id: 'team-dinner', name: 'Cena de equipo', description: 'Mesa común sin móviles para reforzar vínculos y jerarquías.', duration: '2 h', effects: { cohesion: 7, morale: 3, fatigue: 1 } },
  { id: 'community-event', name: 'Encuentro con la afición local', description: 'Clínic infantil y firmas en la ciudad anfitriona.', duration: '3 h', effects: { localSupport: 9, morale: 3, federation: 2, fatigue: 2, pressure: 2 } },
  { id: 'recovery-pool', name: 'Piscina y recuperación libre', description: 'Trabajo individual supervisado y desconexión silenciosa.', duration: '90 min', effects: { recovery: 7, fatigue: -6, pressure: -2 } },
  { id: 'video-night', name: 'Noche de vídeo táctico', description: 'Análisis voluntario del rival con el cuerpo técnico.', duration: '75 min', effects: { tacticalFamiliarity: 6, pressure: 2, fatigue: 1 } },
  { id: 'city-walk', name: 'Paseo controlado por la ciudad', description: 'Contacto con el entorno y descanso mental con seguridad.', duration: '2 h', effects: { morale: 4, localSupport: 3, pressure: -3, fatigue: 1 } },
  { id: 'complete-rest', name: 'Descanso total en habitaciones', description: 'Sin actos, pantallas tácticas ni compromisos comerciales.', duration: 'Tarde completa', effects: { recovery: 9, fatigue: -8, cohesion: -2, federation: -1 } },
]

export const trainingExercises: TrainingExercise[] = [
  { id: 'regeneration', name: 'Regeneración y movilidad', description: 'Bicicleta suave, movilidad, frío y tratamiento individual.', duration: '60 min', category: 'recovery', intensity: 'baja', effects: { recovery: 9, fatigue: -8, tacticalFamiliarity: -1 } },
  { id: 'rondos', name: 'Rondos de orientación', description: 'Perfiles corporales, tercer hombre y juego a uno o dos toques.', duration: '70 min', category: 'technical', intensity: 'media', effects: { tacticalFamiliarity: 4, cohesion: 3, fatigue: 3 } },
  { id: 'pressing-six', name: 'Presión 6 contra 6 + comodines', description: 'Saltos coordinados, cierres interiores y reacción tras pérdida.', duration: '75 min', category: 'tactical', intensity: 'alta', effects: { tacticalFamiliarity: 7, cohesion: 2, fatigue: 8, recovery: -3 } },
  { id: 'build-up', name: 'Salida ante presión alta', description: 'Portero, centrales y pivote resuelven bloqueos del rival.', duration: '80 min', category: 'tactical', intensity: 'media', effects: { tacticalFamiliarity: 7, pressure: -1, fatigue: 5 } },
  { id: 'low-block', name: 'Bloque medio y defensa del área', description: 'Distancias, coberturas, centros laterales y segundas jugadas.', duration: '80 min', category: 'tactical', intensity: 'media', effects: { tacticalFamiliarity: 6, cohesion: 4, fatigue: 5 } },
  { id: 'transitions', name: 'Transiciones 8 segundos', description: 'Finalizar o recuperar la estructura en ocho segundos.', duration: '70 min', category: 'physical', intensity: 'alta', effects: { tacticalFamiliarity: 5, fatigue: 9, recovery: -4, morale: 1 } },
  { id: 'finishing', name: 'Finalización bajo presión', description: 'Remates tras ruptura, centros rasos y segundas acciones.', duration: '65 min', category: 'technical', intensity: 'media', effects: { morale: 3, tacticalFamiliarity: 3, fatigue: 4 } },
  { id: 'set-pieces', name: 'Balón parado completo', description: 'Córners, faltas laterales, bloqueos legales y defensa zonal.', duration: '65 min', category: 'set-pieces', intensity: 'baja', effects: { tacticalFamiliarity: 6, cohesion: 2, fatigue: 2 } },
  { id: 'penalties', name: 'Penaltis con presión simulada', description: 'Orden de lanzadores, rutina, porteros y ruido de grada.', duration: '50 min', category: 'set-pieces', intensity: 'baja', effects: { pressure: -3, morale: 2, tacticalFamiliarity: 2, fatigue: 1 } },
  { id: 'heat-acclimation', name: 'Aclimatación al calor', description: 'Bloques cortos a la hora del partido con hidratación medida.', duration: '55 min', category: 'physical', intensity: 'media', effects: { climateAdaptation: 8, fatigue: 6, recovery: -2 } },
]

export const dailyDecisionGroups: DailyDecisionGroup[] = [
  {
    id: 'recovery', name: 'Protocolo de recuperación', description: 'Decide cómo reparar el cuerpo sin perder activación competitiva.',
    options: [
      { id: 'sleep-first', name: 'Sueño prioritario', description: 'Móviles fuera a las 22:30, control de luz y despertar escalonado.', duration: '9 h', effects: { recovery: 9, fatigue: -7, tacticalFamiliarity: -1 } },
      { id: 'contrast-water', name: 'Contrastes e hidroterapia', description: 'Baños fríos y calientes por grupos con seguimiento individual.', duration: '70 min', effects: { recovery: 8, fatigue: -5, cohesion: 2 } },
      { id: 'individual-physio', name: 'Tratamiento individual', description: 'El área médica prioriza a titulares con mayor riesgo muscular.', duration: '90 min', effects: { recovery: 6, fatigue: -4, federation: 1, cohesion: -1 } },
      { id: 'activation', name: 'Activación competitiva', description: 'Movilidad, rondo suave y finalización breve para mantener chispa.', duration: '45 min', effects: { tacticalFamiliarity: 3, morale: 2, fatigue: 2, recovery: 1 } },
    ],
  },
  {
    id: 'nutrition', name: 'Nutrición e hidratación', description: 'El clima, el horario y la carga cambian lo que necesita el grupo.',
    options: [
      { id: 'hydration-heat', name: 'Plan de calor y electrolitos', description: 'Pesaje, sodio individual y reposición medida antes de dormir.', duration: 'Todo el día', effects: { climateAdaptation: 5, recovery: 4, fatigue: -2 } },
      { id: 'carb-load', name: 'Carga de hidratos', description: 'Menú de partido para elevar reservas de energía y tolerancia al esfuerzo.', duration: 'Cena', effects: { recovery: 3, fatigue: -3, morale: 1 } },
      { id: 'mediterranean', name: 'Menú mediterráneo', description: 'Comida familiar, ligera y reconocible para reducir estrés digestivo.', duration: 'Comida y cena', effects: { morale: 3, recovery: 3, pressure: -1 } },
      { id: 'local-cuisine', name: 'Cocina local supervisada', description: 'Acercamiento cultural con cantidades y alérgenos bajo control.', duration: 'Cena', effects: { localSupport: 4, morale: 4, recovery: -1 } },
    ],
  },
  {
    id: 'media', name: 'Política de medios', description: 'La exposición puede acercar al público o cargar de ruido al vestuario.',
    options: [
      { id: 'open-training', name: 'Entrenamiento abierto 20 minutos', description: 'Cámaras y afición ven el calentamiento; el trabajo táctico queda cerrado.', duration: '20 min', effects: { localSupport: 6, federation: 2, pressure: 3 } },
      { id: 'captain-only', name: 'Habla el capitán', description: 'El líder protege al grupo y asume el relato antes del partido.', duration: '15 min', effects: { cohesion: 3, pressure: -2, morale: 2 } },
      { id: 'manager-front', name: 'El seleccionador da la cara', description: 'Toda la responsabilidad pública recae en el cuerpo técnico.', duration: '25 min', effects: { pressure: -4, morale: 2, federation: -1 } },
      { id: 'closed-doors', name: 'Silencio y puertas cerradas', description: 'Sin entrevistas ni imágenes durante veinticuatro horas.', duration: '24 h', effects: { pressure: -7, tacticalFamiliarity: 2, localSupport: -3, federation: -2 } },
    ],
  },
  {
    id: 'operations', name: 'Viaje y logística', description: 'Hora de salida, seguridad y descanso condicionan el día de partido.',
    options: [
      { id: 'travel-early', name: 'Viajar con 48 horas', description: 'Máxima adaptación a la sede, a costa de abandonar antes la base.', duration: '48 h antes', effects: { climateAdaptation: 5, fatigue: -3, cohesion: -1 } },
      { id: 'travel-late', name: 'Dormir en la base y volar tarde', description: 'Mantiene rutinas, pero deja menos margen ante retrasos.', duration: '24 h antes', effects: { recovery: 4, fatigue: 1, pressure: 2 } },
      { id: 'split-groups', name: 'Desplazamiento por grupos', description: 'Titulares y suplentes siguen cargas y horarios diferentes.', duration: 'Plan escalonado', effects: { recovery: 3, tacticalFamiliarity: 2, cohesion: -3 } },
      { id: 'supporter-arrival', name: 'Llegada junto a la afición', description: 'El autobús atraviesa el recibimiento y eleva la temperatura emocional.', duration: '45 min extra', effects: { morale: 5, localSupport: 7, pressure: 4, fatigue: 1 } },
    ],
  },
  {
    id: 'leadership', name: 'Gestión del vestuario', description: 'Las jerarquías necesitan espacio, voz y responsabilidad compartida.',
    options: [
      { id: 'player-council', name: 'Consejo de cinco jugadores', description: 'Capitán, veterano, joven, portero y suplente llevan el pulso del grupo.', duration: '30 min', effects: { cohesion: 6, morale: 2, federation: 1 } },
      { id: 'captain-speech', name: 'Mensaje privado del capitán', description: 'El cuerpo técnico sale y el liderazgo nace desde dentro.', duration: '15 min', effects: { cohesion: 5, pressure: -2, morale: 3 } },
      { id: 'psychology-circle', name: 'Sesión con psicología', description: 'Respiración, visualización y conversación sobre miedo al error.', duration: '45 min', effects: { pressure: -6, morale: 3, cohesion: 2 } },
      { id: 'competitive-edge', name: 'Competencia abierta por el once', description: 'Nadie tiene el puesto garantizado hasta la última sesión.', duration: 'Hasta el partido', effects: { tacticalFamiliarity: 3, morale: 1, pressure: 4, cohesion: -2 } },
    ],
  },
]

const standardAnswers = (subject: string): PressAnswer[] => [
  { tone: 'calmada', text: `Lo importante es el equipo. ${subject} se gestionará con serenidad y datos.`, effects: { pressure: -2, cohesion: 2, federation: 1 } },
  { tone: 'ambiciosa', text: `No evitamos la expectativa: tenemos nivel para responder en el campo.`, effects: { morale: 4, pressure: 4, federation: 2 } },
  { tone: 'protectora', text: `La responsabilidad es mía; los jugadores necesitan confianza y tranquilidad.`, effects: { morale: 3, pressure: -4, federation: -1 } },
  { tone: 'confrontativa', text: `Respeto la pregunta, pero no voy a permitir que se desestabilice al grupo.`, effects: { cohesion: 3, pressure: 6, federation: -3, localSupport: -1 } },
]

const baseCountryPress: Record<string, CountryPressQuestion[]> = {
  ESP: [
    { id: 'esp-lamine-load', outlet: 'MARCA', journalist: 'Enviado especial de MARCA', topic: 'Estado físico', question: '¿Cómo administrará la carga de Lamine Yamal y Nico Williams después de una temporada con molestias?', answers: standardAnswers('Su carga'), sourceUrl: 'https://elpais.com/deportes/mundial-futbol/2026-05-25/convocatoria-de-espana-para-el-mundial-luis-de-la-fuente-desvela-la-lista-de-26-futbolistas-de-la-seleccion-espanola.html' },
    { id: 'esp-rodri', outlet: 'Diario AS', journalist: 'Corresponsal de Diario AS', topic: 'Liderazgo', question: '¿Será Rodri el eje del equipo y el referente para controlar los momentos de máxima presión?', answers: standardAnswers('El liderazgo de Rodri'), sourceUrl: 'https://as.com/futbol/seleccion/rodri-ganar-con-tu-pais-es-mas-especial-que-con-tu-club-f202606-n/' },
    { id: 'esp-expectation', outlet: 'Cadena SER', journalist: 'Redacción de Deportes SER', topic: 'Expectativa', question: 'España llega entre las favoritas: ¿cómo evita que la confianza se convierta en obligación?', answers: standardAnswers('La expectativa') },
  ],
  FRA: [
    { id: 'fra-mbappe', outlet: "L'Équipe", journalist: "Enviado especial de L'Équipe", topic: 'Capitanía', question: '¿Cómo equilibrará el liderazgo y la libertad ofensiva de Kylian Mbappé con las necesidades colectivas?', answers: standardAnswers('El rol de Mbappé'), sourceUrl: 'https://www.lequipe.fr/Football/France/' },
    { id: 'fra-attack', outlet: 'RMC Sport', journalist: 'Corresponsal de RMC Sport', topic: 'Ataque', question: 'Con Dembélé, Olise, Doué y Mbappé, ¿cómo repartirá minutos sin romper las jerarquías?', answers: standardAnswers('La competencia ofensiva') },
    { id: 'fra-favourite', outlet: 'Le Parisien', journalist: 'Redacción de Le Parisien', topic: 'Favoritismo', question: '¿Acepta que Francia tiene la obligación de llegar al último fin de semana?', answers: standardAnswers('El favoritismo') },
  ],
  MAR: [
    { id: 'mar-hakimi', outlet: 'Hespress', journalist: 'Corresponsal de Hespress', topic: 'Capitán', question: '¿Qué peso tendrá Achraf Hakimi en el campo y en las decisiones internas del grupo?', answers: standardAnswers('El liderazgo de Hakimi'), sourceUrl: 'https://en.hespress.com/138803-fifa-moroccos-world-cup-squad-reflects-new-era-under-coach-mohamed-ouahbi.html' },
    { id: 'mar-2022', outlet: 'Arryadia', journalist: 'Enviado especial de Arryadia', topic: 'Historia', question: '¿La semifinal de 2022 es una inspiración o una presión que este equipo debe olvidar?', answers: standardAnswers('El legado de 2022') },
    { id: 'mar-balance', outlet: 'Le Matin', journalist: 'Redacción deportiva de Le Matin', topic: 'Identidad', question: '¿Mantendrá el bloque y la transición que hicieron histórico a Marruecos o buscará dominar más el balón?', answers: standardAnswers('La nueva identidad') },
  ],
  ENG: [
    { id: 'eng-kane', outlet: 'BBC Sport', journalist: 'Corresponsal de BBC Sport', topic: 'Capitán', question: '¿Cómo gestionará los minutos de Harry Kane sin perder su influencia como capitán y goleador?', answers: standardAnswers('Los minutos de Kane'), sourceUrl: 'https://www.bbc.co.uk/sport/football/articles/c1728r0l218o' },
    { id: 'eng-bellingham', outlet: 'Sky Sports', journalist: 'Enviado especial de Sky Sports', topic: 'Sistema', question: '¿Construirá el mediocampo alrededor de Jude Bellingham o le pedirá adaptarse al plan colectivo?', answers: standardAnswers('El rol de Bellingham') },
    { id: 'eng-pressure', outlet: 'The Guardian', journalist: 'Corresponsal de The Guardian', topic: 'Presión histórica', question: 'Inglaterra lleva décadas conviviendo con la expectativa: ¿qué hará diferente este vestuario?', answers: standardAnswers('La presión histórica') },
  ],
  ARG: [
    { id: 'arg-messi', outlet: 'TyC Sports', journalist: 'Enviado especial de TyC Sports', topic: 'Messi', question: '¿Cómo decidirá los minutos de Lionel Messi y cuánto condicionará su estado físico el plan?', answers: standardAnswers('Los minutos de Messi'), sourceUrl: 'https://www.tycsports.com/seleccion-argentina/scaloni-rompio-el-silencio-como-esta-messi-y-las-posibles-sorpresas-en-la-lista-de-la-seleccion-argentina-id732827.html' },
    { id: 'arg-title', outlet: 'Olé', journalist: 'Corresponsal de Olé', topic: 'Defensa del título', question: '¿Defender la corona cambia la obligación o este grupo sigue jugando con hambre de aspirante?', answers: standardAnswers('La defensa del título') },
    { id: 'arg-transition', outlet: 'Clarín', journalist: 'Redacción deportiva de Clarín', topic: 'Renovación', question: '¿Cómo equilibrará a los campeones veteranos con la generación que pide sitio?', answers: standardAnswers('El recambio generacional') },
  ],
}

const countryPressExtras: Record<string, CountryPressQuestion[]> = {
  ESP: [
    { id: 'esp-pedri', outlet: 'RTVE Deportes', journalist: 'Enviada especial de RTVE', topic: 'Centro del campo', question: '¿Qué plan de minutos tiene para Pedri y cómo protegerá su influencia cuando el partido se rompa?', answers: standardAnswers('La gestión de Pedri') },
    { id: 'esp-nine', outlet: 'El País', journalist: 'Corresponsal de El País', topic: 'Delantero', question: '¿Necesita España un nueve fijo o la movilidad de los atacantes puede ser una ventaja durante todo el torneo?', answers: standardAnswers('La referencia ofensiva') },
    { id: 'esp-defence', outlet: 'COPE', journalist: 'Equipo de Deportes COPE', topic: 'Defensa', question: 'El equipo quiere dominar muy arriba: ¿cómo evitará que las transiciones rivales castiguen la espalda de la defensa?', answers: standardAnswers('El equilibrio defensivo') },
    { id: 'esp-nico-lamine', outlet: 'Mundo Deportivo', journalist: 'Enviado de Mundo Deportivo', topic: 'Extremos', question: '¿Pueden Lamine y Nico jugar siempre juntos o habrá rivales que exijan un extremo más conservador?', answers: standardAnswers('La pareja de extremos') },
    { id: 'esp-youth', outlet: 'Relevo', journalist: 'Redacción de Relevo', topic: 'Juventud', question: 'Hay futbolistas muy jóvenes bajo un foco enorme: ¿quién los protege cuando el ruido supera al fútbol?', answers: standardAnswers('La protección de los jóvenes') },
    { id: 'esp-heat', outlet: 'El Chiringuito', journalist: 'Reportero de El Chiringuito', topic: 'Clima', question: 'Con calor, humedad y viajes largos, ¿veremos un equipo menos agresivo en la presión de lo habitual?', answers: standardAnswers('La adaptación al clima') },
    { id: 'esp-set-pieces', outlet: 'La Vanguardia', journalist: 'Corresponsal de La Vanguardia', topic: 'Balón parado', question: 'Los torneos se deciden en detalles: ¿cuánto trabajo específico dedica España al balón parado y a los penaltis?', answers: standardAnswers('El balón parado') },
  ],
  FRA: [
    { id: 'fra-dembele', outlet: 'France Football', journalist: 'Enviado de France Football', topic: 'Dembélé', question: '¿Cómo aprovechará la libertad de Dembélé sin que el equipo pierda estructura cuando él abandona la banda?', answers: standardAnswers('La libertad de Dembélé') },
    { id: 'fra-midfield', outlet: 'TF1', journalist: 'Equipo de Téléfoot', topic: 'Centro del campo', question: '¿Quién fija el ritmo de Francia cuando el rival niega las transiciones y obliga a atacar en estático?', answers: standardAnswers('El control del partido') },
    { id: 'fra-defence', outlet: 'Le Monde', journalist: 'Corresponsal de Le Monde', topic: 'Defensa', question: 'Francia acumula centrales de élite: ¿elegirá por jerarquía, por estado físico o por compatibilidad?', answers: standardAnswers('La pareja de centrales') },
    { id: 'fra-egos', outlet: 'Canal+ France', journalist: 'Enviado de Canal+', topic: 'Jerarquías', question: '¿Cómo mantendrá comprometido a un banquillo lleno de campeones cuando algunos apenas tengan minutos?', answers: standardAnswers('La gestión de jerarquías') },
    { id: 'fra-pressure', outlet: 'beIN Sports France', journalist: 'Presentador de beIN Sports', topic: 'Presión', question: '¿La etiqueta de favorita libera a Francia por su experiencia o multiplica el miedo al fracaso?', answers: standardAnswers('La presión exterior') },
    { id: 'fra-travel', outlet: 'franceinfo', journalist: 'Redacción deportiva de franceinfo', topic: 'Logística', question: '¿Ha pedido cambios en viajes, descanso o entrenamientos para soportar las distancias del torneo?', answers: standardAnswers('La logística') },
    { id: 'fra-penalties', outlet: 'Eurosport France', journalist: 'Analista de Eurosport', topic: 'Penaltis', question: '¿La tanda se entrena como una acción técnica, una decisión mental o una prueba de liderazgo?', answers: standardAnswers('La preparación de penaltis') },
  ],
  MAR: [
    { id: 'mar-bono', outlet: 'Medi 1 TV', journalist: 'Enviado especial de Medi 1 TV', topic: 'Portería', question: '¿Hasta qué punto la experiencia de Bono cambia la valentía de la línea defensiva y la gestión de los penaltis?', answers: standardAnswers('La influencia de Bono') },
    { id: 'mar-brahim', outlet: 'Al Aoula', journalist: 'Redacción deportiva de Al Aoula', topic: 'Brahim Díaz', question: '¿Dónde puede ser más decisivo Brahim Díaz: entre líneas, partiendo desde banda o cerca del delantero?', answers: standardAnswers('El rol de Brahim') },
    { id: 'mar-support', outlet: '2M', journalist: 'Corresponsal de 2M', topic: 'Afición', question: 'La diáspora promete convertir cada sede en casa: ¿cómo usar ese apoyo sin que se transforme en ansiedad?', answers: standardAnswers('La fuerza de la afición') },
    { id: 'mar-young', outlet: 'MAP Sport', journalist: 'Periodista de MAP Sport', topic: 'Generación', question: '¿Qué jóvenes están preparados para asumir responsabilidades si el torneo exige refrescar al equipo?', answers: standardAnswers('El relevo generacional') },
    { id: 'mar-possession', outlet: 'SNRTnews', journalist: 'Equipo de SNRTnews', topic: 'Posesión', question: 'Contra bloques bajos, ¿tiene Marruecos suficientes mecanismos para llevar la iniciativa sin exponerse?', answers: standardAnswers('El ataque posicional') },
    { id: 'mar-heat', outlet: 'TelQuel', journalist: 'Corresponsal de TelQuel', topic: 'Preparación', question: '¿La elección del hotel y del horario de entrenamiento responde al calor o a una decisión puramente deportiva?', answers: standardAnswers('La preparación ambiental') },
    { id: 'mar-ambition', outlet: 'Al Mountakhab', journalist: 'Enviado de Al Mountakhab', topic: 'Ambición', question: 'Después de demostrar que Marruecos puede llegar lejos, ¿cuál es ahora el límite real de este grupo?', answers: standardAnswers('La ambición del equipo') },
  ],
  ENG: [
    { id: 'eng-saka', outlet: 'ITV Sport', journalist: 'Equipo de ITV Sport', topic: 'Saka', question: '¿Cómo protegerá a Bukayo Saka de la sobrecarga sin perder su conexión con Kane y Bellingham?', answers: standardAnswers('La carga de Saka') },
    { id: 'eng-palmer', outlet: 'The Athletic', journalist: 'Corresponsal de The Athletic', topic: 'Creatividad', question: '¿Tiene Cole Palmer un papel de titular, de revulsivo o depende por completo del rival?', answers: standardAnswers('El papel de Palmer') },
    { id: 'eng-midfield', outlet: 'The Times', journalist: 'Football correspondent de The Times', topic: 'Mediocampo', question: '¿Puede Inglaterra alinear a todos sus grandes talentos interiores sin perder equilibrio ni amplitud?', answers: standardAnswers('El equilibrio del mediocampo') },
    { id: 'eng-defence', outlet: 'The Telegraph', journalist: 'Enviado de The Telegraph', topic: 'Defensa', question: '¿La salida desde atrás es una convicción innegociable o habrá partidos para jugar de forma más directa?', answers: standardAnswers('La salida de balón') },
    { id: 'eng-fans', outlet: 'talkSPORT', journalist: 'Reportero de talkSPORT', topic: 'Afición', question: '¿Qué les dice a quienes sienten que esta generación ya no puede pedir más tiempo ni paciencia?', answers: standardAnswers('El mensaje a la afición') },
    { id: 'eng-hotel', outlet: 'The Independent', journalist: 'Corresponsal de The Independent', topic: 'Concentración', question: '¿Por qué eligió esta base y qué ventaja concreta espera obtener en clima, descanso o privacidad?', answers: standardAnswers('La elección de la base') },
    { id: 'eng-penalties', outlet: 'Daily Mail', journalist: 'Enviado del Daily Mail', topic: 'Penaltis', question: '¿Ya existe una lista cerrada de lanzadores o quiere decidirla según confianza y fatiga en cada partido?', answers: standardAnswers('La lista de lanzadores') },
  ],
  ARG: [
    { id: 'arg-julian', outlet: 'ESPN Argentina', journalist: 'Enviado de ESPN Argentina', topic: 'Ataque', question: '¿Julián Álvarez y Lautaro Martínez compiten por un puesto o contempla verlos juntos en partidos cerrados?', answers: standardAnswers('La competencia de los delanteros') },
    { id: 'arg-macallister', outlet: 'La Nación', journalist: 'Corresponsal de La Nación', topic: 'Mediocampo', question: '¿Qué función tendrá Mac Allister para sostener al equipo cuando los laterales y los interiores ataquen a la vez?', answers: standardAnswers('El equilibrio de Mac Allister') },
    { id: 'arg-captaincy', outlet: 'DSports', journalist: 'Equipo de DSports', topic: 'Liderazgo', question: 'Si Messi necesita descansar, ¿quién lleva el brazalete y quién asume la última decisión con la pelota?', answers: standardAnswers('El liderazgo alternativo') },
    { id: 'arg-young', outlet: 'Radio Mitre', journalist: 'Corresponsal de Radio Mitre', topic: 'Renovación', question: '¿Qué joven se ha ganado un lugar por rendimiento y no solo por ser parte del futuro?', answers: standardAnswers('La oportunidad de los jóvenes') },
    { id: 'arg-pressure', outlet: 'Página/12', journalist: 'Redacción de Deportes de Página/12', topic: 'Expectativa', question: '¿Cómo evita que el recuerdo del último título impida a este grupo construir una historia propia?', answers: standardAnswers('El peso del recuerdo') },
    { id: 'arg-fans', outlet: 'Infobae', journalist: 'Enviado de Infobae', topic: 'Afición', question: 'Habrá un recibimiento masivo en cada ciudad: ¿permite el contacto con la gente o protege la rutina?', answers: standardAnswers('La relación con la afición') },
    { id: 'arg-setpieces', outlet: 'El Gráfico', journalist: 'Periodista de El Gráfico', topic: 'Detalles', question: '¿Qué porcentaje de la preparación dedica a córners, faltas laterales y posibles tandas de penaltis?', answers: standardAnswers('Los detalles del torneo') },
  ],
}

export const countryPress: Record<string, CountryPressQuestion[]> = Object.fromEntries(
  PLAYABLE_NATION_CODES.map((code) => [code, [...(baseCountryPress[code] ?? []), ...(countryPressExtras[code] ?? [])]]),
)
