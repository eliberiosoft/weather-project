/* Widget de Cloudflare Turnstile con render explícito. El script se pide solo cuando se monta
   (es decir, solo en la pantalla de ingreso). Sin librerías. */
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../shared/i18n/useI18n";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let cargaScript: Promise<void> | null = null;

function cargarTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!cargaScript) {
    cargaScript = new Promise((ok, falla) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => (window.turnstile ? ok() : falla(new Error("turnstile")));
      s.onerror = () => { cargaScript = null; s.remove(); falla(new Error("turnstile")); };
      document.head.appendChild(s);
    });
  }
  return cargaScript;
}

export function Turnstile({ siteKey, alToken, reinicio }: {
  siteKey: string;
  /** Token nuevo, o null cuando vence o falla. */
  alToken: (token: string | null) => void;
  /** Al cambiar este número se pide un token nuevo (cada token sirve una sola vez). */
  reinicio: number;
}) {
  const { t, idioma } = useI18n();
  const caja = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(alToken);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");

  useEffect(() => { cb.current = alToken; }, [alToken]);

  useEffect(() => {
    let vivo = true;
    cargarTurnstile().then(() => {
      if (!vivo || !caja.current || !window.turnstile) return;
      widget.current = window.turnstile.render(caja.current, {
        sitekey: siteKey,
        language: idioma,
        theme: "light",
        size: "flexible",
        action: "login",
        callback: (tk) => cb.current(tk),
        "expired-callback": () => cb.current(null),
        "error-callback": () => cb.current(null),
      });
      setEstado("listo");
    }).catch(() => vivo && setEstado("error"));
    return () => {
      vivo = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
      cb.current(null);
    };
  }, [siteKey, idioma]);

  useEffect(() => {
    if (reinicio && widget.current && window.turnstile) {
      cb.current(null);
      window.turnstile.reset(widget.current);
    }
  }, [reinicio]);

  return (
    <div>
      <div ref={caja} className="min-h-[65px]" aria-label={t("panel.login.captcha")} role="group" />
      {estado === "cargando" && <p role="status" className="mt-1 text-xs text-gris">{t("panel.login.captcha_cargando")}</p>}
      {estado === "error" && <p role="alert" className="mt-1 text-sm font-semibold text-texto">{t("panel.login.captcha_error")}</p>}
    </div>
  );
}
