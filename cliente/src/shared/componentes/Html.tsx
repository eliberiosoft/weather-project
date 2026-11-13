/* Texto del diccionario que lleva HTML (negritas, listas, enlaces): las variables van escapadas con tHtml(). */
import { createElement, type HTMLAttributes } from "react";
import { tHtml, useI18n, type Vars } from "../i18n";

type Props = { clave: string; vars?: Vars; como?: "p" | "div" | "span" } & HTMLAttributes<HTMLElement>;

export function Html({ clave, vars, como = "span", ...resto }: Props) {
  useI18n();
  return createElement(como, { ...resto, dangerouslySetInnerHTML: { __html: tHtml(clave, vars) } });
}
