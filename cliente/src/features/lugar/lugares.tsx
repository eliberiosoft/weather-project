/* Lista de lugares del buscador (la usan «Mi lugar» y el mapa: features/lugar/Buscador.tsx). */
import { useMemo } from "react";
import { armarLugares, type Lugares } from "../../shared/lugares";
import { useI18n } from "../../shared/i18n";
import { useApp } from "../../shared/store";

const VACIO: Lugares = { mapa: new Map(), opciones: [] };

export function useLugares(): Lugares {
  const terr = useApp((s) => s.terr);
  const { idioma } = useI18n();
  return useMemo(() => (terr ? armarLugares(terr) : VACIO), [terr, idioma]); // eslint-disable-line react-hooks/exhaustive-deps
}
