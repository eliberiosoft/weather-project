# Tasks: App ciudadana y panel instalables (PWA)

## Hecho

- [X] T001 `admin/manifest.webmanifest` con íconos 192, 512 y maskable
- [X] T002 `admin/sw.js`: cáscara en `panel-v1.0`, primero la red, nunca `/api/`
- [X] T003 Enlaces del manifiesto y del ícono de Apple, y `theme-color`, en `admin/index.html`
- [X] T004 Botón «Instalar el panel» (`beforeinstallprompt` / `appinstalled`) y avisos de red en `admin/panel.js`
- [X] T005 nginx del admin: tipo del manifiesto, `sw.js` con `no-store` y CSP con `manifest-src`/`worker-src`
- [X] T006 La imagen del admin copia los íconos PNG del cliente
- [X] T007 Botón «Instalar la app en el teléfono» en «Avisos» de la app ciudadana
- [X] T008 `id` en `cliente/manifest.webmanifest`
- [X] T009 `notificationclick` → `postMessage` → `#avisos`
- [X] T010 El SW de la app ignora `/panel` y no borra las cachés `panel-*`
- [X] T011 `VERSION` de la app v1.7; panel v1.0

## Pendiente

- [ ] T012 Capturas (`screenshots`) en los dos manifiestos, para el diálogo de instalación enriquecido
- [ ] T013 Un ícono propio del panel, distinto del de la app, para no confundirlos en el escritorio
- [ ] T014 Aviso «hay una versión nueva» con `controllerchange`, en la app y en el panel
