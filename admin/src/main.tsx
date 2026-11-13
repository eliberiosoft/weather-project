/* La hoja de estilos (src/estilos.css) se enlaza desde index.html para que el splash tenga estilo antes que React. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registrarServiceWorker } from "./features/pwa/pwa";

createRoot(document.getElementById("raiz")!).render(<StrictMode><App /></StrictMode>);
registrarServiceWorker();
