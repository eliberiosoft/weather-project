# Feature Specification: «Tormentas cerca»: satélite, rayos y lluvia de la próxima hora

**Feature Branch**: `feat/radar-tormentas`

**Created**: 2026-11-11

**Status**: Implementado

**Input**: Pedido del dueño:
- «Verifica cómo implementar en nuestro cliente la opción de radar de tormentas para disponibilizar a los usuarios esa opción.»
- «Procede a realizar la etapa 1 a la 3. Para evitar saturar el consumo de la API del satélite, realízala en el backend; expón un servicio con la información para pintar en el front e implementa Redis para que responda de caché la información y evitar múltiples llamados para la misma data.»

Las etapas del análisis previo:
1. Vista de nubes de tormenta por satélite.
2. Aviso «tormenta cerca».
3. Rayos.

## Contexto y decisiones

- **No hay radar de lluvia para Yaguachi.** RainViewer, la fuente de radar gratuita más usada, no tiene cobertura de radar en Ecuador; en Sudamérica solo cubre Brasil. Además, desde el 1 de enero de 2026 su versión gratuita llega solo hasta zoom 7 y es para uso personal. Se verificó el 2026-11-11 con su mapa de cobertura y teselas reales.
- **Lo que sí hay** son tres fuentes públicas y sin clave:
  - **Nubes de tormenta:** satélite GOES-19 (GOES-East), banda 13 infrarroja, por NASA GIBS. Una imagen cada 10 min, con 20 a 40 min de retraso.
  - **Rayos:** el sensor GLM del mismo satélite, por OPeNDAP del THREDDS de Unidata (UCAR). Unos 7 KB por archivo de 20 s.
  - **Lluvia de la próxima hora:** Open-Meteo, en tramos de 15 min. Es modelo, no medición.
- **El teléfono nunca llama a esas fuentes.** La API las baja una vez para todos, las procesa y las guarda en Redis.
- **Honestidad (constitución II):**
  - Es satélite, no radar, y la vista lo dice.
  - No es un nivel de alerta: no usa los colores ni los nombres del semáforo. Las nubes van en índigo y los rayos en negro con borde blanco.
  - Los textos son propios: no se copian textos, escalas ni pantallas de otras apps.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver dónde están las tormentas (Priority: P1)

1. **Given** la vista «Tormentas cerca» (`#tormentas`), **Then** se ve un mapa regional (zoom 5 a 10) con:
   - las nubes de tormenta de la última imagen, en 3 clases:
     - nube de tormenta, de −41 °C;
     - tormenta fuerte, de −55 °C;
     - tormenta muy fuerte, de −70 °C o menos;
   - el límite del cantón;
   - el círculo de 40 km;
   - los rayos de los últimos 30 min. Los de 10 min o menos se dibujan más grandes;
   - el marcador de «tu lugar», con la casita de «Mi lugar» para no confundirlo con un rayo.

   El botón «Ir a mi lugar», bajo el zoom, centra el mapa en el lugar elegido en «Mi lugar» a zoom 8, donde se ve entero el círculo de 40 km. Si no hay lugar elegido, usa la ubicación del teléfono; si el GPS falla, lo avisa.
2. **Given** la vista, **Then** dice la hora de la imagen («Imagen de las 21:50 (hace 25 min)»). Tiene una leyenda en palabras de vecino y una sección «Qué estás viendo»: satélite, no radar; puede fallar; el retraso; las fuentes; que no es oficial.
3. **Given** «Ver las últimas 2 horas», **Then** se reproducen las imágenes armadas, de la más vieja a la más nueva, y la línea de tiempo deja elegir una. La reproducción se detiene al salir de la vista.
4. **Given** que el servidor todavía arma imágenes de la animación, **Then** se ve «Armando las últimas 2 horas: faltan N imágenes» y la app vuelve a pedir cada 15 s. Con una sola imagen, «reproducir» queda desactivado.

