/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_TOKEN?: string;
  readonly VITE_AUTH_MODE?: "access" | "password" | "token";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
