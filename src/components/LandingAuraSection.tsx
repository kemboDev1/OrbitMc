import { useI18n } from '../i18n';
import { Icon } from './Icons';

export function LandingAuraSection() {
  const { t } = useI18n();

  return (
    <section id="plans" className="landing-aura-section">
      <div className="landing-aura-copy">
        <span className="landing-section-index">02 / ORBIT+</span>
        <h2>{t('auraTitle')}</h2>
        <p>{t('auraSub')}</p>
        <a className="landing-text-link" href="#plans">{t('landingSeeAura')}<Icon name="arrowUpRight" size={15} /></a>
      </div>
      <div className="landing-aura-tiers">
        <div className="landing-tier"><i>01</i><b>{t('auraEmber')}</b><small>{t('landingTierOne')}</small></div>
        <div className="landing-tier"><i>02</i><b>{t('auraFlare')}</b><small>{t('landingTierTwo')}</small></div>
        <div className="landing-tier tier-nova"><i>03</i><b>{t('auraNova')}</b><small>{t('landingTierThree')}</small></div>
      </div>
    </section>
  );
}
