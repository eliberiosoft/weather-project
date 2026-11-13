/* El mapa con Leaflet, sin framework: capas, estilos y selección. El componente <Mapa> lo crea una vez y le pasa
   los datos (estado, reportes) y las acciones; aquí no hay React.
   - Vectores en canvas, un renderizador por «pane», en el orden de la cartografía de riesgo (de abajo arriba).
   - Las capas fijas se crean una sola vez; el refresco solo cambia estilos (ríos, recintos) y rehace los reportes.
   - Las capas pesadas (escenarios, tramos, parroquias, equipamientos) se bajan solo al encender su capa.
   - Líneas finas con una «línea de toque» transparente encima. */
import type { Feature, FeatureCollection } from "geojson";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { icoHtml } from "../../shared/componentes/Icono";
import { nivelEfectivo, rioEstado, vigente } from "../../shared/dominio";
import { esc } from "../../shared/i18n";
import { AGUA, AGUA_W, COL, ESCENARIO, GRIS, MK, NEGRO, SIN_DATO, TINTA } from "../../shared/estilo";
import { sinMovimiento } from "../../shared/formato";
import type { Albergue, EstadoApi, LatLon, Reporte, Territorio } from "../../shared/tipos";

export type ClaveCapa = "callesAgua" | "rios" | "recintos" | "reportes" | "albergues" | "tramos" | "muyAlto" | "zonas" | "huellas" | "puntos" | "equip" | "parroquias";
export type Fondo = "osm" | "sat";
export type Rasgo = Feature;

/** Lo que se toca en el mapa y se abre en una hoja. */
export type Tocado =
  | { tipo: "recinto"; id: number }
  | { tipo: "rio"; rio: string; f: Rasgo; ll?: LatLon }
  | { tipo: "calle" | "reporte"; r: Reporte }
  | { tipo: "albergue"; a: Albergue }
  | { tipo: "punto" | "equip"; f: Rasgo; latlng: LatLon }
  | { tipo: "zona" | "huella" | "tramo" | "muyAlto"; f: Rasgo };

export interface EventosMotor {
  /** Devuelve false si no se abre (p. ej. en modo «toca la calle»): el toque sigue hasta el mapa. */
  alTocar(t: Tocado): boolean;
  alClic(ll: LatLon): void;
  alMover(): void;
  errorCapa(k: ClaveCapa | "limite"): void;
  sinTeselas(): void;
  /** Cuántas capas siguen bajando (para el aviso «Cargando capas…»). */
  capasPendientes?(n: number): void;
}

/** Selección resaltada: un punto, un rasgo GeoJSON o una línea. */
export type Resalte = { latlng: LatLon } | { geo: Rasgo } | { linea: LatLon[] };

// panes en el orden de la cartografía de riesgo (de abajo arriba)
// «ruta»: el camino a un albergue, sobre todo lo de abajo y bajo la selección y los marcadores
const PANES: [string, number][] = [["escenarios", 350], ["limites", 360], ["rios", 380], ["tramos", 390], ["agua", 400], ["recintos", 410], ["ruta", 440], ["seleccion", 450]];
const URL_FONDO: Record<Fondo, [string, string]> = {
  osm: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png", "© OpenStreetMap"],
  sat: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "Esri World Imagery"],
};

async function capaGeo(n: string): Promise<FeatureCollection> {
  const r = await fetch(`capas/${n}.geojson?v=${__BUILD__}`);
  if (!r.ok) throw new Error(`${n}: ${r.status}`);
  return r.json() as Promise<FeatureCollection>;
}

export class MotorMapa {
  readonly mapa: L.Map;
  private rend: Record<string, L.Canvas> = {};
  private fondos: Record<Fondo, L.TileLayer>;
  private capas: Partial<Record<ClaveCapa, L.Layer>> = {};
  private creando: Partial<Record<ClaveCapa, Promise<L.Layer>>> = {};
  private quiero: Partial<Record<ClaveCapa, boolean>> = {};
  private rioHalo: L.GeoJSON | null = null;
  private rioLinea: L.GeoJSON | null = null;
  private recMarcas: Record<number, L.CircleMarker> = {};
  private callesAgua = L.layerGroup();
  private reportes = L.layerGroup();
  private albergues = L.layerGroup();
  private ruta: L.LayerGroup | null = null;
  private seleccion: L.Layer | null = null;
  private tramoTmp: L.Polyline | null = null;
  private yo: L.LayerGroup | null = null;
  private marcaRep: L.Marker | null = null;
  private estado: EstadoApi | null = null;
  limite: L.GeoJSON | null = null;
  /** el componente se desmontó: las descargas que lleguen tarde no tocan el mapa */
  destruido = false;
  private bajando = 0;

