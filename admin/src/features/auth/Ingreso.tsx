/* Pantalla de ingreso: usuario, clave y Turnstile (contrato §1). */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ErrorApi, mensajeError } from "../../shared/api/cliente";
import type { Usuario } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { K } from "../../shared/ui/clases";
import { CampoClave } from "./CampoClave";
import { conUsuario } from "./sesion";
import { Turnstile } from "./Turnstile";
import { validarIngreso } from "./validar";

interface ConfigAuth { captcha: { proveedor: "turnstile"; site_key: string } }

export function Ingreso({ aviso }: { aviso?: string }) {
  const { t, existe } = useI18n();
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [errorConfig, setErrorConfig] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargarConfig = useCallback(() => {
    setErrorConfig(null);
    api<ConfigAuth>("/api/auth/config", undefined, { sinRedirigir: true })
      .then((c) => setSiteKey(c.captcha.site_key))
      .catch((e) => setErrorConfig(e instanceof ErrorApi && e.status === 404 ? t("panel.login.no_disponible") : mensajeError(e, t, existe)));
  }, [t, existe]);
  useEffect(cargarConfig, [cargarConfig]);

  async function entrar(ev: FormEvent) {
    ev.preventDefault();
    const falta = validarIngreso(usuario, clave, captcha);
    if (falta) { setError(t(falta)); return; }
    setEnviando(true);
    setError(null);
    try {
      const r = await api<{ usuario: Usuario }>("/api/auth/login", { usuario: usuario.trim(), clave, captcha }, { sinRedirigir: true });
      setClave("");
      conUsuario(r.usuario);
    } catch (e) {
      setError(mensajeError(e, t, existe));
      setReinicio((n) => n + 1);       // el token de Turnstile ya se usó
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-md place-items-center p-4">
      <form onSubmit={entrar} noValidate className="w-full rounded-ficha bg-papel p-6 shadow-ficha sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-texto">{t("panel.login.titulo")}</h1>
        <p className="mt-2 text-sm text-gris">{t("panel.login.texto")}</p>
        {aviso && existe(aviso) && <p role="status" className={`${K.nota} mt-4`}>{t(aviso)}</p>}

        <label htmlFor="ing-usuario" className={`mt-5 ${K.etiqueta}`}>{t("panel.login.usuario")}</label>
        <input id="ing-usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username"
          autoCapitalize="off" spellCheck={false} autoFocus className={`${K.campo} h-12`} />
        <CampoClave id="ing-clave" etiqueta={t("panel.login.clave")} valor={clave} alCambiar={setClave} autoComplete="current-password" />

        <div className="mt-5">
          {siteKey && <Turnstile siteKey={siteKey} alToken={setCaptcha} reinicio={reinicio} />}
          {!siteKey && !errorConfig && <p role="status" className={K.mini}>{t("panel.login.captcha_cargando")}</p>}
          {errorConfig && (
            <div role="alert" className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold">{errorConfig}</p>
              <button type="button" className={K.btnChico} onClick={cargarConfig}>{t("panel.reintentar")}</button>
            </div>
          )}
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-tinta-suave px-3 py-2 text-sm font-semibold text-texto">{error}</p>}
        <button type="submit" disabled={enviando || !siteKey} className={`${K.btnPrimario} mt-5 min-h-12 w-full text-base`}>
          {t(enviando ? "panel.login.entrando" : "panel.login.entrar")}
        </button>
      </form>
    </main>
  );
}
