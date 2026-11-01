/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VIVARIUM_URL?: string;
  readonly VITE_VIVARIUM_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
