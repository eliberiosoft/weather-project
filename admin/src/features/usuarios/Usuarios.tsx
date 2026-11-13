/* Usuarios y roles (solo superadmin): crear, editar nombre y rol, activar o desactivar y restablecer la clave.
   Las reglas del último superadmin y de no desactivarse a sí mismo las aplica la API; aquí se muestra su error. */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import { ROLES, type Rol, type Usuario } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, EsqueletoFilas, EsqueletoLinea, Esperando } from "../../shared/ui/Esqueleto";
import { Dialogo } from "../../shared/ui/Dialogo";
import { Icono } from "../../shared/ui/Icono";
import { K } from "../../shared/ui/clases";
import { confirmar, toast } from "../../shared/ui/avisos";
import { normalizarUsuario, validarNombre, validarNuevoUsuario } from "./validar";

interface ClaveMostrada { usuario: string; clave: string }

export function Usuarios({ yo }: { yo: Usuario }) {
  const { t, existe } = useI18n();
  const [lista, setLista] = useState<Usuario[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [clave, setClave] = useState<ClaveMostrada | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try { setLista((await api<{ usuarios: Usuario[] }>("/api/panel/usuarios")).usuarios); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function activar(u: Usuario, activo: boolean) {
    if (!activo && !(await confirmar(t("panel.us.confirmar_desactivar", { usuario: u.usuario }), t("panel.us.desactivar")))) return;
    try {
      await api(`/api/panel/usuarios/${u.id}`, { activo });
      toast(t(activo ? "panel.us.activado" : "panel.us.desactivado"));
      await cargar();
    } catch (e) { toast(mensajeError(e, t, existe), 7000); }
  }

  async function restablecer(u: Usuario) {
    if (!(await confirmar(t("panel.us.confirmar_restablecer", { usuario: u.usuario }), t("panel.us.restablecer")))) return;
    try {
      const r = await api<{ clave_temporal: string }>(`/api/panel/usuarios/${u.id}/clave`, {});
      setClave({ usuario: u.usuario, clave: r.clave_temporal });
      await cargar();
    } catch (e) { toast(mensajeError(e, t, existe), 7000); }
  }

  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] 2xl:items-start">
      <section className={K.ficha} aria-labelledby="us-titulo">
        <h2 id="us-titulo" className={K.h2}>{t("panel.us.titulo")}</h2>
        <p className="mt-1 text-sm text-gris">{t("panel.us.explica")}</p>
        {error ? <div className="mt-3"><ErrorCarga texto={mensajeError(error, t, existe)} reintentar={() => void cargar()} /></div>
          : !lista ? <EsqueletoUsuarios />
          : <TablaUsuarios lista={lista} yo={yo} alEditar={setEditando} alActivar={activar} alRestablecer={restablecer} />}
      </section>
      <NuevoUsuario alCrear={async (c) => { setClave(c); await cargar(); }} />

      <EditarUsuario u={editando} alCerrar={() => setEditando(null)} alGuardar={async () => { setEditando(null); await cargar(); }} />
      <Dialogo abierto={!!clave} titulo={t("panel.us.clave_titulo", { usuario: clave?.usuario ?? "" })} alCerrar={() => setClave(null)}>
        {clave && <ClaveTemporal clave={clave.clave} alListo={() => setClave(null)} />}
      </Dialogo>
    </div>
  );
}

