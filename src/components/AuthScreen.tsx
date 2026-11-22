import { useMemo, useState, type FormEvent } from 'react';
import { passwordScore } from '../lib/crypto';
import { register, signIn, validateName, validatePassword } from '../data/auth';
import { AppError } from '../data/errors';
import { Icon } from './Icons';
import { useI18n } from '../i18n';
import { language } from '../i18n';
import { Modal } from './Modal';
import { tell } from './Toast';

// Keep the expensive strength meter readable and rely on WebCrypto for actual password work.
export function AuthScreen({ onDone, onCancel, initial = 'signin' }: { onDone: () => void; onCancel?: () => void; initial?: 'signin' | 'signup' }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState(initial);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const score = useMemo(() => passwordScore(password), [password]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') await register({ username, name, password, remember });
      else await signIn({ username, password, remember });
      onDone();
    } catch (e) {
      setError(e instanceof AppError ? t(e.key) : t('err.generic'));
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <div className="auth-shell">
      <section className="auth-art">
        <div className="auth-brand"><BrandMark /><span>ORBITMC</span></div>
        <div className="auth-illustration" aria-hidden="true">
          <span className="orbit orbit-a"/><span className="orbit orbit-b"/><span className="orbit orbit-c"/>
          <span className="illustration-spark">✳</span><span className="illustration-star star-a">✳</span><span className="illustration-star star-b">✳</span>
          <div className="orbit-node node-a"><span>m</span></div><div className="orbit-node node-b"><span>l</span></div><div className="orbit-node node-c"><span>n</span></div>
          <div className="orbit-core"><BrandMark large /></div>
          <div className="orbit-label label-a">{t('authCardOne')}</div><div className="orbit-label label-b">{t('authCardTwo')}</div>
        </div>
        <div className="auth-art-copy"><p className="eyebrow">{t('authLabel')}</p><p className="auth-tagline">{t('tagline')}</p><span className="auth-edition">{t('socialClub')}</span></div>
        <span className="art-index">001&nbsp;—&nbsp;2025</span>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-brand"><BrandMark/><span>ORBITMC</span></div>
        <div className="auth-form-wrap">
          <div className="auth-locale">
            {onCancel && <button type="button" className="lang-chip auth-back" onClick={onCancel}>{t('backToApp')}</button>}
            <button type="button" className={`lang-chip ${lang === 'en' ? 'selected' : ''}`} onClick={() => language.set('en')}>EN</button>
            <span>·</span>
            <button type="button" className={`lang-chip ${lang === 'ru' ? 'selected' : ''}`} onClick={() => language.set('ru')}>RU</button>
          </div>
          <div className="auth-eyebrow"><span className="live-dot"/>{mode === 'signin' ? t('authCorner') : t('authMake')}</div>
          <h1>{mode === 'signin' ? t('welcome') : t('createSub')}</h1>
          <p className="auth-intro">{mode === 'signin' ? t('welcomeSub') : t('createSub')}</p>

          <div className="auth-switch" role="tablist" aria-label={t('signIn')}>
            <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); }}>{t('tabSignIn')}</button>
            <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); }}>{t('tabSignUp')}</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === 'signup' && <label className="field-label">{t('displayName')}<input className="field-input" autoComplete="name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === 'ru' ? 'Алекс' : 'Alex'} required /></label>}
            <label className="field-label">{t('username')}<span className="input-prefix-wrap"><span className="input-prefix">@</span><input className="field-input prefix-field" autoComplete="username" maxLength={24} minLength={4} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="yourname" required /></span><span className="field-hint">{lang === 'ru' ? '4–20 латинских букв, цифр или _' : '4–20 letters, numbers or underscores'}</span></label>
            <label className="field-label">{t('password')}<span className="password-field-wrap"><input className="field-input" type={visible ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={lang === 'ru' ? 'Не короче 10 символов' : 'At least 10 characters'} required /><button className="password-eye" type="button" aria-label={visible ? t('hide') : t('show')} onClick={() => setVisible((v) => !v)}><Icon name={visible ? 'eyeOff' : 'eye'} size={17}/></button></span>
              {mode === 'signup' && <span className={`strength-meter strength-${score}`}><span className="strength-track"><i/><i/><i/><i/></span><span>{t(`strength${score}`)}</span></span>}
            </label>
            <div className="auth-options"><label className="check-line"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}/><span className="check-box"><Icon name="check" size={12}/></span><span>{t('remember')}</span></label>{mode === 'signin' && <button className="text-action" type="button" onClick={() => setResetOpen(true)}>{t('resetPassword')}</button>}</div>
            {error && <div className="inline-error" role="alert"><Icon name="info" size={16}/><span>{error}</span></div>}
            <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>{busy ? <span className="spinner"/> : <span>{mode === 'signin' ? t('signIn') : t('signUp')}</span>}<Icon name="arrowUpRight" size={17}/></button>
          </form>
          <p className="auth-terms">{t('terms')}</p>
        </div>
        <footer className="auth-footer"><span>© ORBITMC 2025</span><span className="auth-footer-line"/><span>{t('authFooter')}</span></footer>
      </section>
    </div>
    <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t('resetPassword')} subtitle={t('recoveryHint')} size="sm"><button className="btn btn-primary btn-full" onClick={() => setResetOpen(false)}>{t('backToApp')}</button></Modal>
  </main>;
}

export function BrandMark({ large = false }: { large?: boolean }) {
  return <span className={`brand-mark ${large ? 'brand-mark-large' : ''}`}><span className="brand-dot"/><span className="brand-wave wave-a"/><span className="brand-wave wave-b"/></span>;
}
