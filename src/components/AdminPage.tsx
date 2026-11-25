import { useEffect, useState } from 'react';
import { listAdminFeedback, listAdminProfiles, setFeedbackStatus, type AdminProfile, type FeedbackItem } from '../data/admin';
import { useI18n } from '../i18n';
import { Icon } from './Icons';
import { tell } from './Toast';

export function AdminPage({ onBack }: { onBack: () => void }) {
  const { t, lang } = useI18n();
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [tab, setTab] = useState<'feedback' | 'people'>('feedback');
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState('');
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
  return <section className="admin-page">
    <header className="admin-heading"><div><span className="eyebrow">{t('adminEyebrow')}</span><h1>{t('adminTitle')}</h1><p>{t('adminPrivacy')}</p></div><button className="btn btn-secondary btn-small" onClick={onBack}><Icon name="back" size={14}/>{t('backToApp')}</button></header>
    <div className="admin-metrics"><article><span>{t('adminMembers')}</span><b>{profiles.length}</b></article><article><span>{t('adminNewFeedback')}</span><b>{feedback.filter((item) => item.status === 'new').length}</b></article><article><span>{t('adminReviewed')}</span><b>{feedback.filter((item) => item.status === 'done').length}</b></article></div>
    <div className="admin-tabs"><button className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}>{t('feedbackInbox')}</button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>{t('adminPeople')}</button><button className="icon-btn" aria-label={t('refresh')} onClick={() => void refresh()}><Icon name="refresh" size={15}/></button></div>
    {busy ? <div className="admin-loading"><span className="spinner"/>{t('loading')}</div> : tab === 'feedback' ? <div className="feedback-list">{feedback.length ? feedback.map((item) => <article className="feedback-card" key={item.id}><div className="feedback-card-head"><span className="feedback-category">{t(`feedback${item.category[0].toUpperCase()}${item.category.slice(1)}`)}</span><time>{new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</time></div><p>{item.body}</p><div className="feedback-card-foot"><span>@{item.username} · {item.display_name}</span><select aria-label={t('feedbackStatus')} value={item.status} onChange={(event) => void updateStatus(item, event.target.value as FeedbackItem['status'])}><option value="new">{t('feedbackNew')}</option><option value="reviewing">{t('feedbackReviewing')}</option><option value="done">{t('feedbackDone')}</option></select></div></article>) : <div className="inline-empty"><p>{t('feedbackEmpty')}</p></div>}</div> : <div className="admin-people"><label className="market-search"><Icon name="search" size={15}/><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('search')}/></label><div className="admin-table">{filtered.map((person) => <div className="admin-person" key={person.id}><span className="admin-person-avatar">{person.display_name.trim().slice(0, 1).toUpperCase()}</span><span><b>{person.display_name}</b><small>@{person.username}</small></span><span className="admin-person-presence">{t(person.presence in { online: 1, idle: 1, dnd: 1, offline: 1 } ? person.presence as 'online' | 'idle' | 'dnd' | 'offline' : 'offline')}</span><time>{new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(new Date(person.created_at))}</time></div>)}</div></div>}
  </section>;
}
