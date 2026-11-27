import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Cake, Crown, EyeOff, Sparkles, Tag, Type, Wand2 } from 'lucide-react';
import type { User } from '../data/types';
import { updateAccent, updateProFlex, updateProfile } from '../data/profile';
import { session } from '../data/session';
import { signOut } from '../data/auth';
import { isAdminUser, toggleSelfAdminPreview } from '../data/admin';
import { computeOrbitXP, hasAura } from '../data/market';
import { fetchPublicProfileDetails } from '../data/cloud';
import { db } from '../data/db';
import { prefs, themeMode } from '../lib/prefs';
import { fileToDataUrl } from '../lib/image';
import { useI18n, language } from '../i18n';
import { installApp, installPrompt, isStandalone } from '../lib/pwa';
import { isDesktop } from '../lib/electron';
import { askNotify } from '../lib/notify';
import { ACCENTS, BANNER_GRADIENTS, CHAT_FONTS, LIMITS, MESSAGE_EFFECTS } from '../config';
import { buildBannerFlowCss, buildGradientCss, frameMotionClass, frameSpeedDuration } from '../lib/gradient';
import { fmtDate } from '../lib/util';
import { Avatar } from './Avatar';
import { BrandMark } from './BrandMark';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';
import { VerifiedBadge } from './VectorAssets';
import { AppError } from '../data/errors';

