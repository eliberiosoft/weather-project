# Feature Specification: Seguridad de la API, la app y el panel

**Feature Branch**: `012-seguridad`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: «analiza la seguridad … corrige todo y avisa cuando ya esté, analiza la seguridad del sitio también».


> **Nota (2026-11-09, spec 014):** el frontend se migró a React + TypeScript + Vite, y el panel entra con usuarios y roles en lugar del PIN. El comportamiento descrito aquí se conserva; las rutas de archivos y las referencias al PIN, a unpkg o a `sw.js` v1.x corresponden a la versión anterior. Ver [014](../014-usuarios-incidentes-push-react/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nadie adivina el PIN del panel (Priority: P1)

Un atacante que encuentra el panel no puede probar PIN hasta acertar.

**Why this priority**: con el PIN se cambia el nivel de alerta de todo el cantón y se emiten avisos.

**Independent Test**: 5 PIN equivocados desde una IP → los siguientes intentos reciben 429 aunque el PIN sea correcto, durante 1 min; luego 2, 4… hasta 24 h.

**Acceptance Scenarios**:

1. **Given** un `config.json` con PIN de 6 dígitos (versión anterior), **When** arranca la API, **Then** genera un PIN nuevo de 16 caracteres, lo guarda y lo muestra una sola vez en el registro.
2. **Given** 5 intentos fallidos desde una IP, **When** llega el sexto, **Then** responde 429 «demasiados intentos con el PIN».
3. **Given** `PIN_PANEL` de menos de 12 caracteres, **When** arranca la API, **Then** termina con error.
4. **Given** un arranque normal, **When** se leen los registros, **Then** el PIN no aparece.

---

### User Story 2 - Los vecinos falsos no borran una alerta real (Priority: P1)

Una persona con varios teléfonos, o con ids inventados, no puede cerrar un reporte verificado ni un aviso de otra persona.

**Why this priority**: cerrar una alerta real puede dejar a gente en peligro sin aviso.

**Independent Test**: tres «ya no» desde la misma conexión con ids distintos no cierran un aviso de calle. Tres «ya no» no cierran un reporte verificado.

**Acceptance Scenarios**:

1. **Given** un reporte `validado`, **When** cualquier cantidad de vecinos vota «ya no», **Then** sigue `validado` (solo el analista lo cierra).
2. **Given** un aviso de calle `pendiente`, **When** 3 ids distintos desde una sola IP votan «ya no», **Then** no se cierra (cuenta un voto por conexión).
3. **Given** un reporte que no es de calle, **When** su autor intenta cerrarlo, **Then** 404/409: lo cierra el analista.
4. **Given** más de 30 confirmaciones por hora desde una IP, **When** llega otra, **Then** 429.

---

### User Story 3 - El servicio aguanta abusos simples (Priority: P2)

Conexiones lentas, cuerpos inválidos o ráfagas de fotos no tumban la API ni llenan el disco.

**Independent Test**: `Content-Length: -5` → 413; una conexión que no envía nada se cierra a los 20 s; la foto 21 del día desde una IP → 429; con menos de 1 GB libre → 507.

**Acceptance Scenarios**:

1. **Given** un `Content-Length` negativo o no numérico, **When** llega el POST, **Then** 413 o 400 sin leer el cuerpo.
2. **Given** 200 conexiones abiertas, **When** llega otra, **Then** se cierra sin crear otro hilo.
3. **Given** varios envíos simultáneos del mismo teléfono, **When** se procesan, **Then** el tope de 6 por hora se respeta (comprobación y guardado bajo el mismo candado).

---

### User Story 4 - El navegador protege a quien usa la app (Priority: P2)

Las páginas no se pueden incrustar en otro sitio, no ejecutan scripts en línea ni de orígenes no previstos y no filtran la URL a terceros.

**Independent Test**: `curl -D -` sobre `/` del cliente y del admin muestra CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`; la consola del navegador no muestra violaciones de CSP con el mapa cargado.

**Acceptance Scenarios**:

1. **Given** la app, **When** se carga Leaflet desde unpkg, **Then** el navegador verifica su hash SRI.
2. **Given** el HTML del cliente, **When** se busca `onclick=`, **Then** no hay ninguno (los eventos se enlazan con `addEventListener`).
3. **Given** el panel, **When** lo pide un buscador, **Then** recibe `X-Robots-Tag: noindex, nofollow`.

### Edge Cases

- **Detrás de Cloudflare sin `real_ip_header`:** todas las peticiones parecen venir de pocas IP, y los límites por IP bloquearían a todos. Hay que configurar `CF-Connecting-IP` antes de publicar.
- **Varios vecinos legítimos tras el mismo NAT** (un mismo wifi o una operadora con CGNAT): sus votos de «ya no» cuentan como uno. Es aceptable, porque el aviso igual caduca solo.
- **Fotos propias aún sin verificar:** se piden con una llave firmada por foto (`?k=`, HMAC con `secreto_fotos`), no con el id del teléfono. Quien tenga el enlace ve solo esa foto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El PIN del panel MUST tener al menos 12 caracteres. Los más cortos se rotan solos con `secrets.token_urlsafe(12)`.
- **FR-002**: `_pin_ok` MUST comparar en tiempo constante y aplicar una espera exponencial por IP tras 5 fallos: 60·2^(n−5) s, con un tope de 24 h.
- **FR-003**: El PIN MUST mostrarse en el registro solo cuando se genera.
- **FR-004**: Los vecinos MUST poder cerrar solo los avisos `pendiente` públicos, con al menos 3 «ya no» de conexiones distintas y más del doble de los «sigue».
- **FR-005**: El autor MUST poder cerrar solo sus avisos de tipo `PUBLICO_YA` (calle inundada).
- **FR-006**: Límites por IP:

  | Acción | Límite |
  |---|---|
  | Reportes | 40 por hora |
  | Reportes con foto | 20 por día |
  | Confirmaciones | 30 por hora |
  | «Me gusta» | 60 por hora |

  Por dispositivo: 6 reportes por hora, y un mismo reporte (tipo y lugar, a menos de 150 m) solo una vez cada 30 min.
- **FR-007**: Las comprobaciones de límites y la escritura del reporte MUST hacerse bajo `_db_lock`.
- **FR-008**: La API MUST rechazar un `Content-Length` inválido, negativo o mayor de 3 MB, cerrar las conexiones inactivas a los 20 s y limitar a 200 las conexiones simultáneas.
- **FR-009**: Retención:
  - Un hilo de mantenimiento cada 6 h MUST borrar las fotos de más de 90 días y poner `ip = NULL` en `reportes`, `confirmaciones` y `me_gusta` con más de 48 h.
  - Descartar un reporte MUST borrar su foto.
- **FR-010**: La lista pública MUST ordenar primero lo `validado`.
- **FR-011**: Los registros MUST omitir la query de la URL.
- **FR-012**: El cliente MUST enviar el id del teléfono en la cabecera `X-Dispositivo` y generarlo con `crypto.randomUUID` o `crypto.getRandomValues`.
- **FR-013**: Cabeceras:
  - nginx (cliente y admin) y la API MUST enviar CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`.
  - La CSP del admin no permite orígenes externos.
- **FR-014**: Leaflet MUST cargarse con `integrity` SRI. El binario de Tailwind MUST verificarse con sha256 antes de ejecutarse (en los Dockerfile y en `estilos.sh`).
- **FR-015**: La página `/r/<id>` MUST usar `URL_PUBLICA` como base cuando está definida.
- **FR-016**: Si quedan menos de 1 GB libres, la API MUST rechazar la foto con 507.

### Key Entities

- **Intentos de PIN** (en memoria): ip → (fallos, bloqueado_hasta). Se vacía si supera 10 000 entradas.
- **`confirmaciones.ip`** y **`me_gusta.ip`**: columnas nuevas (con migración `ALTER TABLE`) que se borran a las 48 h.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adivinar un PIN de 16 caracteres con el bloqueo exponencial es impracticable: tras 20 fallos, una IP queda bloqueada 24 h.
- **SC-002**: 0 reportes verificados cerrados por votos de vecinos.
- **SC-003**: 0 violaciones de CSP en la consola con el mapa, «Vecinos» y «Reportar» en uso.
- **SC-004**: Ninguna IP de más de 48 h en la base después de un ciclo de mantenimiento.

## Assumptions

- La app se publica detrás de Cloudflare, siguiendo la lista de `docs/seguridad.md`: Tunnel, Full (strict), HSTS, Access para el panel, WAF y límites en el borde.
- El analista es una persona de confianza; no hay roles dentro del panel.
