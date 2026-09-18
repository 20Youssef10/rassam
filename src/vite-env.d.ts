/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RASSAM_WS_URL?: string;
  readonly VITE_RASSAM_STORAGE_URL?: string;
  readonly VITE_RASSAM_AUTH_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
