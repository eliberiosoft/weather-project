/* Yaguachi Weather · motor i18n (módulo ES, sin dependencias ni framework).
   Lo usan la app ciudadana y el panel (React). Ningún texto de la interfaz va escrito directo:
   se usa una clave y I18N.t("clave", { n: 3 }).

   - I18N.agregar({ es: {...}, en: {...} })   suma diccionarios (cada app agrega los suyos al arrancar)
   - I18N.cambiar("en")                        cambia el idioma, lo guarda y dispara el evento «idioma» en window
   - I18N.idioma                               idioma actual; I18N.IDIOMAS lista los disponibles
   - I18N.fecha(iso, opciones) · I18N.lista(clave) · I18N.existe(clave) · I18N.motivo(m, { vecino })
   En React, suscríbete al evento «idioma» (p. ej. con useSyncExternalStore) para repintar.
   Lo que falte en un idioma cae al español. */

const IDIOMAS = { es: "Español", en: "English" };
const LOCALE = { es: "es-EC", en: "en-US" };
const textos = { es: {}, en: {} };

const guardado = (() => { try { return localStorage.getItem("ay_idioma"); } catch { return null; } })();
const delNavegador = (navigator.language || "es").slice(0, 2);
let idioma = IDIOMAS[guardado] ? guardado : IDIOMAS[delNavegador] ? delNavegador : "es";

function agregar(dic) {
  for (const l of Object.keys(dic)) textos[l] = Object.assign(textos[l] || {}, dic[l]);
}
function crudo(clave) {
  const v = textos[idioma]?.[clave] ?? textos.es[clave];
  if (v === undefined) console.warn("[i18n] falta la clave", clave);
  return v;
}
function t(clave, vars) {
  let s = crudo(clave);
  if (s === undefined) return clave;
  if (Array.isArray(s)) s = s.join(" ");
  return vars ? String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "")) : String(s);
}
const lista = (clave) => { const v = crudo(clave); return Array.isArray(v) ? v : v ? [v] : []; };
const existe = (clave) => (textos[idioma]?.[clave] ?? textos.es[clave]) !== undefined;
const locale = () => LOCALE[idioma] || "es-EC";
const fecha = (iso, op) => (iso ? new Date(iso).toLocaleString(locale(), op) : "");

function aplicar(raiz = document) {
  raiz.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  raiz.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  raiz.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((par) => {
      const [atr, clave] = par.split(":").map((x) => x.trim());
      if (atr && clave) el.setAttribute(atr, t(clave));
    });
  });
  const html = document.documentElement;
  html.lang = locale();
  if (html.dataset.i18nTitulo) document.title = t(html.dataset.i18nTitulo);
  if (html.dataset.i18nDesc) document.querySelector('meta[name="description"]')?.setAttribute("content", t(html.dataset.i18nDesc));
  raiz.querySelectorAll("select[data-idioma]").forEach((sel) => {
    if (!sel.options.length) {
      const corto = sel.dataset.idioma === "corto";   // <select data-idioma="corto"> muestra ES / EN
      sel.innerHTML = Object.entries(IDIOMAS).map(([c, n]) => `<option value="${c}" lang="${c}">${corto ? c.toUpperCase() : n}</option>`).join("");
      sel.addEventListener("change", () => cambiar(sel.value));
    }
    sel.value = idioma;
  });
}

function cambiar(l) {
  if (!IDIOMAS[l] || l === idioma) return;
  idioma = l;
  try { localStorage.setItem("ay_idioma", l); } catch { /* modo privado */ }
  aplicar();
  window.dispatchEvent(new CustomEvent("idioma", { detail: l }));
}

