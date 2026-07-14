# Datos de Gloria Mundial 26

El módulo exporta un snapshot autocontenido y sin peticiones de red durante el juego. `index.ts` es la API pública estable: `nations`, `playersByNation`, `tournamentData`, `domainNations` y sus helpers.

## Cobertura

- 48 selecciones distribuidas en los 12 grupos oficiales, 50 candidatos por país y 104 encuentros sin resultados precargados.
- Los 1.248 registros con `official2026: true` proceden de la lista oficial de FIFA (26 por país). El PDF consultado es dinámico y su versión del 10 de julio puede reflejar sustituciones por lesión aprobadas después de la publicación inicial del 2 de junio.
- Los otros 1.152 son futbolistas reales encontrados en el dataset abierto indicado en `metadata.ts`. En selecciones con poca cobertura se incorporan internacionales históricos; por eso un candidato no oficial no implica que estuviera en la lista provisional de 2026 ni que siguiera activo el 2 de junio.
- Curazao necesitaba un cuarto portero para el selector de 50: se añadió al internacional Zeus de la Paz desde Wikimedia, con atribución CC BY-SA. El snapshot actual no usa ningún nombre sintético; el generador determinista de `players.ts` queda como salvaguarda ante futuros packs incompletos.

## Separación de hechos y estimaciones

`realStats` conserva los hechos disponibles de las fuentes. `gameRatings` usa exclusivamente el modelo determinista original `gm26-original-v1`; no reproduce valoraciones ni algoritmos de Football Manager. La ausencia de club se muestra como “Sin club registrado” y no se interpreta como confirmación de que el jugador estuviera libre.

No se incluyen fotografías, escudos, equipaciones, música ni marcas de terceros.