  /** Cuenta una descarga de capa mientras dura (alimenta «Cargando capas…»). */
  private contar<T>(p: Promise<T>): Promise<T> {
    this.ev.capasPendientes?.(++this.bajando);
    const fin = () => { if (!this.destruido) this.ev.capasPendientes?.(--this.bajando); };
    p.then(fin, fin);
    return p;
  }

  constructor(el: HTMLElement, private terr: Territorio, private ev: EventosMotor, fondo: Fondo) {
    this.mapa = L.map(el, { zoomControl: false, minZoom: 10, maxZoom: 19, attributionControl: true, maxBoundsViscosity: 0.8 }).setView([-2.12, -79.68], 11);
    for (const [n, z] of PANES) this.mapa.createPane(n).style.zIndex = String(z);
    let avisado = false;
    const crearFondo = (f: Fondo) => {
      const [url, attribution] = URL_FONDO[f];
      return L.tileLayer(url, { maxZoom: 19, attribution }).on("tileerror", () => {
        if (!avisado) { avisado = true; this.ev.sinTeselas(); }
      });
    };
    this.fondos = { osm: crearFondo("osm"), sat: crearFondo("sat") };
    this.fondos[fondo].addTo(this.mapa);
    this.capas.callesAgua = this.callesAgua;
    this.capas.reportes = this.reportes;
    this.capas.albergues = this.albergues;
    this.capas.recintos = this.crearRecintos();

    this.mapa.on("click", (e: L.LeafletMouseEvent) => {
      if (!this.tocarVector(e)) this.ev.alClic([e.latlng.lat, e.latlng.lng]);
    });
    this.mapa.on("moveend", () => this.ev.alMover());
    this.mapa.on("zoomend", () => this.etiquetas());
    this.etiquetas();
  }

  /** Un lienzo por pane: cada uno tapa a los de abajo, así que los lienzos no reciben toques (CSS
      «.leaflet-pane > canvas { pointer-events: none }») y el toque se busca aquí, del pane de arriba al de abajo.
      Usa la prueba de toque de Leaflet (_containsPoint, con la tolerancia del lienzo). */
  private tocarVector(e: L.LeafletMouseEvent): boolean {
    const orden = PANES.map(([n]) => n).reverse();
    for (const pane of orden) {
      const r = this.rend[pane] as unknown as { _layers?: Record<string, L.Path & { _containsPoint(p: L.Point): boolean }> } | undefined;
      let tocado: L.Path | null = null;
      for (const capa of Object.values(r?._layers || {})) {
        if (capa.options.interactive !== false && capa._containsPoint(e.layerPoint)) tocado = capa;
      }
      if (tocado) {
        tocado.fire("click", { latlng: e.latlng, layerPoint: e.layerPoint, containerPoint: e.containerPoint, originalEvent: e.originalEvent }, true);
        // si la hoja no se abrió (modo «toca la calle» o «toca el lugar»), el toque sigue siendo del mapa
        return !!(e.originalEvent as Event & { _stopped?: boolean })._stopped;
      }
    }
    return false;
  }

  private lienzo(pane: string): L.Canvas {
    return (this.rend[pane] ??= L.canvas({ pane, padding: 0.5, tolerance: 6 }));
  }

  /** El límite del cantón: encuadre inicial y maxBounds con margen. */
  async cargarLimite(): Promise<void> {
    try {
      const g = await this.contar(capaGeo("limite_canton"));
      if (this.destruido) return;
      this.limite = L.geoJSON(g, {
        pane: "limites", renderer: this.lienzo("limites"), interactive: false, style: { color: TINTA, weight: 3, fill: false },
      } as L.GeoJSONOptions).addTo(this.mapa);
      this.mapa.setMaxBounds(this.limite.getBounds().pad(0.3));
    } catch { if (!this.destruido) this.ev.errorCapa("limite"); }
  }

