import { useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, Link2, Sparkles, User as UserIcon } from 'lucide-react';
import type { DB, Hub, Role, User } from '../data/types';
import { HUB_TEMPLATES, addRoom, joinHub, kickHubMember, makeHub, removeRoom, setHubMemberRole, updateHub, updateRoom, type HubTemplateKey } from '../data/hubs';
import { useChatControls } from '../data/chatControls';
import { computeOrbitXP, hasAura } from '../data/market';
import { fmtShort } from '../lib/util';
import { useI18n } from '../i18n';
import { Avatar, AvatarPile } from './Avatar';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';
import { AppError } from '../data/errors';
import { LIMITS } from '../config';
import { HUB_ICON_OPTIONS, HubSymbol, VerifiedBadge } from './VectorAssets';

export function HubPage({ db, user, onOpen, onCreate }: { db: DB; user: User; onOpen: (hub: Hub, room?: string) => void; onCreate: () => void }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [managingHub, setManagingHub] = useState<Hub | null>(null);
  const joined = useMemo(() => Object.values(db.hubs).filter((h) => !!h.members[user.id]), [db.hubs, user.id]);
  const discover = useMemo(() => Object.values(db.hubs).filter((h) => h.public && !h.members[user.id] && `${h.name} ${h.about}`.toLowerCase().includes(query.toLowerCase())), [db.hubs, user.id, query]);
  const join = async (h: Hub) => { try { await joinHub(h.id, user.id); tell(t('hubJoined'), 'good'); } catch (error) { tell(error instanceof AppError ? t(error.key) : t('err.generic'), 'bad'); } };

  return <div className="page-content hub-page">
    <div className="page-heading">
      <div><div className="eyebrow">{t('hubTitleTag')}</div><h1>{t('hubs')}</h1><p>{t('discoverHubs')}</p></div>
      <button className="btn btn-primary" onClick={onCreate}><Icon name="plus" size={16} />{t('createHub')}</button>
    </div>
    <p className="local-feature-note">{t(user.serverBacked ? 'hubsLiveNotice' : 'hubsLocalNotice')}</p>
    <div className="hub-section-head">
      <h2>{t('yourHubs')} <span className="count-pill">{joined.length}</span></h2>
      {joined.length === 0 && <button className="btn btn-secondary btn-small" onClick={onCreate}>{t('makeHubFirst')}</button>}
    </div>
    {joined.length > 0 ? <div className="hub-grid">{joined.map((h) => {
      const members = Object.keys(h.members).map((id) => db.users[id]).filter(Boolean);
      const last = h.rooms.flatMap((r) => db.msgs[r.id] ?? []).sort((a, b) => b.ts - a.ts)[0];
      const author = last ? db.users[last.by] : null;
      const canManage = ['owner', 'mod'].includes(h.members[user.id] ?? '');
      return <article className="hub-card" key={h.id}>
        <button className="hub-card-main" onClick={() => onOpen(h)}>
          <div className="hub-card-cover" style={{ '--hub-hue': h.hue } as React.CSSProperties}>
            <span className="hub-card-orbit orbit-1" /><span className="hub-card-orbit orbit-2" />
            <span className="hub-card-symbol"><HubSymbol mark={h.emoji} size={24} /></span>
            <span className="hub-card-number">{h.rooms.length} {t('rooms').toLowerCase()}</span>
            <span className="hub-card-go"><Icon name="arrowUpRight" size={16} /></span>
          </div>
          <div className="hub-card-info">
            <div className="hub-card-head">
              <h3>{h.name}</h3>
              <span className="hub-online"><i />{members.filter((x) => x.presence === 'online').length}</span>
            </div>
            <p>{h.about || t('aboutHub')}</p>
            <div className="hub-card-foot">
              <AvatarPile people={members} limit={4} />
              <span className="hub-activity">{last && author ? `${author.name} · ${fmtShort(last.ts, lang)}` : `${members.length} ${t('members').toLowerCase()}`}</span>
            </div>
          </div>
        </button>
        {canManage && <button type="button" className="hub-card-manage icon-btn" title={t('manageHub')} aria-label={t('manageHub')} onClick={() => setManagingHub(h)}><Icon name="sliders" size={14} /></button>}
      </article>;
    })}</div> : <div className="inline-empty"><div className="empty-mark"><HubSymbol mark="icon:orbit" size={20} /></div><p>{t('noHubs')}</p><button className="btn btn-secondary btn-small" onClick={onCreate}>{t('createHub')}</button></div>}

    <div className="hub-section-head discover-head">
      <h2>{t('browseHubs')}</h2>
      <label className="mini-search"><Icon name="search" size={15} /><input placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    </div>
    {discover.length ? <div className="discover-list">{discover.map((h) => <div className="discover-row" key={h.id}>
      <span className="discover-mark" style={{ '--hub-hue': h.hue } as React.CSSProperties}><HubSymbol mark={h.emoji} size={18} /></span>
      <div className="discover-copy"><h3>{h.name}</h3><p>{h.about}</p><small>{Object.keys(h.members).length} {t('members').toLowerCase()} · {h.rooms.length} {t('rooms').toLowerCase()} · {t('hubCreatedBy', { name: db.users[h.ownerId]?.name ?? 'OrbitMc' })}</small></div>
      <button className="btn btn-outline btn-small" onClick={() => join(h)}><Icon name="plus" size={14} />{t('joinHub')}</button>
    </div>)}</div> : <p className="subtle-empty">{t('noPublicHubs')}</p>}

    {managingHub && db.hubs[managingHub.id] && <HubSettingsModal open={!!managingHub} onClose={() => setManagingHub(null)} hub={db.hubs[managingHub.id]} db={db} user={user} />}
  </div>;
}