function TablaUsuarios({ lista, yo, alEditar, alActivar, alRestablecer }: {
  lista: Usuario[]; yo: Usuario; alEditar: (u: Usuario) => void;
  alActivar: (u: Usuario, activo: boolean) => void; alRestablecer: (u: Usuario) => void;
}) {
  const { t, hora } = useI18n();
  if (!lista.length) return <p className={K.vacio}>{t("panel.us.vacio")}</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className={`${K.tabla} [&_td]:align-middle`}>
        <CabezaUsuarios />
        <tbody>
          {lista.map((u) => {
            const soyYo = u.id === yo.id;
            return (
              <tr key={u.id}>
                <td className="min-w-40">
                  <b>{u.nombre}</b>{soyYo && <span className={`${K.pildora.suave} ml-2`}>{t("panel.us.tu")}</span>}
                  <div className={`${K.mini} font-mono`}>{u.usuario}</div>
                </td>
                <td className="whitespace-nowrap">{t("rol." + u.rol)}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <span className={u.activo ? K.pildora.validado : K.pildora.apagado}>{t(u.activo ? "panel.us.activo" : "panel.us.inactivo")}</span>
                    {u.debe_cambiar_clave && <span className={K.pildora.pendiente}>{t("panel.us.temporal")}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap text-gris">{u.ultimo_ingreso ? hora(u.ultimo_ingreso) : t("panel.us.nunca")}</td>
                <td>
                  <div className="flex min-w-72 flex-wrap gap-1.5">
                    <button type="button" className={K.btnChico} onClick={() => alEditar(u)} aria-label={`${t("panel.us.editar")} · ${u.usuario}`}>{t("panel.us.editar")}</button>
                    {u.activo
                      ? <button type="button" className={K.btnNeutro} disabled={soyYo} title={soyYo ? t("panel.us.no_a_ti") : undefined}
                          onClick={() => alActivar(u, false)} aria-label={`${t("panel.us.desactivar")} · ${u.usuario}`}>{t("panel.us.desactivar")}</button>
                      : <button type="button" className={K.btnChico} onClick={() => alActivar(u, true)} aria-label={`${t("panel.us.activar")} · ${u.usuario}`}>{t("panel.us.activar")}</button>}
                    <button type="button" className={K.btnNeutro} onClick={() => alRestablecer(u)} aria-label={`${t("panel.us.restablecer")} · ${u.usuario}`}>
                      <Icono id="llave" className="size-4" />{t("panel.us.restablecer")}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CabezaUsuarios() {
  const { t } = useI18n();
  return (
    <thead><tr>
      <th scope="col">{t("panel.col.usuario")}</th><th scope="col">{t("panel.col.rol")}</th><th scope="col">{t("panel.col.estado")}</th>
      <th scope="col">{t("panel.col.ultimo")}</th><th scope="col">{t("panel.col.acciones")}</th>
    </tr></thead>
  );
}

/** La tabla de usuarios con sus encabezados reales y tres filas grises (nombre y usuario, rol, estado, último ingreso, botones). */
function EsqueletoUsuarios() {
  const botones = (
    <div className="flex min-w-72 gap-1.5">
      <EsqueletoBloque className="h-11 w-18 rounded-xl" />
      <EsqueletoBloque className="h-11 w-26 rounded-xl" />
      <EsqueletoBloque className="h-11 w-30 rounded-xl" />
    </div>
  );
  return (
    <Esperando className="mt-3 overflow-x-auto">
      <table className={`${K.tabla} [&_td]:align-middle`}>
        <CabezaUsuarios />
        <tbody>
          <EsqueletoFilas filas={3} celdas={[<div className="min-w-40"><EsqueletoLinea className="w-32" /><EsqueletoLinea className="w-20" /></div>,
            "w-16", <EsqueletoBloque className="h-6 w-16 rounded-full" />, "w-24", botones]} />
        </tbody>
      </table>
    </Esperando>
  );
}

function SelectorRol({ nombre, valor, alCambiar }: { nombre: string; valor: Rol; alCambiar: (r: Rol) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="mt-4">
      <legend className={K.etiqueta}>{t("panel.us.rol")}</legend>
      <div className="grid gap-2">
        {ROLES.map((r) => (
          <label key={r} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-regla bg-suelo px-3 py-2.5 text-sm has-checked:border-tinta has-checked:bg-tinta-suave">
            <input type="radio" name={nombre} checked={valor === r} onChange={() => alCambiar(r)} className="mt-0.5 size-5 shrink-0" />
            <span><b className="block">{t("rol." + r)}</b><span className="text-gris">{t("panel.us.rol_ayuda." + r)}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function NuevoUsuario({ alCrear }: { alCrear: (c: ClaveMostrada) => Promise<void> }) {
  const { t, existe } = useI18n();
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("operador");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(ev: FormEvent) {
    ev.preventDefault();
    const u = normalizarUsuario(usuario);
    const falta = validarNuevoUsuario(u, nombre, rol);
    if (falta) { setError(t(falta)); return; }
    setEnviando(true);
    setError(null);
    try {
      const r = await api<{ usuario: Usuario; clave_temporal: string }>("/api/panel/usuarios", { usuario: u, nombre: nombre.trim(), rol });
      setUsuario("");
      setNombre("");
      setRol("operador");
      await alCrear({ usuario: r.usuario.usuario, clave: r.clave_temporal });
    } catch (e) { setError(mensajeError(e, t, existe)); } finally { setEnviando(false); }
  }

  return (
    <form onSubmit={crear} noValidate className={`${K.ficha} 2xl:max-w-none max-w-xl`} aria-labelledby="us-nuevo">
      <h2 id="us-nuevo" className={K.h2}>{t("panel.us.nuevo")}</h2>
      <label htmlFor="us-usuario" className={`mt-4 ${K.etiqueta}`}>{t("panel.us.usuario")}</label>
      <input id="us-usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} maxLength={32} autoComplete="off" autoCapitalize="off" spellCheck={false}
        aria-describedby="us-usuario-ayuda" className={`${K.campo} font-mono`} />
      <p id="us-usuario-ayuda" className={`${K.mini} mt-1.5`}>{t("panel.us.usuario_ayuda")}</p>
      <label htmlFor="us-nombre" className={`mt-4 ${K.etiqueta}`}>{t("panel.us.nombre")}</label>
      <input id="us-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="off" className={K.campo} />
      <SelectorRol nombre="us-rol" valor={rol} alCambiar={setRol} />
      {error && <p role="alert" className="mt-3 rounded-xl bg-tinta-suave px-3 py-2 text-sm font-semibold">{error}</p>}
      <button type="submit" disabled={enviando} className={`${K.btnPrimario} mt-4 w-full`}><Icono id="mas" className="size-5" />{t(enviando ? "panel.us.creando" : "panel.us.crear")}</button>
    </form>
  );
}

function EditarUsuario({ u, alCerrar, alGuardar }: { u: Usuario | null; alCerrar: () => void; alGuardar: () => Promise<void> }) {
  const { t } = useI18n();
  return (
    <Dialogo abierto={!!u} titulo={t("panel.us.editar_titulo", { usuario: u?.usuario ?? "" })} alCerrar={alCerrar}>
      {u && <FormEditar key={u.id} u={u} alCerrar={alCerrar} alGuardar={alGuardar} />}
    </Dialogo>
  );
}

function FormEditar({ u, alCerrar, alGuardar }: { u: Usuario; alCerrar: () => void; alGuardar: () => Promise<void> }) {
  const { t, existe } = useI18n();
  const [nombre, setNombre] = useState(u.nombre);
  const [rol, setRol] = useState<Rol>(u.rol);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    const falta = validarNombre(nombre);
    if (falta) { setError(t(falta)); return; }
    const cambios: { nombre?: string; rol?: Rol } = {};
    if (nombre.trim() !== u.nombre) cambios.nombre = nombre.trim();
    if (rol !== u.rol) cambios.rol = rol;
    if (!Object.keys(cambios).length) { alCerrar(); return; }
    if (cambios.rol && !(await confirmar(t("panel.us.confirmar_rol", { usuario: u.usuario })))) return;
    setEnviando(true);
    setError(null);
    try {
      await api(`/api/panel/usuarios/${u.id}`, cambios);
      toast(t("panel.us.guardado"));
      await alGuardar();
    } catch (e) { setError(mensajeError(e, t, existe)); } finally { setEnviando(false); }
  }

  return (
    <form onSubmit={guardar} noValidate>
      <label htmlFor="ed-nombre" className={`mt-4 ${K.etiqueta}`}>{t("panel.us.nombre")}</label>
      <input id="ed-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className={K.campo} />
      <SelectorRol nombre="ed-rol" valor={rol} alCambiar={setRol} />
      {error && <p role="alert" className="mt-3 rounded-xl bg-tinta-suave px-3 py-2 text-sm font-semibold">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={alCerrar} className={K.btnNeutro}>{t("panel.us.cancelar")}</button>
        <button type="submit" disabled={enviando} className={K.btnChicoFuerte}>{t("panel.us.guardar")}</button>
      </div>
    </form>
  );
}

function ClaveTemporal({ clave, alListo }: { clave: string; alListo: () => void }) {
  const { t } = useI18n();
  const [copiada, setCopiada] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiada(true);
    } catch {
      toast(t("panel.us.copiar_error"));
      (document.getElementById("clave-temporal") as HTMLInputElement | null)?.select();
    }
  }
  return (
    <div>
      <p className="mt-2 text-sm text-gris">{t("panel.us.clave_texto")}</p>
      <label htmlFor="clave-temporal" className={`mt-4 ${K.etiqueta}`}>{t("panel.us.clave_etq")}</label>
      <div className="flex gap-2">
        <input id="clave-temporal" readOnly value={clave} onFocus={(e) => e.target.select()} spellCheck={false}
          className={`${K.campo} min-w-0 flex-1 font-mono text-lg tracking-wide`} />
        <button type="button" onClick={copiar} className={K.btnSecundario}><Icono id="copiar" className="size-4.5" />{t(copiada ? "panel.us.copiada" : "panel.us.copiar")}</button>
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={alListo} className={K.btnChicoFuerte}>{t("panel.us.listo")}</button>
      </div>
    </div>
  );
}