  private etiquetas(): void {
    this.mapa.getContainer().classList.toggle("sin-etiquetas", this.mapa.getZoom() < 13);
  }

  /** Abre una hoja y, si se abrió, el toque no sigue hasta el mapa (no la cierra). */
  private tocar(t: Tocado, e?: L.LeafletEvent): void {
    if (this.ev.alTocar(t) && e) L.DomEvent.stop(e as unknown as Event);
  }

  // ---------- capas ----------
  private crearCapa(k: ClaveCapa): Promise<L.Layer> {
    const geo = (o: L.GeoJSONOptions) => o;
    const al = (tipo: "zona" | "huella" | "muyAlto" | "tramo") => (f: Feature, l: L.Layer) =>
      l.on("click", (e) => this.tocar({ tipo, f }, e));
    switch (k) {
      case "parroquias": return capaGeo("parroquias").then((g) => L.geoJSON(g, geo({ pane: "limites", renderer: this.lienzo("limites"), interactive: false, style: { color: TINTA, weight: 1.5, dashArray: "5 6", fill: false } } as L.GeoJSONOptions)));
      // escenarios: nunca en color de semáforo pleno; siempre rotulados como escenario
      case "muyAlto": return capaGeo("riesgo_muy_alto").then((g) => L.geoJSON(g, { pane: "escenarios", renderer: this.lienzo("escenarios"), style: { color: ESCENARIO, weight: 0, fillOpacity: 0.2 }, onEachFeature: al("muyAlto") } as L.GeoJSONOptions));
      case "zonas": return capaGeo("zonas_criticas").then((g) => L.geoJSON(g, { pane: "escenarios", renderer: this.lienzo("escenarios"), style: { color: ESCENARIO, weight: 2, dashArray: "6 5", fillOpacity: 0.05 }, onEachFeature: al("zona") } as L.GeoJSONOptions));
      case "huellas": return capaGeo("huellas_desborde").then((g) => L.geoJSON(g, {
        pane: "escenarios", renderer: this.lienzo("escenarios"),
        style: (f) => ({ color: AGUA[2], weight: 1.5, dashArray: "2 4", fillColor: AGUA[1], fillOpacity: f?.properties?.nivel === "ESPERABLE" ? 0.4 : 0.2 }),
        onEachFeature: al("huella"),
      } as L.GeoJSONOptions));
      case "tramos": return capaGeo("tramos_criticos").then((g) => L.layerGroup([
        L.geoJSON(g, { pane: "tramos", renderer: this.lienzo("tramos"), interactive: false, style: { color: "#fff", weight: 9, opacity: 0.9 } } as L.GeoJSONOptions),
        L.geoJSON(g, { pane: "tramos", renderer: this.lienzo("tramos"), interactive: false, style: { color: NEGRO, weight: 6, dashArray: "3 6" } } as L.GeoJSONOptions),
        L.geoJSON(g, { pane: "tramos", renderer: this.lienzo("tramos"), style: { weight: 24, opacity: 0 }, onEachFeature: al("tramo") } as L.GeoJSONOptions),
      ]));
      case "rios": return capaGeo("rios").then((g) => this.crearRios(g));
      case "puntos": return capaGeo("puntos_control").then((g) => L.geoJSON(g, {
        pointToLayer: (f, ll) => L.marker(ll, { keyboard: true, title: `${f.properties.id} · ${f.properties.rio}`, alt: String(f.properties.id),
          icon: L.divIcon({ className: MK.pc, html: esc(f.properties.id), iconSize: [36, 26] }) }),
        onEachFeature: (f, l) => l.on("click", () => { const p = (l as L.Marker).getLatLng(); this.tocar({ tipo: "punto", f, latlng: [p.lat, p.lng] }); }),
      }));
      case "equip": return capaGeo("equipamientos").then((g) => L.geoJSON(g, {
        pointToLayer: (f, ll) => L.marker(ll, { keyboard: true, title: String(f.properties.nombre), alt: String(f.properties.categoria),
          icon: L.divIcon({ className: MK.equip, html: icoHtml("e-" + f.properties.categoria, "size-4.5"), iconSize: [30, 30] }) }),
        onEachFeature: (f, l) => l.on("click", () => { const p = (l as L.Marker).getLatLng(); this.tocar({ tipo: "equip", f, latlng: [p.lat, p.lng] }); }),
      }));
      default: return Promise.resolve(this.capas[k] as L.Layer);
    }
  }

