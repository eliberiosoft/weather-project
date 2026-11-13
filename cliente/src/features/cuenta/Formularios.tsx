/* Piezas de los formularios de la cuenta: campo con su error, foto de perfil y avatar. */
import { useId, useState, type InputHTMLAttributes } from "react";
import { Icono } from "../../shared/componentes/Icono";
import { useI18n } from "../../shared/i18n";
import { reducirFoto } from "../reportar/foto";

export const CAMPO = "min-h-12 w-full rounded-2xl bg-suelo px-4 text-base text-texto ring-1 ring-regla outline-none transition focus:bg-papel focus:ring-2 focus:ring-tinta aria-invalid:ring-2 aria-invalid:ring-negro read-only:text-gris";

/** Campo con etiqueta arriba y, si hay, el error debajo (ligado con aria-describedby). */
export function Campo({ etiqueta, error, nota, ...resto }: { etiqueta: string; error?: string | null; nota?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{etiqueta}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error || nota ? id + "-m" : undefined} className={CAMPO} {...resto} />
      {error ? <p id={id + "-m"} className="mt-1 text-sm font-semibold text-texto">{t(error)}</p>
        : nota ? <p id={id + "-m"} className="mt-1 text-xs text-gris">{nota}</p> : null}
    </div>
  );
}

/** Contraseña con el botón para verla. */
export function CampoClave({ etiqueta, error, ...resto }: { etiqueta: string; error?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useI18n();
  const id = useId();
  const [ver, setVer] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{etiqueta}</label>
      <div className="relative">
        <input id={id} type={ver ? "text" : "password"} aria-invalid={error ? true : undefined} aria-describedby={error ? id + "-m" : undefined} className={`${CAMPO} pr-24`} {...resto} />
        <button type="button" onClick={() => setVer((v) => !v)} aria-pressed={ver}
          className="absolute inset-y-1 right-1 rounded-xl px-3 text-sm font-semibold text-tinta active:scale-95">
          {t(ver ? "app.cuenta.clave.ocultar" : "app.cuenta.clave.ver")}
        </button>
      </div>
      {error && <p id={id + "-m"} className="mt-1 text-sm font-semibold text-texto">{t(error)}</p>}
    </div>
  );
}

/** Círculo con la foto o la inicial. */
export function Avatar({ src, inicial, className = "size-11 text-lg" }: { src: string | null; inicial: string; className?: string }) {
  return src
    ? <img src={src} alt="" className={`shrink-0 rounded-full object-cover ${className}`} draggable={false} />
    : <span className={`grid shrink-0 place-items-center rounded-full bg-tinta font-bold text-white ${className}`}>{inicial || <Icono id="i-usuario" className="size-1/2" />}</span>;
}

/** Elegir la foto de perfil: se reduce en el teléfono (sin metadatos) y se entrega como data URL JPEG. */
export function ElegirFoto({ foto, alCambiar, inicial }: { foto: string | null; alCambiar: (f: string | null) => void; inicial: string }) {
  const { t } = useI18n();
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState(false);
  async function elegir(lista: FileList | null) {
    const f = lista?.[0];
    if (!f) return;
    setLeyendo(true);
    setError(false);
    try { alCambiar(await reducirFoto(f)); } catch { setError(true); } finally { setLeyendo(false); }
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar src={foto} inicial={inicial} className="size-16 text-2xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t("app.cuenta.foto.titulo")}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <label className={`relative inline-flex min-h-10 items-center gap-1.5 rounded-full bg-tinta-suave px-3.5 text-sm font-semibold text-tinta active:scale-95 ${leyendo ? "opacity-60" : ""}`}>
            <Icono id="i-camara" className="size-4.5" />{t(foto ? "app.cuenta.foto.cambiar" : "app.cuenta.foto.elegir")}
            <input type="file" accept="image/*" disabled={leyendo} onChange={(e) => { void elegir(e.target.files); e.target.value = ""; }} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          {foto && <button type="button" onClick={() => alCambiar(null)} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-gris active:scale-95">{t("app.cuenta.foto.quitar")}</button>}
        </div>
        {error && <p className="mt-1 text-sm font-semibold">{t("app.cuenta.foto.error")}</p>}
      </div>
    </div>
  );
}
