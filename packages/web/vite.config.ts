import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const apiTarget = env.VITE_VIVARIUM_URL || "http://127.0.0.1:8787";

  return {
    plugins: [react()],
    envDir: import.meta.dirname,
    server: {
      port: 5173,
      proxy: {
        "/v1": apiTarget,
        "/health": apiTarget,
      },
    },
  };
});
