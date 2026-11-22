import { useI18n, language } from '../i18n';
import { themeMode } from '../lib/prefs';
import { LandingHero } from './LandingHero';
import { LandingFeatures } from './LandingFeatures';
import { LandingAuraSection } from './LandingAuraSection';
import { LandingInstallSection } from './LandingInstallSection';
import { DownloadSection } from './DownloadSection';
import { LandingSafety } from './LandingSafety';
import { Icon } from './Icons';
import { BrandMark } from './AuthScreen';

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const { t, lang } = useI18n();
  const theme = themeMode.use();

  return <main className="landing-page">
    <header className="landing-nav">
      <button className="landing-brand" aria-label={t('brand')} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><BrandMark/><span>ORBITMC</span></button>
      <nav className="landing-nav-links" aria-label={t('landingNav')}>
        <a href="#features">{t('landingFeaturesNav')}</a><a href="#plans">{t('aura')}</a><a href="#install">{t('landingInstallNav')}</a>
      </nav>
      <div className="landing-nav-actions">
        <div className="landing-language" aria-label={t('landingLanguage')}>
          <button className={lang === 'en' ? 'selected' : ''} onClick={() => language.set('en')}>EN</button>
          <button className={lang === 'ru' ? 'selected' : ''} onClick={() => language.set('ru')}>RU</button>
        </div>
        <button className="landing-icon-button" aria-label={t('landingThemeToggle')} title={t('landingThemeToggle')} onClick={() => themeMode.set(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17}/></button>
        <button className="landing-signin" onClick={onEnter}>{t('signIn')}</button>
      </div>
    </header>

    <LandingHero />

    <LandingFeatures />

    <LandingAuraSection />

    <LandingInstallSection />

    <LandingSafety />

    <DownloadSection />

    <footer className="landing-footer">
      <span className="landing-brand"><BrandMark/><span>ORBITMC</span></span>
      <span>{t('landingFooter')}</span>
      <button onClick={onEnter}>{t('signIn')}<Icon name="arrowUpRight" size={14}/></button>
    </footer>
  </main>;
}