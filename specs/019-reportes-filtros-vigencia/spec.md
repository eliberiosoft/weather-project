# Feature Specification: «Reportes» del panel con filtros, paginación, «visible hasta» y eliminar en lote

**Feature Branch**: `feat/reportes-filtros-vigencia`

**Created**: 2026-11-11

**Status**: Implementado

**Input**: Pedido del dueño:
- «El superadministrador puede modificar la fecha hasta cuándo presentar uno o varios incidentes de golpe; para ello, a /#reportes colócale filtros y paginación, y para el administrador y el analista colócale la opción de cambiar la fecha hasta cuándo están visibles.»
- «También puede eliminar desde ahí y se eliminan todos.»
- «Está bien, los dos pueden [superadmin y analista]. Cuando un operador reporta un incidente es porque está validado, ya que el admin, el analista y el operador son de la empresa; para que sea parametrizable, en configuración (que solo pueda hacerlo el administrador) coloca una opción para que lo que publique el operador se valide directo o no.»

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encontrar casos con filtros y páginas (Priority: P1)

1. **Given** la pestaña «Reportes», **Then** se filtra por:
   - estado (pendientes, validados, descartados, resueltos, retirados o todos);
   - origen (vecinos o equipo);
   - tipo;
   - vigencia (visibles ahora o vencidos);
   - texto (descripción, recinto, calle o id).
2. **Given** más de 20 resultados, **Then** se pagina: «Página X de Y · N en total», con «Anterior» y «Siguiente». Al cambiar un filtro se vuelve a la página 1 y se suelta la selección.

### User Story 2 - Cambiar hasta cuándo se ven, uno o varios (Priority: P1)

1. **Given** el superadmin o el analista, **Then** cada caso tiene una casilla, hay «Seleccionar los N de esta página» y cada ficha tiene «Cambiar» junto a «vence …». La barra de acción elige la fecha y la hora y aplica a todos los seleccionados.
2. **Given** una fecha que no está entre 5 minutos y 90 días desde ahora, **Then** se rechaza (en el panel y en la API).
3. **Given** un caso verificado que ya venció, **When** se le da una fecha futura, **Then** vuelve a verse en la app.
4. **Given** el operador, **Then** no ve las casillas y la API responde 403.

### User Story 3 - Eliminar en lote (Priority: P2)

1. **Given** el superadmin con casos seleccionados, **When** toca «Eliminar» y confirma, **Then** se borran para siempre con sus fotos, confirmaciones y «me gusta»; en la auditoría queda qué eran (sin el texto).
2. **Given** el analista o el operador, **Then** no ve «Eliminar» y la API responde 403.

### User Story 4 - El superadmin decide si lo del operador sale validado (Priority: P2)

1. **Given** «Configuración» (solo superadmin), **Then** hay un interruptor «Lo que publica el operador sale validado», encendido por defecto (como siempre).
2. **Given** el interruptor apagado, **When** el operador publica un incidente, **Then** queda «pendiente», no se ve en la app y el asistente se lo avisa antes y después de publicar. El analista o el superadmin lo verifican en «Reportes».
3. **Given** el superadmin o el analista, **Then** lo que publican sale siempre validado.

## Requirements *(mandatory)*

- **FR-001**: `GET /api/panel/reportes` acepta estos parámetros:
  - `estado`, `origen`, `tipo`, `vigencia` y `q`;
  - `pagina` (desde 1) y `n` (de 1 a 100; 20 por defecto).

  Devuelve `{reportes, total, pagina, n, paginas}`. Un filtro inválido da 400 `reportes.filtro`.
- **FR-002**: `POST /api/panel/reportes/vigencia` recibe `{ids (1–100), hasta (ISO)}`.
  - Permiso `reportes.vigencia`: superadmin y analista.
  - Errores: 400 `reportes.ids` o `reportes.vigencia_fecha`, y 404 `reportes.no_existe`.
  - Queda en la auditoría como `reportes.vigencia`.
- **FR-003**: `POST /api/panel/reportes/eliminar` recibe `{ids (1–100)}`.
  - Permiso `reportes.eliminar`: solo superadmin.
  - El borrado es definitivo, con fotos, y queda en la auditoría como `reportes.eliminar`.
- **FR-004**: Configuración `operador_valida_directo` (bool, por defecto `true`; `config.editar`, solo superadmin).
  - `POST /api/panel/incidentes` devuelve `{id, estado}`.
  - `GET /api/auth/me` agrega `publicacion.validado_directo`.
- **FR-005**: Textos en es/en. SW del panel v2.9.
