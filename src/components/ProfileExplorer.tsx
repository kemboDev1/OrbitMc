import { useEffect, useState } from 'react';
import { Cake, Calendar, Check, Crown, Edit3, EyeOff, Gift, HelpCircle, RotateCcw, Sparkles, Tag, Trophy } from 'lucide-react';
import type { DB, GiftRecord, User } from '../data/types';
import { computeOrbitXP, hasAura } from '../data/market';
import { fetchPublicProfileDetails } from '../data/cloud';
import { setCustomNickname, useChatControls } from '../data/chatControls';
import { useI18n } from '../i18n';
import { Avatar } from './Avatar';
import { bannerMotionClassFor, bannerStyleFor } from './SettingsPage';
import { tell } from './Toast';
import { VectorBadge, VerifiedBadge } from './VectorAssets';

function isBirthdayToday(birthday?: string): boolean {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const now = new Date();
  const [, m, d] = birthday.split('-');
  return Number(m) === now.getMonth() + 1 && Number(d) === now.getDate();
}

function formatBirthday(birthday: string, lang: string): string {
  const [y, m, d] = birthday.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2000, (m || 1) - 1, d || 1));
  return new Intl.DateTimeFormat(lang, { month: 'long', day: 'numeric', year: 'numeric' }).format(dt);
}

