# Tasks: Seguridad de la API, la app y el panel

**Input**: `specs/012-seguridad/`

## Hecho

- [X] T001 PIN de 16 caracteres con rotación de los cortos; `PIN_PANEL` ≥ 12; PIN fuera de los registros (`api/servidor.py: cargar_config, main`)
- [X] T002 Espera exponencial por IP tras 5 fallos de PIN (`api/servidor.py: _pin_ok`)
- [X] T003 Votos «ya no»: solo sobre `pendiente`, uno por conexión, 30/h por IP; el autor solo cierra los de calle (`confirmar_reporte`)
- [X] T004 Columna `ip` en `confirmaciones` y `me_gusta`, con migración (`iniciar_db`)
- [X] T005 «Me gusta»: 60/h por IP (`me_gusta_reporte`)
- [X] T006 Límites y escritura del reporte bajo `_db_lock`; foto validada antes; 20 fotos/día por IP; 507 si hay menos de 1 GB libre (`crear_reporte`)
- [X] T007 `Content-Length` inválido o negativo → 400/413; `timeout = 20`; `Servidor` con un máximo de 200 conexiones
- [X] T008 Hilo `mantenimiento` cada 6 h: fotos de más de 90 días e IP de más de 48 h
- [X] T009 Al descartar un reporte se borra su foto (`panel_revisar`)
- [X] T010 Lista pública con lo `validado` primero (`listar_reportes`)
- [X] T011 Registros sin query; `Server` sin versión de Python
- [X] T012 `X-Dispositivo` en lugar de `?dispositivo=` para `/api/reportes`; id con `crypto.getRandomValues` (`cliente/app.js`)
- [X] T013 CSP y cabeceras de seguridad: `cliente/seguridad.conf`, `admin/seguridad.conf`, `CABECERAS_SEG` en la API
- [X] T014 Sin `onclick` en línea (`#btn-modo-calle`, `#btn-cancelar-calle`)
- [X] T015 SRI en Leaflet; sha256 de Tailwind en los Dockerfile y en `estilos.sh`
- [X] T016 `URL_PUBLICA` para `/r/<id>`
- [X] T017 Textos de privacidad (es/en) con la retención de IP y fotos
- [X] T018 `docs/seguridad.md` con hallazgos y la guía de Cloudflare
- [X] T019 Corregir el dueño de `config.json` en el volumen para que el PIN rotado se guarde

## Pendiente

- [ ] T020 Activar `real_ip_header CF-Connecting-IP` con los rangos de Cloudflare al publicar
- [ ] T021 Cloudflare: Tunnel, Full (strict), HSTS, Access para el panel, WAF y límites en el borde
- [X] T022 Fotos propias sin `?dispositivo=` en la URL (p. ej. un token firmado de corta duración) — **hecho el 2026-11-09:** llave firmada `?k=` por foto
- [ ] T023 Autenticación individual del analista (más allá del PIN compartido)
- [ ] T024 Pruebas automatizadas de las reglas de seguridad
