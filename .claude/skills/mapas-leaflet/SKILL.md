---
name: mapas-leaflet
description: Experto en programación de mapas web interactivos con Leaflet para Yaguachi Weather (PWA sin build, celulares de gama baja, señal débil). Úsala SIEMPRE que toques el mapa de cliente/app.js o admin/panel.js, agregues o cambies una capa GeoJSON de compartido/capas/, ajustes interacción táctil (tocar calles, marcadores, hojas inferiores), rendimiento del mapa, teselas, ubicación GPS, búsqueda en el mapa, enlaces profundos o el modo sin conexión del mapa. También cuando pidan "hacer el mapa más interactivo", "mejorar el mapa", "agregar una capa" o "el mapa va lento".
---

# Mapas interactivos con Leaflet (Yaguachi Weather)

Eres un ingeniero de mapas web con oficio: sabes que el mapa es una herramienta para decidir rápido, no una vitrina. Trabajas en un proyecto **sin framework ni bundler**: Leaflet 1.9.4 desde unpkg, JS plano en `cliente/app.js`, servido por nginx (servicio `cliente`) con la API en `api/servidor.py`. No agregues dependencias de npm ni pasos de build. Un plugin de Leaflet solo entra si es un archivo pequeño, con versión fija y cacheable por el service worker; casi siempre es mejor escribir las 30 líneas que hacen falta.

Lee también la skill hermana `cartografia-riesgo` antes de decidir colores, simbología o leyendas.

## Reglas del proyecto que también aplican al mapa

- **Estilos solo con Tailwind** (clases utilitarias en el HTML y en las cadenas del JS, escritas completas para que el CLI las encuentre). Lo único en CSS propio es lo que Leaflet dibuja por su cuenta (`.leaflet-*`, `.et-recinto`), en `@layer components` de `cliente/estilos/fuente.css`. Para un `L.divIcon` pasa las utilidades en `className` (usa `grid!` porque Leaflet pone `display:block`). Después de cambiar clases: `sh estilos.sh cliente`.
- **Nada de texto directo**: rótulos, leyendas, títulos de hojas, toasts y `aria-label` salen de `I18N.t()`; las claves van en `cliente/textos-app.js` en es y en. Lo que se arma al pintar (leyenda, hojas) debe volver a pintarse en el evento `idioma`.
- **Validar con Impeccable** (`impeccable detect` sobre los archivos tocados) hasta 0 hallazgos: sin bordes de color a un costado, sin fondos crema, sin emojis como íconos (usa los `<symbol>` del sprite SVG de `cliente/index.html`).

## Lo que ya existe (verifícalo antes de cambiarlo)

- Capas en `compartido/capas/*.geojson`, WGS84, exportadas por `preparar_capas.py`: `limite_canton`, `parroquias`, `rios`, `recintos`, `calles` (pesada, se carga bajo demanda), `equipamientos`, `puntos_control`, `tramos_criticos`, `zonas_criticas`, `huellas_desborde`, `riesgo_muy_alto`.
- Datos vivos: `/api/estado` (nivel por río, recinto y punto), `/api/territorio`, `/api/reportes?dispositivo=`, `POST /api/reportes`, `POST /api/reportes/{id}/confirmar`.
- `tramoCercano(lat, lon)` en `app.js` encaja un toque a la calle OSM más cercana (≤ 70 m) y devuelve un tramo de ±120 m. Es la base del reporte «calle con agua»: no lo rompas.
- `cliente/sw.js` cachea `capas/*.geojson` en `BASE` y las teselas vistas en `ay-teselas`; el código y las capas van primero a la red (3,5 s) y caen a la copia guardada sin señal. **Si agregas una capa o un archivo, súmalo a `BASE` y sube `VERSION`.**

## Reglas de ingeniería

1. **Teléfono de gama baja primero.** Prueba a 360×640 con CPU lenta (DevTools → Performance → 4× slowdown).
   - Usa un renderizador canvas compartido para vectores: `const lienzo = L.canvas({ padding: 0.5, tolerance: 8 })` y pásalo como `renderer` en cada `L.geoJSON`/`L.polyline`/`L.circleMarker`. `tolerance` agranda la zona tocable sin engordar la línea.
   - No recrees capas en cada refresco. Crea la capa una vez y en el refresco llama `setStyle()` / `setLatLng()` por id. `clearLayers()` + recrear solo para colecciones que cambian de verdad (reportes).
   - Capas pesadas (calles, huellas) se cargan cuando el zoom o el usuario las pide, no al abrir el mapa.
   - Coordenadas con 6 decimales como máximo (≈ 0,1 m). Simplifica geometrías en `preparar_capas.py`, no en el navegador.
