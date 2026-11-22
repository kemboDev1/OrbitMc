import { useState } from 'react';
import { language, useI18n } from '../i18n';
import { themeMode } from '../lib/prefs';
import { installApp, installPrompt, installed } from '../lib/pwa';
import { Icon } from './Icons';
import { BrandMark } from './AuthScreen';

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const { t, lang } = useI18n();
  const theme = themeMode.use();
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

  return <main className="landing-page">
    <header className="landing-nav">
      <button className="landing-brand" aria-label={t('brand')} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><BrandMark/><span>SADO</span></button>
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

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <div className="landing-kicker"><span className="landing-live-dot"/>{t('landingOverline')}</div>
        <h1>{t('landingTitle')}</h1>
        <p className="landing-lead">{t('landingIntro')}</p>
        <div className="landing-hero-actions"><button className="landing-primary" onClick={onEnter}>{t('landingStart')}<Icon name="arrowUpRight" size={17}/></button><a className="landing-secondary" href="#features">{t('landingExplore')}<Icon name="down" size={16}/></a></div>
        <div className="landing-proof"><span className="landing-avatar-stack"><i>M</i><i>A</i><i>N</i></span><span>{t('landingProof')}</span></div>
      </div>
      <div className="landing-preview-wrap" aria-label={t('landingPreviewLabel')}>
        <div className="landing-orbit landing-orbit-one"/><div className="landing-orbit landing-orbit-two"/>
        <div className="landing-chat-preview">
          <div className="landing-preview-head"><span className="landing-preview-mark"><BrandMark/></span><div><b>{t('landingPreviewName')}</b><small><i/> {t('landingPreviewOnline')}</small></div><button aria-label={t('more')}><Icon name="more" size={17}/></button></div>
          <div className="landing-preview-context">{t('landingPreviewContext')}</div>
          <div className="landing-message-row"><span className="landing-person person-m">M</span><div><b>{t('landingPreviewName')}</b><p>{t('landingPreviewMessage')}</p><time>10:42</time></div></div>
          <div className="landing-message-row landing-message-own"><span className="landing-person person-y">Y</span><div><b>{t('landingPreviewYou')}</b><p>{t('landingPreviewReply')}</p><time>10:43</time></div></div>
          <div className="landing-preview-composer"><span>{t('landingPreviewCompose')}</span><span><Icon name="smile" size={16}/><Icon name="send" size={16}/></span></div>
          <div className="landing-preview-label"><span>01</span>{t('landingPreviewFoot')}</div>
        </div>
        <div className="landing-float-note"><span className="landing-float-icon"><Icon name="spark" size={15}/></span><span><b>{t('landingFloatTitle')}</b><small>{t('landingFloatSub')}</small></span></div>
      </div>
    </section>

    <section id="features" className="landing-features">
      <div className="landing-section-heading"><span className="landing-section-index">01 / {t('landingSection')}</span><h2>{t('landingFeaturesTitle')}</h2><p>{t('landingFeaturesSub')}</p></div>
      <div className="landing-feature-grid">
        <article className="landing-feature-card"><span className="landing-feature-number">01</span><span className="landing-feature-icon"><Icon name="chat" size={20}/></span><h3>{t('landingChatTitle')}</h3><p>{t('landingChatBody')}</p><span className="landing-feature-line"/></article>
        <article className="landing-feature-card"><span className="landing-feature-number">02</span><span className="landing-feature-icon"><Icon name="grid" size={20}/></span><h3>{t('landingHubsTitle')}</h3><p>{t('landingHubsBody')}</p><span className="landing-feature-line"/></article>
        <article className="landing-feature-card"><span className="landing-feature-number">03</span><span className="landing-feature-icon"><Icon name="market" size={20}/></span><h3>{t('landingBazaarTitle')}</h3><p>{t('landingBazaarBody')}</p><span className="landing-feature-line"/></article>
      </div>
    </section>

    <section id="plans" className="landing-aura-section"><div className="landing-aura-copy"><span className="landing-section-index">02 / AURA</span><h2>{t('landingAuraTitle')}</h2><p>{t('landingAuraBody')}</p><button className="landing-text-link" onClick={onEnter}>{t('landingSeeAura')}<Icon name="arrowUpRight" size={16}/></button></div><div className="landing-aura-tiers"><span className="landing-tier"><i>01</i><b>Ember</b><small>{t('landingTierOne')}</small></span><span className="landing-tier"><i>02</i><b>Flare</b><small>{t('landingTierTwo')}</small></span><span className="landing-tier tier-nova"><i>03</i><b>Nova</b><small>{t('landingTierThree')}</small></span></div></section>

    <section id="install" className="landing-install-section">
      <div className="landing-install-copy"><span className="landing-section-index">03 / {t('landingInstallNav')}</span><h2>{t('landingInstallTitle')}</h2><p>{t('landingInstallBody')}</p><div className="landing-install-actions"><button className="landing-primary" onClick={install} disabled={isInstalled}>{isInstalled ? t('landingInstalled') : t('landingDownload')}<Icon name={isInstalled ? 'check' : 'download'} size={17}/></button><button className="landing-text-link" onClick={onEnter}>{t('landingSignInLink')}<Icon name="arrowUpRight" size={16}/></button></div>{installNote && <p className="landing-install-note" role="status">{t('landingInstallSteps')}</p>}<small className="landing-install-hint">{prompt ? t('landingInstallReady') : t('landingInstallFallback')}</small></div>
      <aside className="landing-safety"><span className="landing-safety-icon"><Icon name="lock" size={19}/></span><div><b>{t('landingSafetyTitle')}</b><p>{t('landingSafetyBody')}</p></div></aside>
    </section>
    <footer className="landing-footer"><span className="landing-brand"><BrandMark/><span>SADO</span></span><span>{t('landingFooter')}</span><button onClick={onEnter}>{t('signIn')}<Icon name="arrowUpRight" size={14}/></button></footer>
  </main>;
}
