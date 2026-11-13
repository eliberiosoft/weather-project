# Feature Specification: Indicador de carga, placeholders y splash animado

**Feature Branch**: `015-carga-placeholders-splash`

**Created**: 2026-11-09

**Status**: Implementado (falta probar el splash en un teléfono con la app instalada)

**Input**: Pedido del dueño: «ponle un loading para cuando esté lento, según la carga ponle placeholder, y cuando instales la app que tenga un splash screen con animación».

Aplica a los dos frontends: la app ciudadana (`cliente/`) y el panel (`admin/`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Se nota que algo está cargando (Priority: P1)

Con señal débil, la persona ve que la app está trabajando en vez de una pantalla quieta o vacía.

**Why this priority**: con mala señal, una pantalla quieta parece colgada y la gente cierra la app justo cuando más la necesita.

**Independent Test**: en DevTools, con «Slow 3G», abrir la app y cada vista.

**Acceptance Scenarios**:

1. **Given** una petición a la API que tarda más de 400 ms, **When** sigue pendiente, **Then** aparece arriba una barra de progreso fina e indeterminada, con `role="progressbar"` y la etiqueta i18n «Cargando…». Si la respuesta llega antes de 400 ms, no aparece nada, para que no parpadee.
2. **Given** una carga que pasa de 8 s, **When** sigue pendiente, **Then** aparece un aviso discreto: «La conexión está lenta; seguimos intentando», con un botón «Reintentar».
3. **Given** que no hay red pero sí datos en la caché, **When** se abre una vista, **Then** se muestran los datos guardados con su aviso de «sin conexión», no placeholders eternos.

---

### User Story 2 - Placeholders con la forma de lo que viene (Priority: P1)

Mientras llega el primer dato de una vista, se ven bloques grises suaves («skeletons») con la misma forma y tamaño del contenido final. Así la página no salta al llegar los datos.

**Acceptance Scenarios**:

1. **App, «Mi lugar»:** banda del nivel, mosaico de lluvia y río, «qué hacer» y la lista de calles.
2. **App, otras vistas:**
   - «Vecinos»: 3 tarjetas de publicación con su miniatura.
   - «Avisos»: 2 tarjetas.
   - Mapa: un aviso pequeño «Cargando capas…» sobre el mapa mientras bajan las capas que se encendieron.
3. **Panel:** según la pestaña, filas de tabla, tarjetas o listas (Situación, Reportes, Incidentes, Usuarios, Avisos, Reglas, Ajustes).
4. **Given** que llegan los datos, **When** se reemplaza el placeholder, **Then** el contenido no se desplaza: el cambio de diseño (CLS) es menor de 0,1.
5. **Given** `prefers-reduced-motion: reduce`, **When** se ven los placeholders, **Then** no tienen el brillo animado, solo el bloque estático.
6. Los placeholders tienen `aria-hidden="true"` y el contenedor `aria-busy="true"`. El lector de pantalla oye «Cargando…» una sola vez.

---

### User Story 3 - Splash animado al abrir la app instalada (Priority: P2)

Al abrir la app desde el ícono, ya instalada, aparece una pantalla de bienvenida breve y animada, con el ícono y el nombre. El paso desde la pantalla del sistema operativo es continuo, sin un salto de color.

**Acceptance Scenarios**:

1. **Given** que la app corre como instalada (`display-mode: standalone` o `navigator.standalone` en iOS), **When** arranca, **Then** se ve el splash animado.
   - Se cierra con un fundido cuando llegan los primeros datos o el contenido guardado.
   - Dura 900 ms como mínimo y 4 s como máximo.
2. **Given** la app en una pestaña del navegador, **When** se abre, **Then** NO hay splash: pasa directo a los placeholders.
3. **Given** `prefers-reduced-motion`, **When** se ve el splash, **Then** es estático, con un fundido corto.
4. **Animación del splash de la app:** gotas o una onda de agua suave sobre la paleta cielo de `DESIGN.md`, sin colores del semáforo. Debe quedar resuelta en menos de 1 s.
5. **Splash del panel:** una versión sobria con el ícono, «Panel del equipo» y una barra de progreso.
6. **Manifiestos:** `background_color` y `theme_color` coinciden con el fondo del splash, para que el splash del sistema operativo (Android) empalme con el animado. En iOS se agregan `apple-touch-startup-image` para los tamaños más comunes, o se documenta por qué no.
7. El splash no bloquea la interacción con un overlay invisible después de cerrarse.

### Edge Cases

- La API devuelve un error (no lentitud): el placeholder se reemplaza por el estado de error con «Reintentar». No queda girando sin fin.
- Varias peticiones a la vez: una sola barra de progreso, con un contador de peticiones pendientes.
- Cambio de vista durante la carga: la barra sigue mientras quede alguna petición pendiente.

## Requirements *(mandatory)*

- **FR-001**: un hook o store compartido por app (`usePendientes` o similar) cuenta las peticiones de la API pendientes y alimenta la barra global, que aparece tras 400 ms.
- **FR-002**: componentes `Esqueleto*` reutilizables, con el brillo animado como utilidad de Tailwind y una variante estática para `prefers-reduced-motion`, sin CSS a mano fuera de la hoja de entrada. Cada vista usa su propio esqueleto, con la forma del contenido final.
- **FR-003**: aviso de «conexión lenta» a los 8 s, con «Reintentar», en es y en.
- **FR-004**: splash animado solo cuando la app corre instalada, con los tiempos indicados arriba, accesible y respetando `prefers-reduced-motion`.
- **FR-005**: textos nuevos en es y en (`*.carga.*`, `*.splash.*`). Impeccable en 0. Se sube la `VERSION` del service worker: v2.1 en la app y en el panel.

## Success Criteria *(mandatory)*

- **SC-001**: con «Slow 3G», ninguna vista muestra un área en blanco mientras carga.
- **SC-002**: CLS menor de 0,1 al pasar de placeholder a contenido.
- **SC-003**: el splash se ve solo en la app instalada y se cierra en menos de 4 s, siempre.