  /** Ríos: halo + línea por nivel + línea de toque, creados una vez; el refresco solo cambia estilos. */
  private crearRios(g: FeatureCollection): L.Layer {
    const nombre = (f?: Feature) => String(f?.properties?.rio ?? "");
    this.rioHalo = L.geoJSON(g, { pane: "rios", renderer: this.lienzo("rios"), interactive: false, style: (f) => this.estiloHalo(nombre(f)) } as L.GeoJSONOptions);
    this.rioLinea = L.geoJSON(g, { pane: "rios", renderer: this.lienzo("rios"), interactive: false, style: (f) => this.estiloRio(nombre(f)) } as L.GeoJSONOptions);
    return L.layerGroup([this.rioHalo, this.rioLinea, L.geoJSON(g, {
      pane: "rios", renderer: this.lienzo("rios"), style: { weight: 24, opacity: 0 },
      onEachFeature: (f, l) => l.on("click", (e: L.LeafletMouseEvent) => this.tocar({ tipo: "rio", rio: nombre(f), f, ll: [e.latlng.lat, e.latlng.lng] }, e)),
    } as L.GeoJSONOptions)]);
  }
  private estiloRio(rio: string): L.PathOptions {
    const r = rioEstado(this.estado, rio);
    return { color: (r.n && COL[r.n]) || SIN_DATO, weight: 5, opacity: 0.95 };
  }
  private estiloHalo(rio: string): L.PathOptions {
    return rioEstado(this.estado, rio).oficial ? { color: NEGRO, weight: 11, opacity: 0.85 } : { color: "#fff", weight: 9, opacity: 0.85 };
  }

  /** Recintos: un marcador por recinto, creado una vez; color = nivel, borde grueso negro = verificado. */
  private crearRecintos(): L.LayerGroup {
    const g = L.layerGroup();
    for (const p of Object.values(this.terr.recintos)) {
      const m = L.circleMarker([p.lat, p.lon], { pane: "recintos", renderer: this.lienzo("recintos"), radius: p.etiqueta ? 10 : 8 })
        .bindTooltip(esc(p.nombre), { permanent: true, direction: "right", offset: [10, 0], className: "et-recinto", interactive: false })
        .on("click", (e) => this.tocar({ tipo: "recinto", id: p.id }, e));
      this.recMarcas[p.id] = m;
      m.addTo(g);
    }
    return g;
  }

  /** Enciende o apaga una capa. Las que viven en un archivo se bajan la primera vez que se encienden. */
  encender(k: ClaveCapa, on: boolean): void {
    this.quiero[k] = on;
    if (!on) { this.capas[k]?.remove(); return; }
    const lista = this.capas[k];
    if (lista) { lista.addTo(this.mapa); return; }
    this.creando[k] ??= this.contar(this.crearCapa(k));
    this.creando[k].then((c) => {
      if (this.destruido) return;
      this.capas[k] = c;
      if (k === "rios") this.refrescarEstado(this.estado);
      if (this.quiero[k]) c.addTo(this.mapa);
    }, () => {
      delete this.creando[k];   // se reintenta la próxima vez
      if (this.destruido) return;
      this.ev.errorCapa(k);
    });
  }

  fondo(f: Fondo): void {
    for (const [k, capa] of Object.entries(this.fondos) as [Fondo, L.TileLayer][]) {
      if (k === f) capa.addTo(this.mapa); else capa.remove();
    }
  }

