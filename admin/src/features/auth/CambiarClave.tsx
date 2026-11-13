/* Cambio de clave: obligatorio con clave temporal (debe_cambiar_clave) o voluntario desde la cabecera. */
import { useState, type FormEvent } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import { useI18n } from "../../shared/i18n/useI18n";
import { K } from "../../shared/ui/clases";
import { toast } from "../../shared/ui/avisos";
import { CampoClave } from "./CampoClave";
import { cerrarSesion, claveCambiada, volverAlPanel } from "./sesion";
import { validarCambioClave } from "./validar";

export function CambiarClave({ obligatoria }: { obligatoria: boolean }) {
  const { t, existe } = useI18n();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    const falta = validarCambioClave(actual, nueva, repetir);
    if (falta) { setError(t(falta)); return; }
    setEnviando(true);
    setError(null);
    try {
      await api("/api/auth/clave", { actual, nueva });
      toast(t("panel.clave.lista"));
      await claveCambiada();
    } catch (e) {
      setError(mensajeError(e, t, existe));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-md place-items-center p-4">
      <form onSubmit={guardar} noValidate className="w-full rounded-ficha bg-papel p-6 shadow-ficha sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-texto">{t("panel.clave.titulo")}</h1>
        <p className="mt-2 text-sm text-gris">{t(obligatoria ? "panel.clave.obligatoria" : "panel.clave.voluntaria")}</p>
        <CampoClave id="cl-actual" etiqueta={t("panel.clave.actual")} valor={actual} alCambiar={setActual} autoComplete="current-password" autoFocus />
        <CampoClave id="cl-nueva" etiqueta={t("panel.clave.nueva")} valor={nueva} alCambiar={setNueva} autoComplete="new-password" ayuda={t("panel.clave.ayuda")} />
        <CampoClave id="cl-repetir" etiqueta={t("panel.clave.repetir")} valor={repetir} alCambiar={setRepetir} autoComplete="new-password" />
        {error && <p role="alert" className="mt-4 rounded-xl bg-tinta-suave px-3 py-2 text-sm font-semibold text-texto">{error}</p>}
        <button type="submit" disabled={enviando} className={`${K.btnPrimario} mt-5 min-h-12 w-full text-base`}>
          {t(enviando ? "panel.clave.guardando" : "panel.clave.guardar")}
        </button>
        <button type="button" className={`${K.btnNeutro} mt-2 w-full`}
          onClick={() => (obligatoria ? void cerrarSesion() : volverAlPanel())}>
          {t(obligatoria ? "panel.clave.salir" : "panel.clave.volver")}
        </button>
      </form>
    </main>
  );
}
