import { useI18n } from '../i18n';
import { detectDesktopTarget, downloadUrlFor, TARGET_LABEL, isMobile } from '../lib/downloads';
import { Icon } from './Icons';

export function DownloadSection() {
  const { t } = useI18n();
  const target = detectDesktopTarget();
  const url = downloadUrlFor(target);
  const mobile = isMobile();

  const isDirectDownload = target !== 'unknown' && !mobile;

  const handleDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDirectDownload) {
      // Let the link navigate to releases page
      return;
    }
    // Track download intent if analytics are added later
    console.log('[OrbitMc] Desktop download initiated for', target);
  };

  return (
    <section id="download" className="landing-install-section download-section" aria-labelledby="download-title">
      <div className="landing-install-copy download-copy">
        <span className="landing-section-index">03 / {t('download')}</span>
        <h2 id="download-title">{t('downloadTitle')}</h2>
        <p>{t('downloadBody')}</p>
        <div className="download-actions">
          {isDirectDownload ? (
            <a
              href={url}
              className="landing-primary download-main"
              download
              onClick={handleDownload}
            >
              <Icon name="download" size={17} />
              <span>
                {t('downloadButton')} <strong>{TARGET_LABEL[target]}</strong>
              </span>
            </a>
          ) : (
            <a href={url} className="landing-primary download-main" target="_blank" rel="noopener">
              <Icon name="github" size={17} />
              <span>{t('viewReleases')}</span>
            </a>
          )}
          <button className="landing-text-link" onClick={() => window.location.href = '#features'}>
            {t('exploreFeatures')} <Icon name="arrowUpRight" size={16} />
          </button>
        </div>
        <p className="download-note" role="note">
          {mobile ? t('downloadMobileNote') : target === 'unknown' ? t('downloadUnknownNote') : t('downloadReadyNote')}
        </p>
      </div>

      <aside className="landing-safety download-safety">
        <span className="landing-safety-icon"><Icon name="shield" size={19} /></span>
        <div>
          <b>{t('downloadSafetyTitle')}</b>
          <p>{t('downloadSafetyBody')}</p>
        </div>
      </aside>

      {target !== 'unknown' && !mobile && (
        <details className="download-alternatives">
          <summary><Icon name="chevron" size={14} /> {t('otherPlatforms')}</summary>
          <ul className="download-alternatives-list">
            {(['windows', 'macos', 'linux'] as const).map((p) => {
              if (p === target) return null;
              return (
                <li key={p}>
                  <a
                    href={downloadUrlFor(p)}
                    download
                    className="download-alt-link"
                  >
                    <span className="download-alt-icon">
                      {p === 'windows' && <Icon name="monitor" size={14} />}
                      {p === 'macos' && <Icon name="apple" size={14} />}
                      {p === 'linux' && <Icon name="terminal" size={14} />}
                    </span>
                    <span>{TARGET_LABEL[p]}</span>
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