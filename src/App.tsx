import { useEffect, useMemo, useState } from 'react';
import { BellOff, ExternalLink } from 'lucide-react';
import type { Hub, User } from './data/types';
import { db } from './data/db';
import { session } from './data/session';
import { restoreSession, signOut } from './data/auth';
import { isAdminUser } from './data/admin';
import { subscribeRemoteWorkspace, syncRemoteBlocks, syncRemoteHubMessages, syncRemoteHubs, syncRemoteMarket } from './data/cloud';
import { startDM, setPresence } from './data/chat';
import { AppError } from './data/errors';
import { joinInvite } from './data/hubs';
import { hasAura, checkAndAwardXpMilestones } from './data/market';
import { useI18n, language } from './i18n';
import { prefs, themeMode } from './lib/prefs';
import { isStandalone, registerServiceWorker } from './lib/pwa';
import { fmtShort, inkFor } from './lib/util';
import type { IconName } from './components/Icons';
import { Icon } from './components/Icons';
import { Avatar } from './components/Avatar';
import { BrandMark } from './components/BrandMark';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { ChatScreen } from './components/ChatScreen';
import { HubPage, CreateHubModal, PeoplePage } from './components/HubPages';
import { BazaarPage } from './components/BazaarPage';
import { AuraPage } from './components/AuraPage';
import { SettingsPage } from './components/SettingsPage';
import { AdminPage } from './components/AdminPage';
import { SearchModal } from './components/SearchModal';
import { Modal } from './components/Modal';
import { ProfileExplorerContent } from './components/ProfileExplorer';
import { StudioView } from './components/StudioView';
import { ToastHost, tell } from './components/Toast';
import { isDesktop } from './lib/electron';
import { useChatControls } from './data/chatControls';
import { HubSymbol } from './components/VectorAssets';
import { STUDIO_URL } from './config';

export type View = 'chats' | 'hubs' | 'bazaar' | 'aura' | 'people' | 'settings' | 'admin' | 'studio';
type ChatFolder = 'all' | 'direct' | 'hubs' | 'unread';

