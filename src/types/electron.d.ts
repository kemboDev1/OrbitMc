/**
 * Bridge exposed by electron/preload.cjs via contextBridge.
 * Only present when OrbitMc runs inside the Electron desktop shell.
 */
interface SadoDesktopBridge {
  platform: string;
  appName: string;
  version: string;
}

declare global {
  interface Window {
    sado?: SadoDesktopBridge;
  }
}

export {};
