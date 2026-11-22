import { useI18n } from '../i18n';
import { Icon } from './Icons';

export function LandingFeatures() {
  const { t } = useI18n();
  const features = [
    { icon: 'chat' as const, title: t('landingChatTitle'), body: t('landingChatBody') },
    { icon: 'grid' as const, title: t('landingHubsTitle'), body: t('landingHubsBody') },
    { icon: 'market' as const, title: t('landingBazaarTitle'), body: t('landingBazaarBody') },
  ];

  return (
    <section id="features" className="landing-features">
      <div className="landing-section-heading">
        <span className="landing-section-index">01 / {t('landingSection')}</span>
        <h2>{t('landingFeaturesTitle')}</h2>
        <p>{t('landingFeaturesSub')}</p>
      </div>
      <div className="landing-feature-grid">
        {features.map((feature) => (
          <article className="landing-feature-card" key={feature.title}>
            <span className="landing-feature-icon"><Icon name={feature.icon} size={18} /></span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
            <span className="landing-feature-line" />
          </article>
        ))}
      </div>
    </section>
  );
}
