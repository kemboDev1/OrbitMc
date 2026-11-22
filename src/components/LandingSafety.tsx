import { useI18n } from '../i18n';
import { Icon } from './Icons';

export function LandingSafety() {
  const { t } = useI18n();

  return (
    <aside className="landing-safety">
      <span className="landing-safety-icon"><Icon name="lock" size={19} /></span>
      <div>
        <b>{t('landingSafetyTitle')}</b>
        <p>{t('landingSafetyBody')}</p>
      </div>
    </aside>
  );
}