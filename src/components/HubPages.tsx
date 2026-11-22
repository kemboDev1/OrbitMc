import { useMemo, useState, type FormEvent } from 'react';
import type { DB, Hub, User } from '../data/types';
import { addRoom, joinHub, joinInvite, leaveHub, makeHub } from '../data/hubs';
import { fmtShort } from '../lib/util';
import { useI18n } from '../i18n';
import { Avatar, AvatarPile } from './Avatar';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';
import { AppError } from '../data/errors';
import { LIMITS } from '../config';

const symbols = ['✳', '🌙', '🌱', '🎧', '☁', '✿', '▧', '⚑', '◎', '⁖', '🪩', '🌿'];

export function HubPage({ db, user, onOpen, onCreate }: { db: DB; user: User; onOpen: (hub: Hub, room?: string) => void; onCreate: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const joined = useMemo(() => Object.values(db.hubs).filter((h) => !!h.members[user.id]), [db.hubs, user.id]);
  const discover = useMemo(() => Object.values(db.hubs).filter((h) => h.public && !h.members[user.id] && `${h.name} ${h.about}`.toLowerCase().includes(query.toLowerCase())), [db.hubs, user.id, query]);
  const join = (h: Hub) => { try { joinHub(h.id, user.id); tell(t('hubJoined'), 'good'); } catch { tell(t('err.generic'), 'bad'); } };
  return <div className="page-content hub-page">
    <div className="page-heading"><div><div className="eyebrow">{t('hubTitleTag')}</div><h1>{t('hubs')}</h1><p>{t('discoverHubs')}</p></div><button className="btn btn-primary" onClick={onCreate}><Icon name="plus" size={16}/>{t('createHub')}</button></div>
    <div className="hub-section-head"><h2>{t('yourHubs')} <span className="count-pill">{joined.length}</span></h2>{joined.length === 0 && <button className="btn btn-secondary btn-small" onClick={onCreate}>{t('makeHubFirst')}</button>}</div>
    {joined.length > 0 ? <div className="hub-grid">{joined.map((h) => {
      const members = Object.keys(h.members).map((id) => db.users[id]).filter(Boolean);
      const last = h.rooms.flatMap((r) => db.msgs[r.id] ?? []).sort((a, b) => b.ts - a.ts)[0];
      const author = last ? db.users[last.by] : null;
      return <button className="hub-card" key={h.id} onClick={() => onOpen(h)}>
        <div className="hub-card-cover" style={{ '--hub-hue': h.hue } as React.CSSProperties}><span className="hub-card-orbit orbit-1"/><span className="hub-card-orbit orbit-2"/><span className="hub-card-symbol">{h.emoji}</span><span className="hub-card-number">S / {String(h.name.length).padStart(2, '0')}</span><span className="hub-card-go"><Icon name="arrowUpRight" size={16}/></span></div>
        <div className="hub-card-info"><div className="hub-card-head"><h3>{h.name}</h3><span className="hub-online"><i/>{members.filter((x) => x.presence === 'online').length}</span></div><p>{h.about}</p><div className="hub-card-foot"><AvatarPile people={members} limit={4}/><span className="hub-activity">{last && author ? `${author.name} · ${fmtShort(last.ts, 'en')}` : `${members.length} ${t('members').toLowerCase()}`}</span></div></div>
      </button>;
    })}</div> : <div className="inline-empty"><div className="empty-mark">✳</div><p>{t('noHubs')}</p><button className="btn btn-secondary btn-small" onClick={onCreate}>{t('createHub')}</button></div>}
    <div className="hub-section-head discover-head"><h2>{t('browseHubs')}</h2><label className="mini-search"><Icon name="search" size={15}/><input placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)}/></label></div>
    {discover.length ? <div className="discover-list">{discover.map((h) => <div className="discover-row" key={h.id}><span className="discover-mark" style={{ '--hub-hue': h.hue } as React.CSSProperties}>{h.emoji}</span><div className="discover-copy"><h3>{h.name}</h3><p>{h.about}</p><small>{Object.keys(h.members).length} {t('members').toLowerCase()} · {t('hubCreatedBy', { name: db.users[h.ownerId]?.name ?? 'Sado' })}</small></div><button className="btn btn-outline btn-small" onClick={() => join(h)}><Icon name="plus" size={14}/>{t('joinHub')}</button></div>)}</div> : <p className="subtle-empty">{t('noPublicHubs')}</p>}
  </div>;
}

