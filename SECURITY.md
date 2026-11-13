# Política de seguridad

## Versiones con soporte

| Versión | Soporte |
|---|---|
| `main` (la última versión publicada) | ✓ |
| Versiones anteriores | — |

## Cómo reportar una vulnerabilidad

**No abras un issue público.** Usa el reporte privado de GitHub:
**Security → Report a vulnerability** en este repositorio.

Incluye:
- qué componente afecta (`api`, `cliente`, `admin`, despliegue);
- los pasos para reproducirlo y el impacto que esperas;
- si la conoces, una propuesta de corrección.

Respondemos en un plazo de 7 días. Te avisaremos cuando la corrección esté publicada y te daremos el crédito, salvo que prefieras no aparecer.

## Alcance

Nos interesan en especial:
- el acceso al panel sin permiso o saltando un rol;
- la exposición de datos personales: fotos no verificadas, cuentas ciudadanas, IP o identificadores de teléfonos;
- inyección (SQL, XSS) y CSRF;
- cualquier forma de publicar un aviso o un nivel sin ser del equipo.

Quedan fuera:
- la denegación de servicio por volumen;
- los hallazgos en servicios de terceros (Firebase, Cloudflare, Open-Meteo, NASA);
- los reportes automáticos sin una prueba de concepto.

## Datos

Esta plataforma maneja datos personales protegidos por la LOPDP de Ecuador. Al investigar, no accedas a datos reales de terceros más allá de lo necesario para demostrar el problema, y no los conserves.
