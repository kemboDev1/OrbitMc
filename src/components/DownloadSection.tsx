import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { detectDesktopTarget, fetchLatestRelease, releaseAssetFor, RELEASES_BASE, TARGET_LABEL, type DesktopTarget, type ReleaseAsset, isMobile } from '../lib/downloads';
import { Icon } from './Icons';

type ReleaseStatus = 'loading' | 'ready' | 'missing' | 'error';
const platforms: Exclude<DesktopTarget, 'unknown'>[] = ['windows', 'macos', 'linux'];

export function DownloadSection() {
  const { t } = useI18n();
  const target = detectDesktopTarget();
  const mobile = isMobile();
  const [assets, setAssets] = useState<ReleaseAsset[]>([]);
  const [status, setStatus] = useState<ReleaseStatus>('loading');

  useEffect(() => {
    let active = true;
    void fetchLatestRelease().then((release) => {
      if (!active) return;
      setAssets(release ?? []);
      setStatus(release ? 'ready' : 'missing');
    }).catch(() => {
      if (active) setStatus('error');
    });
    return () => { active = false; };
  }, []);

  const currentAsset = releaseAssetFor(target, assets);
  const note = mobile
    ? t('downloadMobileNote')
    : target === 'unknown'
      ? t('downloadUnknownNote')
      : status === 'loading'
        ? t('releaseChecking')
        : status === 'error'
          ? t('releaseLookupFailed')
          : status === 'missing'
            ? t('releaseUnavailable')
            : currentAsset
              ? t('downloadReadyNote')
              : t('downloadNoPlatformAsset');
  const availablePlatforms = platforms.filter((platform) => releaseAssetFor(platform, assets));

  return (
    <section id="download" className="landing-install-section download-section" aria-labelledby="download-title">
      <div className="landing-install-copy download-copy">
        <h2 id="download-title">{t('downloadTitle')}</h2>
        <p>{t('downloadBody')}</p>
        <div className="download-actions">
          {currentAsset ? (
            <a href={currentAsset.browser_download_url} className="landing-primary download-main">
              <Icon name="download" size={17} />
              <span>{t('downloadButton')} <strong>{TARGET_LABEL[target]}</strong></span>
            </a>
          ) : (
            <a href="#install" className="landing-primary download-main">
              <Icon name="download" size={17} />
              <span>{t('landingDownload')}</span>
            </a>
          )}
          <a className="landing-text-link" href={RELEASES_BASE} target="_blank" rel="noopener noreferrer">
            {t('viewReleases')} <Icon name="arrowUpRight" size={16} />
          </a>
        </div>
        <p className="download-note" role="status">{note}</p>
      </div>

      <aside className="landing-safety download-safety">
        <span className="landing-safety-icon"><Icon name="shield" size={19} /></span>
        <div>
          <b>{t('downloadSafetyTitle')}</b>
          <p>{t('downloadSafetyBody')}</p>
        </div>
      </aside>

      {status === 'ready' && availablePlatforms.length > 0 && (
        <details className="download-alternatives">
          <summary><Icon name="chevron" size={14} /> {t('otherPlatforms')}</summary>
          <ul className="download-alternatives-list">
            {availablePlatforms.filter((platform) => mobile || platform !== target).map((platform) => {
              const asset = releaseAssetFor(platform, assets);
              if (!asset) return null;
              return (
                <li key={platform}>
                  <a href={asset.browser_download_url} className="download-alt-link">
                    <span className="download-alt-icon">
                      {platform === 'windows' && <Icon name="monitor" size={14} />}
                      {platform === 'macos' && <Icon name="apple" size={14} />}
                      {platform === 'linux' && <Icon name="terminal" size={14} />}
                    </span>
                    <span>{TARGET_LABEL[platform]}</span>
                    <Icon name="download" size={13} />
                  </a>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
