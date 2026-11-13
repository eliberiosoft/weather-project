/** Tipos del motor i18n compartido (compartido/i18n/motor.js). */
export type Diccionario = Record<string, Record<string, string | string[]>>;
export type Vars = Record<string, string | number | null | undefined>;
export interface Motivo { k: string; v?: Vars; src?: string; pid?: string }
/** Lo que envía el servidor: la lista estructurada y, aparte, el texto en español como respaldo. */
export interface ConMotivos { motivos?: Motivo[] | null; motivo?: string | null }

export interface MotorI18N {
  t(clave: string, vars?: Vars): string;
  lista(clave: string): string[];
  existe(clave: string): boolean;
  agregar(dic: Diccionario): void;
  /** Solo para HTML con atributos data-i18n (no hace falta en React). */
  aplicar(raiz?: ParentNode): void;
  cambiar(idioma: string): void;
  fecha(iso: string | Date, opciones?: Intl.DateTimeFormatOptions): string;
  locale(): string;
  motivo(obj: ConMotivos | null | undefined, opciones?: { vecino?: boolean }): string;
  readonly IDIOMAS: Record<string, string>;
  readonly idioma: string;
}
export declare const I18N: MotorI18N;
