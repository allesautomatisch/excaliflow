import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { checkFlowSession } from "./data/flowSession";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;

registerSW();
checkFlowSession()
  .then(async (authenticated) => {
    if (!authenticated) {
      return;
    }

    await import("./sentry");
    const { default: ExcalidrawApp } = await import("./App");
    createRoot(rootElement).render(
      <StrictMode>
        <ExcalidrawApp />
      </StrictMode>,
    );
  })
  .catch(() => {
    rootElement.textContent =
      "Die Flow-Sitzung konnte nicht geprüft werden. Lade die Seite erneut.";
  });
