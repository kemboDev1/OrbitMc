import { useMemo, useState, type FormEvent } from 'react';
import { passwordScore } from '../lib/crypto';
import { enterDemoWorkspace, register, resetPassword, signIn } from '../data/auth';
import { AppError } from '../data/errors';
import { Icon } from './Icons';
import { BrandMark } from './BrandMark';
import { useI18n, language } from '../i18n';
import { Modal } from './Modal';
import { tell } from './Toast';

export { BrandMark };

export function AuthScreen({ onDone, onCancel, initial = 'signin' }: { onDone: () => void; onCancel?: () => void; initial?: 'signin' | 'signup' }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState(initial);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const score = useMemo(() => passwordScore(password), [password]);
  const usernameOk = /^[a-z0-9][a-z0-9_]{2,18}[a-z0-9]$/.test(username);
  const passwordLenOk = password.length >= 10 && password.length <= 128;
  const passwordMixOk = /[a-z]/i.test(password) && /\d/.test(password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = mode === 'signup'
        ? await register({ email, username, name, password })
        : await signIn({ email, password });
      if (result.needsEmailConfirmation) {
        setNotice(t('authEmailConfirmation'));
        return;
      }
      onDone();
    } catch (err) {
      if (mode === 'signup' && err instanceof AppError && err.key === 'err.emailTaken') {
        setMode('signin');
        setNotice(t('authAccountExists'));
      } else {
        setError(err instanceof AppError ? t(err.key) : t('err.generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  const launchDemo = () => {
    enterDemoWorkspace();
    onDone();
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetBusy(true);
    try {
      await resetPassword(email);
      setResetOpen(false);
      tell(t('authResetSent'), 'good');
    } catch (err) {
      setResetError(err instanceof AppError ? t(err.key) : t('err.generic'));
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-art">
          <div className="auth-brand"><BrandMark /><span>ORBITMC</span></div>
          <div className="auth-showcase">
            <div className="auth-illustration" aria-hidden="true">
              <span className="orbit orbit-a" /><span className="orbit orbit-b" /><span className="orbit orbit-c" />
              <div className="orbit-core"><BrandMark large /></div>
              <div className="orbit-pill pill-a"><Icon name="chat" size={14} /><span>Direct Chats</span></div>
              <div className="orbit-pill pill-b"><Icon name="grid" size={14} /><span>Work Hubs</span></div>
              <div className="orbit-pill pill-c"><Icon name="market" size={14} /><span>Asset Shop</span></div>
            </div>
          </div>
          <div className="auth-art-copy">
            <p className="eyebrow">{t('authLabel')}</p>
            <p className="auth-tagline">{t('tagline')}</p>
            <div className="auth-highlights">
              <span><Icon name="check" size={13} /> {t('landingChatTitle')}</span>
              <span><Icon name="check" size={13} /> {t('landingHubsTitle')}</span>
              <span><Icon name="check" size={13} /> {t('landingBazaarTitle')}</span>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-top-bar">
            <div className="auth-mobile-brand"><BrandMark /><span>ORBITMC</span></div>
            <div className="auth-locale">
              {onCancel && <button type="button" className="lang-chip auth-back" onClick={onCancel}><Icon name="back" size={13} /> {t('backToApp')}</button>}
              <button type="button" className={`lang-chip ${lang === 'en' ? 'selected' : ''}`} onClick={() => language.set('en')}>EN</button>
              <button type="button" className={`lang-chip ${lang === 'ru' ? 'selected' : ''}`} onClick={() => language.set('ru')}>RU</button>
              <button type="button" className={`lang-chip ${lang === 'uz' ? 'selected' : ''}`} onClick={() => language.set('uz')}>UZ</button>
            </div>
          </div>

          <div className="auth-form-wrap">
            <div className="auth-eyebrow"><span className="live-dot" />{mode === 'signin' ? t('authCorner') : t('authMake')}</div>
            <h1>{mode === 'signin' ? t('welcome') : t('signUp')}</h1>
            <p className="auth-intro">{mode === 'signin' ? t('signInSubtitle') : t('signUpSubtitle')}</p>

            <div className="auth-switch" role="tablist" aria-label={t('signIn')}>
              <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>{t('tabSignIn')}</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>{t('tabSignUp')}</button>
            </div>

            <form onSubmit={submit} className="auth-form">
              <label className="field-label">
                {t('email')}
                <input className="field-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </label>

              {mode === 'signup' && (
                <div className="auth-two-col">
                  <label className="field-label">
                    {t('displayName')}
                    <input className="field-input" autoComplete="name" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('displayNamePlaceholder')} required />
                  </label>
                  <label className="field-label">
                    {t('username')}
                    <span className="input-prefix-wrap">
                      <span className="input-prefix">@</span>
                      <input className="field-input prefix-field" autoComplete="username" maxLength={20} minLength={4} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="yourname" required />
                    </span>
                  </label>
                </div>
              )}

              <label className="field-label">
                {t('password')}
                <span className="password-field-wrap">
                  <input className="field-input" type={visible ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordHint')} required />
                  <button className="password-eye" type="button" aria-label={visible ? t('hide') : t('show')} onClick={() => setVisible((v) => !v)}><Icon name={visible ? 'eyeOff' : 'eye'} size={17} /></button>
                </span>
                {mode === 'signup' && (
                  <>
                    <span className={`strength-meter strength-${score}`}><span className="strength-track"><i /><i /><i /><i /></span><span>{t(`strength${score}`)}</span></span>
                    <div className="auth-checklist">
                      <span className={usernameOk ? 'ok' : ''}><Icon name={usernameOk ? 'check' : 'info'} size={12} /> {t('authReqUsername')}</span>
                      <span className={passwordLenOk ? 'ok' : ''}><Icon name={passwordLenOk ? 'check' : 'info'} size={12} /> {t('authReqLength')}</span>
                      <span className={passwordMixOk ? 'ok' : ''}><Icon name={passwordMixOk ? 'check' : 'info'} size={12} /> {t('authReqMix')}</span>
                    </div>
                  </>
                )}
              </label>

              <div className="auth-options">
                {mode === 'signin' && (
                  <button className="text-action" type="button" onClick={() => { setResetError(''); setResetOpen(true); }}>{t('resetPassword')}</button>
                )}
              </div>

              {notice && <div className="inline-notice" role="status">{notice}</div>}
              {error && <div className="inline-error" role="alert"><Icon name="info" size={16} /><span>{error}</span></div>}

              <button className={`btn btn-primary auth-submit ${busy ? 'is-loading' : ''}`} type="submit" disabled={busy}>
                {busy ? (
                  <span className="auth-loading-row">
                    <span className="auth-spinner-ring" aria-hidden="true" />
                    <span>{t('loading')}</span>
                  </span>
                ) : (
                  <>
                    <span>{mode === 'signin' ? t('signIn') : t('signUp')}</span>
                    <Icon name="arrowUpRight" size={17} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-divider"><span>OR</span></div>

            <button type="button" className="btn btn-outline btn-full auth-demo-btn" onClick={launchDemo}>
              <Icon name="spark" size={16} />
              <span>{t('tryDemo')}</span>
            </button>
            <p className="auth-demo-caption">{t('demoModeBadge')}</p>

            <p className="auth-terms">{t('terms')}</p>
          </div>
          <footer className="auth-footer"><span>© ORBITMC 2026</span><span className="auth-footer-line" /><span>{t('authFooter')}</span></footer>
        </section>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t('resetPassword')} subtitle={t('recoveryHint')} size="sm">
        <form className="stack-form" onSubmit={submitReset}>
          <label className="field-label">{t('email')}<input className="field-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {resetError && <div className="inline-error" role="alert">{resetError}</div>}
          <button className="btn btn-primary btn-full" type="submit" disabled={resetBusy}>{resetBusy ? t('loading') : t('sendResetEmail')}</button>
        </form>
      </Modal>
    </main>
  );
}
