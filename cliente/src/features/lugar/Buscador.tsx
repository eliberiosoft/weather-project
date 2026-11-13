/* Buscador de recintos, cabeceras y calles (combobox) para «Mi lugar» y el mapa. Reemplaza al <datalist> nativo, que en
   el celular se veía mal: en Android, un desplegable apretado contra el teclado y con cada nombre repetido; en iPhone,
   solo una barrita sobre el teclado. Aquí la lista va bajo la caja, con filas de 48 px, ícono (recinto o calle), y se
   usa con el dedo o con el teclado (flechas, Enter, Escape). Sin tildes ni mayúsculas (shared/lugares: sugerirLugares). */
import { useId, useRef, useState, type ReactNode } from "react";
import { Icono } from "../../shared/componentes/Icono";
import { useI18n } from "../../shared/i18n";
import { buscarLugar, sugerirLugares, type LugarBuscado } from "../../shared/lugares";
import { useLugares } from "./lugares";

interface Props {
  id: string;
  etiqueta: string;
  placeholder: string;
  /** clases de la caja (fondo, sombra, ancho): cada vista tiene la suya */
  className: string;
  /** al elegir un lugar; si devuelve true se vacía la caja */
  alElegir: (l: LugarBuscado) => boolean;
  /** escribió algo que no coincide con ningún lugar y tocó «Buscar» */
  alNoEncontrar: () => void;
  /** botones al final de la caja (p. ej. «Usar mi ubicación») */
  extra?: ReactNode;
}

export function BuscadorLugar({ id, etiqueta, placeholder, className, alElegir, alNoEncontrar, extra }: Props) {
  const { t } = useI18n();
  const lugares = useLugares();
  const lista = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const sugerencias = abierto ? sugerirLugares(lugares, texto) : [];
  const verLista = abierto && texto.trim().length > 0;

  const elegir = (l: LugarBuscado) => {
    const vaciar = alElegir(l);
    setTexto(vaciar ? "" : l.texto);
    setAbierto(false);
    setActivo(-1);
    entrada.current?.blur();
  };
  const enviar = () => {
    const l = (activo >= 0 ? sugerencias[activo]?.lugar : null) ?? sugerencias[0]?.lugar ?? buscarLugar(lugares.mapa, texto);
    if (l) elegir(l);
    else if (texto.trim()) alNoEncontrar();
  };
  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAbierto(true);
      const n = sugerencias.length;
      if (n) setActivo((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === "Escape") {
      setAbierto(false);
      setActivo(-1);
    }
  };

  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); enviar(); }} className={`relative ${className}`}>
      <label className="sr-only" htmlFor={id}>{etiqueta}</label>
      <Icono id="i-buscar" className="size-5 shrink-0" />
      <input ref={entrada} id={id} type="search" value={texto} placeholder={placeholder} autoComplete="off" enterKeyHint="search"
        role="combobox" aria-expanded={verLista} aria-controls={lista} aria-autocomplete="list"
        aria-activedescendant={activo >= 0 ? `${lista}-${activo}` : undefined}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(-1); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={teclas}
        className="h-full min-w-0 flex-1 bg-transparent font-medium text-texto outline-none [&::-webkit-search-cancel-button]:hidden" />
      {texto && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setTexto(""); setActivo(-1); entrada.current?.focus(); }}
          aria-label={t("app.buscar.borrar")} title={t("app.buscar.borrar")} className="grid size-9 shrink-0 place-items-center rounded-xl text-gris active:scale-95">
          <Icono id="i-x" className="size-4.5" />
        </button>
      )}
      {extra}
      <ul id={lista} role="listbox" aria-label={etiqueta} hidden={!verLista}
        className="absolute inset-x-0 top-[calc(100%+.5rem)] z-[1100] max-h-[min(22rem,50dvh)] list-none overflow-y-auto overscroll-contain rounded-2xl bg-papel p-1.5 text-left shadow-flota ring-1 ring-regla">
        {sugerencias.length ? sugerencias.map((s, i) => (
          <li key={s.titulo} id={`${lista}-${i}`} role="option" aria-selected={i === activo}
            onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(s.lugar)}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 aria-selected:bg-tinta-suave hover:bg-suelo">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta">
              <Icono id={s.calle ? "t-calle_inundada" : "i-pin"} className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-texto">{s.titulo}</span>
              <span className="block truncate text-xs text-gris">{s.detalle}</span>
            </span>
          </li>
        )) : <li role="presentation" className="px-3 py-3 text-sm text-gris">{t("app.buscar.sin_resultados", { q: texto.trim() })}</li>}
      </ul>
    </form>
  );
}
