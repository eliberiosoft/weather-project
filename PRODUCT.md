# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: residents of the recintos and the cabecera urbana of San Jacinto de Yaguachi** (Guayas, Ecuador). They use basic Android phones on slow or unreliable mobile data, often outdoors, and under stress when a flood is coming or happening. Many are older adults or people without a reading habit: information has to be large, direct and understandable at a glance. Their job: know whether their place is in danger, what to do now, and tell neighbours which streets have water.
- **Secondary: the analyst** (risk team / UGR) who verifies reports and levels in the panel (`/panel`), mostly on a desktop computer.

## Product Purpose

Cantonal flood-alert PWA. For any recinto, street or GPS point it shows an alert level (NORMAL, VIGILANCIA, PREPARACIÓN, RESPUESTA) with what to do, rain for 6 days, the nearest river against its thresholds, nearby places and streets with water. Citizens report streets with water (published at once as «reportada por vecinos», lasting 8 h, with neighbour votes) and 13 other report types (published only after the analyst verifies them). Success: a resident knows their level and the action to take within seconds, even with poor signal.

## Positioning

Cantonal, not national: built on the project's own risk analysis of Yaguachi (critical zones, overflow footprints, critical river stretches, control points P01–P09 with gauge rules) plus GloFAS/Open-Meteo models and neighbour reports at street level (±120 m stretch on OSM roads). Levels follow section 3.2 of the cantonal flood risk plan (Oct 2026).

## Operating Context

- Flood season, rain, tides (aguaje) on the Yaguachi and Babahoyo rivers; residents may be wading, evacuating or helping others.
- Offline/weak-signal use: service worker caches the app and the last data; reports queue offline.
- Vigías send gauge readings over WhatsApp; the analyst enters them in the panel.
- No accounts: each phone has a random id in localStorage.

## Capabilities and Constraints

- **Three separate services** (user requirement, for security): `api` (`api/servidor.py`, Python stdlib + SQLite, no published port), `cliente` (citizen app, static files on nginx, proxies `/api/` and `/r/` and blocks `/api/panel/*`) and `admin` (analyst panel on nginx, bound to 127.0.0.1). Brought up together with `docker compose`. Shared code and data in `compartido/` (`i18n.js`, `capas/`).
- Plain static HTML/JS. **No framework, no bundler.** Map library: **Leaflet** (must stay).
- **Styles: Tailwind v4 only** (user requirement), compiled with the standalone CLI (`sh estilos.sh`, no Node/npm) from `cliente/estilos/fuente.css` and `admin/estilos/fuente.css` into the committed `cliente/estilos.css` and `admin/estilos.css`; the Docker image also builds it. The palette is restricted to the project tokens (`--color-*: initial`).
- **All interface text goes through i18n** (user requirement): `compartido/i18n.js` (engine + shared texts), `cliente/textos-app.js`, `admin/textos-panel.js`; languages es (default) and en, with a switcher on both pages. No literal UI text in HTML or JS. Server-computed reasons and analyst-written texts are data and stay as entered.
- Every UI change is validated with Impeccable's detector (`impeccable detect`) and must end with 0 findings (user requirement: no colored side borders, nothing that reads as AI-made).
- The analyst panel (`/panel`) shares the same visual world and the same Tailwind/i18n rules.
- Layers in `compartido/capas/*.geojson` (WGS84): canton limit, parishes, rivers, recintos, streets, equipment, control points, critical stretches, critical zones, overflow footprints, very-high-risk.
- Base maps: OpenStreetMap and Esri World Imagery.
- Levels are estimates from models and reports unless the analyst marks them **verificado**; the code calls the verified level `oficial` for compatibility.
- Undecided: albergues and evacuation routes have no layer yet; barrios of the cabecera are not named in OSM.

## Brand Commitments

- **Semáforo colours are fixed:** green NORMAL, yellow VIGILANCIA, orange PREPARACIÓN, red RESPUESTA (cantonal plan / COE convention). Text contrast may be adjusted, the hue mapping may not.
- **Non-official disclaimer stays prominent:** Yaguachi Weather is an independent project, not an official channel; official alerts come from the COE cantonal, the Secretaría de Gestión de Riesgos and INAMHI.
- Name: «Yaguachi Weather», an independent project. No author or company brand appears in the UI, the API texts or the docs (owner request, 2026-11-10).
- Language: Spanish (Ecuador) by default, plain «tú» voice; English available. Kichwa or other languages need a human translator, not machine output.

## Evidence on Hand

- Real layers in `compartido/capas/`, live API (`/api/estado`, `/api/territorio`, `/api/lugar`, `/api/reportes`, `/api/avisos`).
- No testimonials, usage numbers or endorsements exist; do not invent them.

## Product Principles

1. **Level and action first.** The answer to «¿estoy en peligro y qué hago?» comes before any data.
2. **Honest about certainty.** Always distinguish estimated vs verified, model vs measurement, and never look official.
3. **Works on a bad phone with bad signal.** Lightweight, offline-tolerant, no heavy dependencies.
4. **Neighbours are sensors.** Reporting a street with water must take a few taps from the map.
5. **Emergency path is never more than one tap away** (ECU 911).

## Accessibility & Inclusion

Large touch targets and text, high contrast in outdoor light, meaning never carried by colour alone (level names always written), minimal reading load, works one-handed. Target WCAG 2.2 AA.
