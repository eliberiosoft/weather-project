# Tasks: Indicador de carga, placeholders y splash animado

## Hecho

### App (`cliente/`)

- [X] T001 `src/shared/pendientes.ts`: cuenta las lecturas pendientes; barra a los 400 ms y aviso a los 8 s
- [X] T002 `src/app/BarraCarga.tsx`, el aviso de conexión lenta con «Reintentar» (recarga la vista actual) y `cache: "no-store"` en las lecturas de la API
- [X] T003 `Esqueleto.tsx`, `ErrorCarga.tsx` y `ChipCarga.tsx`; esqueletos de Mi lugar, Vecinos y Avisos; chips del mapa
- [X] T004 Estados de error que se pueden reintentar (un arranque fallido ya no deja la app sin territorio)
- [X] T005 Splash en `index.html` con gotas y ondas, `src/app/splash.ts`, manifiesto y `theme-color` `#dcf0fa`, imágenes de inicio de iOS (`scripts/inicio-ios.mjs`)
- [X] T006 SW v2.1; 40 pruebas; `npm run qa` y `typecheck` en verde; Impeccable en 0; CLS medido entre 0,006 y 0,028

### Panel (`admin/`)

- [X] T010 `src/shared/api/pendientes.ts`: barra de 2 px; «Reintentar» relanza solo los GET
- [X] T011 `src/shared/ui/Esqueleto.tsx` y un esqueleto por cada una de las 8 pestañas
- [X] T012 Splash sobrio con la variante `standalone:`; la hoja de estilos pasa a `<link>` en `index.html`; manifiesto `#ffffff`
- [X] T013 SW v2.1; 48 pruebas; `qa` y `typecheck` en verde; Impeccable en 0

### Coordinación

- [X] T020 Spec, constitución 2.1.0 (ninguna vista en blanco), `DESIGN.md` («Carga, placeholders y splash»)
- [X] T021 Despliegue: `docker compose up -d --build`; app y panel en v2.1; splash ausente en la pestaña normal; 3 imágenes de inicio de iOS servidas

## Pendiente

- [ ] T030 Probar el splash con la app y el panel **instalados** en Android e iOS, con `prefers-reduced-motion`
- [ ] T031 Con la API caída (502), el SW pasa el error en lugar de la copia guardada: decidir si mostrar la copia con un aviso de «datos guardados»
- [ ] T032 El sondeo de fondo del panel (cada 60 s) también cuenta para la barra y el aviso de conexión lenta: decidir si se excluye
- [ ] T033 En el móvil, el aviso de conexión lenta del panel tapa el borde superior de la primera ficha mientras se ve
