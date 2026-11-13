/* Formatos de fecha para los campos del panel. */

const dos = (x: number) => String(x).padStart(2, "0");

/** ISO → valor de un <input type="datetime-local"> en la hora local del equipo. */
export function aLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Valor de un datetime-local → ISO (o null si está vacío). */
export function deLocal(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Lo mínimo para publicar un texto (igual que la API, texto_con_sentido en api/servidor.py): al menos `minimo`
    caracteres y 3 letras o números. «.» o «...» no cuentan: nada se publica vacío. */
export function textoConSentido(t: string, minimo = 5): boolean {
  const s = t.trim();
  return s.length >= minimo && (s.match(/[\p{L}\p{N}]/gu) ?? []).length >= 3;
}
