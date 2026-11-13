# Implementation Plan: Usuarios y roles, incidentes del equipo, web push y migración a React

**Branch**: `014-usuarios-incidentes-push-react` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Contrato**: [contracts/api.md](contracts/api.md)

## Summary

Tres equipos trabajaron en paralelo contra el contrato:
- **API** (Python): sesiones, roles, usuarios, configuración, incidentes y push con FCM.
- **Cliente** (React): migración completa, autoría de los incidentes y suscripción al push.
- **Admin** (React): migración, ingreso con Turnstile, usuarios, configuración e incidentes.

El coordinador se encargó de la constitución (2.0.0), `compose.yaml`, `.env.example`, `secretos/`, la guía de Firebase y Turnstile, el README y la integración en Docker.

## Technical Context

**Language/Version**: Python 3.12 (imagen); TypeScript 6.0 (`strict`) con React 19.3; Node 22 para construir.

**Primary Dependencies**:

| Pieza | Dependencias |
|---|---|
| API | `firebase-admin` 7.7.0 (opcional en ejecución) |
| Cliente | `react`/`react-dom` 19.3.1, `leaflet` 1.9.4, `@firebase/app` 0.16.5 y `@firebase/messaging` 0.13.3 (carga perezosa) |
| Admin | `react`/`react-dom` 19.3.1, `leaflet` 1.9.4 (carga perezosa) |
| Construcción | Vite 8.3, Tailwind 4.3.5 (`@tailwindcss/vite`), Vitest 5.1, ESLint 10 + `typescript-eslint` |

**Storage**: SQLite. Tablas nuevas: `usuarios`, `sesiones`, `auditoria`, `config`, `push_tokens` y `push_cola`. Columnas nuevas: `reportes.origen`, `reportes.autor_id` y `avisos.autor_id`. La migración es automática.

**Testing**:
- API: 64 pruebas `unittest`, con Turnstile y FCM simulados.
- Cliente: 30 pruebas de Vitest.
- Admin: 35 pruebas de Vitest.
- Además: `tsc`, ESLint e Impeccable (0 hallazgos), y pruebas en el navegador con las tres funciones de rol.

**Performance** (bundle, gzip):
- Cliente, carga inicial: 112 KB de JS + 9 KB de CSS. Leaflet (42 KB) se carga al abrir el mapa y Firebase (15 KB) al activar las notificaciones.
- Admin: 106 KB de JS. El mapa de incidentes (46 KB) se carga aparte.

## Constitution Check (v2.0.0)

| Compuerta | Estado | Evidencia |
|---|---|---|
| Impeccable en 0 + `tsc`/lint/pruebas | ✅ | informes de los tres equipos; `npm run qa` en verde en `cliente/` y `admin/`; `unittest` OK |
| Textos es/en | ✅ | admin: 351 claves = 351; cliente: prueba de paridad es/en en Vitest |
| `VERSION` del SW | ✅ | cliente v2.0 (`cliente/src/sw/sw.ts`); panel v2.0 (`admin/src/features/pwa/sw.js`) |
| Dependencias justificadas | ✅ | ver la tabla «Complexity Tracking» |
| Escrituras con límites | ✅ | login (espera creciente por IP y por usuario), incidentes (60 por usuario y hora), push (30 tokens por IP y hora) |
| Probado levantado | ✅ | `docker compose up -d --build`: el cliente responde 404 a `/api/auth` y `/api/panel`; el panel muestra el ingreso con Turnstile en modo de prueba; los reportes reales traen `origen`/`autor` |

## Complexity Tracking

| Dependencia | Por qué | Alternativa descartada |
|---|---|---|
| React + TypeScript + Vite | pedido del dueño: código limpio y mantenible en dos frontends que crecieron (~1.900 líneas de JS plano) | seguir con JS plano: es más difícil de mantener y de probar |
| `firebase-admin` | FCM HTTP v1 exige firmar un JWT RS256, y la biblioteca estándar no tiene RSA | implementar a mano la firma y el cifrado de Web Push |
| `@firebase/*` en lugar de `firebase` | el paquete completo arrastra firestore y grpc, con avisos de seguridad altos | — |
| Turnstile | captcha gratuito y respetuoso de la privacidad, que encaja con publicar detrás de Cloudflare | reCAPTCHA, que agrega rastreo de Google |
