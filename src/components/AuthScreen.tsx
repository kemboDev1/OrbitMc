import { useMemo, useState, type FormEvent } from 'react';
import { passwordScore } from '../lib/crypto';
import { register, resetPassword, signIn } from '../data/auth';
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
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const score = useMemo(() => passwordScore(password), [password]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = mode === 'signup'
        ? await register({ email, username, name, password, birthDate: birthDate || undefined })
        : await signIn({ email, password });
      if (result.needsEmailConfirmation) {
        setNotice(t('authEmailConfirmation'));
        return;
      }
      onDone();
    } catch (e) {
      if (mode === 'signup' && e instanceof AppError && e.key === 'err.emailTaken') {
        setMode('signin');
        setNotice(t('authAccountExists'));
      } else {
        setError(e instanceof AppError ? t(e.key) : t('err.generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetBusy(true);
    try {
      await resetPassword(email);
      setResetOpen(false);
      tell(t('authResetSent'), 'good');
    } catch (e) {
      setResetError(e instanceof AppError ? t(e.key) : t('err.generic'));
    } finally {
      setResetBusy(false);
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
            <span>·</span>
            <button type="button" className={`lang-chip ${lang === 'uz' ? 'selected' : ''}`} onClick={() => language.set('uz')}>UZ</button>
          </div>
          <div className="auth-eyebrow"><span className="live-dot"/>{mode === 'signin' ? t('authCorner') : t('authMake')}</div>
          <h1>{mode === 'signin' ? t('welcome') : t('createSub')}</h1>
          <p className="auth-intro">{mode === 'signin' ? t('welcomeSub') : t('createSub')}</p>

          <div className="auth-switch" role="tablist" aria-label={t('signIn')}>
            <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>{t('tabSignIn')}</button>
            <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>{t('tabSignUp')}</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            <label className="field-label">{t('email')}<input className="field-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
            {mode === 'signup' && <label className="field-label">{t('displayName')}<input className="field-input" autoComplete="name" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('displayNamePlaceholder')} required /></label>}
            {mode === 'signup' && <label className="field-label">{t('username')}<span className="input-prefix-wrap"><span className="input-prefix">@</span><input className="field-input prefix-field" autoComplete="username" maxLength={20} minLength={4} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="yourname" required /></span><span className="field-hint">{t('usernameHint')}</span></label>}
            {mode === 'signup' && <label className="field-label">{t('birthDate')}<input className="field-input" type="date" autoComplete="bday" value={birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirthDate(e.target.value)}/><span className="field-hint">{t('birthDatePrivate')}</span></label>}
            <label className="field-label">{t('password')}<span className="password-field-wrap"><input className="field-input" type={visible ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordHint')} required /><button className="password-eye" type="button" aria-label={visible ? t('hide') : t('show')} onClick={() => setVisible((v) => !v)}><Icon name={visible ? 'eyeOff' : 'eye'} size={17}/></button></span>
              {mode === 'signup' && <span className={`strength-meter strength-${score}`}><span className="strength-track"><i/><i/><i/><i/></span><span>{t(`strength${score}`)}</span></span>}
            </label>
            <div className="auth-options">{mode === 'signin' && <button className="text-action" type="button" onClick={() => { setResetError(''); setResetOpen(true); }}>{t('resetPassword')}</button>}</div>
            {notice && <div className="inline-notice" role="status">{notice}</div>}
            {error && <div className="inline-error" role="alert"><Icon name="info" size={16}/><span>{error}</span></div>}
            <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>{busy ? <span className="spinner"/> : <span>{mode === 'signin' ? t('signIn') : t('signUp')}</span>}<Icon name="arrowUpRight" size={17}/></button>
          </form>
          <p className="auth-terms">{t('terms')}</p>
        </div>
        <footer className="auth-footer"><span>© ORBITMC 2025</span><span className="auth-footer-line"/><span>{t('authFooter')}</span></footer>
      </section>
    </div>
    <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t('resetPassword')} subtitle={t('recoveryHint')} size="sm"><form className="stack-form" onSubmit={submitReset}><label className="field-label">{t('email')}<input className="field-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>{resetError && <div className="inline-error" role="alert">{resetError}</div>}<button className="btn btn-primary btn-full" type="submit" disabled={resetBusy}>{resetBusy ? t('loading') : t('sendResetEmail')}</button></form></Modal>
  </main>;
}

export function BrandMark({ large = false }: { large?: boolean }) {
  return <span className={`brand-mark ${large ? 'brand-mark-large' : ''}`}><span className="brand-dot"/><span className="brand-wave wave-a"/><span className="brand-wave wave-b"/></span>;
}
