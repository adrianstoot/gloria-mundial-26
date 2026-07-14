# Gloria Mundial 26

## Jugar online

La versión pública se despliega automáticamente en:

**https://adrianstoot.github.io/gloria-mundial-26/**

En móvil se juega en horizontal. Cada cambio enviado a `main` ejecuta pruebas, genera la PWA y vuelve a publicar GitHub Pages automáticamente.

PWA de escritorio en español para dirigir una selección durante una línea temporal alternativa del Mundial 2026. Es una obra original para uso local: no copia el motor, la interfaz ni los recursos de Football Manager, FIFA u otros productos comerciales.

## Campaña jugable

- Seleccionables: España, Francia, Marruecos, Inglaterra y Argentina.
- Torneo simulado: las 48 selecciones, 12 grupos, mejores terceros, cuadro completo y 104 partidos.
- Calendario: del 25 de mayo al 19 de julio de 2026, sin resultados reales precargados.
- Flujo completo: portada, seleccionador, país, convocatoria guiada por el asistente virtual, concentración, preparación, partidos, eliminación o ceremonia final.
- Tras una eliminación se mantiene el modo espectador hasta conocer al campeón.

## Sistemas principales

- Pool local de 50 futbolistas reales por país, con 26 convocados de referencia y un mínimo de cuatro porteros. Los hechos (`realStats`) están separados de las estimaciones originales 1–100 (`gameRatings`).
- Convocatoria libre de 26, mínimo de tres porteros, dorsales editables, capitán y lanzadores.
- Hotel, clima, viajes, privacidad, apoyo local, ejercicios diarios, microciclo de siete días, descanso y actividades de tiempo libre.
- Entorno de partido calculado por sede: temperatura, humedad, viento, altitud, kilómetros desde el hotel, descanso, calidad del césped y reparto de apoyo. Sus efectos modifican condición, fatiga, moral y decisiones.
- Moral, cohesión, presión, fatiga, recuperación, confianza, adaptación y familiaridad; cada decisión queda registrada y llega al motor.
- Diez formaciones, posiciones libres, detección inteligente de demarcación, rendimiento efectivo según encaje, roles, mentalidad, pase, ritmo, amplitud, presión, línea, transición, marcaje e instrucciones combinables.
- Prensa propia de cada país con medios reales y texto original. Hay una comparecencia contextual antes de cada partido y otra al producirse una eliminación.
- Partido 2D determinista con paso de 100 ms, aceleración, frenada, inercia, separación, reacciones escalonadas, presión selectiva y bloques distintos para reinicio, salida, progresión, último tercio y transición.
- Pases, centros y tiros recorren el campo durante varios pasos; la animación, el marcador y las estadísticas nacen del mismo evento. La IA protege o remonta según minuto, resultado, expulsiones y cansancio.
- Tensión dinámica, narrativa filtrada, momentos de estrella, iluminación progresiva y presentación especial de goles, VAR, eliminatorias y penaltis.
- Simulación de jornadas IA en Web Worker, planes tácticos en directo, cinco cambios, ventanas, cambio de conmoción y cambio adicional en prórroga.
- Audio de estadio procedural, volumen, mute, texto para eventos, reducción de movimiento y pantalla completa.
- Autoguardado local en IndexedDB con copia anterior recuperable, además de exportación e importación `.gm26save`.
- PWA instalable y caché offline después de la primera carga.
- Centro del Mundial visual con partido estelar, jornadas, filtros, sedes, aforos, forma, urgencia y recorrido interactivo hasta la final.
- Fotografía editorial original para hotel, entrenamiento, táctica, prensa y calendario; los jugadores usan identificadores abstractos sin rostro y camisetas originales con los colores nacionales.

## Datos y licencias

El snapshot `world-cup-2026-v1` contiene 48 selecciones, 2.400 candidatos, 1.248 convocados de referencia, 16 sedes y 104 encuentros. Las fuentes, fechas de consulta, uso y licencias están documentadas en [`src/data/README.md`](src/data/README.md) y [`src/data/metadata.ts`](src/data/metadata.ts). Las banderas proceden de `flag-icons` (MIT). La portada panorámica y el logotipo son originales del proyecto.

No se incluyen fotografías de jugadores, escudos, equipaciones oficiales, música, trofeos ni marcas sin licencia. Todos los futbolistas aparecen sin rostro mediante una ficha abstracta y una camiseta propia que solo utiliza la paleta nacional. La actualidad periodística aporta contexto, pero las preguntas y respuestas son redacción original. El inventario y los prompts de los recursos generados están documentados en [`public/assets/ASSETS.md`](public/assets/ASSETS.md).

## Desarrollo

Requiere Node.js y pnpm:

```powershell
pnpm install
pnpm dev
```

Abrir `http://localhost:4173` en Chrome o Edge. Resolución mínima de juego: 1366×768.

## Calidad

```powershell
pnpm test
pnpm data:validate
pnpm license:audit
pnpm sim:calibrate
pnpm build
```

Las pruebas validan los 2.400 jugadores, porteros, listas de 26, IDs, fuentes, 104 partidos, desempates, ocho mejores terceros, las 495 rutas del Anexo C, determinismo, cambios, tarjetas, prórroga, penaltis, recorrido del cuadro y 10.000 muestras Monte Carlo.

## Arquitectura

- `src/domain`: contratos puros del torneo, partido y guardado.
- `src/simulation`: PRNG, reglas, motor, worker, campaña, cuadro y calibración.
- `src/features`: onboarding, gestión, concentración, prensa, torneo y centro de partido.
- `src/data`: snapshot autocontenido y metadatos auditables.
- `src/persistence`: Dexie, copias de seguridad, importación y packs de datos.
