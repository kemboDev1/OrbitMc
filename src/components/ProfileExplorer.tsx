import { useEffect, useState } from 'react';
import { Cake, Calendar, Crown, EyeOff, Gift, Sparkles, Tag, Trophy } from 'lucide-react';
import type { DB, GiftRecord, User } from '../data/types';
import { computeOrbitXP, hasAura } from '../data/market';
import { fetchPublicProfileDetails } from '../data/cloud';
import { useI18n } from '../i18n';
import { Avatar } from './Avatar';
import { Icon } from './Icons';
import { bannerStyleFor } from './SettingsPage';
import { VectorBadge } from './VectorAssets';

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
  const isSelf = target.id === viewer.id;
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
      <div className={variant === 'drawer' ? 'profile-cover' : 'profile-modal-cover'} style={bannerStyleFor(target)} />
      <Avatar user={target} size={variant === 'drawer' ? 'lg' : 'xl'} showStatus />
      {variant === 'drawer' && <span className="member-presence">{t(target.presence)}</span>}

      <h2 className={targetPro && target.chatFont ? `font-${target.chatFont}` : ''}>
        {target.name}
        {targetPro && (
          <span className={`pro-flex-pill tier-${target.aura?.tier ?? 'ember'}`}>
            {target.aura?.tier === 'nova' ? <Crown size={10} /> : <Sparkles size={10} />}
            {target.aura?.tier === 'nova' ? 'NOVA MAX' : 'ORBIT+'}
          </span>
        )}
        {target.isAdmin && <span className="admin-tag">{t('admin')}</span>}
      </h2>

      <p className="profile-handle">@{target.username}</p>
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
          <b>{xpInfo.xp.toLocaleString(lang)} XP</b>
        </div>
        <div className="orbit-xp-track"><span style={{ width: `${xpInfo.progressPct}%` }} /></div>
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