export default function App() {
  const data = db.use();
  const currentSession = session.use();
  const pref = prefs.use();
  const chatControls = useChatControls(currentSession?.userId ?? '');
  themeMode.use();
  const lang = language.use();
  const { t } = useI18n();
  const user = currentSession ? data.users[currentSession.userId] : undefined;
  const adminVisible = isAdminUser(user);
  const [view, setView] = useState<View>('chats');
  const [folder, setFolder] = useState<ChatFolder>('all');
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [channel, setChannel] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newHubOpen, setNewHubOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteValue, setInviteValue] = useState('');
  const [profileMenu, setProfileMenu] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const navItems: { key: View; icon: IconName }[] = useMemo(() => {
    const base: { key: View; icon: IconName }[] = [
      { key: 'chats', icon: 'chat' },
      { key: 'hubs', icon: 'grid' },
      { key: 'bazaar', icon: 'market' },
      { key: 'aura', icon: 'spark' },
      { key: 'people', icon: 'people' },
    ];
    if (adminVisible) base.push({ key: 'admin', icon: 'shield' });
    return base;
  }, [adminVisible]);

  useEffect(() => { registerServiceWorker(); }, []);
  useEffect(() => {
    let active = true;
    void restoreSession().catch((error: unknown) => {
      if (active) setRestoreError(error instanceof AppError ? t(error.key) : t('err.generic'));
    }).finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user?.serverBacked) return;
    const unsubscribe = subscribeRemoteWorkspace(user.id, (error) => {
      console.error('Realtime sync failed', error);
      tell(t('err.backendUnavailable'), 'bad');
    });
    const refreshBlocks = () => {
      if (document.visibilityState === 'visible') void Promise.all([syncRemoteBlocks(user.id), syncRemoteMarket(user.id), syncRemoteHubs(user.id).then(() => syncRemoteHubMessages(user.id))]).catch(() => tell(t('err.backendUnavailable'), 'bad'));
    };
    window.addEventListener('focus', refreshBlocks);
    document.addEventListener('visibilitychange', refreshBlocks);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshBlocks);
      document.removeEventListener('visibilitychange', refreshBlocks);
    };
  }, [user?.id, user?.serverBacked]);

  useEffect(() => {
    if (!user?.serverBacked || user.presence !== 'offline') {
      setPresenceBusy(false);
      return;
    }
    let active = true;
    setPresenceBusy(true);
    void Promise.resolve(setPresence(user.id, 'online')).catch((error: unknown) => {
      console.error('Presence update failed', error);
      tell(t('err.backendUnavailable'), 'bad');
    }).finally(() => {
      if (active) setPresenceBusy(false);
    });
    return () => { active = false; };
  }, [user?.id, user?.serverBacked]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang, user?.id]);

  useEffect(() => {
    if (!user || channel) return;
    const dm = data.dms[user.id]?.[0];
    const firstJoinedHub = Object.values(data.hubs).find((h) => !!h.members[user.id]);
    setChannel(dm ?? firstJoinedHub?.rooms[0]?.id ?? null);
  }, [user?.id, channel, data.dms, data.hubs]);

  useEffect(() => {
    if (!user) return;
    const unlocked = checkAndAwardXpMilestones(user.id);
    if (unlocked.length > 0) {
      tell(t('xpMilestoneToast', { xp: unlocked[unlocked.length - 1] }), 'good');
    }
  }, [user?.id, user?.inventory.length, user?.giftsReceivedCount, user?.sparks, user?.aura?.tier]);

  useEffect(() => {
    if (!user) return;
    const handleProfile = (e: Event) => setProfileTarget((e as CustomEvent<string>).detail);
    const handleInvite = (e: Event) => { setInviteValue((e as CustomEvent<string>).detail ?? ''); setInviteOpen(true); };
    const handleNav = (e: Event) => { setView((e as CustomEvent<View>).detail); setMobileListOpen(false); };
    window.addEventListener('sado:profile', handleProfile);
    window.addEventListener('sado:invite', handleInvite);
    window.addEventListener('orbit:nav', handleNav);
    const pathInvite = window.location.pathname.match(/^\/invite\/([a-z0-9]+)\/?$/i);
    const queryInvite = new URLSearchParams(window.location.search).get('invite');
    if (pathInvite) { setInviteValue(pathInvite[1]); setInviteOpen(true); }
    else if (queryInvite) { setInviteValue(queryInvite); setInviteOpen(true); }
    return () => {
      window.removeEventListener('sado:profile', handleProfile);
      window.removeEventListener('sado:invite', handleInvite);
      window.removeEventListener('orbit:nav', handleNav);
    };
  }, [user?.id]);

  const contacts = useMemo(() => Object.values(data.users).filter((p) => (p.serverBacked || (!p.bot && p.id !== 'orbit-studio')) && p.id !== user?.id && !chatControls.blocked.includes(p.id)).sort((a, b) => Number(b.presence === 'online') - Number(a.presence === 'online')), [data.users, user?.id, chatControls.blocked]);
  const recentDms = useMemo(() => (data.dms[user?.id ?? ''] ?? []).map((id) => {
    const [a, b] = id.split(':').slice(1);
    const otherId = a === user?.id ? b : a;
    const person = data.users[otherId] ?? user;
    const messages = data.msgs[id] ?? [];
    const last = messages.at(-1);
    const unseen = !!(last && last.by !== user?.id && last.ts > (data.reads[user?.id ?? '']?.[id] ?? 0));
    return { id, person, last, unseen };
  }).filter((x) => !!x.person && !chatControls.blocked.includes(x.person.id)).sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0)), [data.dms, data.msgs, data.reads, data.users, user?.id, chatControls.blocked]);

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

  const toView = (next: View) => {
    if (next === 'chats' && view === 'chats') {
      setMobileListOpen((v) => !v);
    } else {
      setMobileListOpen(false);
    }
    setView(next);
    setProfileMenu(false);
  };

  const openAuth = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setAuthOpen(true);
  };

  const pickUser = (person: User) => {
    if (!user) return;
    if (chatControls.blocked.includes(person.id)) { tell(t('blockedConversationSub'), 'info'); return; }
    const next = startDM(user.id, person.id);
    setChannel(next);
    setView('chats');
    setNewChatOpen(false);
    setMobileListOpen(false);
  };

  const openHub = (h: Hub, room?: string) => {
    if (!user) return;
    if (!h.members[user.id]) {
      tell(t('joinHub'), 'info');
      return;
    }
    setChannel(room ?? h.rooms[0]?.id ?? null);
    setView('chats');
    setMobileListOpen(false);
  };

  const newHub = () => setNewHubOpen(true);
  const markSignedOut = () => { setChannel(null); setView('chats'); setProfileMenu(false); setMobileListOpen(false); };

  if (!authReady) {
    return (
      <main className="app-loading" role="status">
        <div className="loader-card">
          <div className="loader-orbit">
            <span className="loader-ring ring-a" />
            <span className="loader-ring ring-b" />
            <span className="loader-orbit-dot" />
            <BrandMark large />
          </div>
          <strong>ORBITMC</strong>
          <p>{t('loading')}</p>
          <div className="loader-bar"><span /></div>
        </div>
      </main>
    );
  }
  if (!user) return <>{restoreError && <div className="restore-notice" role="alert">{restoreError}</div>}{authOpen || isDesktop() || isStandalone() ? <AuthScreen initial="signin" onCancel={isDesktop() || isStandalone() ? undefined : () => setAuthOpen(false)} onDone={() => { setRestoreError(''); setAuthOpen(false); setView('chats'); setChannel(null); }} /> : <LandingPage onEnter={openAuth} />}<ToastHost /></>;

  const report = (error: unknown) => tell(error instanceof AppError ? t(error.key) : t('err.generic'), 'bad');
  const changePresence = async (next: User['presence']) => {
    setPresenceBusy(true);
    try { await setPresence(user.id, next); tell(t('presenceUpdated'), 'good'); setProfileMenu(false); }
    catch (error) { report(error); }
    finally { setPresenceBusy(false); }
  };
  const signOutNow = async () => { try { await signOut(); markSignedOut(); } catch (error) { report(error); } };

  const visibleDms = folder === 'hubs' ? [] : folder === 'unread' ? recentDms.filter((x) => x.unseen) : recentDms;
  const visibleHubs = folder === 'direct' ? [] : joinedHubs;
  const unreadCount = recentDms.filter((x) => x.unseen).length;
  const userIsPro = hasAura(user.id);
  const studioHref = `${STUDIO_URL}?tier=${user.aura?.tier ?? 'none'}&user=${encodeURIComponent(user.username)}`;

  const nav = (item: { key: View; icon: IconName }, compact = false) => (
    <button key={item.key} aria-label={t(item.key)} title={compact ? t(item.key) : undefined} className={`nav-link ${view === item.key ? 'active' : ''} ${compact ? 'rail-link' : ''}`} onClick={() => toView(item.key)}>
      <span className="nav-icon">
        <Icon name={item.icon} size={19} />
        {item.key === 'chats' && unreadCount > 0 && <i className="nav-unread" />}
      </span>
      {!compact && <span>{t(item.key)}</span>}
      {compact && view === item.key && <i className="rail-active-dot" />}
    </button>
  );

  return <div className={`app-shell ${pref.density === 'compact' ? 'density-compact' : ''} ${mobileListOpen ? 'mobile-list-open' : ''}`} data-color-theme={marketTheme ? (marketTheme.dark ? 'dark' : 'light') : undefined} style={appStyle}>
    {restoreError && <div className="restore-notice" role="alert">{restoreError}</div>}
    <aside className="icon-rail">
      <button className="rail-logo" aria-label={t('brand')} title={t('brand')} onClick={() => toView('chats')}><BrandMark /></button>
      <span className="rail-divider" />
      <nav className="rail-nav" aria-label={t('brand')}>{navItems.map((item) => nav(item, true))}</nav>
      <div className="rail-bottom">
        <button className={`nav-link rail-link ${view === 'settings' ? 'active' : ''}`} aria-label={t('settings')} title={t('settings')} onClick={() => toView('settings')}><span className="nav-icon"><Icon name="gear" size={19} /></span>{view === 'settings' && <i className="rail-active-dot" />}</button>
        <button className={`rail-user ${profileMenu ? 'active' : ''}`} aria-label={t('profile')} onClick={() => { setStatusDraft(user.statusText); setProfileMenu((v) => !v); }}><Avatar user={user} size="sm" showStatus /></button>
      </div>
    </aside>

    <aside className="side-panel">
      <div className="side-brand-row">
        <div className="side-brand-top">
          <button className="wordmark" onClick={() => toView('chats')}><BrandMark /><span>ORBITMC</span></button>
          <div className="side-top-actions">
            <button className="icon-btn mobile-close-drawer" aria-label={t('closeLabel')} onClick={() => setMobileListOpen(false)}><Icon name="close" size={16} /></button>
            <button className="side-user-chip" onClick={() => { setStatusDraft(user.statusText); setProfileMenu((v) => !v); }} aria-label={t('profile')}><Avatar user={user} size="xs" showStatus /></button>
          </div>
        </div>
        <button className="side-search-button" onClick={() => window.dispatchEvent(new CustomEvent('sado:search', { detail: {} }))} aria-label={t('openSearch')} title={t('openSearch')}><Icon name="search" size={16} /><span>{t('search')}</span><kbd>⌘K</kbd></button>
        <div className="folder-tabs" role="tablist" aria-label={t('folders')}>
          {([
            { id: 'all', label: t('allChats') },
            { id: 'direct', label: t('directSection').split(' ')[0] },
            { id: 'hubs', label: t('hubs') },
            { id: 'unread', label: t('unreadOnly') },
          ] as { id: ChatFolder; label: string }[]).map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={folder === tab.id} className={folder === tab.id ? 'active' : ''} onClick={() => setFolder(tab.id)}>
              {tab.label}{tab.id === 'unread' && unreadCount > 0 && <span className="folder-badge">{unreadCount}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="side-scroll">
        <section className="side-primary-links">{navItems.map((item) => nav(item))}</section>

        {folder !== 'hubs' && <section className="side-list-section">
          <div className="side-section-title"><span>{t('directSection')}</span><button aria-label={t('newMessage')} title={t('newMessage')} onClick={() => setNewChatOpen(true)}><Icon name="plus" size={15} /></button></div>
          {visibleDms.map((item) => item.person && <button className={`dm-list-row ${channel === item.id && view === 'chats' ? 'selected' : ''}`} key={item.id} onClick={() => { setChannel(item.id); setView('chats'); setMobileListOpen(false); }}>
            <Avatar user={item.person} size="sm" showStatus />
            <span className="dm-list-copy"><b>{item.person.name}{chatControls.muted.includes(item.person.id) && <BellOff size={11} className="muted-inline-icon" />}</b><small>{item.last?.text || item.last?.sticker || item.last?.poll?.question || t('savedDM')}</small></span>
            {item.unseen && <i className="unread-dot" />}
            {item.last && <time>{fmtShort(item.last.ts, lang)}</time>}
          </button>)}
          {visibleDms.length === 0 && <button className="side-empty-link" onClick={() => setNewChatOpen(true)}>{t('noChats')} <Icon name="plus" size={14} /></button>}
        </section>}

        {folder !== 'direct' && <section className="side-list-section">
          <div className="side-section-title"><span>{t('yourHubs')}</span><button aria-label={t('createHub')} title={t('createHub')} onClick={newHub}><Icon name="plus" size={15} /></button></div>
          {visibleHubs.map((h) => {
            const active = !direct && channel && h.rooms.some((r) => r.id === channel);
            const members = Object.keys(h.members).map((id) => data.users[id]).filter(Boolean);
            return <div className={`hub-side-row ${active ? 'selected' : ''}`} key={h.id}>
              <button className="hub-side-main" onClick={() => openHub(h)}>
                <span className="hub-side-symbol" style={{ '--hub-hue': h.hue } as React.CSSProperties}><HubSymbol mark={h.emoji} size={15} /></span>
                <span className="hub-side-copy"><b>{h.name}</b><small>{members.filter((p) => p.presence === 'online').length} {t('onlineNow')} · {h.rooms.length} {t('rooms').toLowerCase()}</small></span>
                <Icon name="chevron" size={14} />
              </button>
              {active && <div className="hub-side-rooms">{h.rooms.slice(0, 5).map((room) => <button key={room.id} className={`hub-room-short ${channel === room.id ? 'active' : ''}`} onClick={() => { setChannel(room.id); setMobileListOpen(false); }}><span>{room.kind === 'broadcast' ? <Icon name="megaphone" size={11} /> : '#'}</span>{room.name}</button>)}{h.rooms.length > 5 && <button className="hub-room-short" onClick={() => openHub(h)}><span>···</span>{h.rooms.length - 5}+</button>}</div>}
            </div>;
          })}
          {visibleHubs.length === 0 && <button className="side-empty-link" onClick={() => toView('hubs')}>{t('noHubs')} <Icon name="arrowUpRight" size={13} /></button>}
        </section>}

        <button className="invite-side-card" onClick={() => { setInviteValue(''); setInviteOpen(true); }}><span className="invite-icon"><Icon name="spark" size={16} /></span><span><b>{t('invite')}</b><small>{t('discoverHubs')}</small></span><Icon name="arrowUpRight" size={15} /></button>
      </div>
      <div className="side-local-note"><span className="local-indicator" /><span>{user.serverBacked ? t('demoNote') : t('demoModeBadge').split('—')[0]}</span></div>
    </aside>

    <main className="main-area">
      <div className="view-stage" key={view}>
        {view === 'chats' && <ChatScreen db={data} user={user} channel={channel} setChannel={setChannel} onStartChat={() => setNewChatOpen(true)} onOpenList={() => setMobileListOpen(true)} />}
        {view === 'hubs' && <HubPage db={data} user={user} onOpen={openHub} onCreate={newHub} />}
        {view === 'people' && <PeoplePage db={data} user={user} onChat={(id) => pickUser(data.users[id])} />}
        {view === 'bazaar' && <BazaarPage db={data} user={user} />}
        {view === 'aura' && <AuraPage user={user} />}
        {view === 'settings' && <SettingsPage user={user} onSignedOut={markSignedOut} />}
        {view === 'admin' && <AdminPage db={data} user={user} onOpenHub={openHub} />}
        {view === 'studio' && <StudioView user={user} db={data} onBackToShop={() => toView('bazaar')} />}
      </div>
      <nav className="mobile-nav" aria-label={t('brand')}>
        {navItems.slice(0, 5).map((item) => (
          <button key={item.key} className={view === item.key ? 'active' : ''} aria-label={t(item.key)} onClick={() => toView(item.key)}>
            <span className="nav-icon"><Icon name={item.icon} size={19} />{item.key === 'chats' && unreadCount > 0 && <i className="nav-unread" />}</span>
            <span>{t(item.key)}</span>
          </button>
        ))}
        <button className={view === 'settings' || view === 'admin' ? 'active' : ''} onClick={() => toView('settings')} aria-label={t('settings')}>
          <Icon name="gear" size={19} />
          <span>{t('settings')}</span>
        </button>
      </nav>
    </main>

    {profileMenu && <><button className="menu-dismiss" aria-label={t('cancel')} onClick={() => setProfileMenu(false)} /><div className="account-popover"><div className="account-popover-head"><Avatar user={user} size="md" /><span><b>{user.name}</b><small>@{user.username}</small></span><span className="account-plan">{userIsPro ? <Icon name="spark" size={12} /> : null}{userIsPro ? user.aura?.tier.toUpperCase() : t('auraFree')}</span></div><div className="status-editor"><label className="field-label">{t('setStatus')}<input className="field-input" value={statusDraft} maxLength={60} placeholder={t('statusPlaceholder')} onChange={(e) => setStatusDraft(e.target.value)} /></label><div><button className="text-action" disabled={presenceBusy} onClick={() => { void Promise.resolve(setPresence(user.id, user.presence, statusDraft)).then(() => tell(t('statusSaved'), 'good')).catch(report); }}>{t('applyStatus')}</button><button className="text-action" disabled={presenceBusy} onClick={() => { setStatusDraft(''); void Promise.resolve(setPresence(user.id, user.presence, '')).then(() => tell(t('statusSaved'), 'good')).catch(report); }}>{t('clearStatus')}</button></div></div><div className="presence-picker"><span>{t('setPresence')}</span>{(['online', 'idle', 'dnd', 'offline'] as User['presence'][]).map((p) => <button key={p} className={user.presence === p ? 'active' : ''} disabled={presenceBusy} onClick={() => { void changePresence(p); }}><i className={`status-mini status-${p}`} />{t(p)}{user.presence === p && <Icon name="check" size={13} />}</button>)}</div><div className="account-popover-links"><button onClick={() => { setProfileMenu(false); setProfileTarget(user.id); }}><Icon name="people" size={15} />{t('myProfile')}</button><button onClick={() => { setProfileMenu(false); toView('settings'); }}><Icon name="gear" size={15} />{t('settings')}</button><button onClick={() => { setProfileMenu(false); toView('aura'); }}><Icon name="spark" size={15} />{t('aura')}</button>{userIsPro && <button onClick={() => { setProfileMenu(false); if (STUDIO_URL) { window.open(studioHref, '_blank', 'noopener,noreferrer'); } else { toView('studio'); } }}><ExternalLink size={15} />{t('studioPlatform')}</button>}{adminVisible && <button onClick={() => { setProfileMenu(false); toView('admin'); }}><Icon name="shield" size={15} />{t('admin')}</button>}<button className="signout-action" onClick={() => { void signOutNow(); }}><Icon name="back" size={15} />{t('signOut')}</button></div></div></>}

    <Modal open={newChatOpen} onClose={() => setNewChatOpen(false)} title={t('newMessage')} subtitle={t('welcomeSub')} size="sm"><div className="new-chat-list"><label className="mini-search"><Icon name="search" size={15} /><input autoFocus placeholder={t('search')} onChange={(e) => { const q = e.target.value.toLowerCase(); document.querySelectorAll<HTMLButtonElement>('.new-chat-contact').forEach((el) => { el.hidden = !el.dataset.search?.includes(q); }); }} /></label>{contacts.map((p) => <button className="new-chat-contact" data-search={`${p.name} ${p.username}`.toLowerCase()} key={p.id} onClick={() => pickUser(p)}><Avatar user={p} size="sm" showStatus /><span><b>{p.name}</b><small>@{p.username}</small></span><Icon name="arrowUpRight" size={15} /></button>)}{contacts.length === 0 && <p className="modal-demo-note">{t('noPeople')}</p>}</div></Modal>

    <CreateHubModal open={newHubOpen} onClose={() => setNewHubOpen(false)} user={user} onCreated={(h) => { tell(t('hubCreated'), 'good'); openHub(h); }} />

    <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('invite')} subtitle={t('pasteInvite')} size="sm"><form className="stack-form" onSubmit={async (e) => { e.preventDefault(); try { const token = inviteValue.trim().split('/').filter(Boolean).at(-1) ?? ''; const h = await joinInvite(token, user.id); if (!h) throw new AppError('err.inviteInvalid'); setInviteOpen(false); setInviteValue(''); openHub(h); tell(t('hubJoined'), 'good'); } catch (err) { tell(err instanceof AppError ? t(err.key) : t('err.generic'), 'bad'); } }}><p className="modal-explainer">{t(user.serverBacked ? 'inviteLiveNotice' : 'inviteLocalNotice')}</p><label className="field-label">{t('invite')}<input autoFocus className="field-input" value={inviteValue} onChange={(e) => setInviteValue(e.target.value)} placeholder={t('invitePlaceholder')} /></label><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setInviteOpen(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary"><Icon name="arrowUpRight" size={14} />{t('joinHub')}</button></div></form></Modal>

    <SearchModal db={data} user={user} blockedUsers={chatControls.blocked} onSelect={(id) => { setChannel(id); setView('chats'); setMobileListOpen(false); }} />
    <Modal open={!!profileTarget} onClose={() => setProfileTarget(null)} title={t('profile')} subtitle={profileTarget ? `@${data.users[profileTarget]?.username ?? ''}` : ''} size="sm">{profileTarget && data.users[profileTarget] && (() => {
      const targetUser = data.users[profileTarget];
      return <ProfileExplorerContent target={targetUser} viewer={user} db={data} variant="modal" action={profileTarget === user.id ? <button className="btn btn-outline btn-full" onClick={() => { setProfileTarget(null); toView('settings'); }}><Icon name="edit" size={15} />{t('editProfile')}</button> : <button className="btn btn-primary btn-full" onClick={() => { pickUser(targetUser); setProfileTarget(null); }}><Icon name="chat" size={15} />{t('dmFrom')}</button>} />;
    })()}</Modal>
    <ToastHost />
  </div>;
}