export function CreateHubModal({ open, onClose, user, onCreated }: { open: boolean; onClose: () => void; user: User; onCreated: (hub: Hub) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [emoji, setEmoji] = useState('✳');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault(); setError('');
    try { const h = makeHub({ userId: user.id, name, about, emoji, public: isPublic }); onCreated(h); setName(''); setAbout(''); onClose(); } catch (e) { setError(e instanceof AppError ? t(e.key) : t('err.generic')); }
  };
  return <Modal open={open} onClose={onClose} title={t('createHub')} subtitle={t('makeHubFirst')} size="md"><form className="stack-form" onSubmit={submit}>
    <label className="field-label">{t('hubName')}<input className="field-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.hubName} placeholder={t('hubName')}/></label>
    <label className="field-label">{t('hubAbout')}<textarea className="field-input field-textarea" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={LIMITS.hubAbout} placeholder={t('hubAbout')}/></label>
    <div className="field-label">{t('hubEmoji')}<div className="symbol-picker">{symbols.map((s, i) => <button key={`${s}${i}`} type="button" className={`symbol-option ${emoji === s ? 'picked' : ''}`} onClick={() => setEmoji(s)}>{s}</button>)}</div></div>
    <div className="field-label">{t('hubPrivacy')}<div className="segmented-choice"><button type="button" className={isPublic ? 'selected' : ''} onClick={() => setIsPublic(true)}>{t('publicHub')}</button><button type="button" className={!isPublic ? 'selected' : ''} onClick={() => setIsPublic(false)}>{t('privateHub')}</button></div></div>
    {error && <div className="inline-error" role="alert"><Icon name="info" size={15}/>{error}</div>}
    <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button><button type="submit" className="btn btn-primary"><Icon name="plus" size={15}/>{t('create')}</button></div>
  </form></Modal>;
}

export function PeoplePage({ db, user, onChat }: { db: DB; user: User; onChat: (id: string) => void }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const list = useMemo(() => Object.values(db.users).filter((p) => p.id !== user.id && !p.bot && `${p.name} ${p.username}`.toLowerCase().includes(q.toLowerCase())), [db.users, user.id, q]);
  const botList = useMemo(() => Object.values(db.users).filter((p) => p.bot && `${p.name} ${p.username}`.toLowerCase().includes(q.toLowerCase())), [db.users, q]);
  const others = [...list, ...botList];
  return <div className="page-content people-page">
    <div className="page-heading"><div><div className="eyebrow">THE GOOD PEOPLE</div><h1>{t('people')}</h1><p>{t('welcomeSub')}</p></div><label className="page-search"><Icon name="search" size={17}/><input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}/></label></div>
    {others.length ? <div className="people-list">{others.map((p) => <button key={p.id} className="person-card" onClick={() => onChat(p.id)}><Avatar user={p} size="lg" showStatus/><div className="person-card-info"><h3>{p.name}{p.aura && <span className="aura-inline"><Icon name="spark" size={10}/> AURA</span>}</h3><small>@{p.username}</small><p>{p.statusText || p.bio || t('welcomeSub')}</p></div><span className="person-presence"><i className={`status-mini status-${p.presence}`}/>{t(p.presence)}</span><Icon name="chevron" size={16}/></button>)}</div> : <div className="inline-empty"><div className="empty-mark">◎</div><p>{t('noPeople')}</p></div>}
    <p className="demo-helper">{t('demoNote')}</p>
  </div>;
}