export function CreateHubModal({ open, onClose, user, onCreated }: { open: boolean; onClose: () => void; user: User; onCreated: (hub: Hub) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [emoji, setEmoji] = useState('icon:rocket');
  const [template, setTemplate] = useState<HubTemplateKey>('team');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pickTemplate = (next: HubTemplateKey) => {
    setTemplate(next);
    setEmoji(next === 'team' ? 'icon:rocket' : next === 'friends' ? 'icon:music' : next === 'community' ? 'icon:globe' : 'icon:orbit');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (busy) return;
    setBusy(true);
    try {
      const safeMark = emoji.startsWith('icon:') ? '✳' : emoji;
      const h = await makeHub({ userId: user.id, name, about, emoji: user.serverBacked ? safeMark : emoji, public: isPublic, template });
      onCreated(h);
      setName('');
      setAbout('');
      onClose();
    } catch (err) { setError(err instanceof AppError ? t(err.key) : t('err.generic')); }
    finally { setBusy(false); }
  };

  return <Modal open={open} onClose={onClose} title={t('createHub')} subtitle={t('makeHubFirst')} size="md"><form className="stack-form" onSubmit={submit}>
    {!user.serverBacked && <div className="field-label">{t('hubTemplate')}
      <div className="template-grid">
        {([
          { id: 'team', label: t('templateTeam'), mark: 'icon:rocket' },
          { id: 'friends', label: t('templateFriends'), mark: 'icon:music' },
          { id: 'community', label: t('templateCommunity'), mark: 'icon:globe' },
          { id: 'blank', label: t('templateBlank'), mark: 'icon:orbit' },
        ] as const).map((tpl) => (
          <button key={tpl.id} type="button" className={`template-chip ${template === tpl.id ? 'active' : ''}`} onClick={() => pickTemplate(tpl.id)}>
            <span className="template-chip-icon"><HubSymbol mark={tpl.mark} size={18} /></span>
            <b>{tpl.label}</b>
            <small>{HUB_TEMPLATES[tpl.id].rooms.map((r) => `#${r.name}`).join(' · ')}</small>
          </button>
        ))}
      </div>
    </div>}
    <label className="field-label">{t('hubName')}<input className="field-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.hubName} placeholder={t('hubName')} /></label>
    <label className="field-label">{t('hubAbout')}<textarea className="field-input field-textarea" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={LIMITS.hubAbout} placeholder={t('hubAbout')} /></label>
    <div className="field-label">{t('hubEmoji')}
      <div className="symbol-picker">
        {HUB_ICON_OPTIONS.map((opt) => (
          <button key={opt.key} type="button" title={opt.label} className={`symbol-option ${emoji === opt.key ? 'picked' : ''}`} onClick={() => setEmoji(opt.key)}>
            <opt.Icon size={17} />
          </button>
        ))}
      </div>
    </div>
    <div className="field-label">{t('hubPrivacy')}<div className="segmented-choice"><button type="button" className={isPublic ? 'selected' : ''} onClick={() => setIsPublic(true)}>{t('publicHub')}</button><button type="button" className={!isPublic ? 'selected' : ''} onClick={() => setIsPublic(false)}>{t('privateHub')}</button></div></div>
    {error && <div className="inline-error" role="alert"><Icon name="info" size={15} />{error}</div>}
    <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('cancel')}</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('loading') : <><Icon name="plus" size={15} />{t('create')}</>}</button></div>
  </form></Modal>;
}