  // ---------- datos vivos ----------
  refrescarEstado(estado: EstadoApi | null): void {
    this.estado = estado;
    this.rioHalo?.setStyle((f) => this.estiloHalo(String(f?.properties?.rio ?? "")));
    this.rioLinea?.setStyle((f) => this.estiloRio(String(f?.properties?.rio ?? "")));
    if (!estado) return;
    for (const p of Object.values(this.terr.recintos)) {
      const ef = nivelEfectivo(estado.recintos[p.id]);
      this.recMarcas[p.id]?.setStyle({ color: ef.oficial ? NEGRO : GRIS, weight: ef.oficial ? 4 : 1.5, fillColor: (ef.n && COL[ef.n]) || SIN_DATO, fillOpacity: 1 });
    }
  }

  /** Calles con agua (por altura, discontinuas si no están verificadas) y otros reportes. Los tuyos vencidos siguen en «Vecinos», no aquí. */
  pintarReportes(reportes: Reporte[]): void {
    this.reportes.clearLayers();
    this.callesAgua.clearLayers();
    for (const r of reportes.filter((x) => vigente(x))) {
      if (r.tipo === "calle_inundada") {
        if (!["pendiente", "validado"].includes(r.estado)) continue;
        const a = r.altura_agua || 1, ver = !!r.verificado, w = AGUA_W[a] ?? 5;
        const abrir = (e: L.LeafletEvent) => this.tocar({ tipo: "calle", r }, e);
        if (r.tramo && r.tramo.length > 1) {
          L.polyline(r.tramo, { pane: "agua", renderer: this.lienzo("agua"), interactive: false, color: ver ? NEGRO : "#fff", weight: w + 6, opacity: 0.9 }).addTo(this.callesAgua);
          L.polyline(r.tramo, { pane: "agua", renderer: this.lienzo("agua"), interactive: false, color: AGUA[a], weight: w, dashArray: ver ? undefined : "10 7", lineCap: "butt" }).addTo(this.callesAgua);
          L.polyline(r.tramo, { pane: "agua", renderer: this.lienzo("agua"), weight: 26, opacity: 0 }).on("click", abrir).addTo(this.callesAgua);
        } else {
          L.circleMarker([r.lat, r.lon], { pane: "agua", renderer: this.lienzo("agua"), radius: 9, color: ver ? NEGRO : "#fff", weight: 3, dashArray: ver ? undefined : "3 3", fillColor: AGUA[a], fillOpacity: 1 })
            .on("click", abrir).addTo(this.callesAgua);
        }
        continue;
      }
      if (r.estado !== "validado" && !(r.mio && r.estado === "pendiente")) continue;
      // borde discontinuo mientras no lo verifique el equipo (también el confirmado por vecinos)
      const clase = r.origen === "equipo" ? MK.repEquipo : r.estado === "validado" && r.validado_por !== "vecinos" ? MK.rep : MK.repPend;
      L.marker([r.lat, r.lon], { keyboard: true, title: r.etiqueta || r.tipo, alt: r.etiqueta || r.tipo,
        icon: L.divIcon({ className: clase, html: icoHtml("t-" + r.tipo, "size-4.5"), iconSize: [32, 32] }) })
        .on("click", () => this.tocar({ tipo: "reporte", r })).addTo(this.reportes);
    }
  }

  /** Albergues: cuadrado blanco con borde de tinta y casita, 34 px (se toca con el pulgar). */
  pintarAlbergues(lista: Albergue[]): void {
    this.albergues.clearLayers();
    for (const a of lista) {
      L.marker([a.lat, a.lon], { keyboard: true, title: a.nombre, alt: a.nombre, zIndexOffset: 500,
        icon: L.divIcon({ className: MK.albergue, html: icoHtml("i-albergue", "size-5"), iconSize: [34, 34] }) })
        .on("click", () => this.tocar({ tipo: "albergue", a })).addTo(this.albergues);
    }
  }

