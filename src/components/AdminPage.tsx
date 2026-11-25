import { useEffect, useState } from 'react';
import { listAdminFeedback, listAdminProfiles, setFeedbackStatus, type AdminProfile, type FeedbackItem } from '../data/admin';
import { useI18n } from '../i18n';
import { Icon } from './Icons';
import { tell } from './Toast';
import type { DB, User } from '../data/types';
import { setHubMemberRole } from '../data/hubs';

export function AdminPage({ onBack, db, user }: { onBack: () => void; db: DB; user: User }) {
  const { t, lang } = useI18n();
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [tab, setTab] = useState<'feedback' | 'people' | 'roles'>('feedback');
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedHub, setSelectedHub] = useState('');
  const [roleBusy, setRoleBusy] = useState('');
  const ownedHubs = Object.values(db.hubs).filter((hub) => hub.ownerId === user.id);
  const activeHub = ownedHubs.find((hub) => hub.id === selectedHub) ?? ownedHubs[0];
  const refresh = async () => {
    setBusy(true);
    try {
      const [people, notes] = await Promise.all([listAdminProfiles(), listAdminFeedback()]);
      setProfiles(people); setFeedback(notes);
    } catch { tell(t('err.backendUnavailable'), 'bad'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const updateStatus = async (item: FeedbackItem, status: FeedbackItem['status']) => {
    try { await setFeedbackStatus(item.id, status); setFeedback((items) => items.map((entry) => entry.id === item.id ? { ...entry, status } : entry)); }
    catch { tell(t('err.saveFailed'), 'bad'); }
  };
  const filtered = profiles.filter((profile) => `${profile.username} ${profile.display_name}`.toLowerCase().includes(filter.toLowerCase()));
  const changeRole = async (memberId: string, current: 'owner' | 'mod' | 'member') => {
    if (!activeHub || current === 'owner' || roleBusy) return;
    setRoleBusy(memberId);
    try { await setHubMemberRole(activeHub.id, user.id, memberId, current === 'mod' ? 'member' : 'mod'); tell(t('roleSaved'), 'good'); }
    catch { tell(t('err.saveFailed'), 'bad'); }
    finally { setRoleBusy(''); }
  };
  return <section className="admin-page">
    <header className="admin-heading"><div><span className="eyebrow">{t('adminEyebrow')}</span><h1>{t('adminTitle')}</h1><p>{t('adminPrivacy')}</p></div><button className="btn btn-secondary btn-small" onClick={onBack}><Icon name="back" size={14}/>{t('backToApp')}</button></header>
    <div className="admin-metrics"><article><span>{t('adminMembers')}</span><b>{profiles.length}</b></article><article><span>{t('adminNewFeedback')}</span><b>{feedback.filter((item) => item.status === 'new').length}</b></article><article><span>{t('adminReviewed')}</span><b>{feedback.filter((item) => item.status === 'done').length}</b></article></div>
    <div className="admin-tabs"><button className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}>{t('feedbackInbox')}</button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>{t('adminPeople')}</button><button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>{t('communityRoles')}</button><button className="icon-btn" aria-label={t('refresh')} onClick={() => void refresh()}><Icon name="refresh" size={15}/></button></div>
    {busy ? <div className="admin-loading"><span className="spinner"/>{t('loading')}</div> : tab === 'feedback' ? <div className="feedback-list">{feedback.length ? feedback.map((item) => <article className="feedback-card" key={item.id}><div className="feedback-card-head"><span className="feedback-category">{t(`feedback${item.category[0].toUpperCase()}${item.category.slice(1)}`)}</span><time>{new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</time></div><p>{item.body}</p><div className="feedback-card-foot"><span>@{item.username} · {item.display_name}</span><select aria-label={t('feedbackStatus')} value={item.status} onChange={(event) => void updateStatus(item, event.target.value as FeedbackItem['status'])}><option value="new">{t('feedbackNew')}</option><option value="reviewing">{t('feedbackReviewing')}</option><option value="done">{t('feedbackDone')}</option></select></div></article>) : <div className="inline-empty"><p>{t('feedbackEmpty')}</p></div>}</div> : tab === 'roles' ? <div className="admin-roles"><header><div><h2>{t('communityRoles')}</h2><p>{t('communityRolesHelp')}</p></div>{ownedHubs.length > 0 && <select className="sort-select" aria-label={t('chooseCommunity')} value={activeHub?.id ?? ''} onChange={(event) => setSelectedHub(event.target.value)}>{ownedHubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.emoji} {hub.name}</option>)}</select>}</header>{!activeHub ? <div className="inline-empty"><p>{t('noOwnedCommunities')}</p></div> : <div className="admin-table">{Object.entries(activeHub.members).map(([memberId, role]) => { const member = db.users[memberId]; if (!member) return null; return <div className="admin-person admin-role-person" key={memberId}><span className="admin-person-avatar">{member.name.slice(0, 1).toUpperCase()}</span><span><b>{member.name}</b><small>@{member.username}</small></span><span className={`role-badge role-${role}`}>{t(role === 'mod' ? 'moderator' : role === 'owner' ? 'owner' : 'member')}</span>{role !== 'owner' && <button className="btn btn-outline btn-small" disabled={roleBusy === memberId} onClick={() => void changeRole(memberId, role as 'mod' | 'member')}>{t(role === 'mod' ? 'removeModerator' : 'assignModerator')}</button>}</div>; })}</div>}</div> : <div className="admin-people"><label className="market-search"><Icon name="search" size={15}/><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('search')}/></label><div className="admin-table">{filtered.map((person) => <div className="admin-person" key={person.id}><span className="admin-person-avatar">{person.display_name.trim().slice(0, 1).toUpperCase()}</span><span><b>{person.display_name}</b><small>@{person.username}</small></span><span className="admin-person-presence">{t(person.presence in { online: 1, idle: 1, dnd: 1, offline: 1 } ? person.presence as 'online' | 'idle' | 'dnd' | 'offline' : 'offline')}</span><time>{new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(new Date(person.created_at))}</time></div>)}</div></div>}
  </section>;
}