export function HubSettingsModal({ open, onClose, hub, db, user }: { open: boolean; onClose: () => void; hub: Hub; db: DB; user: User }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'general' | 'rooms' | 'members'>('general');
  const [name, setName] = useState(hub.name);
  const [about, setAbout] = useState(hub.about);
  const [emoji, setEmoji] = useState(hub.emoji);
  const [isPublic, setIsPublic] = useState(hub.public);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomKind, setNewRoomKind] = useState<'text' | 'broadcast'>('text');
  const [newRoomTopic, setNewRoomTopic] = useState('');
  const report = (e: unknown) => tell(e instanceof AppError ? t(e.key) : t('err.generic'), 'bad');
  const isOwner = hub.ownerId === user.id;

  const saveGeneral = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const safeMark = hub.remote && emoji.startsWith('icon:') ? hub.emoji : emoji;
      await updateHub(hub.id, user.id, { name, about, emoji: safeMark, public: isPublic });
      tell(t('hubUpdated'), 'good');
    } catch (err) { report(err); }
  };

  const createNewRoom = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addRoom(hub.id, user.id, newRoomName, newRoomKind, newRoomTopic);
      setNewRoomName('');
      setNewRoomTopic('');
      tell(t('roomCreated'), 'good');
    } catch (err) { report(err); }
  };

  return <Modal open={open} onClose={onClose} title={hub.name} subtitle={t('hubSettings')} size="md">
    <div className="hub-manage-tabs">
      <button type="button" className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>{t('overview')}</button>
      <button type="button" className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>{t('rooms')} ({hub.rooms.length})</button>
      <button type="button" className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>{t('members')} ({Object.keys(hub.members).length})</button>
    </div>

    {tab === 'general' && <form className="stack-form" onSubmit={saveGeneral}>
      <label className="field-label">{t('hubName')}<input className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.hubName} /></label>
      <label className="field-label">{t('hubAbout')}<textarea className="field-input field-textarea" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={LIMITS.hubAbout} /></label>
      {!hub.remote && <div className="field-label">{t('hubEmoji')}
        <div className="symbol-picker">
          {HUB_ICON_OPTIONS.map((opt) => (
            <button key={opt.key} type="button" title={opt.label} className={`symbol-option ${emoji === opt.key ? 'picked' : ''}`} onClick={() => setEmoji(opt.key)}>
              <opt.Icon size={17} />
            </button>
          ))}
        </div>
      </div>}
      <div className="field-label">{t('hubPrivacy')}<div className="segmented-choice"><button type="button" className={isPublic ? 'selected' : ''} onClick={() => setIsPublic(true)}>{t('publicHub')}</button><button type="button" className={!isPublic ? 'selected' : ''} onClick={() => setIsPublic(false)}>{t('privateHub')}</button></div></div>
      <div className="modal-actions">
        <button type="button" className="btn btn-outline btn-small" onClick={async () => { const url = `${window.location.origin}/invite/${hub.invite}`; try { await navigator.clipboard.writeText(url); tell(t('inviteCopied'), 'good'); } catch { tell(url, 'info'); } }}><Icon name="link" size={14} />{t('inviteCopy')}</button>
        <button type="submit" className="btn btn-primary btn-small">{t('saveHub')}</button>
      </div>
    </form>}

    {tab === 'rooms' && <div className="stack-form">
      <div className="hub-manage-list">
        {hub.rooms.map((r) => (
          <div className="hub-manage-row" key={r.id}>
            <span className="hub-room-badge"><Icon name={r.kind === 'broadcast' ? 'megaphone' : 'hash'} size={14} /></span>
            <div className="hub-manage-copy">
              <b>#{r.name}</b>
              <small>{r.topic || (r.kind === 'broadcast' ? t('roomKindBroadcast') : t('roomKindText'))}</small>
            </div>
            <button type="button" className="btn btn-ghost btn-small" onClick={async () => { try { await updateRoom(hub.id, r.id, user.id, { kind: r.kind === 'text' ? 'broadcast' : 'text' }); tell(t('hubUpdated'), 'good'); } catch (err) { report(err); } }}>
              {r.kind === 'broadcast' ? t('roomKindBroadcast') : t('roomKindText')}
            </button>
            {hub.rooms.length > 1 && <button type="button" className="icon-btn danger-ghost" title={t('deleteRoom')} onClick={async () => { try { await removeRoom(hub.id, r.id, user.id); tell(t('hubUpdated'), 'good'); } catch (err) { report(err); } }}><Icon name="trash" size={14} /></button>}
          </div>
        ))}
      </div>
      <form className="stack-form hub-add-room-box" onSubmit={createNewRoom}>
        <div className="auth-two-col">
          <label className="field-label">{t('newRoom')}<input className="field-input" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="announcements" maxLength={LIMITS.roomName} /></label>
          {!hub.remote && <label className="field-label">{t('roomKind')}
            <select className="sort-select" value={newRoomKind} onChange={(e) => setNewRoomKind(e.target.value as 'text' | 'broadcast')}>
              <option value="text">{t('roomKindText')}</option>
              <option value="broadcast">{t('roomKindBroadcast')}</option>
            </select>
          </label>}
        </div>
        {!hub.remote && <label className="field-label">{t('roomTopic')}<input className="field-input" value={newRoomTopic} onChange={(e) => setNewRoomTopic(e.target.value)} placeholder={t('roomTopicPlaceholder')} maxLength={LIMITS.topic} /></label>}
        <button type="submit" className="btn btn-primary btn-small"><Icon name="plus" size={14} />{t('addRoom')}</button>
      </form>
    </div>}

    {tab === 'members' && <div className="hub-manage-list">
      {Object.entries(hub.members).map(([memberId, role]) => {
        const person = db.users[memberId];
        if (!person) return null;
        return (
          <div className="hub-manage-row" key={memberId}>
            <Avatar user={person} size="sm" showStatus />
            <div className="hub-manage-copy">
              <b>{person.name}</b>
              <small>@{person.username} · {t(role === 'mod' ? 'moderator' : role)}</small>
            </div>
            {isOwner && memberId !== user.id && (
              <div className="hub-member-actions">
                <button type="button" className="btn btn-outline btn-small" onClick={async () => { try { const next: Exclude<Role, 'owner'> = role === 'mod' ? 'member' : 'mod'; await setHubMemberRole(hub.id, user.id, memberId, next); tell(t('memberRoleUpdated'), 'good'); } catch (err) { report(err); } }}>
                  {role === 'mod' ? t('demoteMember') : t('promoteMod')}
                </button>
                <button type="button" className="icon-btn danger-ghost" title={t('kickMember')} onClick={async () => { try { await kickHubMember(hub.id, user.id, memberId); tell(t('memberRemoved'), 'good'); } catch (err) { report(err); } }}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>}
  </Modal>;
}

export function PeoplePage({ db, user, onChat }: { db: DB; user: User; onChat: (id: string) => void }) {
  const { t } = useI18n();
  const chatControls = useChatControls(user.id);
  const [q, setQ] = useState('');
  const others = useMemo(() => Object.values(db.users).filter((p) => (p.serverBacked || (!p.bot && p.id !== 'orbit-studio')) && p.id !== user.id && `${p.name} ${chatControls.nicknames?.[p.id] ?? ''} ${p.username}`.toLowerCase().includes(q.toLowerCase())), [db.users, user.id, q, chatControls.nicknames]);
  return <div className="page-content people-page">
    <div className="page-heading"><div><div className="eyebrow">{t('goodPeople')}</div><h1>{t('people')}</h1><p>{t('welcomeSub')}</p></div><label className="page-search"><Icon name="search" size={17} /><input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} /></label></div>
    {others.length ? <div className="people-list">{others.map((p) => {
      const xp = computeOrbitXP(p);
      const displayName = chatControls.nicknames?.[p.id] || p.name;
      return (
        <div key={p.id} className="person-card">
          <button type="button" className="person-card-profile-hit" onClick={() => window.dispatchEvent(new CustomEvent('sado:profile', { detail: p.id }))} title={t('profile')}>
            <Avatar user={p} size="lg" showStatus />
            <div className="person-card-info">
              <h3>{displayName}<VerifiedBadge user={p} size={14} /><span className="pill-mini">Lv.{xp.level}</span></h3>
              <small>@{p.username} · {t('orbitXp')} {xp.xp}</small>
              <p>{p.statusText || p.bio || t('welcomeSub')}</p>
            </div>
          </button>
          <span className="person-presence"><i className={`status-mini status-${p.presence}`} />{t(p.presence)}</span>
          <div className="person-card-actions">
            <button type="button" className="btn btn-outline btn-small" title={t('profile')} onClick={() => window.dispatchEvent(new CustomEvent('sado:profile', { detail: p.id }))}><UserIcon size={14} /></button>
            <button type="button" className="btn btn-primary btn-small" onClick={() => onChat(p.id)}><Icon name="chat" size={14} /></button>
          </div>
        </div>
      );
    })}</div> : <div className="inline-empty"><div className="empty-mark"><HubSymbol mark="icon:users" size={20} /></div><p>{t('noPeople')}</p></div>}
    <p className="demo-helper">{t('demoNote')}</p>
  </div>;
}

export function HubInviteModal({ open, onClose, hub }: { open: boolean; onClose: () => void; hub: Hub | null }) {
  const { t } = useI18n();
  const [copiedWhat, setCopiedWhat] = useState<'link' | 'code' | null>(null);
  if (!hub) return null;
  const shareUrl = `${window.location.origin}/?invite=${encodeURIComponent(hub.invite)}`;
  const copy = async (value: string, what: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedWhat(what);
      tell(t(what === 'link' ? 'inviteCopied' : 'codeCopied'), 'good');
      setTimeout(() => setCopiedWhat((cur) => (cur === what ? null : cur)), 1800);
    } catch {
      tell(value, 'info');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={hub.name} subtitle={`${Object.keys(hub.members).length} ${t('members').toLowerCase()} · ${hub.public ? t('publicHub') : t('privateHub')}`} size="sm">
      <div className="stack-form">
        <div className="invite-code-card">
          <div className="invite-code-meta">
            <span><Sparkles size={13} /> {t('inviteCodeLabel')}</span>
            <strong>{hub.invite}</strong>
          </div>
          <button type="button" className="btn btn-outline btn-small" onClick={() => void copy(hub.invite, 'code')}>
            {copiedWhat === 'code' ? <Check size={14} /> : <Copy size={14} />}
            <span>{t('inviteCopyCode')}</span>
          </button>
        </div>

        <label className="field-label">
          <span>{t('inviteLinkLabel')}</span>
          <div className="invite-link-row">
            <input
              readOnly
              className="field-input"
              value={shareUrl}
              onClick={(e) => e.currentTarget.select()}
            />
            <button type="button" className="btn btn-primary btn-small" onClick={() => void copy(shareUrl, 'link')}>
              {copiedWhat === 'link' ? <Check size={14} /> : <Link2 size={14} />}
              <span>{t('copy')}</span>
            </button>
          </div>
        </label>
      </div>
    </Modal>
  );
}
