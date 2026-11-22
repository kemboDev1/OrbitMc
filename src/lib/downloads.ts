/**
 * Desktop download resolution.
 *
 * OrbitMc ships native installers from GitHub Releases (built by the release
 * workflow). This module maps the visitor's OS to the matching asset name so
 * the landing page can offer the right file, and falls back to a release page
 * link when the platform is unknown.
 */

export type DesktopTarget = 'windows' | 'macos' | 'linux' | 'unknown';

/** Owner/repo used for the download links. Override for forks. */
export const RELEASES_BASE = 'https://github.com/kemboDev1/sado/releases';

function ua(): string {
  if (typeof navigator === 'undefined') return '';
  const uaData = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData;
  if (uaData?.platform) return uaData.platform;
  return navigator.userAgent || '';
}

/** Best-effort OS detection. `unknown` covers iPhone, Android and the rest. */
export function detectDesktopTarget(): DesktopTarget {
  const hint = ua();
  if (/win/i.test(hint)) return 'windows';
  if (/mac|darwin/i.test(hint)) return 'macos';
  if (/linux|x11/i.test(hint)) return 'linux';
  return 'unknown';
}

export function isMobile(): boolean {
  return /iphone|ipad|ipod|android|mobile/i.test(ua());
}

/**
 * Asset naming follows electron-builder's configured patterns. Keep these in
 * sync with `build` in package.json.
 */
const ASSET_NAME: Record<Exclude<DesktopTarget, 'unknown'>, string> = {
  windows: 'OrbitMc-Windows-1.0.0.exe',
  macos: 'OrbitMc-1.0.0.dmg',
  linux: 'OrbitMc-1.0.0.AppImage',
};

/** URL of the best matching installer, or the releases page if none match. */
export function downloadUrlFor(target: DesktopTarget): string {
  if (target === 'unknown') return `${RELEASES_BASE}/latest`;
  return `${RELEASES_BASE}/download/v1.0.0/${ASSET_NAME[target]}`;
}

/** Human label for each target, used for the button subtitle. */
export const TARGET_LABEL: Record<DesktopTarget, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  unknown: 'All platforms',
};