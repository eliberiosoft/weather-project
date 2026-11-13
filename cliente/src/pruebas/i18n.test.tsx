// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { I18N, useI18n } from "../shared/i18n";
import { textosApp } from "../i18n/textos";

function Texto() {
  const { t, idioma } = useI18n();
  return <p data-idioma={idioma}>{t("app.sec.avisos")}</p>;
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useI18n", () => {
  afterEach(() => act(() => I18N.cambiar("es")));
  it("repinta al cambiar de idioma (evento «idioma» de window)", () => {
    act(() => I18N.cambiar("es"));
    const el = document.createElement("div");
    const raiz = createRoot(el);
    act(() => raiz.render(<Texto />));
    expect(el.textContent).toBe("Avisos");
    act(() => I18N.cambiar("en"));
    expect(el.textContent).toBe("Alerts");
    expect(el.querySelector("p")?.dataset.idioma).toBe("en");
    act(() => raiz.unmount());
  });
  it("es y en tienen las mismas claves", () => {
    const es = Object.keys(textosApp.es ?? {}).sort(), en = Object.keys(textosApp.en ?? {}).sort();
    expect(en).toEqual(es);
  });
});
