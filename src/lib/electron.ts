/** Runtime helpers for the narrow bridge exposed by the Electron preload. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.sado !== 'undefined';
}

export function desktopPlatform(): string | null {
  return typeof window !== 'undefined' ? window.sado?.platform ?? null : null;
}
