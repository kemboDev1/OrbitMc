import { useState } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icons';

export function LandingSafety() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <aside className="landing-safety">
      <button className="landing-safety-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Icon name="shield" size={14}/>{t('security')}</button>
      {open && <div className="landing-safety-copy" role="region" aria-label={t('landingSafetyTitle')}><b>{t('landingSafetyTitle')}</b><p>{t('landingSafetyBody')}</p></div>}
    </aside>
  );
}
