import { createStore } from '../lib/store';
import { Icon } from './Icons';
import { useI18n } from '../i18n';

interface Notice { id: string; text: string; tone?: 'good' | 'bad' | 'info' }
export const notice = createStore<Notice | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

export function tell(text: string, tone: Notice['tone'] = 'info') {
  if (timer) clearTimeout(timer);
  const id = Math.random().toString(36).slice(2);
  notice.set({ id, text, tone });
  timer = setTimeout(() => {
    if (notice.get()?.id === id) notice.set(null);
  }, 3200);
}

export function ToastHost() {
  const item = notice.use();
  const { t } = useI18n();
  if (!item) return null;
  return <div className={`toast toast-${item.tone ?? 'info'}`} role={item.tone === 'bad' ? 'alert' : 'status'}><Icon name={item.tone === 'bad' ? 'closeCircle' : item.tone === 'good' ? 'check' : 'info'} size={17}/><span>{item.text}</span><button aria-label={t('dismiss')} onClick={() => notice.set(null)}><Icon name="close" size={14}/></button></div>;
}
