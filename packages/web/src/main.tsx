import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PluginProvider } from "./plugins/PluginContext";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PluginProvider>
      <App />
    </PluginProvider>
  </StrictMode>,
);