// ---------- textos comunes a la app y al panel ----------
agregar({
  es: {
    "idioma.etq": "Idioma",
    "nivel.0": "Sin dato", "nivel.1": "NORMAL", "nivel.2": "VIGILANCIA", "nivel.3": "PREPARACIÓN", "nivel.4": "RESPUESTA",
    "tipo.calle_inundada": "Calle o camino inundado",
    "tipo.vivienda_inundada": "Agua dentro de viviendas",
    "tipo.rio_crecido": "Río o estero creciendo",
    "tipo.desborde": "El río se desbordó",
    "tipo.via_cerrada": "Vía cerrada o intransitable",
    "tipo.alcantarilla": "Alcantarilla o canal tapado",
    "tipo.dique_filtracion": "Filtración o grieta en muro o dique",
    "tipo.socavon": "Socavón o hundimiento",
    "tipo.arbol_poste": "Árbol o poste caído",
    "tipo.sin_luz": "Sin energía eléctrica",
    "tipo.lluvia_fuerte": "Lluvia muy fuerte ahora",
    "tipo.aislados": "Familias aisladas o que necesitan evacuar",
    "tipo.cultivos_ganado": "Cultivos o ganado afectados",
    "tipo.bache": "Bache en la calle",
    "tipo.basura": "No han recolectado la basura",
    "tipo.robo": "Robo o asalto",
    "tipo.otro": "Otro problema",
    "gravedad.0": "por tipificar", "gravedad.1": "leve", "gravedad.2": "moderada", "gravedad.3": "grave",
    "altura.1": "hasta la vereda", "altura.2": "sobre la vereda", "altura.3": "no cruces",
    "altura.1.larga": "Hasta el borde de la vereda (menos de 15 cm)", "altura.2.larga": "Sobre la vereda (tapa media llanta de moto)", "altura.3.larga": "No cruces (más de 40 cm o con corriente)",
    "estado.validado": "verificado", "estado.pendiente": "en revisión", "estado.descartado": "descartado", "estado.resuelto": "resuelto",
    "estado.calle_pendiente": "aviso de vecinos", "estado.vecinos": "confirmado por {n} vecinos",
    "estado.validado_vecinos": "confirmado por vecinos",
    "acciones.1": ["Mantén limpias las cunetas y alcantarillas de tu calle.",
      "Ten a mano tu mochila de emergencia: documentos, agua, linterna, medicinas y cargador.",
      "Conoce el albergue y la ruta segura de tu recinto."],
    "acciones.2": ["Revisa la app y sigue las indicaciones del COE cantonal, de la Unidad de Riesgos del municipio y de tu presidente de recinto.",
      "Sube a lo alto documentos, semillas, abonos y electrodomésticos.",
      "Si vives junto al río, acuerda con tu familia a dónde irían si hay que salir.",
      "Reporta en la app si ves que el río o el estero sube rápido."],
    "acciones.3": ["Prepárate para salir: mochila lista y la familia avisada.",
      "Adultos mayores, personas con discapacidad, embarazadas y niños deben salir primero, hacia el albergue o donde un familiar en zona alta.",
      "Lleva el ganado y la maquinaria a zonas altas.",
      "No cruces ríos ni calles con corriente."],
    "acciones.4": ["Sal ya hacia el albergue o a una zona alta por la ruta segura.",
      "Corta la luz y el gas antes de salir si puedes hacerlo sin riesgo.",
      "No camines ni manejes por agua en movimiento: 15 cm pueden tumbarte y 60 cm arrastran un carro.",
      "Si estás atrapado o hay personas en peligro, llama al ECU 911."],
  },
  en: {
    "idioma.etq": "Language",
    "nivel.0": "No data", "nivel.1": "NORMAL", "nivel.2": "WATCH", "nivel.3": "GET READY", "nivel.4": "RESPONSE",
    "tipo.calle_inundada": "Flooded street or road",
    "tipo.vivienda_inundada": "Water inside homes",
    "tipo.rio_crecido": "River or creek rising",
    "tipo.desborde": "The river overflowed",
    "tipo.via_cerrada": "Road closed or impassable",
    "tipo.alcantarilla": "Blocked drain or channel",
    "tipo.dique_filtracion": "Leak or crack in a wall or levee",
    "tipo.socavon": "Sinkhole or subsidence",
    "tipo.arbol_poste": "Fallen tree or pole",
    "tipo.sin_luz": "No electricity",
    "tipo.lluvia_fuerte": "Very heavy rain now",
    "tipo.aislados": "Families cut off or needing evacuation",
    "tipo.cultivos_ganado": "Crops or livestock affected",
    "tipo.bache": "Pothole in the street",
    "tipo.basura": "Rubbish not collected",
    "tipo.robo": "Theft or robbery",
    "tipo.otro": "Other problem",
    "gravedad.0": "not yet classified", "gravedad.1": "minor", "gravedad.2": "moderate", "gravedad.3": "serious",
    "altura.1": "up to the curb", "altura.2": "over the curb", "altura.3": "do not cross",
    "altura.1.larga": "Up to the curb (under 15 cm)", "altura.2.larga": "Over the curb (covers half a motorbike wheel)", "altura.3.larga": "Do not cross (over 40 cm or flowing)",
    "estado.validado": "verified", "estado.pendiente": "under review", "estado.descartado": "dismissed", "estado.resuelto": "resolved",
    "estado.calle_pendiente": "neighbour alert", "estado.vecinos": "confirmed by {n} neighbours",
    "estado.validado_vecinos": "confirmed by neighbours",
    "acciones.1": ["Keep the gutters and drains on your street clear.",
      "Keep your emergency bag at hand: documents, water, flashlight, medicine and charger.",
      "Know your community's shelter and safe route."],
    "acciones.2": ["Check the app and follow the instructions of the cantonal COE, the municipal Risk Unit and your community leader.",
      "Move documents, seeds, fertiliser and appliances up high.",
      "If you live by the river, agree with your family where you would go if you have to leave.",
      "Report in the app if you see the river or creek rising fast."],
    "acciones.3": ["Get ready to leave: bag packed and family informed.",
      "Older adults, people with disabilities, pregnant women and children should leave first, to the shelter or to relatives on high ground.",
      "Move livestock and machinery to high ground.",
      "Do not cross rivers or streets with flowing water."],
    "acciones.4": ["Leave now for the shelter or high ground by the safe route.",
      "Turn off power and gas before leaving if you can do it safely.",
      "Do not walk or drive through moving water: 15 cm can knock you down and 60 cm can sweep a car away.",
      "If you are trapped or people are in danger, call ECU 911."],
  },
});

