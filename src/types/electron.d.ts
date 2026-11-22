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

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.sado !== 'undefined';
}

export function desktopPlatform(): string | null {
  return typeof window !== 'undefined' ? window.sado?.platform ?? null : null;
}