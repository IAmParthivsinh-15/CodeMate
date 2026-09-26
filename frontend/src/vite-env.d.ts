/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API origin. Empty = same origin (dev proxy / reverse proxy). */
  readonly VITE_API_URL?: string
  /** Optional Socket.IO origin. Empty = same origin. */
  readonly VITE_SOCKET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
