import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { DB, Hub, Message, User } from '../data/types';
import { addReaction, canDeleteMessageForEveryone, deleteMessage, editMessage, loadOlderMessages, parseDM, pinMessage, sendMessage, setUserBlocked, startDM, updateRead } from '../data/chat';
import { addRoom, leaveHub } from '../data/hubs';
import { getAura, hasAura } from '../data/market';
import { fileToDataUrl } from '../lib/image';
import { chime, notify } from '../lib/notify';
import { prefs } from '../lib/prefs';
import { hueOf, fmtTime, uid, cx } from '../lib/util';
import { useI18n } from '../i18n';
import { Avatar, AvatarPile } from './Avatar';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell, tellUndo } from './Toast';
import { AppError } from '../data/errors';
import { LIMITS } from '../config';
import { clearHistory, hiddenBefore, hideMessage, isMessageHidden, restoreHistory, setMuted, useChatControls } from '../data/chatControls';

const quickEmoji = ['🫶', '😂', '✨', '🤍', '👀', '🔥', '🥹', '🌱', '🎧', '🙌', '😮‍💨', '💀'];

function normalizeText(text: string, t: (key: string) => string) {
  return text.replace(/\n/g, '\n').trim().length === 0 ? t('err.emptyMessage') : '';
}

