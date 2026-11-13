import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./estilos.css";
import "./shared/i18n";
import { App } from "./app/App";
import { iniciar } from "./app/arranque";
import { prepararSplash } from "./app/splash";

prepararSplash();   // antes de pintar: en una pestaña el splash sale del DOM; instalada, se queda hasta los primeros datos
createRoot(document.getElementById("raiz") as HTMLElement).render(<StrictMode><App /></StrictMode>);
void iniciar();
