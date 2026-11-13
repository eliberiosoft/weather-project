---
version: 1
slug: "web-index-html"
primary_target: "cliente/index.html"
related_targets: ["admin/index.html","cliente/app.js","admin/panel.js"]
---

# App ciudadana (cliente/index.html) y panel (admin/index.html)

Scope: the citizen PWA (Mi lugar, Mapa, Reportar, Avisos) and the analyst panel, one visual world. Mode: **Operate**.

Audience and task: residents of Yaguachi's recintos and cabecera on basic Android phones, weak signal, under stress; the analyst on a desktop. Resident task in seconds: «¿mi lugar está en peligro y qué hago?»; report a street with water from the map in a few taps.

Constraints: semáforo hues fixed and only where a level is stated; non-official disclaimer prominent; Leaflet, plain JS, no framework; Tailwind v4 only (standalone CLI); all UI text through i18n (es/en) with a switcher; Impeccable detector at 0 findings; offline-tolerant; WCAG 2.2 AA.

## Direction contract

THESIS: A native-feeling mobile app laid out as a bento mosaic: the level of your place is the biggest tile, painted in its semáforo colour, and everything else is a smaller white tile you can scan with a thumb. Refuses both the generic stacked-cards alert app and the earlier rough printed-sack look the user rejected.

OWN-WORLD: Clear-sky ground: a fixed gradient from #bfe3f6 to #f0f8fc (approved system change, user answer of 2026-11-09 pointing to the colour range of a weather-app Dribbble shot; colour range only). Frosted glass tiles (white at .74, 1.6rem corners, a 1 px white edge, petrol-tinted soft shadow), the phone's own system font (SF / Roboto) in sentence case, one petrol action colour tinta #1d5f84 with a soft sky tint for secondary actions, pills for chips and states, iOS-style segmented controls and switches, translucent blurred top bar and bottom tab bar (a floating dock on desktop). Semáforo colour only on the level tile (same-hue gradient with a live scene: water that rises with the level, a cloud that rains with the forecast), level pills, map symbols and the river meter; the «no es alerta oficial» notice is inside the level tile in both states.

STORY: The resident opens the app, sees their place and the level tile, reads the numbered actions beside it, glances at the stat tiles (rain 24 h, rain 3 days, distance to river) and the black ECU 911 tile, and, if a street floods, opens the map, taps the street and sends the height from a bottom sheet in three taps.

FIRST VIEWPORT: Translucent top bar (indigo app mark, name, ES/EN pill, black 911 pill). Search field tile with GPS button. Place name as a large title with an «En el mapa» pill. Bento grid: level tile (2×2 on desktop) with level name, reason, verified/estimated pill and a 4-bar scale naming only the active level; «Qué hacer ahora» tile; four small tiles (two rain stats, river distance, call 911). Material-style bottom tab bar with a tinted pill behind the active icon. Map: full-screen Leaflet with floating rounded controls, layer sheet with switches and built-in legend, and bottom sheets with a grab handle that print the level tile for whatever is tapped (signature move).

FORM: user-pinned «bento, que parezca aplicación móvil» (2026-11-09), replacing the rolled direction «Saco de piladora» (position 3 of 7); seed:02cc63ac99bb3137 belongs to the replaced round. Kept raises: colour only where a level is stated; fixed rain scale with 50/100 mm lines; full-contrast text; same tile set in the same order for every place.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