5. **Given** el mapa, **Then** los anillos de acercamiento de 10, 40 y 150 km llevan su distancia escrita, y cada tormenta que se sigue tiene una flecha que muestra **hacia dónde va**. La API la calcula así:
   - agrupa las nubes de tormenta de la imagen actual y de la de 30 min antes, en una grilla de unos 7 km;
   - empareja cada grupo con el más cercano de tamaño parecido (entre un tercio y el triple);
   - descarta lo que va a menos de 6 km/h (casi quieta) o a más de 100 km/h (emparejamiento equivocado).

   La flecha sale de la tormenta y es más larga cuanto más rápido va. La leyenda dice «aprox., por su avance en la última media hora». Solo se dibuja con la imagen más reciente.

### User Story 2 - Aviso «tormenta cerca» (Priority: P1)

1. **Given** la imagen más reciente, **Then** la API da la nube de tormenta más cercana al centro del cantón: distancia, rumbo (8 puntos) y la más fuerte a menos de 40 km. El estado es:

   | Estado | Distancia de la nube más cercana |
   |---|---|
   | encima | 10 km o menos |
   | cerca | 40 km o menos |
   | lejos | 150 km o menos |
   | sin | más de 150 km |

2. **Given** la imagen de 30 min antes, **Then** la API da la tendencia. Con una diferencia de 5 km o más en la distancia es «se acerca» o «se aleja»; con menos, «quieta». Es «nueva» si antes no había ninguna nube de tormenta.
3. **Given** «Mi lugar», **Then** la ficha «Tormentas cerca» resume el aviso, los rayos a menos de 30 km de los últimos 15 min y la lluvia de la próxima hora («modelo»), con «Ver el mapa de tormentas». Pide el resumen liviano, sin puntos.
5. **Given** la ficha de «Mi lugar», **Then** muestra un radar alrededor del cantón:
   - anillos de 10, 40 y 150 km, con escala de raíz cuadrada para que el de 10 km no quede como un punto;
   - las nubes de tormenta en celdas de 10 km y los rayos en celdas de 5 km, con su dirección y distancia;
   - norte arriba y un barrido que solo da la idea de radar (con movimiento reducido no gira).

   La API manda las celdas en km desde el centro (`radar` en `/api/tormentas/resumen`); son unos pocos cientos de números, no la imagen. El pie del dibujo aclara que sale del satélite.
4. **Given** una tormenta a 40 km o menos, o rayos cerca, **Then** la ficha se destaca en el color de la marca (tinta), nunca con el semáforo. Siempre dice «Esto no es un nivel de alerta» en la vista.

### User Story 3 - Rayos (Priority: P2)

1. **Given** los archivos GLM de los últimos 30 min, **Then** se guardan solo los destellos dentro del área del mosaico. Cada archivo se baja una sola vez y queda 45 min en Redis.
2. **Given** que los rayos todavía no están leídos (unos 20 s la primera vez), **Then** la API no hace esperar: responde «Buscando…» (`calculando`) y los lee en segundo plano.

### User Story 4 - Un solo llamado por dato (Priority: P1)

1. **Given** muchas personas abriendo «Tormentas» a la vez, **Then** cada dato externo se baja una sola vez. Un candado en Redis (`SET NX`) hace que las demás peticiones, incluso de otros procesos, esperen ese resultado. Los plazos:

   | Dato | Plazo en caché |
   |---|---|
   | Hora de la última imagen | 2 min |
   | Imágenes (clases y PNG) | 3 h |
   | Archivos GLM | 45 min |
   | Resumen de rayos | 2 min |
   | Lluvia | 15 min |

2. **Given** que una fuente falla, **Then** se da la última copia buena (6 h) y el fallo queda anotado 60 s: nadie vuelve a intentar la descarga en cada visita.
3. **Given** que GIBS anuncia una hora nueva sin todas sus teselas (algunas dan 404 hasta unos 30 min), **Then**:
   - se prueban las 3 imágenes anteriores (hasta 30 min) y se usa la más reciente completa;
   - una hora que dio 404 no se vuelve a pedir en 5 min;
   - si ninguna se puede armar, se usa la última que sí se armó (de las últimas 3 h).