export function ProfileExplorerContent({
  target,
  viewer,
  db,
  variant = 'modal',
  action,
}: {
  target: User;
  viewer: User;
  db: DB;
  variant?: 'modal' | 'drawer';
  action?: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const [, setTick] = useState(0);
  const [xpGuideOpen, setXpGuideOpen] = useState(false);
  const controls = useChatControls(viewer.id);
  const isSelf = target.id === viewer.id;
  const customNick = !isSelf ? controls.nicknames?.[target.id] : undefined;
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState('');

  useEffect(() => {
    setEditingNick(false);
    setNickDraft(customNick ?? '');
  }, [target.id, customNick]);

  useEffect(() => {
    if (!target.serverBacked) return;
    let active = true;
    void fetchPublicProfileDetails(target.id).then((res) => {
      if (active && res) setTick((x) => x + 1);
    });
    return () => { active = false; };
  }, [target.id, target.serverBacked]);

  const targetPro = hasAura(target.id);
  const xpInfo = computeOrbitXP(target);
  const showBirthday = !!target.birthday && (isSelf || target.birthdayVisible !== false);
  const bdayToday = showBirthday && isBirthdayToday(target.birthday);
  const sharedHubs = Object.values(db.hubs).filter((h) => !!h.members[target.id]).length;
  const hideSenders = !!target.hideGiftSenders && !isSelf;

  const fallbackGifts: GiftRecord[] = (target.giftsReceived ?? []).map((id, i) => ({
    listingId: id,
    listingName: db.listings[id]?.name,
    listingKind: db.listings[id]?.kind,
    at: target.createdAt + i,
  }));
  const gifts = (target.giftRecords && target.giftRecords.length > 0 ? target.giftRecords : fallbackGifts).slice(0, 8);
  const giftTotal = Math.max(gifts.length, target.giftsReceivedCount ?? 0);

  return (
    <div className={`${variant === 'drawer' ? 'profile-aside-card' : 'profile-modal-card'} tpl-${target.profileTemplate ?? 'halo'}`}>
      <div className={`${variant === 'drawer' ? 'profile-cover' : 'profile-modal-cover'} ${bannerMotionClassFor(target)}`} style={bannerStyleFor(target)} />
      <Avatar user={target} size={variant === 'drawer' ? 'lg' : 'xl'} showStatus />
      {variant === 'drawer' && <span className="member-presence">{t(target.presence)}</span>}

      <h2 className={targetPro && target.chatFont ? `font-${target.chatFont}` : ''}>
        {customNick || target.name}
        <VerifiedBadge user={target} />
        {!isSelf && !target.bot && (
          <button
            type="button"
            className="nick-edit-inline"
            title={t('editContactName')}
            aria-label={t('editContactName')}
            onClick={() => { setNickDraft(customNick ?? target.name); setEditingNick((v) => !v); }}
          >
            <Edit3 size={12} />
          </button>
        )}
        {targetPro && (
          <span className={`pro-flex-pill tier-${target.aura?.tier ?? 'ember'}`}>
            {target.aura?.tier === 'nova' ? <Crown size={10} /> : <Sparkles size={10} />}
            {target.aura?.tier === 'nova' ? 'NOVA MAX' : 'ORBIT+'}
          </span>
        )}
      </h2>

      {editingNick && !isSelf && !target.bot && (
        <form
          className="nick-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            setCustomNickname(viewer.id, target.id, nickDraft);
            setEditingNick(false);
            tell(t('contactNameSaved'), 'good');
          }}
        >
          <input
            className="field-input"
            value={nickDraft}
            maxLength={32}
            placeholder={t('contactNamePlaceholder')}
            autoFocus
            onChange={(e) => setNickDraft(e.target.value)}
          />
          <button type="submit" className="icon-btn btn-primary" title={t('save')} aria-label={t('save')}><Check size={14} /></button>
          {customNick && (
            <button
              type="button"
              className="icon-btn"
              title={t('resetContactName')}
              aria-label={t('resetContactName')}
              onClick={() => { setCustomNickname(viewer.id, target.id, ''); setEditingNick(false); tell(t('contactNameSaved'), 'good'); }}
            >
              <RotateCcw size={13} />
            </button>
          )}
        </form>
      )}

      <p className="profile-handle">@{target.username}{customNick ? ` · ${target.name}` : ''}</p>
      {target.bio && <p className="profile-bio-text">{target.bio}</p>}
      {target.statusText && <p className="profile-status">“{target.statusText}”</p>}

      {!!target.profileTags?.length && (
        <div className="tag-chips-list center">
          {target.profileTags.map((tag) => (
            <span key={tag} className="profile-custom-tag"><Tag size={10} />{tag}</span>
          ))}
        </div>
      )}

      <div className="orbit-xp-card">
        <div className="orbit-xp-head">
          <span><Trophy size={13} /> {t('orbitXp')} · Lv.{xpInfo.level} ({xpInfo.rank})</span>
          <span className="orbit-xp-right">
            <b>{xpInfo.xp.toLocaleString(lang)} XP</b>
            <button type="button" className="xp-guide-btn" title={t('xpGuideTitle')} aria-label={t('xpGuideTitle')} onClick={() => setXpGuideOpen((v) => !v)}>
              <HelpCircle size={13} />
            </button>
          </span>
        </div>
        <div className="orbit-xp-track"><span style={{ width: `${xpInfo.progressPct}%` }} /></div>
        {xpGuideOpen && (
          <div className="xp-guide-box">
            <b>{t('xpGuideTitle')}</b>
            <p>{t('xpGuideBody')}</p>
            <div className="xp-milestones-row">
              <span className={`pill-mini ${xpInfo.xp >= 50 ? 'ok' : ''}`}>50 XP · +25 Sparks + Gift</span>
              <span className={`pill-mini ${xpInfo.xp >= 100 ? 'ok' : ''}`}>100 XP · +50 Sparks + Gift</span>
            </div>
          </div>
        )}
      </div>

      <div className="profile-facts-grid">
        <div className="profile-fact-tile">
          <Calendar size={13} />
          <span>{t('memberSince', { date: new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(target.createdAt) })}</span>
        </div>
        {showBirthday && target.birthday && (
          <div className={`profile-fact-tile ${bdayToday ? 'is-bday' : ''}`}>
            <Cake size={13} />
            <span>{formatBirthday(target.birthday, lang)}{bdayToday ? ` · ${t('birthdayToday')}` : ''}</span>
          </div>
        )}
        <div className="profile-fact-tile">
          <Sparkles size={13} />
          <span>{t('collectionCount', { count: target.inventory.length })} · {sharedHubs} {t('hubs').toLowerCase()}</span>
        </div>
      </div>

      {giftTotal > 0 && (
        <div className="profile-gifts-box">
          <div className="profile-gifts-head">
            <span><Gift size={13} /> {t('giftsShowcase')} ({giftTotal})</span>
            {hideSenders && <span className="pill-mini"><EyeOff size={10} /> {t('giftSenderHidden')}</span>}
          </div>
          {gifts.length > 0 && (
            <div className="profile-gifts-grid">
              {gifts.map((g, idx) => {
                const item = db.listings[g.listingId];
                const title = g.listingName ?? item?.name ?? g.listingId;
                const stickerIcon = item?.stickers?.[0];
                const senderLabel = hideSenders
                  ? t('giftSenderHidden')
                  : g.fromUsername
                    ? t('giftFrom', { name: g.fromUsername })
                    : g.fromId && db.users[g.fromId]
                      ? t('giftFrom', { name: db.users[g.fromId].username })
                      : t('giftSenderHidden');
                return (
                  <div className="profile-gift-tile" key={`${g.listingId}-${idx}`} title={`${title} — ${senderLabel}`}>
                    <span className="gift-tile-art">
                      {stickerIcon ? <VectorBadge id={stickerIcon} size="sm" /> : <Gift size={16} />}
                    </span>
                    <b>{title}</b>
                    <small>{senderLabel}</small>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {action}
    </div>
  );
}
