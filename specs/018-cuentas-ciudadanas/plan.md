# Implementation Plan: Cuentas ciudadanas (spec 018)

## Enfoque

- **API**: `api/cuentas.py` (registro, ingreso, perfil, foto, sesiones, límites y baja), migración 4 en
  `api/esquema.py`, rutas `/api/cuenta/*` y exigencia de sesión en `POST /api/reportes` (`api/servidor.py`).
- **Cliente**: `features/cuenta/` (pantalla de ingreso: iniciar sesión, crear cuenta y editar datos; «Mi cuenta» con foto; aviso de «Reportar»;
  validación, lógica) y `features/seguridad/` (portada y detección de capturas). Estado en `shared/store.ts`
  (`cuenta`, `ingreso`, `menuCuenta`, `fotoV`, `tapada`).
- **Descartados** (pedidos del dueño): Firebase Authentication y luego Facebook (Meta exige verificar el negocio para publicar la app). La CSP y la COOP no cambian.

## Constitution Check

| Compuerta | Estado |
|---|---|
| Impeccable en 0, `tsc`, ESLint, Vitest y `unittest` en verde | ver tasks.md |
| Textos en `es` y `en` | ✅ |
| `VERSION` del SW subida | ✅ v2.12 |
| Dependencias nuevas | ninguna |
| Límites y validación en toda escritura nueva | ✅ (§2 y §6 del contrato) |
| Probado en la app levantada | con API + PostgreSQL desechables |

## Complexity Tracking

- **Principio V** decía «los ciudadanos no tienen cuentas» y «no se piden nombre, cédula ni teléfono». El dueño pidió
  cuentas con nombres, apellidos, cédula, correo, contraseña y foto para reportar: se enmienda (2.2.0) con consentimiento, datos
  que nunca se publican, baja en un toque y el modo invitado como alternativa sin cuenta.
- La cédula es un dato sensible: solo la ve su dueño (a medias en pantalla) y el equipo; nunca va en la URL ni en los
  registros.