  /** La ruta a un albergue: tinta con halo blanco (se lee sobre OSM y satélite). Encuadra todo el camino. */
  dibujarRuta(linea: LatLon[] | null, encuadrar = true): void {
    this.ruta?.remove();
    this.ruta = null;
    if (!linea || linea.length < 2) return;
    const base = { pane: "ruta", renderer: this.lienzo("ruta"), interactive: false, lineCap: "round" as const, lineJoin: "round" as const };
    this.ruta = L.layerGroup([
      L.polyline(linea, { ...base, color: "#fff", weight: 11, opacity: 0.95 }),
      L.polyline(linea, { ...base, color: TINTA, weight: 6, opacity: 1 }),
    ]).addTo(this.mapa);
    if (encuadrar) {
      // abajo queda el resumen de la ruta (y en celular, los botones): más margen abajo
      const chico = innerWidth < 816;
      this.mapa.fitBounds(L.latLngBounds(linea), { paddingTopLeft: [24, 90], paddingBottomRight: [chico ? 24 : 80, chico ? 170 : 120], maxZoom: 17, animate: !sinMovimiento() });
    }
  }

  // ---------- selección y vista ----------
  quitarSeleccion(): void {
    this.seleccion?.remove();
    this.seleccion = null;
  }

  resaltar(d: Resalte): void {
    this.quitarSeleccion();
    const base = { pane: "seleccion", renderer: this.lienzo("seleccion"), interactive: false };
    if ("latlng" in d) this.seleccion = L.circleMarker(d.latlng, { ...base, radius: 22, color: TINTA, weight: 4, fill: false });
    else if ("geo" in d) this.seleccion = L.geoJSON(d.geo, { ...base, style: { color: TINTA, weight: 14, opacity: 0.35, fillOpacity: 0.12 } } as L.GeoJSONOptions);
    else this.seleccion = L.polyline(d.linea, { ...base, color: TINTA, weight: 18, opacity: 0.3 });
    this.seleccion.addTo(this.mapa);
    this.encimaDeLaHoja("latlng" in d ? d.latlng : "linea" in d ? d.linea[Math.floor(d.linea.length / 2)] : undefined);
  }

  /** Mueve el mapa para que el punto quede visible por encima de la hoja inferior (en escritorio la hoja va al costado). */
  encimaDeLaHoja(ll: LatLon | undefined): void {
    if (!ll || innerWidth >= 816) return;
    const p = this.mapa.latLngToContainerPoint(ll), tam = this.mapa.getSize();
    this.mapa.panBy(p.subtract(L.point(tam.x / 2, tam.y * 0.26)), { animate: !sinMovimiento() });
  }

  irAlPunto(ll: LatLon, z: number): void {
    if (sinMovimiento() || this.mapa.distance(this.mapa.getCenter(), ll) < 1500) this.mapa.setView(ll, z);
    else this.mapa.flyTo(ll, z, { duration: 0.7 });
  }

  verCanton(animar = true): void {
    if (!this.limite) return;
    if (animar) this.mapa.flyToBounds(this.limite.getBounds(), { padding: [20, 20], animate: !sinMovimiento() });
    else this.mapa.fitBounds(this.limite.getBounds(), { padding: [20, 20] });
  }

  /** El tramo de calle elegido en la hoja «calle inundada». */
  tramoTemporal(coords: LatLon[] | null): void {
    this.tramoTmp?.remove();
    this.tramoTmp = coords ? L.polyline(coords, { pane: "seleccion", renderer: this.lienzo("seleccion"), color: TINTA, weight: 10, opacity: 0.85, interactive: false }).addTo(this.mapa) : null;
  }

  /** Tu ubicación con el círculo de precisión. */
  ubicacion(ll: LatLon, prec: number, titulo: string): void {
    this.yo?.remove();
    this.yo = L.layerGroup([
      L.circle(ll, { radius: prec, pane: "seleccion", renderer: this.lienzo("seleccion"), color: TINTA, weight: 1.5, fillColor: TINTA, fillOpacity: 0.1, interactive: false }),
      L.marker(ll, { icon: L.divIcon({ className: MK.yo, iconSize: [20, 20] }), title: titulo, keyboard: false }),
    ]).addTo(this.mapa);
  }

  /** El punto del reporte que se está armando en el asistente. */
  marcadorReporte(ll: LatLon | null): void {
    this.marcaRep?.remove();
    this.marcaRep = ll ? L.marker(ll, { icon: L.divIcon({ className: MK.rep, html: icoHtml("i-pin", "size-4.5"), iconSize: [32, 32] }), keyboard: false }).addTo(this.mapa) : null;
  }

  destruir(): void {
    this.destruido = true;
    this.mapa.remove();
  }
}
