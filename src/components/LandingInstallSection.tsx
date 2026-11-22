import { useState } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icons';
import { installApp, installPrompt, installed } from '../lib/pwa';

export function LandingInstallSection() {
  const { t } = useI18n();
  const prompt = installPrompt.use();
  const isInstalled = installed.use();
  const [installNote, setInstallNote] = useState(false);

  const install = async () => {
    try {
      const prompted = await installApp();
      if (!prompted) setInstallNote(true);
    } catch {
      setInstallNote(true);
    }
  };

  return (
    <section className="landing-install-section">
      <div className="landing-install-copy">
        <span className="landing-section-index">03 / {t('landingInstallNav')}</span>
        <h2>{t('landingInstallTitle')}</h2>
        <p>{t('landingInstallBody')}</p>
        <div className="landing-install-actions">
          <button className="landing-primary" onClick={install}>
            {isInstalled ? t('landingInstalled') : t('landingDownload')}<Icon name={isInstalled ? 'check' : 'download'} size={17} />
          </button>
          <a href="#features" className="landing-text-link">
            {t('landingExplore')} <Icon name="arrowUpRight" size={16} />
          </a>
        </div>
        {installNote && <p className="landing-install-note" role="status">{t('landingInstallSteps')}</p>}
        <small className="landing-install-hint">{prompt ? t('landingInstallReady') : t('landingInstallFallback')}</small>
      </div>
    </section>
  );
  }