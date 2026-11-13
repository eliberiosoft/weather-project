# Feature Specification: validación por vecinos

**Feature Branch**: `feat/validacion-vecinos`

**Created**: 2026-11-12

**Status**: Implementado

**Input**: Pedido del dueño: «Haz una mejora: cuando un cliente publica una alerta y mínimo 2 clientes más publican por el mismo sector, esta se debe aprobar directamente.»

## Decisiones

- **Qué es «lo mismo»:**
  - el mismo **tipo** de reporte;
  - a **300 m** o menos entre sí;
  - en las **últimas 3 horas**;
  - de **3 personas distintas** como mínimo: quien publica más otras 2.

  El superadmin cambia estos valores en Configuración (rangos: 2–10 personas, 50–2000 m, 1–48 h) o apaga la función.
- **Persona distinta:** otro **teléfono**, otra **conexión (IP)** y otra **cuenta**. Así una sola persona con varios teléfonos en el mismo wifi, o con su cuenta desde dos teléfonos, no se valida a sí misma. Si la misma persona reporta dos veces, su segundo reporte no suma y queda para el analista.
- **Honestidad (constitución II):** el reporte queda `estado='validado'` con `validado_por='vecinos'` y `vecinos_n` (cuántas personas). Se publica, pero se dice **«confirmado por N vecinos»**, nunca «verificado»:
  - en el mapa sigue con borde discontinuo, como todo lo que el equipo no verificó;
  - **no cuenta para el nivel de alerta** (`reportes_graves_validados`) hasta que el analista lo verifique.
- **Fotos (constitución V):** la foto de otra persona solo se publica si el analista verifica el reporte. Lo validado por vecinos se ve sin sus fotos.
- **El analista sigue mandando:**
  - si lo verifica, con su gravedad, pasa a `validado_por='analista'`: se publican sus fotos y cuenta para el nivel;
  - si lo descarta, deja de verse.

## User Scenarios & Testing *(mandatory)*

1. **Given** dos reportes pendientes del mismo tipo de dos personas distintas a 120 y 200 m, **When** una tercera persona reporta lo mismo, **Then** los tres pasan a «confirmado por 3 vecinos». La tercera persona ve: «Con tu reporte ya son 3 vecinos en este sector: quedó publicado como "confirmado por vecinos". El equipo lo revisará.»
2. **Given** un grupo ya confirmado, **When** llega un cuarto vecino, **Then** su reporte se publica enseguida y todos pasan a «confirmado por 4 vecinos».
3. **Given** tres reportes desde la misma conexión, o de la misma cuenta, **Then** no se publican: es una sola persona.
4. **Given** otro tipo de reporte, o un punto a más de 300 m, **Then** no suma.
5. **Given** un reporte confirmado por vecinos, **Then**:
   - en la app se ve con la etiqueta «confirmado por N vecinos», sin fotos para los demás;
   - en el enlace compartido dice «Confirmado por N vecinos, sin revisión del equipo».
6. **Given** el panel, **Then** «Reportes» tiene el filtro de estado «Confirmados por vecinos». Cada uno lleva la píldora y una nota: «Lo publicaron N personas distintas… Verifícalo (con su gravedad) o descártalo».
7. **Given** el análisis, **Then** se cuentan aparte («confirmado por vecinos»):
   - siguen como «sin atender» hasta que el analista los revise;
   - no entran en el tiempo hasta revisar, porque no los revisó nadie del equipo.
8. **Given** cada validación automática, **Then** queda en la auditoría (`reporte.validado_vecinos`, sin usuario).

## Requirements *(mandatory)*

- **FR-001:** migración 9 (`reportes.validado_por`, `reportes.vecinos_n` e índice `(tipo, creado)`).
- **FR-002:** la validación corre dentro de la transacción del reporte nuevo: dos envíos simultáneos no publican nada a medias.
- **FR-003:** configuración `validacion_vecinos`, `validacion_minimo`, `validacion_radio_m` y `validacion_horas` (solo superadmin; la API valida tipos y rangos).
- **FR-004:** textos `estado.vecinos` y `estado.validado_vecinos` (es y en, en `compartido/i18n`), y textos de la app y del panel.
- **FR-005:** SW de la app v2.25 y del panel v2.14.

## Success Criteria *(mandatory)*

- **SC-001:** `api/tests/test_validacion_vecinos.py` con 4 pruebas:
  - 3 personas distintas publican, un cuarto se suma, las fotos siguen privadas, no cuenta para el nivel, el analista verifica después y queda en la auditoría;
  - la misma persona no se valida sola;
  - otro tipo o lejos no suma;
  - interruptor y rangos.
- **SC-002:** la suite completa de la API y `npm run qa` de la app y del panel en verde.
