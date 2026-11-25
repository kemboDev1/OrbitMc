export type DesktopTarget = 'windows' | 'macos' | 'linux' | 'unknown';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  assets?: ReleaseAsset[];
}

export const RELEASES_BASE = 'https://github.com/kemboDev1/OrbitMc/releases';
const RELEASE_API = 'https://api.github.com/repos/kemboDev1/OrbitMc/releases/latest';

function ua(): string {
  if (typeof navigator === 'undefined') return '';
  const uaData = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData;
  return uaData?.platform || navigator.userAgent || '';
}

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

export async function fetchLatestRelease(): Promise<ReleaseAsset[] | null> {
  const response = await fetch(RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`release_lookup_failed:${response.status}`);

  const release = await response.json() as GitHubRelease;
  if (!Array.isArray(release.assets)) throw new Error('release_assets_missing');
  return release.assets.filter((asset) =>
    typeof asset.name === 'string'
    && typeof asset.browser_download_url === 'string'
    && asset.browser_download_url.startsWith('https://github.com/kemboDev1/OrbitMc/releases/download/'),
  );
}

const ASSET_PATTERN: Record<Exclude<DesktopTarget, 'unknown'>, RegExp> = {
  windows: /^OrbitMc-Windows-[\d.]+\.exe$/i,
  macos: /^OrbitMc-[\d.]+(?:-(?:arm64|x64|universal))?\.dmg$/i,
  linux: /^OrbitMc-[\d.]+\.AppImage$/i,
};

export function releaseAssetFor(target: DesktopTarget, assets: ReleaseAsset[]): ReleaseAsset | undefined {
  if (target === 'unknown') return undefined;
  return assets.find((asset) => ASSET_PATTERN[target].test(asset.name));
}

export const TARGET_LABEL: Record<DesktopTarget, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  unknown: 'All platforms',
};
