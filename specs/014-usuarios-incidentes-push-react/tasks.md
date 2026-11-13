# Tasks: Usuarios y roles, incidentes del equipo, web push y migración a React

## Hecho

### Coordinación

- [X] T001 Contrato API v2 (`contracts/api.md`) como fuente única para los tres equipos
- [X] T002 Motor i18n compartido como módulo ES (`compartido/i18n/motor.js` + `motor.d.ts`)
- [X] T003 Constitución 2.0.0 (React/TS/Vite, pip justificado, usuarios en lugar del PIN)
- [X] T004 `compose.yaml` (variables y `secretos/`), `.env.example`, `.gitignore` y `.dockerignore`
- [X] T005 `docs/firebase-y-captcha.md`, README y `docs/seguridad.md`
- [X] T006 `iniciar-dev.sh` e `INICIAR_APP.bat` con Vite; se quitaron `estilos.sh` y `herramientas/`
- [X] T007 Ruta `/api/auth/yo` renombrada a `/api/auth/me` (pedido del dueño); `publicacion.incidentes_anonimos` visible para todo rol

### API

- [X] T010 `api/auth.py`: `scrypt`, sesiones por cookie, CSRF, Turnstile, espera creciente, permisos y auditoría
- [X] T011 `api/usuarios.py`: gestión de usuarios, regla del último superadmin, superadmin inicial, `--restablecer-clave` y `config`
- [X] T012 Incidentes del equipo (`crear_incidente`, `listar_incidentes`, `editar_incidente`) y `origen`/`autor` con anonimato al leer
- [X] T013 `api/push.py`: suscripción, cola, hilo cada 30 s, horas de silencio, envío por ámbito, lotes de 500 y limpieza de tokens
- [X] T014 Migración de tablas, mantenimiento a 48 h, `requirements.txt` y Dockerfile
- [X] T015 64 pruebas en `api/tests/`

### Cliente

- [X] T020 Migración completa a React + TS + Vite (`src/features/*`), con el mismo diseño y las mismas funciones
- [X] T021 Autoría de los incidentes («Publicado por …» o «Equipo de riesgo») en el mapa, en «Vecinos» y en la leyenda
- [X] T022 Push: suscripción con Firebase perezoso; el SW recibe el evento `push` y arma la notificación en el idioma guardado
- [X] T023 Se corrigieron de paso brechas de 003, 006 y 010 (capas bajo demanda, hash con la app abierta, aviso de cookies, enlace a la política)
- [X] T024 nginx: 404 a `/api/auth`; CSP sin unpkg y con FCM

### Admin

- [X] T030 Migración a React + TS + Vite
- [X] T031 Ingreso con Turnstile, cambio de clave obligatorio y navegación según permisos
- [X] T032 Usuarios, Configuración (anonimato) e Incidentes (formulario con mapa y foto)
- [X] T033 PWA `panel-v2.0`, que nunca guarda `/api/`

## Pendiente

- [ ] T040 Probar el push de punta a punta con las credenciales reales de Firebase y HTTPS (`docs/firebase-y-captcha.md`)
- [ ] T041 Claves reales de Turnstile en producción
- [ ] T042 Pantalla para leer la auditoría
- [ ] T043 Editar la descripción y la gravedad de un incidente ya publicado (la API lo permite; la interfaz solo resuelve y retira)
- [ ] T044 Purga periódica de los tokens push viejos (hoy solo se borran cuando FCM los rechaza)
- [ ] T045 Probar la cola sin conexión del cliente React en un teléfono real
- [ ] T046 `motor.ts` del mapa usa internos de Leaflet (`_containsPoint`, `_layers`) para resolver los toques entre los lienzos: revisarlo al actualizar Leaflet