export function bannerStyleFor(user: User, overrideBanner?: string): React.CSSProperties {
  const b = overrideBanner !== undefined ? overrideBanner : user.banner;
  if (b && b.startsWith('frame:')) {
    const frame = db.get().listings[b.slice(6)]?.frame;
    if (frame) {
      const animated = (frame.motion ?? (frame.spin ? 'spin' : 'none')) !== 'none';
      return {
        backgroundImage: buildBannerFlowCss(frame),
        backgroundSize: animated ? '200% 100%' : undefined,
        '--frame-speed': frameSpeedDuration(frame.speed),
      } as React.CSSProperties;
    }
  }
  if (b && b.startsWith('grad:')) {
    const found = BANNER_GRADIENTS.find((g) => g.id === b);
    if (found) return { background: found.css };
  }
  if (b && b.startsWith('data:image/')) {
    return { backgroundImage: `url(${b})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  if (user.frame) {
    const frame = db.get().listings[user.frame]?.frame;
    if (frame) {
      const animated = (frame.motion ?? (frame.spin ? 'spin' : 'none')) !== 'none';
      return {
        backgroundImage: buildBannerFlowCss(frame),
        backgroundSize: animated ? '200% 100%' : undefined,
        '--frame-speed': frameSpeedDuration(frame.speed),
      } as React.CSSProperties;
    }
  }
  return { '--cover-hue': user.hue } as React.CSSProperties;
}

export function bannerMotionClassFor(user: User, overrideBanner?: string): string {
  const b = overrideBanner !== undefined ? overrideBanner : user.banner;
  const frameId = b?.startsWith('frame:') ? b.slice(6) : user.frame;
  const frame = frameId ? db.get().listings[frameId]?.frame : undefined;
  const motion = frameMotionClass(frame);
  return motion ? `banner-animated ${motion}` : '';
}

export function SettingsPage({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const { t, lang } = useI18n();
  const data = db.use();
  const pr = prefs.use();
  const currentTheme = themeMode.use();
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState(user.avatar ?? '');
  const [banner, setBanner] = useState(user.banner ?? 'grad:cosmic');
  const [profileStroke, setProfileStroke] = useState(user.profileStroke ?? '');
  const [profileTags, setProfileTags] = useState<string[]>(user.profileTags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [profileTemplate, setProfileTemplate] = useState<'clean' | 'halo' | 'frame'>(user.profileTemplate ?? 'halo');
  const [chatFont, setChatFont] = useState<'sans' | 'display' | 'mono' | 'serif'>(user.chatFont ?? 'sans');
  const [messageEffect, setMessageEffect] = useState<'none' | 'glow' | 'aurora' | 'ember'>(user.messageEffect ?? 'none');
  const [birthday, setBirthday] = useState(user.birthday ?? '');
  const [birthdayVisible, setBirthdayVisible] = useState(user.birthdayVisible ?? true);
  const [hideGiftSenders, setHideGiftSenders] = useState(user.hideGiftSenders ?? false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    setBanner(user.banner ?? (user.frame ? `frame:${user.frame}` : 'grad:cosmic'));
  }, [user.banner, user.frame]);

  useEffect(() => {
    if (!user.serverBacked) return;
    void fetchPublicProfileDetails(user.id).then((details) => {
      if (!details) return;
      if (details.birthday !== undefined) setBirthday(details.birthday);
      if (details.birthdayVisible !== undefined) setBirthdayVisible(details.birthdayVisible);
      if (details.hideGiftSenders !== undefined) setHideGiftSenders(details.hideGiftSenders);
    });
  }, [user.id, user.serverBacked]);
  const [resetOpen, setResetOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [device, setDevice] = useState<'ios' | 'android' | 'computer'>('computer');
  const promptAvailable = installPrompt.use();
  const [notificationBlocked, setNotificationBlocked] = useState(typeof Notification !== 'undefined' && Notification.permission === 'denied');
  const [accent, setAccent] = useState(user.accent ?? '');

  const isPro = hasAura(user.id);
  const used = useMemo(() => db.bytes(), [data]);

  const addTag = () => {
    const clean = tagDraft.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (!clean || profileTags.length >= 5 || profileTags.includes(clean)) return;
    setProfileTags((prev) => [...prev, clean]);
    setTagDraft('');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); setSaveBusy(true);
    try {
      await updateProfile(user.id, {
        name,
        bio,
        avatar: avatar || null,
        banner: banner || null,
        profileStroke: profileStroke || null,
        profileTags,
        profileTemplate,
        birthday,
        birthdayVisible,
        hideGiftSenders,
      });
      if (isPro) {
        updateProFlex(user.id, { chatFont, messageEffect });
      }
      tell(t('profileSaved'), 'good');
    } catch (err) { tell(err instanceof AppError ? t(err.key) : t('err.saveFailed'), 'bad'); }
    finally { setSaveBusy(false); }
  };

  const chooseAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { setAvatar(await fileToDataUrl(file, 560, LIMITS.imageChars)); }
    catch (err) { tell(err instanceof AppError ? t(err.key) : t('uploadAvatarError'), 'bad'); }
  };

  const chooseBanner = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { setBanner(await fileToDataUrl(file, 960, LIMITS.imageChars)); }
    catch (err) { tell(err instanceof AppError ? t(err.key) : t('uploadAvatarError'), 'bad'); }
  };

  const exportBackup = () => {
    try {
      const blob = new Blob([db.exportJSON(user)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `orbitmc-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 800);
      tell(t('exportDone'), 'good');
    } catch { tell(t('err.generic'), 'bad'); }
  };
  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 6 * 1024 * 1024) throw new Error('size');
      const backup = await file.text();
      await signOut();
      db.importJSON(backup);
      session.end();
      tell(t('importDone'), 'good');
      onSignedOut();
    } catch { tell(t('backupError'), 'bad'); }
  };
  const wipe = async () => {
    try {
      await signOut();
      db.wipe(); setResetOpen(false); tell(t('wipeDone'), 'good'); onSignedOut();
    } catch (err) {
      tell(err instanceof AppError ? t(err.key) : t('err.generic'), 'bad');
    }
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
  const adminOn = isAdminUser(user);

  return <div className="page-content settings-page">
    <div className="page-heading"><div><div className="eyebrow">{t('settingsEyebrow')}</div><h1>{t('settings')}</h1><p>{t('appearanceHint')}</p></div><div className="settings-profile-top"><Avatar user={user} size="md" showStatus /><div><b>{user.name}</b><small>@{user.username}</small></div></div></div>
    <div className="settings-layout">
      <nav className="settings-nav"><a href="#profile"><span>01</span>{t('profile')}</a><a href="#appearance"><span>02</span>{t('appearance')}</a><a href="#preferences"><span>03</span>{t('preferences')}</a><a href="#privacy"><span>04</span>{t('privacy')}</a><a href="#data"><span>05</span>{t('dataTools')}</a>{!isDesktop() && <a href="#install"><span>06</span>{t('install')}</a>}</nav>
      <div className="settings-sections">
        <section className="settings-section" id="profile">
          <div className="settings-section-head"><span className="section-index">01</span><div><h2>{t('profile')}</h2><p>{t('editProfile')}</p></div></div>

          <div className={`profile-showcase-banner tpl-${profileTemplate}`}>
            <div className={`profile-showcase-cover ${bannerMotionClassFor(user, banner)}`} style={bannerStyleFor(user, banner)} />
            <div className="profile-showcase-body">
              <Avatar user={{ ...user, name, avatar: avatar || undefined, profileStroke: profileStroke || undefined, frame: banner.startsWith('frame:') ? banner.slice(6) : user.frame }} size="xl" showStatus />
              <div className="profile-showcase-meta">
                <div className="profile-showcase-title">
                  <strong className={`font-${chatFont}`}>{name || user.name}</strong>
                  <VerifiedBadge user={user} size={14} />
                  {isPro && <span className={`pro-flex-pill tier-${user.aura?.tier ?? 'ember'}`}>{user.aura?.tier === 'nova' ? <Crown size={11} /> : <Sparkles size={11} />}{user.aura?.tier === 'nova' ? 'NOVA MAX' : `ORBIT+ ${user.aura?.tier.toUpperCase()}`}</span>}
                  {adminOn && <span className="admin-tag">{t('admin')}</span>}
                </div>
                <small>@{user.username} · {user.sparks.toLocaleString(lang)} {t('sparks')} · {t('orbitXp')} {computeOrbitXP(user).xp}</small>
                <div className="profile-showcase-pills">
                  {profileTags.map((tag) => (
                    <span key={tag} className="profile-custom-tag"><Tag size={10} />{tag}</span>
                  ))}
                  <span>{t('orbitXp')} Lv.{computeOrbitXP(user).level}</span>
                  <span>{t('collectionCount', { count: user.inventory.length })}</span>
                </div>
              </div>
            </div>
          </div>

          <form className="profile-settings-form" onSubmit={save}>
            <div className="avatar-editor"><Avatar user={{ ...user, name, avatar: avatar || undefined, profileStroke: profileStroke || undefined, frame: banner.startsWith('frame:') ? banner.slice(6) : user.frame }} size="xl" /><div><strong>{t('avatar')}</strong><p>{t('avatarHelp')}</p><div className="avatar-actions"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden ref={avatarRef} onChange={chooseAvatar} /><button type="button" className="btn btn-outline btn-small" onClick={() => avatarRef.current?.click()}><Icon name="upload" size={14} />{t('changeAvatar')}</button>{avatar && <button type="button" className="btn btn-ghost btn-small" onClick={() => setAvatar('')}>{t('removeAvatar')}</button>}</div></div></div>

            <div className="profile-fields">
              <label className="field-label">{t('profileName')}<input className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} /></label>
              <div className="field-label">{t('username')}<span className="field-input field-readonly">@{user.username}<Icon name="lock" size={14} /></span></div>
              <label className="field-label">{t('profileBio')}<textarea className="field-input field-textarea" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={LIMITS.bio} placeholder={t('bioPlaceholder')} /><small className="field-counter">{bio.length}/{LIMITS.bio}</small></label>

              <div className="field-label">{t('profileBanner')}
                <div className="banner-picker-row">
                  {BANNER_GRADIENTS.map((g) => (
                    <button key={g.id} type="button" className={`banner-grad-chip ${banner === g.id ? 'selected' : ''}`} style={{ background: g.css }} onClick={() => setBanner(g.id)} title={g.label}><span>{g.label}</span></button>
                  ))}
                  {Object.values(data.listings)
                    .filter((l) => !l.removed && l.frame && (user.inventory.includes(l.id) || l.sellerId === user.id))
                    .map((l) => (
                      <button key={l.id} type="button" className={`banner-grad-chip ${banner === `frame:${l.id}` ? 'selected' : ''}`} style={{ background: buildGradientCss(l.frame) }} onClick={() => setBanner(`frame:${l.id}`)} title={l.name}><span>{l.name}</span></button>
                    ))}
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden ref={bannerRef} onChange={chooseBanner} />
                  <button type="button" className="btn btn-outline btn-small" onClick={() => bannerRef.current?.click()}><Icon name="image" size={14} />{t('profileBannerUpload')}</button>
                </div>
              </div>

              <div className="field-label">{t('profileStrokeLabel')}
                <div className="color-swatches">
                  <button type="button" className={`color-dot sado-dot ${!profileStroke ? 'selected' : ''}`} onClick={() => setProfileStroke('')} title={t('clearStatus')} />
                  {ACCENTS.map((c) => (
                    <button key={c} type="button" className={`color-dot ${profileStroke === c ? 'selected' : ''}`} style={{ '--swatch': c } as React.CSSProperties} onClick={() => setProfileStroke(c)} />
                  ))}
                </div>
              </div>

              <div className="field-label">{t('profileTagsLabel')}
                <div className="tag-editor-row">
                  <input className="field-input" value={tagDraft} maxLength={20} placeholder={t('profileTagsPlaceholder')} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                  <button type="button" className="btn btn-outline btn-small" onClick={addTag} disabled={profileTags.length >= 5 || !tagDraft.trim()}><Icon name="plus" size={14} /></button>
                </div>
                {profileTags.length > 0 && <div className="tag-chips-list">
                  {profileTags.map((tag) => (
                    <span key={tag} className="profile-custom-tag"><Tag size={11} />{tag}<button type="button" onClick={() => setProfileTags((prev) => prev.filter((x) => x !== tag))} aria-label={t('delete')}><Icon name="close" size={11} /></button></span>
                  ))}
                </div>}
              </div>

              <div className="field-label">{t('profileTemplateLabel')}
                <div className="segmented-choice">
                  {(['clean', 'halo', 'frame'] as const).map((tpl) => (
                    <button key={tpl} type="button" className={profileTemplate === tpl ? 'selected' : ''} onClick={() => setProfileTemplate(tpl)}>{tpl.toUpperCase()}</button>
                  ))}
                </div>
              </div>

              <div className="auth-two-col">
                <label className="field-label"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Cake size={13} />{t('birthdayLabel')}</span>
                  <input type="date" className="field-input" value={birthday} onChange={(e) => setBirthday(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                </label>
                <div className="field-label"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><EyeOff size={13} />{t('hideGiftSenders')}</span>
                  <label className="creator-motion" style={{ minHeight: 40, padding: '0 10px' }}>
                    <input type="checkbox" checked={hideGiftSenders} onChange={(e) => setHideGiftSenders(e.target.checked)} />
                    <span>{t('hideGiftSenders')}</span>
                  </label>
                </div>
              </div>
              <label className="creator-motion" style={{ minHeight: 38, padding: '0 10px' }}>
                <input type="checkbox" checked={birthdayVisible} onChange={(e) => setBirthdayVisible(e.target.checked)} />
                <span>{t('birthdayPublic')}</span>
              </label>

              <div className="pro-flex-box">
                <div className="pro-flex-head"><Wand2 size={15} /><strong>{t('auraFeatures')}</strong>{!isPro && <span className="pill-mini">ORBIT+ PRO</span>}</div>
                <div className="auth-two-col">
                  <label className="field-label"><Type size={12} /> {t('chatFontLabel')}
                    <select className="sort-select" disabled={!isPro} value={chatFont} onChange={(e) => setChatFont(e.target.value as typeof chatFont)}>
                      {CHAT_FONTS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                    </select>
                  </label>
                  <label className="field-label"><Sparkles size={12} /> {t('messageEffectLabel')}
                    <select className="sort-select" disabled={!isPro} value={messageEffect} onChange={(e) => setMessageEffect(e.target.value as typeof messageEffect)}>
                      {MESSAGE_EFFECTS.map((ef) => <option key={ef} value={ef}>{ef.toUpperCase()}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="profile-form-actions"><span>{t('memberSince', { date: fmtDate(user.createdAt, lang) })}</span><button type="submit" className="btn btn-primary btn-small" disabled={saveBusy}>{saveBusy ? t('loading') : t('saveProfile')}</button></div>
          </form>
        </section>

        <section className="settings-section" id="appearance"><div className="settings-section-head"><span className="section-index">02</span><div><h2>{t('appearance')}</h2><p>{t('appearanceHint')}</p></div></div>
          <div className="setting-row"><div><b>{t('theme')}</b><p>{t('themeSystem')}</p></div><div className="theme-choice">{(['system', 'dark', 'light'] as const).map((theme) => <button key={theme} className={`theme-option ${currentTheme === theme ? 'selected' : ''}`} onClick={() => themeMode.set(theme)}><span className={`theme-swatch swatch-${theme}`}><i /><i /></span><small>{t(theme === 'system' ? 'system' : theme === 'dark' ? 'dark' : 'light')}</small></button>)}</div></div>
          <div className="setting-row"><div><b>{t('accent')}</b><p>{t('accentDefault')}</p></div><div className="color-swatches"><button className={`color-dot sado-dot ${!accent ? 'selected' : ''}`} title={t('accentDefault')} onClick={() => setA('')} />{ACCENTS.slice(1).map((c) => <button key={c} className={`color-dot ${accent === c ? 'selected' : ''}`} title={c} style={{ '--swatch': c } as React.CSSProperties} onClick={() => setA(c)} />)}</div></div>
          <div className="setting-row"><div><b>{t('language')}</b><p>{t('english')} · {t('russian')} · {t('uzbek')}</p></div><div className="segmented-choice lang-setting"><button className={lang === 'en' ? 'selected' : ''} onClick={() => language.set('en')}>EN</button><button className={lang === 'ru' ? 'selected' : ''} onClick={() => language.set('ru')}>RU</button><button className={lang === 'uz' ? 'selected' : ''} onClick={() => language.set('uz')}>UZ</button></div></div>
          <div className="setting-row"><div><b>{t('layout')}</b><p>{t('messageHint')}</p></div><select className="sort-select" value={pr.layout} onChange={(e) => prefs.set({ layout: e.target.value as typeof pr.layout })}><option value="auto">{t('autoLayout')}</option><option value="bubbles">{t('bubbles')}</option><option value="stream">{t('stream')}</option></select></div>
          <div className="setting-row"><div><b>{t('preferences')}</b><p>{t('cozy')} · {t('compact')}</p></div><div className="segmented-choice"><button className={pr.density === 'cozy' ? 'selected' : ''} onClick={() => prefs.set({ density: 'cozy' })}>{t('cozy')}</button><button className={pr.density === 'compact' ? 'selected' : ''} onClick={() => prefs.set({ density: 'compact' })}>{t('compact')}</button></div></div>
        </section>

        <section className="settings-section" id="preferences"><div className="settings-section-head"><span className="section-index">03</span><div><h2>{t('preferences')}</h2><p>{t('notificationsHint')}</p></div></div>
          <ToggleRow title={t('enterToSendToggle')} subtitle={t('messageHint')} value={pr.enterToSend} onChange={(v) => prefs.set({ enterToSend: v })} />
          <ToggleRow title={t('soundToggle')} subtitle={t('messageHint')} value={pr.sound} onChange={(v) => prefs.set({ sound: v })} />
          <div className="toggle-row"><div><b>{t('desktopToggle')}</b><p>{notificationBlocked ? t('desktopBlocked') : t('notificationsHint')}</p></div><div className="toggle-actions">{!pr.desktop && <button className="btn btn-outline btn-small" onClick={toggleNotifications}>{t('desktopEnable')}</button>}<Switch value={pr.desktop} onChange={toggleNotifications} label={t('desktopToggle')} /></div></div>
          <ToggleRow title={t('calmToggle')} subtitle={t('appearanceHint')} value={pr.calm} onChange={(v) => prefs.set({ calm: v })} />
          <ToggleRow title={t('memberToggle')} subtitle={t('members')} value={pr.members} onChange={(v) => prefs.set({ members: v })} />
        </section>

        <section className="settings-section privacy-section" id="privacy"><div className="settings-section-head"><span className="section-index">04</span><div><h2>{t('privacy')}</h2><p>{t('privacyHeading')}</p></div></div>
          <ToggleRow title={t('hideGiftSenders')} subtitle={t('hideGiftSendersSub')} value={hideGiftSenders} onChange={(v) => { setHideGiftSenders(v); void updateProfile(user.id, { name, bio, hideGiftSenders: v }).then(() => tell(t('profileSaved'), 'good')).catch(() => tell(t('err.saveFailed'), 'bad')); }} />
          <ToggleRow title={t('birthdayPublic')} subtitle={t('birthdayLabel')} value={birthdayVisible} onChange={(v) => { setBirthdayVisible(v); void updateProfile(user.id, { name, bio, birthdayVisible: v }).then(() => tell(t('profileSaved'), 'good')).catch(() => tell(t('err.saveFailed'), 'bad')); }} />
          <div className="privacy-notice"><span className="privacy-icon"><Icon name="shield" size={18} /></span><div><b>{t('privacyHeading')}</b><p>{t('privacyDemo')}</p><p>{t('privacyAuth')}</p></div></div><div className="privacy-warning"><Icon name="info" size={16} /><p>{t('privacyWarning')}</p></div><div className="future-note"><span className="eyebrow">{t('launchLabel')}</span><p>{t('privacyLive')}</p></div></section>

        <section className="settings-section" id="data"><div className="settings-section-head"><span className="section-index">05</span><div><h2>{t('dataTools')}</h2><p>{t('storage')}: {storageText}</p></div></div>
          <div className="data-actions">
            <div className="data-action-row"><span className="data-action-icon"><Icon name="shield" size={17} /></span><div><b>{t('adminTitle')}</b><p>{t('adminSub')}</p></div><div className="admin-toggle-actions">{adminOn && <button className="btn btn-primary btn-small" onClick={() => window.dispatchEvent(new CustomEvent('orbit:nav', { detail: 'admin' }))}>{t('admin')}</button>}<button className="btn btn-outline btn-small" onClick={() => { const next = toggleSelfAdminPreview(user.id); if (next) window.dispatchEvent(new CustomEvent('orbit:nav', { detail: 'admin' })); }}>{adminOn ? t('adminDisablePreview') : t('adminEnablePreview')}</button></div></div>
            <div className="data-action-row"><span className="data-action-icon"><Icon name="download" size={17} /></span><div><b>{t('exportData')}</b><p>{t('privacyDemo')}</p></div><button className="btn btn-outline btn-small" onClick={exportBackup}>{t('exportData')}</button></div>
            <div className="data-action-row"><span className="data-action-icon"><Icon name="upload" size={17} /></span><div><b>{t('importData')}</b><p>{t('backupError')}</p></div><input hidden ref={importRef} type="file" accept=".json,application/json" onChange={importBackup} /><button className="btn btn-outline btn-small" onClick={() => importRef.current?.click()}>{t('importData')}</button></div>
            <div className="data-action-row reset-row"><span className="data-action-icon"><Icon name="trash" size={17} /></span><div><b>{t('wipeData')}</b><p>{t('resetSub')}</p></div><button className="btn btn-danger-outline btn-small" onClick={() => setResetOpen(true)}>{t('wipeData')}</button></div>
          </div>
        </section>

        {!isDesktop() && <section className="settings-section install-section" id="install"><div className="settings-section-head"><span className="section-index">06</span><div><h2>{t('install')}</h2><p>{t('installSub')}</p></div></div><div className="install-card"><div className="install-logo"><BrandMark large /></div><div className="install-copy"><b>{isStandalone() ? t('installReady') : t('brand')}</b><p>{t('downloadApp')}</p><small>{t('installSub')}</small></div><button className="btn btn-primary btn-small" onClick={openInstall} disabled={isStandalone()}>{isStandalone() ? t('installReady') : t(promptAvailable ? 'installAction' : 'install')}</button></div></section>}

        <div className="signout-line"><span>@{user.username}</span><button className="btn btn-ghost" onClick={async () => { try { await signOut(); onSignedOut(); } catch (err) { tell(err instanceof AppError ? t(err.key) : t('err.generic'), 'bad'); } }}><Icon name="back" size={15} />{t('signOut')}</button></div>
      </div>
    </div>
    <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t('resetConfirm')} subtitle={t('resetSub')} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setResetOpen(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={wipe}>{t('wipeData')}</button></div></Modal>
    <Modal open={installOpen} onClose={() => setInstallOpen(false)} title={t('install')} subtitle={t('chooseDevice')} size="sm"><div className="install-choices">{(['ios', 'android', 'computer'] as const).map((d) => <button key={d} className={device === d ? 'selected' : ''} onClick={() => setDevice(d)}><Icon name={d === 'computer' ? 'monitor' : 'download'} size={18} />{t(d === 'ios' ? 'desktopIOS' : d === 'android' ? 'desktopAndroid' : 'desktopComputer')}</button>)}</div><div className="install-instructions"><Icon name="info" size={16} /><p>{deviceSteps}</p></div><p className="install-footnote">{t('downloadApp')}</p><button className="btn btn-secondary btn-full" onClick={() => setInstallOpen(false)}>{t('backToApp')}</button></Modal>
  </div>;
}

function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-row"><div><b>{title}</b><p>{subtitle}</p></div><Switch value={value} onChange={() => onChange(!value)} label={title} /></div>;
}

function Switch({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  return <button role="switch" aria-checked={value} aria-label={label} className={`switch ${value ? 'on' : ''}`} onClick={onChange}><span /></button>;
}