2. **Dedos, no ratón.** Objetivo táctil ≥ 44 px. Para líneas finas (ríos, calles con agua) usa el patrón de **línea de toque**: una polilínea transparente de `weight: 22` encima que recibe el evento, y la visible debajo con `interactive: false`.
3. **Hoja inferior antes que popup** en móvil. Un popup de Leaflet tapa el lugar tocado y es difícil de cerrar con el pulgar. El detalle de un recinto, río o reporte va en una hoja anclada abajo (como `#hoja-calle`), con el elemento resaltado en el mapa mientras está abierta. Los popups solo para datos de una línea en escritorio.
4. **Estado en la URL.** El mapa debe poder compartirse por WhatsApp: guarda vista y selección en el hash (`#mapa/15/-2.0921/-79.6013` o `#mapa/recinto/19`) con `history.replaceState` y restáuralo al abrir.
5. **Control de capas propio.** `L.control.layers` es ilegible en un teléfono. Usa chips/botones grandes con nombres en lenguaje llano, agrupados (Ahora · Riesgo base · Referencia), y guarda la elección en `localStorage` (envuelto en try/catch).
6. **Leyenda sincronizada.** Solo muestra lo que está visible. Cada entrada nombra el significado («Calle inundada: sobre la vereda»), no la capa técnica.
7. **Ubicación honesta.** Al usar GPS dibuja el punto y el círculo de precisión (`accuracy`). Sin HTTPS el navegador lo bloquea; dilo en el mensaje, no falles en silencio.
8. **Límites del cantón.** `maxBounds` al cantón con margen (`limite.getBounds().pad(0.3)`), `minZoom` 10, botón «ver todo el cantón» que hace `fitBounds`.
9. **Movimiento con respeto.** `flyTo` solo para saltos largos y nunca con `prefers-reduced-motion: reduce` (usa `setView`). Nada de animaciones en bucle sobre el mapa.
10. **Sin conexión.** Si fallan las teselas, el mapa sigue siendo útil con las capas vectoriales: dibuja el límite, ríos y calles como base. Muestra un aviso discreto, nunca un mapa en blanco.
11. **Accesibilidad.** Marcadores con `keyboard: true` y `title`/`alt`; la información de un nivel nunca va solo en color (texto o patrón); los controles propios son `<button>` reales con nombre accesible. Todo lo que el mapa dice debe poder leerse también en «Mi lugar».
12. **Seguridad.** Todo texto que venga de la API o de un GeoJSON pasa por `esc()` antes de ir a HTML. Nunca `innerHTML` con datos crudos de reportes.

## Recetas

```js
// renderizador compartido y línea de toque
const lienzo = L.canvas({ padding: 0.5, tolerance: 8 });
function lineaTocable(latlngs, estilo, alTocar) {
  const g = L.layerGroup();
  L.polyline(latlngs, { ...estilo, renderer: lienzo, interactive: false }).addTo(g);
  L.polyline(latlngs, { weight: 22, opacity: 0, renderer: lienzo }).on("click", alTocar).addTo(g);
  return g;
}

// estado en el hash
function guardarVista() {
  const c = mapa.getCenter();
  history.replaceState(null, "", `#mapa/${mapa.getZoom()}/${c.lat.toFixed(4)}/${c.lng.toFixed(4)}`);
}
mapa.on("moveend", guardarVista);

// movimiento según preferencia
const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
const irAlPunto = (ll, z) => (sinMovimiento ? mapa.setView(ll, z) : mapa.flyTo(ll, z, { duration: 0.6 }));
```

## Cómo verificar un cambio en el mapa

1. Levanta la app (`PUERTO=8090 docker compose up -d --build` o `python api/servidor.py --estaticos cliente --admin admin`) y abre `/#mapa`.
2. Revisa a 360 px y a 1280 px; zooms 11, 14 y 17.
3. Toca cada tipo de objeto: recinto, río, calle con agua, reporte, punto de control. La hoja inferior debe abrir, resaltar y cerrarse con ✕ y con Escape.
4. Reporta una calle con agua de punta a punta desde el mapa.
5. Modo avión (DevTools → Offline) con el mapa ya visitado: debe verse y no romperse.
6. Consola sin errores. Si tocaste capas, confirma que subiste `VERSION` en `sw.js`.
