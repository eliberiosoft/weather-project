/// <reference types="vite/client" />

/** API mínima del widget de Cloudflare Turnstile (render explícito). */
interface TurnstileOpciones {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  language?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  action?: string;
}
interface Turnstile {
  render(el: HTMLElement, opciones: TurnstileOpciones): string;
  reset(id?: string): void;
  remove(id: string): void;
}
interface Window { turnstile?: Turnstile }

/** Evento de instalación de la PWA (Chrome y Edge). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface WindowEventMap { beforeinstallprompt: BeforeInstallPromptEvent }