3b. **Given** que el satélite no responde, o que la imagen nueva todavía no se puede armar, **Then** el aviso, el radar, las flechas y las horas de la animación se dan de la **última respuesta buena**. Esa copia tiene una clave fija `torm:ultima:*` y dura 6 h; no depende de la hora de la imagen. Llega con `viejo: true` y la app dice «Satélite de las 22:50 · la última que llegó» en lugar de «Sin datos del satélite». Además, la app conserva la parte que ya mostraba si una respuesta llega sin ella.
4. **Given** que alguien miró «Tormentas» en los últimos 30 min, **Then** un hilo mantiene la caché al día cada minuto: imagen nueva, aviso, rayos, lluvia y la animación. Sin nadie mirando, no baja nada.
5. **Given** que Redis no responde, **Then** la API sigue con la memoria del proceso y vuelve a probar Redis cada 30 s.
6. **Given** una imagen fuera de las últimas 3 h, o no múltiplo de 10 min, **Then** la API responde 404 (`tormentas.marco`): nadie puede hacer que la API pida cualquier cosa a NASA.

### Edge Cases

- **Sin satélite:** responde 200 con `cerca: null` y sin imágenes; la vista dice «No se pudo traer la imagen del satélite». El PNG responde 503 (`tormentas.sin_datos`).
- **Sin conexión:** el service worker da el último JSON. Las imágenes vistas quedan en la caché `ay-tormentas`, con las últimas 16.
- **Grises del infrarrojo:** las teselas vienen remuestreadas y sus grises de nube baja coinciden con los de −71 a −80 °C. Un grupo de grises solo cuenta como núcleo de tormenta si está encerrado por nube fría (−55 °C o menos).

## Probar la ubicación en local

`sh iniciar-https.sh` crea un certificado con mkcert para `localhost`, `127.0.0.1` y la IP de la Mac en la red. Después levanta el compose con `compose.https.yaml`, que agrega un nginx en el puerto 8443 delante de la app.

Así, desde un celular en la misma red, `https://<IP>:8443` es un contexto seguro y el navegador puede dar la ubicación. Hay que aceptar el aviso del certificado. Es solo para desarrollo: en producción el HTTPS lo pone Cloudflare.

## Requirements *(mandatory)*

- **FR-001:** `GET /api/tormentas` y `GET /api/tormentas/resumen` son públicas y de solo lectura, desde la caché. Contrato en [contracts/api.md](contracts/api.md).
- **FR-002:** `GET /api/tormentas/marco/<AAAAMMDDTHHMM>.png` sirve el mosaico de esa hora, con `Cache-Control: public, max-age=10800, immutable`.
- **FR-003:** el mosaico es propio: 768×768 px, en un PNG de paleta casi todo transparente de unos 2 a 20 KB. Lo arma la API con la biblioteca estándar, sin Pillow.
- **FR-004:** Redis 8.2 es el servicio `redis` del compose: sin disco, con `maxmemory 96mb` y `allkeys-lru`, solo en la red interna y en `127.0.0.1:6380` para el desarrollo. La API lo usa con `redis==8.1.0`.
- **FR-005:** los textos están en `es` y `en`. La privacidad agrega que el teléfono no se conecta con NASA, Unidata ni Open-Meteo.
- **FR-006:** sin cambios en la CSP: todo llega del mismo origen.

## Success Criteria *(mandatory)*

Medido el 2026-11-11 en Docker, con datos reales:

| Criterio | Medido |
|---|---|
| **SC-001:** con la caché caliente, `/api/tormentas` responde en menos de 50 ms | 8–30 ms |
| **SC-002:** la imagen sale de la caché | ~2 ms |
| **SC-003:** desde la caché vacía, la primera respuesta llega en menos de 10 s | 6,3 s |
| **SC-004:** la animación completa queda lista en menos de 1 min | ~30 s |
| **SC-005:** muchas peticiones = una descarga | 8 peticiones desde 2 clientes de Redis → 1 descarga (prueba) |
| **SC-006:** Impeccable en 0 hallazgos en `#tormentas`, `#mapa` e `#inicio`, a 360 px y a 1280 px | 0 en los 6 casos |
| **SC-007:** sin errores en la consola | 0 errores |
