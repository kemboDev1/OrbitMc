import { useI18n } from '../i18n';
import { BrandMark } from './AuthScreen';
import { Icon } from './Icons';

export function LandingHero() {
  const { t } = useI18n();

  return (
    <section className="landing-hero">
      <div className="landing-hero-copy">
        <span className="landing-kicker"><span className="landing-live-dot" />{t('landingOverline')}</span>
        <h1>{t('landingTitle')}</h1>
        <p className="landing-lead">{t('landingIntro')}</p>
        <div className="landing-hero-actions">
          <a className="landing-primary" href="#features">{t('landingExplore')}<Icon name="arrowUpRight" size={16} /></a>
          <a className="landing-secondary" href="#install">{t('landingInstallNav')}</a>
        </div>
        <div className="landing-proof">
          <span className="landing-proof-icon" aria-hidden="true"><Icon name="chat" size={15}/></span>
          <span>{t('landingProof')}</span>
        </div>
      </div>
      <div className="landing-preview-wrap">
        <span className="landing-orbit landing-orbit-one" />
        <span className="landing-orbit landing-orbit-two" />
        <div className="landing-chat-preview">
          <div className="landing-preview-head">
            <span className="landing-preview-mark"><BrandMark /></span>
            <div><b>{t('landingPreviewName')}</b><small><i />{t('landingPreviewOnline')}</small></div>
            <span className="landing-preview-status"><Icon name="lock" size={13}/></span>
          </div>
          <p className="landing-preview-context">{t('landingPreviewContext')}</p>
          <div className="landing-message-row">
            <span className="landing-person"><Icon name="chat" size={15}/></span>
            <div><b>{t('landingPreviewName')}</b><p>{t('landingPreviewMessage')}</p><time>18:42</time></div>
          </div>
          <div className="landing-message-row landing-message-own">
            <span className="landing-person person-y"><Icon name="spark" size={14}/></span>
            <div><b>{t('landingPreviewYou')}</b><p>{t('landingPreviewReply')}</p><time>18:43</time></div>
          </div>
          <div className="landing-preview-composer"><span>{t('landingPreviewCompose')}</span><span><Icon name="plus" size={14} /><Icon name="send" size={14} /></span></div>
          <div className="landing-preview-label"><span>01</span>{t('landingPreviewFoot')}</div>
        </div>
        <div className="landing-float-note">
          <span className="landing-float-icon"><Icon name="grid" size={16} /></span>
          <span><b>{t('landingFloatTitle')}</b><small>{t('landingFloatSub')}</small></span>
        </div>
      </div>
    </section>
  );
}
