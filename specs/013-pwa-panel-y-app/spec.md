# Feature Specification: App ciudadana y panel instalables (PWA)

**Feature Branch**: `013-pwa-panel-y-app`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: «convierte el proyecto admin y client en PWA».


> **Nota (2026-11-09, spec 014):** el frontend se migró a React + TypeScript + Vite, y el panel entra con usuarios y roles en lugar del PIN. El comportamiento descrito aquí se conserva; las rutas de archivos y las referencias al PIN, a unpkg o a `sw.js` v1.x corresponden a la versión anterior. Ver [014](../014-usuarios-incidentes-push-react/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El analista instala el panel (Priority: P1)

El analista abre el panel en Chrome o Edge y lo instala como app de escritorio: tiene su propio ícono, se abre en su propia ventana y carga aunque se caiga la red, aunque sin datos.

**Why this priority**: el analista usa el panel durante horas en la emergencia. Como app instalada no se pierde entre pestañas y abre aunque no haya red.

**Independent Test**: abrir http://127.0.0.1:8091, comprobar que aparece «Instalar el panel», instalarlo y abrirlo sin red.

**Acceptance Scenarios**:

1. **Given** el panel abierto en un navegador compatible, **When** el navegador lo considera instalable, **Then** aparece el botón «Instalar el panel» en la cabecera.
2. **Given** el panel instalado y sin red, **When** se abre, **Then** carga la pantalla y avisa: «Sin conexión: el panel abre, pero no puede leer ni guardar datos…».
3. **Given** el panel en uso, **When** se revisa la caché del navegador, **Then** no hay ninguna respuesta de `/api/`. Los datos protegidos con PIN no se guardan en el equipo.

---

### User Story 2 - El vecino instala la app ciudadana (Priority: P1)

Desde «Avisos», un vecino con Android toca «Instalar la app en el teléfono» y la app queda como un ícono que abre sin señal.

**Independent Test**: abrir http://localhost:8090/#avisos en Chrome, ver el botón, instalar, desconectar y abrir.

**Acceptance Scenarios**:

1. **Given** Chrome ofrece instalar, **When** se abre «Avisos», **Then** se ve el botón y la nota que explica para qué sirve instalarla.
2. **Given** la app ya instalada, **When** se abre de nuevo, **Then** el botón no aparece.
3. **Given** un iPhone (sin `beforeinstallprompt`), **When** se abre «Avisos», **Then** no hay botón: se instala desde «Compartir → Agregar a inicio».

---

### User Story 3 - La notificación lleva a «Avisos» (Priority: P2)

**Acceptance Scenarios**:

1. **Given** la app abierta en otra vista, **When** se toca una notificación de aviso, **Then** la ventana pasa a `#avisos`.

### Edge Cases

- **En desarrollo** el panel se sirve en `/panel/`, en el mismo origen que la app:
  - el SW de la app ignora `/panel` y `/api/panel`;
  - la caché del panel usa el prefijo `panel-`, que la app no borra.
- **Falta un ícono:** el SW del panel guarda la cáscara archivo por archivo, así que un ícono que falte no impide la instalación.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `admin/manifest.webmanifest` MUST declarar:
  - `name`, `short_name`, `id`, `start_url`, `scope`, `display: standalone`, colores;
  - íconos 192, 512 y maskable 512, copiados del cliente en la imagen Docker.
- **FR-002**: `admin/sw.js` MUST:
  - guardar solo la cáscara, en la caché `panel-vX.Y`;
  - pedir primero la red y usar la copia sin conexión;
  - NUNCA guardar `/api/`.
- **FR-003**: El panel y la app MUST mostrar un botón de instalar solo cuando llega `beforeinstallprompt`, y ocultarlo con `appinstalled`.
- **FR-004**: nginx del admin MUST servir el manifiesto como `application/manifest+json` y `sw.js` con `no-store`. La CSP del admin permite `manifest-src 'self'` y `worker-src 'self'`.
- **FR-005**: Al tocar una notificación, el SW de la app MUST enviar `postMessage({ir: "avisos"})` a la ventana abierta.
- **FR-006**: Todos los textos nuevos MUST estar en es y en (`panel.instalar*`, `panel.sin_red`, `panel.con_red`, `app.instalar*`).

## Success Criteria *(mandatory)*

- **SC-001**: Chrome muestra la opción de instalar en http://127.0.0.1:8091 y en http://localhost:8090. Comprobado el 2026-11-09: aparecen los dos botones.
- **SC-002**: 0 entradas de `/api/` en la caché `panel-*`.
- **SC-003**: Sin red, el panel instalado abre su pantalla de ingreso.

## Assumptions

- El panel se usa en 127.0.0.1 (contexto seguro) o detrás de HTTPS con Cloudflare Access; fuera de eso, el navegador no registra service workers.