// Motivos que calcula el servidor: llegan como [{k, v, pid?, src?}] y se arman en el idioma activo.
// Si el objeto no trae la lista (API vieja o caché), se usa su texto en español.
function motivo(obj, { vecino = false } = {}) {
  const ms = obj && obj.motivos;
  if (!Array.isArray(ms) || !ms.length) return (obj && obj.motivo) || "";
  if (vecino) return motivoVecino(ms);
  const fmt = (v) => Object.fromEntries(Object.entries(v || {}).map(([k, x]) =>
    [k, typeof x === "number" ? x.toLocaleString(locale(), { maximumFractionDigits: 2 }) : x]));
  const grupos = [];
  for (const m of ms) {
    const clave = (m.pid || "") + "|" + (m.src || "");
    let g = grupos.find((x) => x.clave === clave);
    if (!g) grupos.push((g = { clave, pid: m.pid, src: m.src, partes: [] }));
    g.partes.push(existe("motivo." + m.k) ? t("motivo." + m.k, fmt(m.v)) : m.k);
  }
  return grupos.map((g) => (g.pid ? g.pid + " · " : "") + (g.src ? t("motivo.src." + g.src) + ": " : "") + g.partes.join("; ")).join(" / ");
}

// Para la app ciudadana: frases llanas, sin P(>Q2) ni códigos de punto; repetidas se dicen una vez y se avisa si es modelo o medida.
function motivoVecino(ms) {
  const fmt = (v) => Object.fromEntries(Object.entries(v || {}).map(([k, x]) =>
    [k, typeof x === "number" ? x.toLocaleString(locale(), { maximumFractionDigits: k === "p" ? 0 : 2 }) : x]));
  const partes = [];
  for (const m of ms) {
    const clave = existe("vecino." + m.k) ? "vecino." + m.k : "motivo." + m.k;
    const txt = existe(clave) ? t(clave, fmt(m.v)) : m.k;
    if (!partes.includes(txt)) partes.push(txt);
  }
  const fuentes = [...new Set(ms.map((m) => m.src).filter(Boolean))].map((f) => t("vecino.src." + f));
  const frase = partes.join("; ") + (fuentes.length ? " (" + fuentes.join(", ") + ")" : "");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

agregar({
  es: {
    "vecino.src.glofas": "modelo GloFAS", "vecino.src.regla": "medido en la regla",
    "vecino.glofas.q_q5": "el río trae hoy mucha más agua de lo normal", "vecino.glofas.q_q2": "el río trae hoy más agua de lo normal",
    "vecino.glofas.q_p90": "el río está más alto de lo habitual", "vecino.glofas.normal": "el río está dentro de lo normal",
    "vecino.glofas.p_q2_30": "{p} % de probabilidad de que el río crezca más de lo normal en los próximos 30 días",
    "vecino.glofas.p_q5_30": "{p} % de probabilidad de una crecida fuerte en los próximos 30 días",
    "vecino.glofas.p_q5_72": "{p} % de probabilidad de una crecida fuerte en los próximos 3 días",
    "vecino.regla.borde": "al río le faltan {m} m para desbordarse", "vecino.regla.24h": "el río subió {m} m en un día", "vecino.regla.hora": "el río sube {m} m por hora",
    "vecino.lluvia.prep": "se esperan {dia} mm de lluvia en un día y {tres} mm en 3 días", "vecino.lluvia.vig": "se esperan {dia} mm de lluvia en un día",
    "vecino.adv": "hay una advertencia del INAMHI", "vecino.adv_texto": "hay una advertencia del INAMHI ({texto})",
    "vecino.rio_cerca": "{rio} está a {m} m", "vecino.graves": "hay {n} caso(s) grave(s) verificado(s) a menos de 1,5 km",
    "vecino.sin_punto": "este río no tiene medición ni modelo", "vecino.ninguno": "no hay señales de peligro por ahora",
    "motivo.src.glofas": "GloFAS", "motivo.src.regla": "Regla",
    "motivo.glofas.sin_datos": "sin datos de GloFAS", "motivo.glofas.vencido": "pronóstico GloFAS vencido",
    "motivo.glofas.sin_caudal": "GloFAS sin caudal para hoy",
    "motivo.glofas.q_q5": "caudal {q} > Q5 {u}", "motivo.glofas.q_q2": "caudal {q} > Q2 {u}", "motivo.glofas.q_p90": "caudal {q} > P90 {u}",
    "motivo.glofas.p_q5_72": "P(>Q5) {p} % en 72 h", "motivo.glofas.p_q2_30": "P(>Q2) {p} % en 30 d", "motivo.glofas.p_q5_30": "P(>Q5) {p} % en 30 d",
    "motivo.glofas.normal": "caudal {q} < P90 {u} y P(>Q2) {p} % < 20 %",
    "motivo.regla.borde": "regla a {m} m del borde de desborde", "motivo.regla.24h": "subió {m} m en 24 h", "motivo.regla.hora": "sube {m} m por hora",
    "motivo.lluvia.prep": "lluvia pronosticada {dia} mm en un día / {tres} mm en 3 días", "motivo.lluvia.vig": "lluvia pronosticada {dia} mm en un día",
    "motivo.adv": "Advertencia INAMHI vigente", "motivo.adv_texto": "Advertencia INAMHI vigente ({texto})",
    "motivo.rio_cerca": "{rio} a {m} m", "motivo.graves": "{n} caso(s) grave(s) verificado(s) a menos de 1,5 km",
    "motivo.sin_punto": "sin punto GloFAS ni regla", "motivo.ninguno": "sin disparadores activos",
    "fuente.modelo": "modelo", "fuente.medido": "medido",
  },
  en: {
    "vecino.src.glofas": "GloFAS model", "vecino.src.regla": "measured on the gauge",
    "vecino.glofas.q_q5": "the river is carrying far more water than normal today", "vecino.glofas.q_q2": "the river is carrying more water than normal today",
    "vecino.glofas.q_p90": "the river is higher than usual", "vecino.glofas.normal": "the river is within normal levels",
    "vecino.glofas.p_q2_30": "{p}% chance the river rises above normal in the next 30 days",
    "vecino.glofas.p_q5_30": "{p}% chance of a major flood in the next 30 days",
    "vecino.glofas.p_q5_72": "{p}% chance of a major flood in the next 3 days",
    "vecino.regla.borde": "the river is {m} m below overflowing", "vecino.regla.24h": "the river rose {m} m in one day", "vecino.regla.hora": "the river is rising {m} m per hour",
    "vecino.lluvia.prep": "{dia} mm of rain expected in one day and {tres} mm in 3 days", "vecino.lluvia.vig": "{dia} mm of rain expected in one day",
    "vecino.adv": "there is an INAMHI warning", "vecino.adv_texto": "there is an INAMHI warning ({texto})",
    "vecino.rio_cerca": "{rio} is {m} m away", "vecino.graves": "there are {n} verified serious case(s) within 1.5 km",
    "vecino.sin_punto": "this river has no gauge or model", "vecino.ninguno": "no signs of danger for now",
    "motivo.src.glofas": "GloFAS", "motivo.src.regla": "Gauge",
    "motivo.glofas.sin_datos": "no GloFAS data", "motivo.glofas.vencido": "GloFAS forecast expired",
    "motivo.glofas.sin_caudal": "GloFAS has no flow for today",
    "motivo.glofas.q_q5": "flow {q} > Q5 {u}", "motivo.glofas.q_q2": "flow {q} > Q2 {u}", "motivo.glofas.q_p90": "flow {q} > P90 {u}",
    "motivo.glofas.p_q5_72": "P(>Q5) {p}% within 72 h", "motivo.glofas.p_q2_30": "P(>Q2) {p}% within 30 days", "motivo.glofas.p_q5_30": "P(>Q5) {p}% within 30 days",
    "motivo.glofas.normal": "flow {q} < P90 {u} and P(>Q2) {p}% < 20%",
    "motivo.regla.borde": "gauge {m} m below the overflow mark", "motivo.regla.24h": "rose {m} m in 24 h", "motivo.regla.hora": "rising {m} m per hour",
    "motivo.lluvia.prep": "forecast rain {dia} mm in one day / {tres} mm in 3 days", "motivo.lluvia.vig": "forecast rain {dia} mm in one day",
    "motivo.adv": "INAMHI warning in force", "motivo.adv_texto": "INAMHI warning in force ({texto})",
    "motivo.rio_cerca": "{rio} {m} m away", "motivo.graves": "{n} verified serious case(s) within 1.5 km",
    "motivo.sin_punto": "no GloFAS point or gauge", "motivo.ninguno": "no active triggers",
    "fuente.modelo": "model", "fuente.medido": "measured",
  },
});

export const I18N = { t, lista, existe, agregar, aplicar, cambiar, fecha, locale, motivo, IDIOMAS, get idioma() { return idioma; } };
