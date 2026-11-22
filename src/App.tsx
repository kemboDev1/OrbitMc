import { useEffect, useMemo, useState } from 'react';
import type { DB, Hub, User } from './data/types';
import { db } from './data/db';
import { session } from './data/session';
import { signOut } from './data/auth';
import { startDM, setPresence } from './data/chat';
import { AppError } from './data/errors';
import { joinInvite } from './data/hubs';
import { hasAura } from './data/market';
import { useI18n, language } from './i18n';
import { prefs, themeMode } from './lib/prefs';
import { registerServiceWorker } from './lib/pwa';
import { fmtShort, inkFor } from './lib/util';
import type { IconName } from './components/Icons';
import { Icon } from './components/Icons';
import { Avatar, AvatarPile } from './components/Avatar';
import { BrandMark } from './components/AuthScreen';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { ChatScreen } from './components/ChatScreen';
import { HubPage, CreateHubModal, PeoplePage } from './components/HubPages';
import { BazaarPage } from './components/BazaarPage';
import { AuraPage } from './components/AuraPage';
import { SettingsPage } from './components/SettingsPage';
import { SearchModal } from './components/SearchModal';
import { Modal } from './components/Modal';
import { ToastHost, tell } from './components/Toast';

export type View = 'chats' | 'hubs' | 'bazaar' | 'aura' | 'people' | 'settings';
const navItems: { key: View; icon: IconName }[] = [
  { key: 'chats', icon: 'chat' }, { key: 'hubs', icon: 'grid' }, { key: 'bazaar', icon: 'market' }, { key: 'aura', icon: 'spark' }, { key: 'people', icon: 'people' },
];

