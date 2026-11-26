import { useEffect, useRef } from 'react';
import { Icon } from './Icons';

export function Modal({ open, onClose, title, subtitle, children, size = 'md' }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const backdropPressRef = useRef(false);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    const active = document.activeElement;
    if (!active || !ref.current?.contains(active)) {
      ref.current?.focus();
    }
    return () => { document.body.style.overflow = old; window.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropPressRef.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (backdropPressRef.current && e.target === e.currentTarget) onCloseRef.current(); backdropPressRef.current = false; }}
    >
      <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-btn modal-close" aria-label={title} onClick={() => onCloseRef.current()}><Icon name="close" size={17} /></button></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
