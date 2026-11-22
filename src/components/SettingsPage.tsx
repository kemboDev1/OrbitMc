import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { User } from '../data/types';
import { updateAccent, updateProfile } from '../data/profile';
import { session } from '../data/session';
import { signOut } from '../data/auth';
import { db } from '../data/db';
import { prefs, themeMode } from '../lib/prefs';
import { fileToDataUrl } from '../lib/image';
import { useI18n, language } from '../i18n';
import { installApp, installPrompt, isStandalone } from '../lib/pwa';
import { askNotify } from '../lib/notify';
import { ACCENTS, LIMITS } from '../config';
import { fmtDate } from '../lib/util';
import { Avatar } from './Avatar';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';
import { AppError } from '../data/errors';

export function SettingsPage({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const { t, lang } = useI18n();
  const pr = prefs.use();
  const currentTheme = themeMode.use();
  const avatarRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState(user.avatar ?? '');
  const [saveBusy, setSaveBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [device, setDevice] = useState<'ios' | 'android' | 'computer'>('computer');
  const promptAvailable = installPrompt.use();
  const [notificationBlocked, setNotificationBlocked] = useState(typeof Notification !== 'undefined' && Notification.permission === 'denied');
  const [accent, setAccent] = useState(user.accent ?? '');

  const used = useMemo(() => db.bytes(), [user, db.use]);
  const save = (e: FormEvent) => {
    e.preventDefault(); setSaveBusy(true);
    try { updateProfile(user.id, { name, bio, avatar: avatar || null }); tell(t('profileSaved'), 'good'); }
    catch (e) { tell(e instanceof AppError ? t(e.key) : t('err.saveFailed'), 'bad'); }
    finally { setSaveBusy(false); }
  };
  const chooseAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { setAvatar(await fileToDataUrl(file, 560, LIMITS.imageChars)); }
    catch (e) { tell(e instanceof AppError ? t(e.key) : t('uploadAvatarError'), 'bad'); }
  };
  const exportBackup = () => {
    try {
      const blob = new Blob([db.exportJSON(user)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `sado-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 800);
      tell(t('exportDone'), 'good');
    } catch { tell(t('err.generic'), 'bad'); }
  };
  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 6 * 1024 * 1024) throw new Error('size');
      db.importJSON(await file.text());
      // Imported auth is intentionally discarded. Sign out to avoid a session referencing an old profile.
      session.end();
      tell(t('importDone'), 'good');
      onSignedOut();
    } catch { tell(t('backupError'), 'bad'); }
  };
  const wipe = () => {
    signOut(); db.wipe(); setResetOpen(false); tell(t('wipeDone'), 'good'); onSignedOut();
  };
  const setA = (value: string) => {
    setAccent(value);
    try { updateAccent(user.id, value || null); }
    catch { tell(t('err.saveFailed'), 'bad'); }
  };
  const toggleNotifications = async () => {
    const ok = await askNotify();
    setNotificationBlocked(typeof Notification !== 'undefined' && Notification.permission === 'denied');
    prefs.set({ desktop: ok });
    if (!ok) tell(t('desktopBlocked'), 'info'); else tell(t('desktopToggle'), 'good');
  };
  const openInstall = async () => {
    if (await installApp()) return;
    const ua = navigator.userAgent;
    setDevice(/iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'computer');
    setInstallOpen(true);
  };
  const storageText = used >= 1_000_000 ? `${(used / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(used / 1000))} KB`;
  const deviceSteps = device === 'ios' ? t('installIos') : device === 'android' ? t('installAndroid') : t('installDesktop');

  return <div className="page-content settings-page">
    <div className="page-heading"><div><div className="eyebrow">{t('settingsEyebrow')}</div><h1>{t('settings')}</h1><p>{t('appearanceHint')}</p></div><div className="settings-profile-top"><Avatar user={user} size="md"/><div><b>{user.name}</b><small>@{user.username}</small></div></div></div>
    <div className="settings-layout">
      <nav className="settings-nav"><a href="#profile"><span>01</span>{t('profile')}</a><a href="#appearance"><span>02</span>{t('appearance')}</a><a href="#preferences"><span>03</span>{t('preferences')}</a><a href="#privacy"><span>04</span>{t('privacy')}</a><a href="#data"><span>05</span>{t('dataTools')}</a><a href="#install"><span>06</span>{t('install')}</a></nav>
      <div className="settings-sections">
        <section className="settings-section" id="profile"><div className="settings-section-head"><span className="section-index">01</span><div><h2>{t('profile')}</h2><p>{t('editProfile')}</p></div></div>
          <form className="profile-settings-form" onSubmit={save}>
            <div className="avatar-editor"><Avatar user={{ ...user, name, avatar: avatar || undefined }} size="xl"/><div><strong>{t('avatar')}</strong><p>{t('avatarHelp')}</p><div className="avatar-actions"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden ref={avatarRef} onChange={chooseAvatar}/><button type="button" className="btn btn-outline btn-small" onClick={() => avatarRef.current?.click()}><Icon name="upload" size={14}/>{t('changeAvatar')}</button>{avatar && <button type="button" className="btn btn-ghost btn-small" onClick={() => setAvatar('')}>{t('removeAvatar')}</button>}</div></div></div>
            <div className="profile-fields"><label className="field-label">{t('profileName')}<input className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name}/></label><div className="field-label">{t('username')}<span className="field-input field-readonly">@{user.username}<Icon name="lock" size={14}/></span></div><label className="field-label">{t('profileBio')}<textarea className="field-input field-textarea" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={LIMITS.bio} placeholder={t('bioPlaceholder')}/><small className="field-counter">{bio.length}/{LIMITS.bio}</small></label></div>
            <div className="profile-form-actions"><span>{t('memberSince', { date: fmtDate(user.createdAt, lang) })}</span><button className="btn btn-primary btn-small" disabled={saveBusy}>{saveBusy ? t('loading') : t('saveProfile')}</button></div>
          </form>
        </section>

        <section className="settings-section" id="appearance"><div className="settings-section-head"><span className="section-index">02</span><div><h2>{t('appearance')}</h2><p>{t('appearanceHint')}</p></div></div>
          <div className="setting-row"><div><b>{t('theme')}</b><p>{t('themeSystem')}</p></div><div className="theme-choice">{(['system', 'dark', 'light'] as const).map((theme) => <button key={theme} className={`theme-option ${currentTheme === theme ? 'selected' : ''}`} onClick={() => themeMode.set(theme)}><span className={`theme-swatch swatch-${theme}`}><i/><i/></span><small>{t(theme === 'system' ? 'system' : theme === 'dark' ? 'dark' : 'light')}</small></button>)}</div></div>
          <div className="setting-row"><div><b>{t('accent')}</b><p>{t('accentDefault')}</p></div><div className="color-swatches"><button className={`color-dot sado-dot ${!accent ? 'selected' : ''}`} title={t('accentDefault')} onClick={() => setA('')}/>{ACCENTS.slice(1).map((c) => <button key={c} className={`color-dot ${accent === c ? 'selected' : ''}`} title={c} style={{ '--swatch': c } as React.CSSProperties} onClick={() => setA(c)}/>)}</div></div>
          <div className="setting-row"><div><b>{t('language')}</b><p>{t('english')} · {t('russian')}</p></div><div className="segmented-choice lang-setting"><button className={lang === 'en' ? 'selected' : ''} onClick={() => language.set('en')}>EN</button><button className={lang === 'ru' ? 'selected' : ''} onClick={() => language.set('ru')}>RU</button></div></div>
          <div className="setting-row"><div><b>{t('layout')}</b><p>{t('messageHint')}</p></div><select className="sort-select" value={pr.layout} onChange={(e) => prefs.set({ layout: e.target.value as typeof pr.layout })}><option value="auto">{t('autoLayout')}</option><option value="bubbles">{t('bubbles')}</option><option value="stream">{t('stream')}</option></select></div>
          <div className="setting-row"><div><b>{t('preferences')}</b><p>{t('cozy')} · {t('compact')}</p></div><div className="segmented-choice"><button className={pr.density === 'cozy' ? 'selected' : ''} onClick={() => prefs.set({ density: 'cozy' })}>{t('cozy')}</button><button className={pr.density === 'compact' ? 'selected' : ''} onClick={() => prefs.set({ density: 'compact' })}>{t('compact')}</button></div></div>
        </section>

        <section className="settings-section" id="preferences"><div className="settings-section-head"><span className="section-index">03</span><div><h2>{t('preferences')}</h2><p>{t('notificationsHint')}</p></div></div>
          <ToggleRow title={t('soundToggle')} subtitle={t('messageHint')} value={pr.sound} onChange={(v) => prefs.set({ sound: v })}/>
          <div className="toggle-row"><div><b>{t('desktopToggle')}</b><p>{notificationBlocked ? t('desktopBlocked') : t('notificationsHint')}</p></div><div className="toggle-actions">{!pr.desktop && <button className="btn btn-outline btn-small" onClick={toggleNotifications}>{t('desktopEnable')}</button>}<Switch value={pr.desktop} onChange={toggleNotifications} label={t('desktopToggle')}/></div></div>
          <ToggleRow title={t('calmToggle')} subtitle={t('appearanceHint')} value={pr.calm} onChange={(v) => prefs.set({ calm: v })}/>
          <ToggleRow title={t('memberToggle')} subtitle={t('members')} value={pr.members} onChange={(v) => prefs.set({ members: v })}/>
        </section>

        <section className="settings-section privacy-section" id="privacy"><div className="settings-section-head"><span className="section-index">04</span><div><h2>{t('privacy')}</h2><p>{t('privacyHeading')}</p></div></div><div className="privacy-notice"><span className="privacy-icon"><Icon name="shield" size={18}/></span><div><b>{t('privacyHeading')}</b><p>{t('privacyDemo')}</p><p>{t('privacyAuth')}</p></div></div><div className="privacy-warning"><Icon name="info" size={16}/><p>{t('privacyWarning')}</p></div><div className="future-note"><span className="eyebrow">{t('launchLabel')}</span><p>{t('privacyLive')}</p></div></section>

        <section className="settings-section" id="data"><div className="settings-section-head"><span className="section-index">05</span><div><h2>{t('dataTools')}</h2><p>{t('storage')}: {storageText}</p></div></div><div className="data-actions"><div className="data-action-row"><span className="data-action-icon"><Icon name="download" size={17}/></span><div><b>{t('exportData')}</b><p>{t('privacyDemo')}</p></div><button className="btn btn-outline btn-small" onClick={exportBackup}>{t('exportData')}</button></div><div className="data-action-row"><span className="data-action-icon"><Icon name="upload" size={17}/></span><div><b>{t('importData')}</b><p>{t('backupError')}</p></div><input hidden ref={importRef} type="file" accept=".json,application/json" onChange={importBackup}/><button className="btn btn-outline btn-small" onClick={() => importRef.current?.click()}>{t('importData')}</button></div><div className="data-action-row reset-row"><span className="data-action-icon"><Icon name="trash" size={17}/></span><div><b>{t('wipeData')}</b><p>{t('resetSub')}</p></div><button className="btn btn-danger-outline btn-small" onClick={() => setResetOpen(true)}>{t('wipeData')}</button></div></div></section>

        <section className="settings-section install-section" id="install"><div className="settings-section-head"><span className="section-index">06</span><div><h2>{t('install')}</h2><p>{t('installSub')}</p></div></div><div className="install-card"><div className="install-logo"><span>S</span></div><div className="install-copy"><b>{isStandalone() ? t('installReady') : t('brand')}</b><p>{t('downloadApp')}</p><small>{t('installSub')}</small></div><button className="btn btn-primary btn-small" onClick={openInstall} disabled={isStandalone()}>{isStandalone() ? t('installReady') : t(promptAvailable ? 'installAction' : 'install')}</button></div></section>

        <div className="signout-line"><span>@{user.username}</span><button className="btn btn-ghost" onClick={() => { signOut(); onSignedOut(); }}><Icon name="back" size={15}/>{t('signOut')}</button></div>
      </div>
    </div>
    <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t('resetConfirm')} subtitle={t('resetSub')} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setResetOpen(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={wipe}>{t('wipeData')}</button></div></Modal>
    <Modal open={installOpen} onClose={() => setInstallOpen(false)} title={t('install')} subtitle={t('chooseDevice')} size="sm"><div className="install-choices">{(['ios','android','computer'] as const).map((d) => <button key={d} className={device === d ? 'selected' : ''} onClick={() => setDevice(d)}><Icon name={d === 'computer' ? 'monitor' : 'download'} size={18}/>{t(d === 'ios' ? 'desktopIOS' : d === 'android' ? 'desktopAndroid' : 'desktopComputer')}</button>)}</div><div className="install-instructions"><Icon name="info" size={16}/><p>{deviceSteps}</p></div><p className="install-footnote">{t('downloadApp')}</p><button className="btn btn-secondary btn-full" onClick={() => setInstallOpen(false)}>{t('backToApp')}</button></Modal>
  </div>;
}

function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-row"><div><b>{title}</b><p>{subtitle}</p></div><Switch value={value} onChange={() => onChange(!value)} label={title}/></div>;
}

function Switch({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  return <button role="switch" aria-checked={value} aria-label={label} className={`switch ${value ? 'on' : ''}`} onClick={onChange}><span/></button>;
}