export default function App() {
  const data = db.use();
  const currentSession = session.use();
  const pref = prefs.use();
  const theme = themeMode.use();
  const lang = language.use();
  const { t } = useI18n();
  const user = currentSession ? data.users[currentSession.userId] : undefined;
  const [view, setView] = useState<View>('chats');
  const [authOpen, setAuthOpen] = useState(false);
  const [channel, setChannel] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newHubOpen, setNewHubOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteValue, setInviteValue] = useState('');
  const [profileMenu, setProfileMenu] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');

  useEffect(() => { registerServiceWorker(); }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang, user?.id]);

  useEffect(() => {
    if (!user || channel) return;
    const dm = data.dms[user.id]?.[0];
    const firstJoinedHub = Object.values(data.hubs).find((h) => !!h.members[user.id]);
    setChannel(dm ?? firstJoinedHub?.rooms[0]?.id ?? startDM(user.id, 'u_mila'));
  }, [user?.id, channel, data.dms, data.hubs]);

  useEffect(() => {
    if (!user) return;
    const handleProfile = (e: Event) => setProfileTarget((e as CustomEvent<string>).detail);
    const handleInvite = (e: Event) => { setInviteValue((e as CustomEvent<string>).detail ?? ''); setInviteOpen(true); };
    window.addEventListener('sado:profile', handleProfile);
    window.addEventListener('sado:invite', handleInvite);
    const pathInvite = window.location.pathname.match(/^\/invite\/([a-z0-9]+)\/?$/i);
    if (pathInvite) { setInviteValue(pathInvite[1]); setInviteOpen(true); }
    return () => { window.removeEventListener('sado:profile', handleProfile); window.removeEventListener('sado:invite', handleInvite); };
  }, [user?.id]);

  const contacts = useMemo(() => Object.values(data.users).filter((p) => p.id !== user?.id).sort((a, b) => Number(b.presence === 'online') - Number(a.presence === 'online')), [data.users, user?.id]);
  const recentDms = useMemo(() => (data.dms[user?.id ?? ''] ?? []).map((id) => {
    const [a, b] = id.split(':').slice(1);
    const otherId = a === user?.id ? b : a;
    const person = data.users[otherId] ?? user;
    const messages = data.msgs[id] ?? [];
    const last = messages.at(-1);
    const unseen = last && last.by !== user?.id && last.ts > (data.reads[user?.id ?? '']?.[id] ?? 0);
    return { id, person, last, unseen };
  }).filter((x) => !!x.person).sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0)), [data.dms, data.msgs, data.reads, data.users, user?.id]);
  const joinedHubs = useMemo(() => Object.values(data.hubs).filter((h) => !!h.members[user?.id ?? '']), [data.hubs, user?.id]);
  const direct = channel?.startsWith('dm:') ?? false;
  const marketTheme = user?.theme ? data.listings[user.theme]?.theme : undefined;
  const activeAccent = marketTheme?.accent ?? user?.accent ?? undefined;
  const appStyle = {
    '--bg': marketTheme?.bg, '--side': marketTheme?.panel, '--panel': marketTheme?.panel, '--raised': marketTheme?.raised,
    '--raised-2': marketTheme?.line, '--line': marketTheme?.line, '--line-soft': marketTheme?.line,
    '--accent': activeAccent, '--accent-ink': activeAccent ? inkFor(activeAccent) : undefined,
    '--theme-bg': marketTheme?.bg, '--theme-panel': marketTheme?.panel,
    '--theme-raised': marketTheme?.raised, '--theme-border': marketTheme?.line, '--theme-accent': marketTheme?.accent,
  } as React.CSSProperties;
  const title = t(view);

  const toView = (next: View) => { setView(next); setProfileMenu(false); };
  const pickUser = (person: User) => {
    if (!user) return;
    const next = startDM(user.id, person.id);
    setChannel(next); setView('chats'); setNewChatOpen(false);
  };
  const openHub = (h: Hub, room?: string) => {
    if (!user) return;
    if (!h.members[user.id]) {
      tell(t('joinHub'), 'info');
      return;
    }
    setChannel(room ?? h.rooms[0]?.id ?? null); setView('chats');
  };
  const newHub = () => setNewHubOpen(true);
  const markSignedOut = () => { setChannel(null); setView('chats'); setProfileMenu(false); };

  if (!user) return <>{authOpen ? <AuthScreen initial="signin" onCancel={() => setAuthOpen(false)} onDone={() => { setAuthOpen(false); setView('chats'); setChannel(null); }}/> : <LandingPage onEnter={() => setAuthOpen(true)}/>}<ToastHost/></>;

  const signOutNow = () => { signOut(); markSignedOut(); };
  const nav = (item: {key: View; icon: IconName}, compact = false) => <button key={item.key} aria-label={t(item.key)} title={compact ? t(item.key) : undefined} className={`nav-link ${view === item.key ? 'active' : ''} ${compact ? 'rail-link' : ''}`} onClick={() => toView(item.key)}><span className="nav-icon"><Icon name={item.icon} size={19}/>{item.key === 'chats' && recentDms.some((x) => x.unseen) && <i className="nav-unread"/>}</span>{!compact && <span>{t(item.key)}</span>}{compact && view === item.key && <i className="rail-active-dot"/>}</button>;

  return <div className={`app-shell ${pref.density === 'compact' ? 'density-compact' : ''}`} data-color-theme={marketTheme ? (marketTheme.dark ? 'dark' : 'light') : undefined} style={appStyle}>
    <aside className="icon-rail">
      <button className="rail-logo" aria-label={t('brand')} title={t('brand')} onClick={() => toView('chats')}><BrandMark/></button>
      <span className="rail-divider"/>
      <nav className="rail-nav" aria-label={t('brand')}>{navItems.map((item) => nav(item, true))}</nav>
      <div className="rail-bottom"><button className={`nav-link rail-link ${view === 'settings' ? 'active' : ''}`} aria-label={t('settings')} title={t('settings')} onClick={() => toView('settings')}><span className="nav-icon"><Icon name="gear" size={19}/></span>{view === 'settings' && <i className="rail-active-dot"/>}</button><button className={`rail-user ${profileMenu ? 'active' : ''}`} aria-label={t('profile')} onClick={() => { setStatusDraft(user.statusText); setProfileMenu((v) => !v); }}><Avatar user={user} size="sm" showStatus/></button></div>
    </aside>

    <aside className="side-panel">
      <div className="side-brand-row"><button className="wordmark" onClick={() => toView('chats')}><BrandMark/><span>SADO</span><Icon name="down" size={14}/></button><button className="side-search-button" onClick={() => window.dispatchEvent(new CustomEvent('sado:search', { detail: {} }))} aria-label={t('openSearch')} title={t('openSearch')}><Icon name="search" size={16}/><span>{t('search')}</span><kbd>⌘K</kbd></button></div>
      <div className="side-scroll">
        <section className="side-primary-links">{navItems.map((item) => nav(item))}</section>
        <section className="side-list-section"><div className="side-section-title"><span>{t('directSection')}</span><button aria-label={t('newMessage')} title={t('newMessage')} onClick={() => setNewChatOpen(true)}><Icon name="plus" size={15}/></button></div>
          {recentDms.map((item) => item.person && <button className={`dm-list-row ${channel === item.id && view === 'chats' ? 'selected' : ''}`} key={item.id} onClick={() => { setChannel(item.id); setView('chats'); }}><Avatar user={item.person} size="sm" showStatus/><span className="dm-list-copy"><b>{item.person.name}</b><small>{item.last?.text || item.last?.sticker || t('savedDM')}</small></span>{item.unseen && <i className="unread-dot"/>}{item.last && <time>{fmtShort(item.last.ts, lang)}</time>}</button>)}
          {recentDms.length === 0 && <button className="side-empty-link" onClick={() => setNewChatOpen(true)}>{t('noChats')} <Icon name="plus" size={14}/></button>}
        </section>
        <section className="side-list-section"><div className="side-section-title"><span>{t('yourHubs')}</span><button aria-label={t('createHub')} title={t('createHub')} onClick={newHub}><Icon name="plus" size={15}/></button></div>
          {joinedHubs.map((h) => {
            const active = !direct && channel && h.rooms.some((r) => r.id === channel);
            const members = Object.keys(h.members).map((id) => data.users[id]).filter(Boolean);
            return <div className={`hub-side-row ${active ? 'selected' : ''}`} key={h.id}><button className="hub-side-main" onClick={() => openHub(h)}><span className="hub-side-symbol" style={{ '--hub-hue': h.hue } as React.CSSProperties}>{h.emoji}</span><span className="hub-side-copy"><b>{h.name}</b><small>{members.filter((p) => p.presence === 'online').length} {t('onlineNow')}</small></span><Icon name="chevron" size={14}/></button>{active && <div className="hub-side-rooms">{h.rooms.slice(0, 4).map((room) => <button key={room.id} className={`hub-room-short ${channel === room.id ? 'active' : ''}`} onClick={() => setChannel(room.id)}><span>#</span>{room.name}</button>)}{h.rooms.length > 4 && <button className="hub-room-short" onClick={() => openHub(h)}><span>···</span>{h.rooms.length - 4}+</button>}</div>}</div>;
          })}
          {joinedHubs.length === 0 && <button className="side-empty-link" onClick={() => toView('hubs')}>{t('noHubs')} <Icon name="arrowUpRight" size={13}/></button>}
        </section>
        <button className="invite-side-card" onClick={() => { setInviteValue(''); setInviteOpen(true); }}><span className="invite-icon"><Icon name="spark" size={16}/></span><span><b>{t('invite')}</b><small>{t('discoverHubs')}</small></span><Icon name="arrowUpRight" size={15}/></button>
      </div>
      <div className="side-local-note"><span className="local-indicator"/><span>{t('demoNote')}</span></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-title"><span className="topbar-location">SADO&nbsp; / &nbsp;{view === 'chats' ? t('chat') : title}</span><h1>{view === 'chats' ? channel?.startsWith('dm:') ? data.users[channel.split(':').filter(Boolean).at(-1) ?? '']?.name ?? t('chat') : Object.values(data.hubs).flatMap((h) => h.rooms.map((r) => ({ r, h }))).find((x) => x.r.id === channel)?.h.name ?? t('chat') : title}</h1></div><div className="topbar-actions"><button className="icon-btn header-search" aria-label={t('openSearch')} title={t('openSearch')} onClick={() => window.dispatchEvent(new CustomEvent('sado:search', { detail: {} }))}><Icon name="search" size={18}/></button>{view === 'chats' && <button className="btn btn-primary btn-small top-new-chat" onClick={() => setNewChatOpen(true)}><Icon name="plus" size={15}/><span>{t('newMessage')}</span></button>}{view === 'hubs' && <button className="btn btn-primary btn-small" onClick={newHub}><Icon name="plus" size={15}/><span>{t('createHub')}</span></button>}{view === 'bazaar' && <button className="btn btn-primary btn-small" onClick={() => window.dispatchEvent(new CustomEvent('sado:market-create'))}><Icon name="plus" size={15}/><span>{t('makeListing')}</span></button>}<button className="top-profile-button" onClick={() => { setStatusDraft(user.statusText); setProfileMenu((v) => !v); }} aria-label={t('profile')}><Avatar user={user} size="sm" showStatus/></button></div></header>
      <div className="view-stage" key={view}>
        {view === 'chats' && <ChatScreen db={data} user={user} channel={channel} setChannel={setChannel} onStartChat={() => setNewChatOpen(true)} onNewHub={newHub}/>}
        {view === 'hubs' && <HubPage db={data} user={user} onOpen={openHub} onCreate={newHub}/>}
        {view === 'people' && <PeoplePage db={data} user={user} onChat={(id) => pickUser(data.users[id])}/>}
        {view === 'bazaar' && <BazaarPage db={data} user={user}/>}
        {view === 'aura' && <AuraPage user={user}/>}
        {view === 'settings' && <SettingsPage user={user} onSignedOut={markSignedOut}/>}
      </div>
      <nav className="mobile-nav" aria-label={t('brand')}>{navItems.map((item) => <button key={item.key} className={view === item.key ? 'active' : ''} aria-label={t(item.key)} onClick={() => toView(item.key)}><Icon name={item.icon} size={20}/><span>{t(item.key)}</span></button>)}<button className={view === 'settings' ? 'active' : ''} onClick={() => toView('settings')} aria-label={t('settings')}><Icon name="gear" size={19}/><span>{t('settings')}</span></button></nav>
    </main>

    {profileMenu && <><button className="menu-dismiss" aria-label={t('cancel')} onClick={() => setProfileMenu(false)}/><div className="account-popover"><div className="account-popover-head"><Avatar user={user} size="md"/><span><b>{user.name}</b><small>@{user.username}</small></span><span className="account-plan">{hasAura(user.id) ? <Icon name="spark" size={12}/> : null}{hasAura(user.id) ? user.aura?.tier.toUpperCase() : t('auraFree')}</span></div><div className="status-editor"><label className="field-label">{t('setStatus')}<input className="field-input" value={statusDraft} maxLength={60} placeholder={t('statusPlaceholder')} onChange={(e) => setStatusDraft(e.target.value)}/></label><div><button className="text-action" onClick={() => { setPresence(user.id, user.presence, statusDraft); tell(t('statusSaved'), 'good'); }}>{t('applyStatus')}</button><button className="text-action" onClick={() => { setStatusDraft(''); setPresence(user.id, user.presence, ''); tell(t('statusSaved'), 'good'); }}>{t('clearStatus')}</button></div></div><div className="presence-picker"><span>{t('setPresence')}</span>{(['online','idle','dnd','offline'] as User['presence'][]).map((p) => <button key={p} className={user.presence === p ? 'active' : ''} onClick={() => { db.transaction((d) => { const u = d.users[user.id]; if (u) u.presence = p; }); setProfileMenu(false); }}><i className={`status-mini status-${p}`}/>{t(p)}{user.presence === p && <Icon name="check" size={13}/>}</button>)}</div><div className="account-popover-links"><button onClick={() => { setProfileMenu(false); toView('settings'); }}><Icon name="gear" size={15}/>{t('settings')}</button><button onClick={() => { setProfileMenu(false); toView('aura'); }}><Icon name="spark" size={15}/>{t('aura')}</button><button className="signout-action" onClick={signOutNow}><Icon name="back" size={15}/>{t('signOut')}</button></div></div></>}

    <Modal open={newChatOpen} onClose={() => setNewChatOpen(false)} title={t('newMessage')} subtitle={t('welcomeSub')} size="sm"><div className="new-chat-list"><label className="mini-search"><Icon name="search" size={15}/><input autoFocus placeholder={t('search')} onChange={(e) => { const q = e.target.value.toLowerCase(); document.querySelectorAll<HTMLButtonElement>('.new-chat-contact').forEach((el) => { el.hidden = !el.dataset.search?.includes(q); }); }}/></label>{contacts.map((p) => <button className="new-chat-contact" data-search={`${p.name} ${p.username}`.toLowerCase()} key={p.id} onClick={() => pickUser(p)}><Avatar user={p} size="sm" showStatus/><span><b>{p.name}</b><small>{p.bot ? t('botDisclosure') : `@${p.username}`}</small></span><Icon name="arrowUpRight" size={15}/></button>)}</div><p className="modal-demo-note">{t('botDisclosure')}</p></Modal>

    <CreateHubModal open={newHubOpen} onClose={() => setNewHubOpen(false)} user={user} onCreated={(h) => { tell(t('hubCreated'), 'good'); openHub(h); }}/>

    <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('invite')} subtitle={t('pasteInvite')} size="sm"><form className="stack-form" onSubmit={(e) => { e.preventDefault(); try { const token = inviteValue.trim().split('/').filter(Boolean).at(-1) ?? ''; const h = joinInvite(token, user.id); if (!h) throw new AppError('err.inviteInvalid'); setInviteOpen(false); setInviteValue(''); openHub(h); tell(t('hubJoined'), 'good'); } catch (e) { tell(e instanceof AppError ? t(e.key) : t('err.generic'), 'bad'); } }}><p className="modal-explainer">{t('botDisclosure')}</p><label className="field-label">{t('invite')}<input autoFocus className="field-input" value={inviteValue} onChange={(e) => setInviteValue(e.target.value)} placeholder="sado.app/invite/…"/></label><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setInviteOpen(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary"><Icon name="arrowUpRight" size={14}/>{t('joinHub')}</button></div></form></Modal>

    <SearchModal db={data} user={user} onSelect={(id) => { setChannel(id); setView('chats'); }}/>
    <Modal open={!!profileTarget} onClose={() => setProfileTarget(null)} title={t('profile')} subtitle={profileTarget ? `@${data.users[profileTarget]?.username ?? ''}` : ''} size="sm">{profileTarget && data.users[profileTarget] && <div className="profile-modal-card"><div className="profile-modal-cover" style={{ '--cover-hue': data.users[profileTarget].hue } as React.CSSProperties}/><Avatar user={data.users[profileTarget]} size="xl" showStatus/><h2>{data.users[profileTarget].name}</h2><p>@{data.users[profileTarget].username}</p><p>{data.users[profileTarget].bio || data.users[profileTarget].statusText}</p><button className="btn btn-primary btn-full" onClick={() => { pickUser(data.users[profileTarget]); setProfileTarget(null); }}><Icon name="chat" size={15}/>{t('dmFrom')}</button></div>}</Modal>
    <ToastHost/>
  </div>;
}