export function ChatScreen({ db: data, user, channel, setChannel, onStartChat, onNewHub }: {
  db: DB; user: User; channel: string | null; setChannel: (id: string) => void; onStartChat: () => void; onNewHub: () => void;
}) {
  const { t, lang } = useI18n();
  const pref = prefs.use();
  const chatControls = useChatControls(user.id);
  const [composer, setComposer] = useState('');
  const [reply, setReply] = useState<string | undefined>();
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null);
  const [confirmDeleteEveryone, setConfirmDeleteEveryone] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [hasOlderHistory, setHasOlderHistory] = useState(false);
  const [loadingOlderHistory, setLoadingOlderHistory] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousChannelRef = useRef<string | null>(null);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const nearBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const prependSnapshotRef = useRef<{ channel: string; height: number; top: number; count: number; firstId?: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const gifRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const dm = channel ? parseDM(channel) : null;
  const otherId = dm?.find((id) => id !== user.id) ?? user.id;
  const other = data.users[otherId] ?? user;
  const activeHub = channel ? Object.values(data.hubs).find((h) => h.rooms.some((r) => r.id === channel)) ?? null : null;
  const activeRoom = activeHub?.rooms.find((r) => r.id === channel);
  const allMessages = channel ? data.msgs[channel] ?? [] : [];
  const clearMark = channel && dm ? hiddenBefore(user.id, channel) : 0;
  const messages = allMessages.filter((message) => message.ts > clearMark && !isMessageHidden(user.id, message.ch, message.id));
  const remoteDM = !!dm && dm[0] !== dm[1] && dm.every((id) => data.users[id]?.serverBacked);
  const remoteHub = !!activeHub?.remote;
  const remoteHistory = remoteDM || remoteHub;
  const channelTitle = dm ? (otherId === user.id ? t('saved') : other.name) : activeRoom?.name ?? t('chat');
  const subtitle = dm ? (otherId === user.id ? t('savedDM') : other.statusText || (other.presence === 'online' ? t('onlineNow') : t(other.presence))) : activeHub?.name;
  const activeAura = getAura(user);
  const maxChars = activeAura?.tier === 'nova' ? LIMITS.messageNova : LIMITS.message;
  const directLayout = dm && dm[0] !== dm[1];
  const people = useMemo(() => activeHub ? Object.keys(activeHub.members).map((id) => data.users[id]).filter(Boolean) : [], [activeHub, data.users]);
  const messageLayout = pref.layout === 'auto' ? (directLayout ? 'bubbles' : 'stream') : pref.layout;
  const pinned = messages.filter((m) => m.pinned);
  const blockedConversation = !!dm && otherId !== user.id && chatControls.blocked.includes(otherId);
  const mutedConversation = !!dm && otherId !== user.id && chatControls.muted.includes(otherId);

  useEffect(() => { setMembersOpen(Boolean(activeHub && pref.members)); }, [channel, activeHub?.id, pref.members]);

  useEffect(() => {
    setComposer(''); setReply(undefined); setEditId(null); setEmojiOpen(false); setMoreFor(null);
    if (channel) updateRead(user.id, channel);
  }, [channel, user.id]);

  useLayoutEffect(() => {
    if (!channel || !scrollRef.current || editId) return;
    const el = scrollRef.current;
    const last = messages.at(-1);
    const changedChannel = previousChannelRef.current !== channel;
    const addedMessage = last?.id !== lastMessageIdRef.current;
    const prepend = prependSnapshotRef.current;
    if (prepend?.channel === channel && messages.length > prepend.count && messages[0]?.id !== prepend.firstId) {
      const behavior = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = prepend.top + (el.scrollHeight - prepend.height);
      el.style.scrollBehavior = behavior;
      prependSnapshotRef.current = null;
      nearBottomRef.current = false;
    } else if (prepend && prepend.channel !== channel) prependSnapshotRef.current = null;
    if (changedChannel) {
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true;
      setNewMessageCount(0);
    } else if (addedMessage && last) {
      if (nearBottomRef.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        nearBottomRef.current = true;
        setNewMessageCount(0);
      } else setNewMessageCount((count) => count + 1);
    }
    previousChannelRef.current = channel;
    lastMessageIdRef.current = last?.id;
    if (addedMessage && last && last.by !== user.id && document.hidden && pref.desktop && !mutedConversation) {
      const author = data.users[last.by]?.name ?? 'OrbitMc';
      notify(author, last.text || last.sticker || t('messagePlaceholder'));
    }
  }, [channel, messages.length, messages.at(-1)?.id, user.id, editId, pref.desktop, mutedConversation, data.users, t]);

  const loadOlderHistory = async () => {
    if (!remoteHistory || clearMark || !hasOlderHistory || loadingOlderRef.current || !channel) return;
    const oldest = messages[0];
    const el = scrollRef.current;
    if (!oldest || !el) { setHasOlderHistory(false); return; }
    loadingOlderRef.current = true;
    setLoadingOlderHistory(true);
    prependSnapshotRef.current = { channel, height: el.scrollHeight, top: el.scrollTop, count: messages.length, firstId: messages[0]?.id };
    try { setHasOlderHistory(await loadOlderMessages(channel, user.id, oldest)); }
    catch (error) { prependSnapshotRef.current = null; report(error); }
    finally { loadingOlderRef.current = false; setLoadingOlderHistory(false); }
  };

  useEffect(() => {
    setHasOlderHistory(remoteHistory && !clearMark);
    setLoadingOlderHistory(false);
    loadingOlderRef.current = false;
    prependSnapshotRef.current = null;
  }, [channel, remoteHistory, clearMark]);

  const recordScrollPosition = () => {
    const el = scrollRef.current;
    if (el) {
      nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottomRef.current && newMessageCount > 0) setNewMessageCount(0);
      if (el.scrollTop < 72 && messages.length > 0 && !clearMark) void loadOlderHistory();
    }
  };

  const report = (e: unknown) => tell(e instanceof AppError ? t(e.key) : t('err.generic'), 'bad');

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!channel || imageBusy || blockedConversation) return;
    try {
      const text = composer.replace(/\r\n?/g, '\n').trim();
      if (!text) throw new AppError('err.emptyMessage');
      await sendMessage({ channel, userId: user.id, text, reply });
      setComposer(''); setReply(undefined); setEmojiOpen(false);
      textareaRef.current?.focus();
      if (pref.sound) chime();
    } catch (e) { report(e); }
  };

  const keySend = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
  };

  const attachPicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !channel || blockedConversation) return;
    setImageBusy(true);
    try {
      const aura = getAura(user);
      const max = aura?.tier === 'nova' ? LIMITS.imageCharsAura : aura ? LIMITS.imageChars : LIMITS.avatarChars;
      const image = await fileToDataUrl(file, aura ? 1280 : 720, max, true);
      await sendMessage({ channel, userId: user.id, text: composer.trim(), image, reply });
      setComposer(''); setReply(undefined);
    } catch (e) { report(e); }
    finally { setImageBusy(false); }
  };

  const editStart = (msg: Message) => { setEditId(msg.id); setEditText(msg.text); setMoreFor(null); setTimeout(() => editRef.current?.focus(), 0); };
  const editSave = async (msg: Message) => { try { await editMessage(msg.ch, msg.id, user.id, editText); setEditId(null); } catch (e) { report(e); } };
  const onReaction = async (msg: Message, emoji: string) => { try { await addReaction(msg.ch, msg.id, user.id, emoji); } catch (e) { report(e); } };
  const onPin = async (msg: Message) => { try { await pinMessage(msg.ch, msg.id, user.id); setMoreFor(null); } catch (e) { report(e); } };
  const onDelete = async () => { if (!confirmDelete) return; try { if (confirmDeleteEveryone && canDeleteMessageForEveryone(confirmDelete.ch, confirmDelete, user.id)) await deleteMessage(confirmDelete.ch, confirmDelete.id, user.id); else hideMessage(user.id, confirmDelete.ch, confirmDelete.id); } catch (e) { report(e); } finally { setConfirmDelete(null); setConfirmDeleteEveryone(false); } };
  const quote = (msg: Message) => { setReply(msg.id); setMoreFor(null); textareaRef.current?.focus(); };
  const jumpTo = (id: string) => { document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };

  const clearConversation = () => {
    if (!channel) return;
    const previous = clearHistory(user.id, channel);
    setConfirmClear(false);
    setConversationMenuOpen(false);
    tellUndo(t('historyCleared'), t('undo'), () => restoreHistory(user.id, channel, previous));
  };

  const toggleMute = () => {
    const nextMuted = !mutedConversation;
    setMuted(user.id, otherId, nextMuted);
    setConversationMenuOpen(false);
    tell(t(nextMuted ? 'chatMuted' : 'chatUnmuted'), 'good');
  };

  const confirmBlockChange = async () => {
    setBlockBusy(true);
    try {
      await setUserBlocked(user.id, otherId, !blockedConversation);
      setConfirmBlock(false);
      tell(t(blockedConversation ? 'userUnblocked' : 'userBlocked'), 'good');
    } catch (error) { report(error); }
    finally { setBlockBusy(false); }
  };

  const confirmLeaveHub = async () => {
    try { await leaveHub(activeHub!.id, user.id); setLeaveOpen(false); onStartChat(); tell(t('hubLeft'), 'good'); }
    catch (error) { tell(error instanceof AppError && error.key === 'owner' ? t('ownerLeave') : error instanceof AppError ? t(error.key) : t('err.generic'), 'bad'); setLeaveOpen(false); }
  };

  const createRoom = async (event: FormEvent) => {
    event.preventDefault();
    try { const id = await addRoom(activeHub!.id, user.id, roomName); setChannel(id); tell(t('roomCreated'), 'good'); setRoomName(''); setNewRoomOpen(false); }
    catch (error) { report(error); }
  };

  if (!channel) return <div className="empty-conversation"><div className="empty-art"><span/><span/><span/><Icon name="chat" size={27}/></div><h2>{t('quiet')}</h2><p>{t('quietSub')}</p><button className="btn btn-primary" onClick={onStartChat}><Icon name="plus" size={16}/>{t('startDM')}</button></div>;

  return <div className="chat-layout">
    {activeHub && <div className="channel-rail">
      <div className="channel-hub-heading"><span className="hub-mark" style={{ '--hub-hue': activeHub.hue } as React.CSSProperties}>{activeHub.emoji}</span><div><strong>{activeHub.name}</strong><small>{people.length} {t('members').toLowerCase()}</small></div><button className="icon-btn" aria-label={t('inviteCopy')} title={t('inviteCopy')} onClick={async () => { const url = `${window.location.origin}/invite/${activeHub.invite}`; try { await navigator.clipboard.writeText(url); tell(t('inviteCopied'), 'good'); } catch { tell(url, 'info'); } }}><Icon name="link" size={15}/></button><button className="icon-btn" aria-label={t('members')} title={t('members')} onClick={() => setMembersOpen((v) => !v)}><Icon name="people" size={15}/></button></div>
      <div className="channel-label">{t('rooms')}<button className="tiny-add" aria-label={t('addRoom')} onClick={() => setNewRoomOpen(true)} disabled={!['owner','mod'].includes(activeHub.members[user.id])}><Icon name="plus" size={14}/></button></div>
      <div className="channel-links">{activeHub.rooms.map((room) => <button key={room.id} className={`channel-link ${channel === room.id ? 'active' : ''}`} onClick={() => setChannel(room.id)}><span className="hash">#</span><span>{room.name}</span></button>)}</div>
      <div className="channel-footer"><div className="online-pip"/><span>{people.filter((p) => p.presence === 'online').length} {t('onlineNow')}</span><button className="icon-btn leave-room" title={t('leaveHub')} aria-label={t('leaveHub')} onClick={() => setLeaveOpen(true)}><Icon name="back" size={15}/></button></div>
    </div>}

    <section className="conversation">
      <header className="conversation-header">
        <button className="conversation-back" onClick={onStartChat} aria-label={t('backToApp')}><Icon name="back" size={17}/></button>
        <button className="conversation-person" onClick={() => setMembersOpen((v) => !v)}>
          {dm ? <Avatar user={other} size="sm" showStatus /> : <span className="hash-head">#</span>}
          <span className="conversation-title"><strong>{channelTitle}</strong><small>{subtitle}</small></span>
        </button>
        <div className="conversation-tools">{activeHub && <button className="icon-btn" aria-label={t('inviteCopy')} title={t('inviteCopy')} onClick={async () => { const url = `${window.location.origin}/invite/${activeHub.invite}`; try { await navigator.clipboard.writeText(url); tell(t('inviteCopied'), 'good'); } catch { tell(url, 'info'); } }}><Icon name="link" size={15}/></button>}{activeHub && <span className="header-people"><AvatarPile people={people.filter((p) => p.presence === 'online')} limit={3}/></span>}<button className={`icon-btn ${membersOpen ? 'active' : ''}`} aria-label={t('members')} title={t('members')} onClick={() => setMembersOpen((v) => !v)}><Icon name="people" size={18}/></button><button className="icon-btn" aria-label={t('openSearch')} title={t('openSearch')} onClick={() => window.dispatchEvent(new CustomEvent('sado:search', { detail: { channel } }))}><Icon name="search" size={18}/></button>{dm && otherId !== user.id && <div className="conversation-menu-wrap"><button className={`icon-btn ${conversationMenuOpen ? 'active' : ''}`} aria-label={t('conversationOptions')} title={t('conversationOptions')} aria-expanded={conversationMenuOpen} onClick={() => setConversationMenuOpen((open) => !open)}><Icon name="moreVertical" size={17}/></button>{conversationMenuOpen && <div className="conversation-menu" onClick={(event) => event.stopPropagation()}><button onClick={toggleMute}><Icon name={mutedConversation ? 'bell' : 'moon'} size={15}/>{t(mutedConversation ? 'unmuteChat' : 'muteChat')}</button><button onClick={() => { setConversationMenuOpen(false); setConfirmClear(true); }}><Icon name="trash" size={15}/>{t('clearHistory')}</button><span className="conversation-menu-note">{t('chatControlsLocalOnly')}</span><span className="menu-divider"/><button className="danger-action" onClick={() => { setConversationMenuOpen(false); setConfirmBlock(true); }}><Icon name={blockedConversation ? 'check' : 'lock'} size={15}/>{t(blockedConversation ? 'unblockUser' : 'blockUser')}</button></div>}</div>}</div>
      </header>
      {activeHub && <div className="mobile-room-strip">{activeHub.rooms.map((room) => <button key={room.id} className={channel === room.id ? 'active' : ''} onClick={() => setChannel(room.id)}><span>#</span>{room.name}</button>)}{['owner','mod'].includes(activeHub.members[user.id]) && <button className="mobile-room-add" aria-label={t('addRoom')} onClick={() => setNewRoomOpen(true)}><Icon name="plus" size={14}/></button>}</div>}

      {pinned.length > 0 && <button className="pinned-banner" onClick={() => jumpTo(pinned[pinned.length - 1].id)}><Icon name="pin" size={14}/><span><b>{t('pinnedSection')}</b><em>{pinned[pinned.length - 1].text || pinned[pinned.length - 1].sticker}</em></span><Icon name="chevron" size={14}/></button>}

      <div className={`message-scroll ${pref.density === 'compact' ? 'compact' : ''} ${messageLayout === 'stream' ? 'stream-layout' : 'bubbles-layout'}`} ref={scrollRef} onScroll={recordScrollPosition} onClick={() => setMoreFor(null)}>
      {remoteHistory && !clearMark && hasOlderHistory && messages.length > 0 && <button className="load-older-messages" onClick={() => void loadOlderHistory()} disabled={loadingOlderHistory}>{t(loadingOlderHistory ? 'loadingOlder' : 'loadOlder')}</button>}
        <div className="conversation-intro">
          {dm && <button type="button" className="intro-avatar" aria-label={t('profile')} title={t('profile')} onClick={() => window.dispatchEvent(new CustomEvent('sado:profile', { detail: other.id }))}><Avatar user={other} size="xl" showStatus /></button>}
          {!dm && <div className="intro-hub-mark" style={{ '--hub-hue': activeHub?.hue ?? 30 } as React.CSSProperties}>{activeHub?.emoji ?? '✳'}</div>}
          <h2>{dm ? (otherId === user.id ? t('saved') : other.name) : `${activeHub?.emoji ?? ''} ${activeHub?.name ?? ''}`}</h2>
          <p>{dm ? (other.bio || (otherId === user.id ? t('savedDM') : t('welcomeSub'))) : (activeHub?.about || activeRoom?.topic || t('quietSub'))}</p>
          {dm && <span className="member-since">@{other.username} · {other.presence === 'online' ? t('online') : t(other.presence)}</span>}
          {!dm && activeHub && <span className="member-since">{people.length} {t('members').toLowerCase()} · {activeRoom?.topic || activeHub.name}</span>}
        </div>

        {blockedConversation ? <div className="conversation-blocked-note"><Icon name="lock" size={18}/><b>{t('blockedConversation')}</b><span>{t('blockedConversationSub')}</span></div> : messages.length > 0 ? <div className="date-divider"><span>{t('today')}</span></div> : <div className="first-message-note">{allMessages.length > 0 && clearMark ? t('historyCleared') : t('noMessages')}</div>}
        {!blockedConversation && messages.map((msg, index) => {
          const person = data.users[msg.by] ?? user;
          const previous = messages[index - 1];
          const grouped = previous && previous.by === msg.by && msg.ts - previous.ts < 5 * 60_000;
          const isMine = msg.by === user.id;
          const replyMessage = msg.reply ? messages.find((m) => m.id === msg.reply) : undefined;
          return <article id={`msg-${msg.id}`} key={msg.id} className={cx('message-row', isMine && 'mine', grouped && 'grouped', msg.pinned && 'message-pinned')}>
            {!grouped && <button type="button" className="message-avatar" aria-label={t('profile')} title={t('profile')} onClick={() => window.dispatchEvent(new CustomEvent('sado:profile', { detail: person.id }))}><Avatar user={person} size="sm"/></button>}
            {grouped && <time className="group-time" title={fmtTime(msg.ts, lang)}>{fmtTime(msg.ts, lang)}</time>}
            <div className="message-main">
              {!grouped && <div className="message-byline"><button className="message-name" onClick={() => window.dispatchEvent(new CustomEvent('sado:profile', { detail: person.id }))}>{person.name}</button>{hasAura(person.id) && <span className="verified-badge" title={t('profilePlanLabel', { plan: person.aura?.tier.toUpperCase() ?? 'ORBIT+' })} aria-label={t('profilePlanLabel', { plan: person.aura?.tier.toUpperCase() ?? 'ORBIT+' })}><Icon name="check" size={10}/></span>}<time>{fmtTime(msg.ts, lang)}</time>{isMine && <span className="message-mine-tag">{t('you')}</span>}</div>}
              {replyMessage && <button className="reply-preview" onClick={() => jumpTo(replyMessage.id)}><Icon name="reply" size={12}/><span>{t('replyBadge')} {data.users[replyMessage.by]?.name ?? t('you')}:</span><em>{replyMessage.text || replyMessage.sticker}</em></button>}
              {editId === msg.id ? <form className="edit-message" onSubmit={(e) => { e.preventDefault(); editSave(msg); }}><input ref={editRef} value={editText} maxLength={maxChars} onChange={(e) => setEditText(e.target.value)}/><div><button type="button" className="text-action" onClick={() => setEditId(null)}>{t('cancel')}</button><button type="submit" className="btn btn-primary btn-small">{t('save')}</button></div></form> : <>
                {msg.text && <p className="message-text">{msg.text}{msg.edited && <span className="edited-label"> · {t('edit').toLowerCase()}</span>}</p>}
                {msg.sticker && <div className="message-sticker">{msg.sticker}</div>}
                {msg.image && <img className="message-image" src={msg.image} alt="" loading="lazy"/>}
              </>}
              {Object.keys(msg.reactions).length > 0 && <div className="reactions">{Object.entries(msg.reactions).map(([emoji, ids]) => <button key={emoji} className={`reaction ${ids.includes(user.id) ? 'reacted' : ''}`} onClick={() => { void onReaction(msg, emoji); }}><span>{emoji}</span><small>{ids.length}</small></button>)}<button className="reaction-add" aria-label={t('react')} onClick={() => setMoreFor(moreFor === `r:${msg.id}` ? null : `r:${msg.id}`)}><Icon name="plus" size={12}/></button></div>}
            </div>
            {!editId && <div className="message-actions"><button className="action-tiny" aria-label={t('react')} title={t('react')} onClick={(e) => { e.stopPropagation(); setMoreFor(moreFor === `r:${msg.id}` ? null : `r:${msg.id}`); }}><Icon name="smile" size={14}/></button><button className="action-tiny" aria-label={t('reply')} title={t('reply')} onClick={() => quote(msg)}><Icon name="reply" size={14}/></button><button className="action-tiny" aria-label={t('more')} title={t('more')} onClick={(e) => { e.stopPropagation(); setMoreFor(moreFor === `m:${msg.id}` ? null : `m:${msg.id}`); }}><Icon name="more" size={14}/></button>
              {moreFor === `r:${msg.id}` && <div className="reaction-flyout" onClick={(e) => e.stopPropagation()}>{quickEmoji.map((emoji) => <button key={emoji} aria-label={`${t('react')} ${emoji}`} onClick={() => { void onReaction(msg, emoji); setMoreFor(null); }}>{emoji}</button>)}</div>}
              {moreFor === `m:${msg.id}` && <div className="message-menu" onClick={(e) => e.stopPropagation()}><button onClick={() => quote(msg)}><Icon name="reply" size={14}/>{t('reply')}</button><button onClick={async () => { try { await navigator.clipboard.writeText(msg.text); tell(t('copied'), 'good'); } catch { tell(t('err.generic'), 'bad'); } setMoreFor(null); }}><Icon name="copy" size={14}/>{t('copy')}</button><button onClick={() => { void onPin(msg); }}><Icon name="pin" size={14}/>{msg.pinned ? t('unpin') : t('pin')}</button>{isMine && <button onClick={() => editStart(msg)}><Icon name="edit" size={14}/>{t('edit')}</button>}<button className="danger-action" onClick={() => { setConfirmDelete(msg); setConfirmDeleteEveryone(isMine); setMoreFor(null); }}><Icon name="trash" size={14}/>{t('delete')}</button></div>}
            </div>}
          </article>;
        })}
      </div>

      {newMessageCount > 0 && <button type="button" className="new-messages-jump" onClick={() => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); nearBottomRef.current = true; setNewMessageCount(0); }}><Icon name="down" size={15}/>{t('newMessagesCount', { count: newMessageCount })}</button>}
      {reply && !blockedConversation && <div className="replying-bar"><Icon name="reply" size={14}/><span>{t('replyBadge')} <b>{data.users[messages.find((m) => m.id === reply)?.by ?? '']?.name ?? t('you')}</b></span><em>{messages.find((m) => m.id === reply)?.text}</em><button className="icon-btn" aria-label={t('cancel')} onClick={() => setReply(undefined)}><Icon name="close" size={13}/></button></div>}
      <form className="composer-wrap" onSubmit={submit}>
        {emojiOpen && <div className="composer-emoji" role="group" aria-label={t('emoji')}>{user.stickerPack && data.listings[user.stickerPack]?.stickers?.map((emoji, i) => <button key={`pack-${emoji}-${i}`} type="button" title={t('stickers')} onClick={async () => { try { await sendMessage({ channel, userId: user.id, text: '', sticker: emoji, reply }); setReply(undefined); setEmojiOpen(false); } catch (e) { report(e); } }}>{emoji}</button>)}{quickEmoji.concat(['😊', '🪩', '🌈', '🍓', '☕', '🪴', '🫧', '😌', '💫', '🧸', '🦋', '🪐']).map((emoji, i) => <button key={`${emoji}${i}`} type="button" onClick={() => { setComposer((v) => v + emoji); setEmojiOpen(false); textareaRef.current?.focus(); }}>{emoji}</button>)}</div>}
        {blockedConversation ? <div className="blocked-composer-note">{t('blockedConversationSub')}</div> : <div className="composer-box">
          <div className="composer-rail"><button className="composer-icon" type="button" title={t('attach')} aria-label={t('attach')} disabled={imageBusy} onClick={() => imageRef.current?.click()}><Icon name="image" size={18}/></button><input ref={imageRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={attachPicture}/><button className="composer-gif" type="button" title={t('attachGif')} aria-label={t('attachGif')} disabled={imageBusy} onClick={() => gifRef.current?.click()}>GIF</button><input ref={gifRef} hidden type="file" accept="image/gif" onChange={attachPicture}/></div>
          <textarea ref={textareaRef} rows={1} placeholder={imageBusy ? t('loading') : t('messagePlaceholder')} value={composer} maxLength={maxChars} onChange={(e) => setComposer(e.target.value)} onKeyDown={keySend} aria-label={t('messagePlaceholder')} />
          <button className="composer-icon emoji-toggle" type="button" aria-label={t('emoji')} title={t('emoji')} onClick={() => setEmojiOpen((v) => !v)}><Icon name="smile" size={18}/></button>
          <span className="composer-count">{composer.length > maxChars - 120 ? `${composer.length}/${maxChars}` : ''}</span>
          <button type="submit" className="send-btn" disabled={!composer.trim() || imageBusy} aria-label={t('send')} title={t('send')}><Icon name="send" size={17}/></button>
        </div>}
        <div className="composer-caption"><span>{t('messageHint')}</span>{activeAura && <span className="aura-caption"><Icon name="spark" size={11}/> {activeAura.tier.toUpperCase()}</span>}</div>
      </form>
    </section>

    {membersOpen && <aside className="members-drawer"><div className="members-head"><strong>{dm ? t('profile') : t('members')}</strong><button className="icon-btn" aria-label={t('cancel')} onClick={() => setMembersOpen(false)}><Icon name="close" size={16}/></button></div>{dm ? <><div className="profile-cover" style={{ '--cover-hue': other.hue || hueOf(other.username) } as React.CSSProperties}/><div className="profile-aside-card"><Avatar user={other} size="lg" showStatus/><span className="member-presence">{t(other.presence)}</span><h2>{other.name}{hasAura(other.id) && <span className="verified-badge" title={t('profilePlanLabel', { plan: other.aura?.tier.toUpperCase() ?? 'ORBIT+' })} aria-label={t('profilePlanLabel', { plan: other.aura?.tier.toUpperCase() ?? 'ORBIT+' })}><Icon name="check" size={10}/></span>}</h2><p className="profile-handle">@{other.username}</p>{other.bio && <p>{other.bio}</p>}{other.statusText && <p className="profile-status">“{other.statusText}”</p>}{hasAura(other.id) && <span className="profile-plan"><Icon name="check" size={13}/>{t('profilePlanLabel', { plan: other.aura?.tier.toUpperCase() ?? 'ORBIT+' })}</span>}<div className="profile-public-facts"><span>{t('memberSince', { date: new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(other.createdAt) })}</span>{other.inventory.length > 0 && <span>{t('collectionCount', { count: other.inventory.length })}</span>}{(other.giftsReceivedCount ?? other.giftsReceived?.length ?? 0) > 0 && <span>{t('giftsReceived', { count: other.giftsReceivedCount ?? other.giftsReceived?.length ?? 0 })}</span>}</div><button className="btn btn-secondary btn-full" onClick={() => setMembersOpen(false)}>{t('backToApp')}</button></div></> : <><div className="member-list">{people.map((p) => <button key={p.id} className="member-row" onClick={() => { if (p.id !== user.id) { setChannel(startDM(user.id, p.id)); setMembersOpen(false); } }}><Avatar user={p} size="sm" showStatus/><span><b>{p.name}</b><small>{p.statusText || t(p.presence)}</small></span>{hasAura(p.id) && <span className="verified-badge" title={t('profilePlanLabel', { plan: p.aura?.tier.toUpperCase() ?? 'ORBIT+' })} aria-label={t('profilePlanLabel', { plan: p.aura?.tier.toUpperCase() ?? 'ORBIT+' })}><Icon name="check" size={10}/></span>}</button>)}</div><div className="member-drawer-actions"><button className="btn btn-outline btn-small" onClick={async () => { const url = `${window.location.origin}/invite/${activeHub!.invite}`; try { await navigator.clipboard.writeText(url); tell(t('inviteCopied'), 'good'); } catch { tell(url, 'info'); } }}><Icon name="link" size={14}/>{t('inviteCopy')}</button>{activeHub!.ownerId !== user.id && <button className="btn btn-ghost btn-small" onClick={() => { setMembersOpen(false); setLeaveOpen(true); }}><Icon name="back" size={14}/>{t('leaveHub')}</button>}</div></>}</aside>}

    <Modal open={!!confirmDelete} onClose={() => { setConfirmDelete(null); setConfirmDeleteEveryone(false); }} title={t('deleteConfirm')} subtitle={t(confirmDelete && canDeleteMessageForEveryone(confirmDelete.ch, confirmDelete, user.id) ? 'deleteConfirmSubOwn' : 'deleteConfirmSubOther')} size="sm">{confirmDelete && canDeleteMessageForEveryone(confirmDelete.ch, confirmDelete, user.id) && <label className="delete-everyone-toggle"><input type="checkbox" checked={confirmDeleteEveryone} onChange={(event) => setConfirmDeleteEveryone(event.target.checked)}/><span>{t('deleteForEveryone')}</span></label>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => { setConfirmDelete(null); setConfirmDeleteEveryone(false); }}>{t('cancel')}</button><button className="btn btn-danger" onClick={onDelete}>{t('delete')}</button></div></Modal>
    <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title={t('clearHistory')} subtitle={t('clearHistoryConfirm')} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setConfirmClear(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={clearConversation}>{t('clearHistory')}</button></div></Modal>
    <Modal open={confirmBlock} onClose={() => !blockBusy && setConfirmBlock(false)} title={t(blockedConversation ? 'unblockUser' : 'blockUser')} subtitle={t(blockedConversation ? 'unblockConfirm' : 'blockConfirm', { name: other.name })} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setConfirmBlock(false)} disabled={blockBusy}>{t('cancel')}</button><button className={blockedConversation ? 'btn btn-primary' : 'btn btn-danger'} onClick={() => void confirmBlockChange()} disabled={blockBusy}>{t(blockedConversation ? 'unblockUser' : 'blockUser')}</button></div></Modal>
    <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title={t('leaveConfirm')} subtitle={t('leaveHubSub')} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setLeaveOpen(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={() => void confirmLeaveHub()}>{t('leaveHub')}</button></div></Modal>
    <Modal open={newRoomOpen} onClose={() => setNewRoomOpen(false)} title={t('addRoom')} subtitle={t('newRoom')} size="sm"><form className="stack-form" onSubmit={createRoom}><label className="field-label">{t('newRoom')}<span className="input-prefix-wrap"><span className="input-prefix">#</span><input autoFocus className="field-input prefix-field" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="behind-the-scenes" maxLength={24}/></span></label><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setNewRoomOpen(false)}>{t('cancel')}</button><button className="btn btn-primary">{t('create')}</button></div></form></Modal>
  </div>;
}
