import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { BellOff, Clock, Crown, Mic, Smile, Sparkles, Square, Trash2, Video } from 'lucide-react';
import type { DB, Message, User } from '../data/types';
import { addReaction, canDeleteMessageForEveryone, canPostInChannel, deleteMessage, editMessage, loadOlderMessages, parseDM, pinMessage, sendMessage, setUserBlocked, startDM, updateRead, votePoll } from '../data/chat';
import { addRoom, leaveHub } from '../data/hubs';
import { getAura, hasAura } from '../data/market';
import { fileToDataUrl } from '../lib/image';
import { extractYouTubeIds, renderRichText, YouTubeEmbedCard } from '../lib/format';
import { chime, notify } from '../lib/notify';
import { prefs } from '../lib/prefs';
import { fmtTime, uid, cx } from '../lib/util';
import { useI18n } from '../i18n';
import { Avatar, AvatarPile } from './Avatar';
import { HubInviteModal, HubSettingsModal } from './HubPages';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { ProfileExplorerContent } from './ProfileExplorer';
import { tell, tellUndo } from './Toast';
import { AppError } from '../data/errors';
import { AURA, LIMITS } from '../config';
import { clearHistory, deleteConversation, getMuteUntil, hiddenBefore, hideMessage, isMessageHidden, restoreHistory, setCustomNickname, setMutedFor, useChatControls } from '../data/chatControls';
import { HubSymbol, VECTOR_BADGES, VectorBadge, VerifiedBadge } from './VectorAssets';

const quickEmoji = ['🫶', '😂', '✨', '🤍', '👀', '🔥', '🎧', '🙌', '🥳', '💎', '⚡', '🚀', '🎨', '💬', '👏', '💙', '🌙', '☕'];

export function ChatScreen({ db: data, user, channel, setChannel, onStartChat, onOpenList }: {
  db: DB; user: User; channel: string | null; setChannel: (id: string) => void; onStartChat: () => void; onOpenList?: () => void;
}) {
  const { t, lang } = useI18n();
  const pref = prefs.use();
  const chatControls = useChatControls(user.id);
  const [composer, setComposer] = useState('');
  const [reply, setReply] = useState<string | undefined>();
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'vectors' | 'emoji'>('vectors');
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [hubManageOpen, setHubManageOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null);
  const [confirmDeleteEveryone, setConfirmDeleteEveryone] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false);
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
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordCancelRef = useRef(false);
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
  const nameOf = (p?: { id: string; name: string } | null) => p ? (p.id === user.id ? p.name : (chatControls.nicknames?.[p.id] || p.name)) : '';
  const channelTitle = dm ? (otherId === user.id ? t('saved') : nameOf(other)) : activeRoom?.name ?? t('chat');
  const subtitle = dm ? (otherId === user.id ? t('savedDM') : other.statusText || (other.presence === 'online' ? t('onlineNow') : t(other.presence))) : `${activeHub?.name ?? ''}${activeRoom?.topic ? ` · ${activeRoom.topic}` : ''}`;
  const activeAura = getAura(user);
  const maxChars = activeAura ? AURA[activeAura.tier].maxChars : LIMITS.message;
  const directLayout = dm && dm[0] !== dm[1];
  const people = useMemo(() => activeHub ? Object.keys(activeHub.members).map((id) => data.users[id]).filter(Boolean) : [], [activeHub, data.users]);
  const messageLayout = pref.layout === 'auto' ? (directLayout ? 'bubbles' : 'stream') : pref.layout;
  const pinned = messages.filter((m) => m.pinned);
  const blockedConversation = !!dm && otherId !== user.id && chatControls.blocked.includes(otherId);
  const muteUntil = dm && otherId !== user.id ? getMuteUntil(user.id, otherId) : 0;
  const mutedConversation = muteUntil !== 0;
  const canPost = channel ? canPostInChannel(channel, user.id) : false;
  const isBroadcastLocked = !!activeRoom && activeRoom.kind === 'broadcast' && !canPost;
  const isSuspended = !!user.suspended;
  const canManageHub = !!activeHub && ['owner', 'mod'].includes(activeHub.members[user.id] ?? '');

  useEffect(() => { setMembersOpen(Boolean(activeHub && pref.members)); }, [channel, activeHub?.id, pref.members]);

  useEffect(() => {
    setComposer(''); setReply(undefined); setEditId(null); setEmojiOpen(false); setAttachOpen(false); setMoreFor(null); setActiveMsgId(null); setConversationMenuOpen(false);
    if (channel) updateRead(user.id, channel);
  }, [channel, user.id]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(132, Math.max(24, el.scrollHeight))}px`;
  }, [composer]);

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
    if (!channel || imageBusy || blockedConversation || !canPost) return;
    try {
      const text = composer.replace(/\r\n?/g, '\n').trim();
      if (!text) throw new AppError('err.emptyMessage');
      await sendMessage({ channel, userId: user.id, text, reply });
      setComposer(''); setReply(undefined); setEmojiOpen(false);
      textareaRef.current?.focus();
      if (pref.sound) chime();
    } catch (err) { report(err); }
  };

  const keySend = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (pref.enterToSend && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
    if (!pref.enterToSend && e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
  };

  const wrapSelection = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) { setComposer((v) => `${v}${before}${after}`); return; }
    const start = el.selectionStart ?? composer.length;
    const end = el.selectionEnd ?? composer.length;
    const selected = composer.slice(start, end) || 'text';
    const next = composer.slice(0, start) + before + selected + after + composer.slice(end);
    setComposer(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const startVoice = async () => {
    if (recording || !channel || blockedConversation || !canPost) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      tell(t('err.micUnavailable'), 'bad');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = preferredTypes.find((type) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)) ?? '';
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 });
      } catch {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      }
      audioChunksRef.current = [];
      recordCancelRef.current = false;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
        setRecording(false);
        setRecordSecs(0);
        if (recordCancelRef.current || audioChunksRef.current.length === 0) return;
        const rawType = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
        const safeType = rawType === 'audio/x-m4a' || rawType === 'audio/aac' ? 'audio/mp4' : rawType;
        const blob = new Blob(audioChunksRef.current, { type: safeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const rawUrl = typeof reader.result === 'string' ? reader.result : '';
          const dataUrl = rawUrl
            .replace(/^data:audio\/(?:x-m4a|aac)/i, 'data:audio/mp4')
            .replace(/^(data:audio\/[a-z0-9.+-]+)(?:;[^;]+)?;base64,/i, '$1;base64,');
          if (!dataUrl || dataUrl.length > LIMITS.audioChars) {
            tell(t('err.voiceTooBig'), 'bad');
            return;
          }
          void Promise.resolve(sendMessage({ channel, userId: user.id, text: '', audio: dataUrl, reply }))
            .then(() => { setReply(undefined); if (pref.sound) chime(); })
            .catch(report);
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setAttachOpen(false);
      setEmojiOpen(false);
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        tell(t('err.micPermission'), 'bad');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'NotReadableError') {
        tell(t('err.micUnavailable'), 'bad');
      } else {
        tell(t('err.generic'), 'bad');
      }
    }
  };

  const stopVoice = (cancel = false) => {
    recordCancelRef.current = cancel;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const sendYouTube = async (e: FormEvent) => {
    e.preventDefault();
    const raw = youtubeUrl.trim();
    if (!raw || !channel) return;
    if (!extractYouTubeIds(raw).length) {
      tell(t('err.badText'), 'bad');
      return;
    }
    try {
      await sendMessage({ channel, userId: user.id, text: raw, reply });
      setYoutubeUrl('');
      setYoutubeOpen(false);
      setReply(undefined);
      if (pref.sound) chime();
    } catch (err) {
      report(err);
    }
  };

  const attachPicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !channel || blockedConversation || !canPost) return;
    setImageBusy(true);
    try {
      const aura = getAura(user);
      const max = aura?.tier === 'nova' ? LIMITS.imageCharsAura : aura ? LIMITS.imageChars : LIMITS.avatarChars;
      const image = await fileToDataUrl(file, aura ? 1280 : 720, max, true);
      await sendMessage({ channel, userId: user.id, text: composer.trim(), image, reply });
      setComposer(''); setReply(undefined);
    } catch (err) { report(err); }
    finally { setImageBusy(false); }
  };

  const submitPoll = async (e: FormEvent) => {
    e.preventDefault();
    if (!channel || !canPost) return;
    const q = pollQuestion.trim();
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    try {
      await sendMessage({
        channel,
        userId: user.id,
        text: '',
        poll: {
          question: q.slice(0, 160),
          options: opts.slice(0, 6).map((text, idx) => ({ id: `opt_${idx}_${uid(4)}`, text: text.slice(0, 80), votes: [] })),
        },
      });
      setPollOpen(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      if (pref.sound) chime();
    } catch (err) { report(err); }
  };

  const editStart = (msg: Message) => { setEditId(msg.id); setEditText(msg.text); setMoreFor(null); setTimeout(() => editRef.current?.focus(), 0); };
  const editSave = async (msg: Message) => { try { await editMessage(msg.ch, msg.id, user.id, editText); setEditId(null); } catch (err) { report(err); } };
  const onReaction = async (msg: Message, emoji: string) => { try { await addReaction(msg.ch, msg.id, user.id, emoji); } catch (err) { report(err); } };
  const onPin = async (msg: Message) => { try { await pinMessage(msg.ch, msg.id, user.id); setMoreFor(null); } catch (err) { report(err); } };
  const onDelete = async () => { if (!confirmDelete) return; try { if (confirmDeleteEveryone && canDeleteMessageForEveryone(confirmDelete.ch, confirmDelete, user.id)) await deleteMessage(confirmDelete.ch, confirmDelete.id, user.id); else hideMessage(user.id, confirmDelete.ch, confirmDelete.id); } catch (err) { report(err); } finally { setConfirmDelete(null); setConfirmDeleteEveryone(false); } };
  const quote = (msg: Message) => { setReply(msg.id); setMoreFor(null); textareaRef.current?.focus(); };
  const jumpTo = (id: string) => { document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };

  const clearConversation = () => {
    if (!channel) return;
    const previous = clearHistory(user.id, channel);
    setConfirmClear(false);
    setConversationMenuOpen(false);
    tellUndo(t('historyCleared'), t('undo'), () => restoreHistory(user.id, channel, previous));
  };

  const muteFor = (duration: number | 'forever' | 0) => {
    setMutedFor(user.id, otherId, duration);
    setConversationMenuOpen(false);
    tell(t(duration === 0 ? 'chatUnmuted' : 'chatMuted'), 'good');
  };

  const deleteChatNow = () => {
    if (!channel) return;
    deleteConversation(user.id, channel);
    setConfirmDeleteChat(false);
    setConversationMenuOpen(false);
    const nextChannel = Object.keys(data.dms[user.id] ?? []).find((id) => id !== channel)
      ?? Object.values(data.hubs).find((h) => !!h.members[user.id])?.rooms[0]?.id
      ?? '';
    setChannel(nextChannel);
    tell(t('contactNameReset'), 'good');
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
    try { await leaveHub(activeHub!.id, user.id); setLeaveOpen(false); (onOpenList ?? onStartChat)(); tell(t('hubLeft'), 'good'); }
    catch (error) { tell(error instanceof AppError && error.key === 'owner' ? t('ownerLeave') : error instanceof AppError ? t(error.key) : t('err.generic'), 'bad'); setLeaveOpen(false); }
  };

  const createRoom = async (event: FormEvent) => {
    event.preventDefault();
    try { const id = await addRoom(activeHub!.id, user.id, roomName); setChannel(id); tell(t('roomCreated'), 'good'); setRoomName(''); setNewRoomOpen(false); }
    catch (error) { report(error); }
  };

  const replyTargetMsg = reply ? messages.find((m) => m.id === reply) : undefined;
  const ownedStickerPacks = useMemo(() => Object.values(data.listings).filter((l) => !l.removed && l.kind === 'stickers' && (user.inventory.includes(l.id) || l.sellerId === user.id) && l.stickers?.length), [data.listings, user.inventory, user.id]);

  if (!channel) return <div className="empty-conversation"><div className="empty-art"><span /><span /><span /><Icon name="chat" size={27} /></div><h2>{t('quiet')}</h2><p>{t('quietSub')}</p><div className="empty-actions">{onOpenList && <button className="btn btn-outline mobile-only-btn" onClick={onOpenList}><Icon name="menu" size={16} />{t('backToChats')}</button>}<button className="btn btn-primary" onClick={onStartChat}><Icon name="plus" size={16} />{t('startDM')}</button></div></div>;

  return <div className="chat-layout">
    {activeHub && <div className="channel-rail">
      <div className="channel-hub-heading">
        <span className="hub-mark" style={{ '--hub-hue': activeHub.hue } as React.CSSProperties}><HubSymbol mark={activeHub.emoji} size={16} /></span>
        <div><strong>{activeHub.name}</strong><small>{people.length} {t('members').toLowerCase()}</small></div>
        {canManageHub && <button className="icon-btn" aria-label={t('hubSettings')} title={t('hubSettings')} onClick={() => setHubManageOpen(true)}><Icon name="sliders" size={15} /></button>}
        <button className="icon-btn" aria-label={t('inviteCopy')} title={t('inviteCopy')} onClick={() => setInviteModalOpen(true)}><Icon name="link" size={15} /></button>
      </div>
      <div className="channel-label">{t('rooms')}<button className="tiny-add" aria-label={t('addRoom')} onClick={() => setNewRoomOpen(true)} disabled={!canManageHub}><Icon name="plus" size={14} /></button></div>
      <div className="channel-links">{activeHub.rooms.map((room) => <button key={room.id} className={`channel-link ${channel === room.id ? 'active' : ''}`} onClick={() => setChannel(room.id)}><span className="hash">{room.kind === 'broadcast' ? <Icon name="megaphone" size={13} /> : '#'}</span><span>{room.name}</span></button>)}</div>
      <div className="channel-footer"><div className="online-pip" /><span>{people.filter((p) => p.presence === 'online').length} {t('onlineNow')}</span><button className="icon-btn leave-room" title={t('leaveHub')} aria-label={t('leaveHub')} onClick={() => setLeaveOpen(true)}><Icon name="back" size={15} /></button></div>
    </div>}

    <section className="conversation">
      <header className="conversation-header">
        <button className="conversation-back" onClick={onOpenList ?? onStartChat} aria-label={t('backToChats')} title={t('backToChats')}><Icon name="back" size={17} /></button>
        <button className="conversation-person" onClick={() => setMembersOpen((v) => !v)}>
          {dm ? <Avatar user={other} size="sm" showStatus /> : <span className="hash-head">{activeRoom?.kind === 'broadcast' ? <Icon name="megaphone" size={16} /> : '#'}</span>}
          <span className="conversation-title"><strong>{channelTitle}{mutedConversation && <BellOff size={12} className="muted-inline-icon" />}</strong><small>{subtitle}</small></span>
        </button>
        <div className="conversation-tools">
          {activeHub && canManageHub && <button className="icon-btn mobile-hub-manage" aria-label={t('hubSettings')} title={t('hubSettings')} onClick={() => setHubManageOpen(true)}><Icon name="sliders" size={16} /></button>}
          {activeHub && <button className="icon-btn" aria-label={t('inviteCopy')} title={t('inviteCopy')} onClick={() => setInviteModalOpen(true)}><Icon name="link" size={15} /></button>}
          {activeHub && <span className="header-people"><AvatarPile people={people.filter((p) => p.presence === 'online')} limit={3} /></span>}
          {pinned.length > 0 && <button className={`icon-btn ${pinnedOpen ? 'active' : ''}`} aria-label={t('pinnedMessages')} title={t('pinnedMessages')} onClick={() => setPinnedOpen(true)}><Icon name="pin" size={16} /></button>}
          <button className={`icon-btn ${membersOpen ? 'active' : ''}`} aria-label={t('members')} title={t('members')} onClick={() => setMembersOpen((v) => !v)}><Icon name="people" size={18} /></button>
          <button className="icon-btn" aria-label={t('openSearch')} title={t('openSearch')} onClick={() => window.dispatchEvent(new CustomEvent('sado:search', { detail: { channel } }))}><Icon name="search" size={18} /></button>
          {dm && otherId !== user.id && <div className="conversation-menu-wrap"><button className={`icon-btn ${conversationMenuOpen ? 'active' : ''}`} aria-label={t('conversationOptions')} title={t('conversationOptions')} aria-expanded={conversationMenuOpen} onClick={() => setConversationMenuOpen((open) => !open)}><Icon name="moreVertical" size={17} /></button>{conversationMenuOpen && <div className="conversation-menu conversation-menu-wide" onClick={(event) => event.stopPropagation()}>
            {mutedConversation ? (
              <button onClick={() => muteFor(0)}><Icon name="bell" size={15} /><span>{t('unmuteChat')}</span></button>
            ) : (
              <>
                <span className="conversation-menu-section"><Clock size={12} /> {t('muteChat')}</span>
                <button onClick={() => muteFor(3_600_000)}><BellOff size={14} />{t('mute1h')}</button>
                <button onClick={() => muteFor(28_800_000)}><BellOff size={14} />{t('mute8h')}</button>
                <button onClick={() => muteFor(604_800_000)}><BellOff size={14} />{t('mute1w')}</button>
                <button onClick={() => muteFor('forever')}><BellOff size={14} />{t('muteForever')}</button>
              </>
            )}
            <span className="menu-divider" />
            <button onClick={() => { setConversationMenuOpen(false); setNicknameDraft(chatControls.nicknames?.[otherId] ?? other.name); setEditNameOpen(true); }}><Icon name="edit" size={15} />{t('editContactName')}</button>
            <button onClick={() => { setConversationMenuOpen(false); setConfirmClear(true); }}><Icon name="trash" size={15} />{t('clearHistory')}</button>
            <button className="danger-action" onClick={() => { setConversationMenuOpen(false); setConfirmDeleteChat(true); }}><Icon name="trash" size={15} />{t('deleteChat')}</button>
            <button className="danger-action" onClick={() => { setConversationMenuOpen(false); setConfirmBlock(true); }}><Icon name={blockedConversation ? 'check' : 'lock'} size={15} />{t(blockedConversation ? 'unblockUser' : 'blockUser')}</button>
          </div>}</div>}
        </div>
      </header>
      {activeHub && <div className="mobile-room-strip">{activeHub.rooms.map((room) => <button key={room.id} className={channel === room.id ? 'active' : ''} onClick={() => setChannel(room.id)}><span>{room.kind === 'broadcast' ? <Icon name="megaphone" size={12} /> : '#'}</span>{room.name}</button>)}{canManageHub && <button className="mobile-room-add" aria-label={t('addRoom')} onClick={() => setNewRoomOpen(true)}><Icon name="plus" size={14} /></button>}</div>}

      {pinned.length > 0 && <button className="pinned-banner" onClick={() => setPinnedOpen(true)}><Icon name="pin" size={14} /><span><b>{t('pinnedSection')} ({pinned.length})</b><em>{pinned[pinned.length - 1].text || pinned[pinned.length - 1].sticker || (pinned[pinned.length - 1].poll?.question ?? '📷')}</em></span><Icon name="chevron" size={14} /></button>}

      <div className={`message-scroll ${pref.density === 'compact' ? 'compact' : ''} ${messageLayout === 'stream' ? 'stream-layout' : 'bubbles-layout'}`} ref={scrollRef} onScroll={recordScrollPosition} onClick={() => { setMoreFor(null); setActiveMsgId(null); }}>
        {remoteHistory && !clearMark && hasOlderHistory && messages.length > 0 && <button className="load-older-messages" onClick={() => void loadOlderHistory()} disabled={loadingOlderHistory}>{t(loadingOlderHistory ? 'loadingOlder' : 'loadOlder')}</button>}
        <div className="conversation-intro">
          {dm && <button type="button" className="intro-avatar" aria-label={t('profile')} title={t('profile')} onClick={() => window.dispatchEvent(new CustomEvent('sado:profile', { detail: other.id }))}><Avatar user={other} size="xl" showStatus /></button>}
          {!dm && <div className="intro-hub-mark" style={{ '--hub-hue': activeHub?.hue ?? 30 } as React.CSSProperties}><HubSymbol mark={activeHub?.emoji ?? 'icon:orbit'} size={22} /></div>}
          <h2>{dm ? (otherId === user.id ? t('saved') : nameOf(other)) : activeHub?.name}</h2>
          <p>{dm ? (other.bio || (otherId === user.id ? t('savedDM') : t('welcomeSub'))) : (activeRoom?.topic || activeHub?.about || t('quietSub'))}</p>
          {dm && <span className="member-since">@{other.username}{chatControls.nicknames?.[other.id] ? ` · ${other.name}` : ''} · {other.presence === 'online' ? t('online') : t(other.presence)}</span>}
          {!dm && activeHub && <span className="member-since">{people.length} {t('members').toLowerCase()} · #{activeRoom?.name}</span>}
        </div>

        {blockedConversation ? <div className="conversation-blocked-note"><Icon name="lock" size={18} /><b>{t('blockedConversation')}</b><span>{t('blockedConversationSub')}</span></div> : messages.length > 0 ? <div className="date-divider"><span>{t('today')}</span></div> : <div className="first-message-note">{allMessages.length > 0 && clearMark ? t('historyCleared') : t('noMessages')}</div>}
        {!blockedConversation && messages.map((msg, index) => {
          const person = data.users[msg.by] ?? user;
          const previous = messages[index - 1];
          const grouped = previous && previous.by === msg.by && msg.ts - previous.ts < 5 * 60_000;
          const isMine = msg.by === user.id;
          const replyMessage = msg.reply ? messages.find((m) => m.id === msg.reply) : undefined;
          const totalPollVotes = msg.poll ? msg.poll.options.reduce((s, o) => s + o.votes.length, 0) : 0;
          const senderPro = hasAura(person.id);
          const senderTier = senderPro ? person.aura?.tier : undefined;
          const fontClass = senderPro && person.chatFont ? `font-${person.chatFont}` : '';
          const effectClass = senderPro && person.messageEffect && person.messageEffect !== 'none' ? `effect-${person.messageEffect}` : '';
          const rowActive = activeMsgId === msg.id || moreFor === `r:${msg.id}` || moreFor === `m:${msg.id}`;

          return <article id={`msg-${msg.id}`} key={msg.id} onClick={(e) => { if ((e.target as HTMLElement).closest('button, a, audio, input, form')) return; e.stopPropagation(); setActiveMsgId((cur) => (cur === msg.id ? null : msg.id)); setMoreFor(null); }} className={cx('message-row', isMine && 'mine', grouped && 'grouped', msg.pinned && 'message-pinned', effectClass, rowActive && 'is-active')}>
            {!grouped && <button type="button" className="message-avatar" aria-label={t('profile')} title={t('profile')} onClick={() => window.dispatchEvent(new CustomEvent('sado:profile', { detail: person.id }))}><Avatar user={person} size="sm" /></button>}
            {grouped && <time className="group-time" title={fmtTime(msg.ts, lang)}>{fmtTime(msg.ts, lang)}</time>}
            <div className="message-main">
              {!grouped && <div className="message-byline">
                <button className={`message-name ${fontClass}`} onClick={() => window.dispatchEvent(new CustomEvent('sado:profile', { detail: person.id }))}>{nameOf(person)}</button>
                <VerifiedBadge user={person} size={13} />
                {senderPro && <span className={`pro-flex-pill tier-${senderTier ?? 'ember'}`}>{senderTier === 'nova' ? <Crown size={10} /> : <Sparkles size={10} />}{senderTier === 'nova' ? 'MAX' : 'PRO'}</span>}
                <time>{fmtTime(msg.ts, lang)}</time>
                {isMine && <span className="message-mine-tag">{t('you')}</span>}
              </div>}
              {replyMessage && <button className="reply-preview" onClick={() => jumpTo(replyMessage.id)}><Icon name="reply" size={12} /><span>{t('replyBadge')} {nameOf(data.users[replyMessage.by]) || t('you')}:</span><em>{replyMessage.text || replyMessage.sticker || replyMessage.poll?.question || '📷'}</em></button>}
              {editId === msg.id ? <form className="edit-message" onSubmit={(e) => { e.preventDefault(); editSave(msg); }}><input ref={editRef} value={editText} maxLength={maxChars} onChange={(e) => setEditText(e.target.value)} /><div><button type="button" className="text-action" onClick={() => setEditId(null)}>{t('cancel')}</button><button type="submit" className="btn btn-primary btn-small">{t('save')}</button></div></form> : <>
                {msg.text && <div className={`message-text ${fontClass} ${effectClass}`}>{renderRichText(msg.text)}{msg.edited && <span className="edited-label"> · {t('edit').toLowerCase()}</span>}</div>}
                {msg.text && extractYouTubeIds(msg.text).map((ytId) => <YouTubeEmbedCard key={ytId} videoId={ytId} />)}
                {msg.audio && <div className="msg-audio-player"><audio controls src={msg.audio} preload="metadata" /></div>}
                {msg.sticker && <div className="message-sticker"><VectorBadge id={msg.sticker} size="lg" /></div>}
                {msg.image && <button type="button" className="message-image-btn" onClick={() => setLightboxSrc(msg.image!)}><img className="message-image" src={msg.image} alt="" loading="lazy" /></button>}
                {msg.poll && <div className="message-poll">
                  <div className="poll-head"><Icon name="barChart" size={15} /><strong>{msg.poll.question}</strong></div>
                  <div className="poll-options">
                    {msg.poll.options.map((opt) => {
                      const pct = totalPollVotes > 0 ? Math.round((opt.votes.length / totalPollVotes) * 100) : 0;
                      const picked = opt.votes.includes(user.id);
                      return <button key={opt.id} type="button" className={`poll-option ${picked ? 'picked' : ''}`} onClick={() => votePoll(msg.ch, msg.id, opt.id, user.id)}>
                        <span className="poll-bar" style={{ width: `${pct}%` }} />
                        <span className="poll-label">{picked && <Icon name="check" size={12} />}{opt.text}</span>
                        <span className="poll-pct">{pct}%</span>
                      </button>;
                    })}
                  </div>
                  <small className="poll-foot">{t('pollVotes', { count: totalPollVotes })}</small>
                </div>}
              </>}
              {Object.keys(msg.reactions).length > 0 && <div className="reactions">{Object.entries(msg.reactions).map(([emoji, ids]) => <button key={emoji} className={`reaction ${ids.includes(user.id) ? 'reacted' : ''}`} onClick={() => { void onReaction(msg, emoji); }}><span>{emoji}</span><small>{ids.length}</small></button>)}<button className="reaction-add" aria-label={t('react')} onClick={() => setMoreFor(moreFor === `r:${msg.id}` ? null : `r:${msg.id}`)}><Icon name="plus" size={12} /></button></div>}
            </div>
            {!editId && <div className="message-actions"><button className="action-tiny" aria-label={t('react')} title={t('react')} onClick={(e) => { e.stopPropagation(); setMoreFor(moreFor === `r:${msg.id}` ? null : `r:${msg.id}`); }}><Icon name="smile" size={14} /></button><button className="action-tiny" aria-label={t('reply')} title={t('reply')} onClick={() => quote(msg)}><Icon name="reply" size={14} /></button><button className="action-tiny" aria-label={t('more')} title={t('more')} onClick={(e) => { e.stopPropagation(); setMoreFor(moreFor === `m:${msg.id}` ? null : `m:${msg.id}`); }}><Icon name="more" size={14} /></button>
              {moreFor === `r:${msg.id}` && <div className="reaction-flyout" onClick={(e) => e.stopPropagation()}>{quickEmoji.map((emoji) => <button key={emoji} aria-label={`${t('react')} ${emoji}`} onClick={() => { void onReaction(msg, emoji); setMoreFor(null); }}>{emoji}</button>)}</div>}
              {moreFor === `m:${msg.id}` && <div className="message-menu" onClick={(e) => e.stopPropagation()}><button onClick={() => quote(msg)}><Icon name="reply" size={14} />{t('reply')}</button>{msg.text && <button onClick={async () => { try { await navigator.clipboard.writeText(msg.text); tell(t('copied'), 'good'); } catch { tell(t('err.generic'), 'bad'); } setMoreFor(null); }}><Icon name="copy" size={14} />{t('copy')}</button>}<button onClick={() => { void onPin(msg); }}><Icon name="pin" size={14} />{msg.pinned ? t('unpin') : t('pin')}</button>{isMine && msg.text && <button onClick={() => editStart(msg)}><Icon name="edit" size={14} />{t('edit')}</button>}<button className="danger-action" onClick={() => { setConfirmDelete(msg); setConfirmDeleteEveryone(isMine); setMoreFor(null); }}><Icon name="trash" size={14} />{t('delete')}</button></div>}
            </div>}
          </article>;
        })}
      </div>

      {newMessageCount > 0 && <button type="button" className="new-messages-jump" onClick={() => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); nearBottomRef.current = true; setNewMessageCount(0); }}><Icon name="down" size={15} />{t('newMessagesCount', { count: newMessageCount })}</button>}
      {reply && !blockedConversation && <div className="replying-bar"><Icon name="reply" size={14} /><span>{t('replyBadge')} <b>{nameOf(data.users[replyTargetMsg?.by ?? '']) || t('you')}</b></span><em>{replyTargetMsg?.text || replyTargetMsg?.sticker || replyTargetMsg?.poll?.question || '📷'}</em><button className="icon-btn" aria-label={t('cancel')} onClick={() => setReply(undefined)}><Icon name="close" size={13} /></button></div>}

      <form className="composer-wrap" onSubmit={submit}>
        {emojiOpen && (
          <div className="composer-drawer" role="group" aria-label={t('emoji')}>
            <div className="composer-drawer-head">
              <button type="button" className={emojiTab === 'vectors' ? 'active' : ''} onClick={() => setEmojiTab('vectors')}>
                <Sparkles size={13} />
                <span>{t('stickerTab')}</span>
              </button>
              <button type="button" className={emojiTab === 'emoji' ? 'active' : ''} onClick={() => setEmojiTab('emoji')}>
                <Smile size={13} />
                <span>{t('emojiTab')}</span>
              </button>
            </div>
            <div className="composer-drawer-body">
              {emojiTab === 'vectors' ? (
                <>
                  {ownedStickerPacks.map((pack) => (
                    <div key={pack.id} className="composer-pack-group">
                      <small>{pack.name}</small>
                      <div className="composer-vector-grid">
                        {pack.stickers?.map((badgeId, i) => (
                          <button key={`${pack.id}-${badgeId}-${i}`} type="button" title={pack.name} onClick={async () => { try { await sendMessage({ channel, userId: user.id, text: '', sticker: badgeId, reply }); setReply(undefined); setEmojiOpen(false); } catch (err) { report(err); } }}>
                            <VectorBadge id={badgeId} size="sm" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="composer-pack-group">
                    <small>{t('stickers')}</small>
                    <div className="composer-vector-grid">
                      {VECTOR_BADGES.slice(0, 12).map((badge) => (
                        <button key={badge.id} type="button" title={badge.label} onClick={async () => { try { await sendMessage({ channel, userId: user.id, text: '', sticker: badge.id, reply }); setReply(undefined); setEmojiOpen(false); } catch (err) { report(err); } }}>
                          <VectorBadge id={badge.id} size="sm" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="composer-emoji-grid">
                  {quickEmoji.map((emoji, i) => (
                    <button key={`${emoji}${i}`} type="button" onClick={() => { setComposer((v) => v + emoji); setEmojiOpen(false); textareaRef.current?.focus(); }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {attachOpen && !recording && !blockedConversation && !isSuspended && !isBroadcastLocked && (
          <div className="composer-attach-menu" role="menu" aria-label={t('attachMore')}>
            <button type="button" onClick={() => { setAttachOpen(false); imageRef.current?.click(); }}><Icon name="image" size={16} /><span>{t('attach')}</span></button>
            <button type="button" onClick={() => { setAttachOpen(false); gifRef.current?.click(); }}><span className="attach-gif-pill">GIF</span><span>{t('attachGif')}</span></button>
            <button type="button" onClick={() => { setAttachOpen(false); setYoutubeOpen(true); }}><Video size={16} /><span>{t('youtubeAttach')}</span></button>
            {!remoteHistory && <button type="button" onClick={() => { setAttachOpen(false); setPollOpen(true); }}><Icon name="barChart" size={16} /><span>{t('createPoll')}</span></button>}
            <div className="composer-attach-fmt">
              <button type="button" title={t('formatBold')} onClick={() => { setAttachOpen(false); wrapSelection('**', '**'); }}><b>B</b></button>
              <button type="button" title={t('formatCode')} onClick={() => { setAttachOpen(false); wrapSelection('`', '`'); }}><code>&lt;/&gt;</code></button>
              <button type="button" title={t('formatSpoiler')} onClick={() => { setAttachOpen(false); wrapSelection('||', '||'); }}><span>||</span></button>
            </div>
          </div>
        )}
        {isSuspended ? <div className="blocked-composer-note">{t('suspendedNotice')}</div> : blockedConversation ? <div className="blocked-composer-note">{t('blockedConversationSub')}</div> : isBroadcastLocked ? <div className="blocked-composer-note"><Icon name="megaphone" size={15} /> {t('broadcastOnly')}</div> : recording ? (
          <div className="composer-box voice-rec-bar">
            <span className="voice-rec-dot" />
            <span className="voice-rec-time">{Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, '0')}</span>
            <span className="voice-rec-hint">{t('voiceMessage')}</span>
            <button type="button" className="composer-icon danger-ghost" title={t('voiceCancel')} aria-label={t('voiceCancel')} onClick={() => stopVoice(true)}><Trash2 size={16} /></button>
            <button type="button" className="send-btn" title={t('voiceStop')} aria-label={t('voiceStop')} onClick={() => stopVoice(false)}><Square size={14} /></button>
          </div>
        ) : <div className="composer-box">
          <input ref={imageRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={attachPicture} />
          <input ref={gifRef} hidden type="file" accept="image/gif" onChange={attachPicture} />
          <button className={cx('composer-icon composer-more-btn', attachOpen && 'active')} type="button" title={t('attachMore')} aria-label={t('attachMore')} aria-expanded={attachOpen} onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }}><Icon name={attachOpen ? 'close' : 'plus'} size={18} /></button>
          <div className="composer-rail">
            <button className="composer-icon" type="button" title={t('attach')} aria-label={t('attach')} disabled={imageBusy} onClick={() => imageRef.current?.click()}><Icon name="image" size={18} /></button>
            <button className="composer-gif" type="button" title={t('attachGif')} aria-label={t('attachGif')} disabled={imageBusy} onClick={() => gifRef.current?.click()}>GIF</button>
            <button className="composer-icon" type="button" title={t('youtubeAttach')} aria-label={t('youtubeAttach')} onClick={() => setYoutubeOpen(true)}><Video size={17} /></button>
            {!remoteHistory && <button className="composer-icon" type="button" title={t('createPoll')} aria-label={t('createPoll')} onClick={() => setPollOpen(true)}><Icon name="barChart" size={17} /></button>}
          </div>
          <textarea ref={textareaRef} rows={1} placeholder={imageBusy ? t('loading') : t('messagePlaceholder')} value={composer} maxLength={maxChars} onChange={(e) => setComposer(e.target.value)} onKeyDown={keySend} aria-label={t('messagePlaceholder')} />
          <div className="composer-format-rail">
            <button className="composer-fmt-btn" type="button" title={t('formatBold')} onClick={() => wrapSelection('**', '**')}><b>B</b></button>
            <button className="composer-fmt-btn" type="button" title={t('formatCode')} onClick={() => wrapSelection('`', '`')}><code>&lt;/&gt;</code></button>
            <button className="composer-fmt-btn" type="button" title={t('formatSpoiler')} onClick={() => wrapSelection('||', '||')}><span>||</span></button>
          </div>
          <button className="composer-icon emoji-toggle" type="button" aria-label={t('emoji')} title={t('emoji')} onClick={() => { setEmojiOpen((v) => !v); setAttachOpen(false); }}><Icon name="smile" size={18} /></button>
          <button className="composer-icon composer-mic-btn" type="button" aria-label={t('voiceRecord')} title={t('voiceRecord')} onClick={() => void startVoice()}><Mic size={17} /></button>
          <span className="composer-count">{composer.length > maxChars - 160 ? `${composer.length}/${maxChars}` : ''}</span>
          <button type="submit" className="send-btn" disabled={!composer.trim() || imageBusy} aria-label={t('send')} title={t('send')}><Icon name="send" size={17} /></button>
        </div>}
        <div className="composer-caption"><span>{t('messageHint')}</span>{activeAura && <span className="aura-caption"><Icon name="spark" size={11} /> ORBIT+ {activeAura.tier.toUpperCase()}</span>}</div>
      </form>
    </section>

    {membersOpen && <aside className="members-drawer"><div className="members-head"><strong>{dm ? (otherId === user.id ? t('profile') : t('userProfileTitle', { name: nameOf(other) })) : t('members')}</strong><button className="icon-btn" aria-label={t('cancel')} onClick={() => setMembersOpen(false)}><Icon name="close" size={16} /></button></div>{dm ? <ProfileExplorerContent target={other} viewer={user} db={data} variant="drawer" action={<button className="btn btn-secondary btn-full" onClick={() => setMembersOpen(false)}>{t('backToApp')}</button>} /> : <><div className="member-list">{people.map((p) => <button key={p.id} className="member-row" onClick={() => { if (p.id !== user.id) { setChannel(startDM(user.id, p.id)); setMembersOpen(false); } }}><Avatar user={p} size="sm" showStatus /><span><b>{p.name}<VerifiedBadge user={p} size={13} /></b><small>{p.statusText || t(p.presence)}</small></span>{activeHub?.members[p.id] === 'owner' && <span className="role-chip owner">{t('owner')}</span>}{activeHub?.members[p.id] === 'mod' && <span className="role-chip mod">{t('moderator')}</span>}</button>)}</div><div className="member-drawer-actions">{canManageHub && <button className="btn btn-outline btn-small" onClick={() => setHubManageOpen(true)}><Icon name="sliders" size={14} />{t('hubSettings')}</button>}<button className="btn btn-outline btn-small" onClick={() => setInviteModalOpen(true)}><Icon name="link" size={14} />{t('inviteCopy')}</button>{activeHub!.ownerId !== user.id && <button className="btn btn-ghost btn-small" onClick={() => { setMembersOpen(false); setLeaveOpen(true); }}><Icon name="back" size={14} />{t('leaveHub')}</button>}</div></>}</aside>}

    <Modal open={pinnedOpen} onClose={() => setPinnedOpen(false)} title={t('pinnedMessages')} size="md">
      {pinned.length ? <div className="pinned-list">{pinned.map((pm) => <div key={pm.id} className="pinned-item">
        <div className="pinned-item-body"><b>{data.users[pm.by]?.name ?? t('you')}</b><p>{pm.text || pm.sticker || pm.poll?.question || '📷'}</p><small>{fmtTime(pm.ts, lang)}</small></div>
        <button className="btn btn-outline btn-small" onClick={() => { setPinnedOpen(false); jumpTo(pm.id); }}>{t('viewHub')}</button>
        <button className="icon-btn" title={t('unpin')} onClick={() => void onPin(pm)}><Icon name="close" size={14} /></button>
      </div>)}</div> : <p className="subtle-empty">{t('noPinned')}</p>}
    </Modal>

    <Modal open={!!lightboxSrc} onClose={() => setLightboxSrc(null)} title={t('attach')} size="lg">
      {lightboxSrc && <div className="lightbox-wrap"><img src={lightboxSrc} alt="" className="lightbox-img" /></div>}
    </Modal>

    <Modal open={pollOpen} onClose={() => setPollOpen(false)} title={t('createPoll')} size="sm">
      <form className="stack-form" onSubmit={submitPoll}>
        <label className="field-label">{t('pollQuestion')}<input className="field-input" autoFocus value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} maxLength={160} required /></label>
        {pollOptions.map((opt, idx) => (
          <label key={idx} className="field-label">{t('pollOption', { n: idx + 1 })}
            <input className="field-input" value={opt} onChange={(e) => setPollOptions((prev) => prev.map((v, i) => i === idx ? e.target.value : v))} maxLength={80} required={idx < 2} />
          </label>
        ))}
        {pollOptions.length < 5 && <button type="button" className="btn btn-ghost btn-small" onClick={() => setPollOptions((p) => [...p, ''])}><Icon name="plus" size={14} />{t('addOption')}</button>}
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setPollOpen(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary">{t('send')}</button></div>
      </form>
    </Modal>

    {activeHub && hubManageOpen && <HubSettingsModal open={hubManageOpen} onClose={() => setHubManageOpen(false)} hub={activeHub} db={data} user={user} />}
    <HubInviteModal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} hub={activeHub} />

    <Modal open={!!confirmDelete} onClose={() => { setConfirmDelete(null); setConfirmDeleteEveryone(false); }} title={t('deleteConfirm')} subtitle={t(confirmDelete && canDeleteMessageForEveryone(confirmDelete.ch, confirmDelete, user.id) ? 'deleteConfirmSubOwn' : 'deleteConfirmSubOther')} size="sm">{confirmDelete && canDeleteMessageForEveryone(confirmDelete.ch, confirmDelete, user.id) && <label className="delete-everyone-toggle"><input type="checkbox" checked={confirmDeleteEveryone} onChange={(event) => setConfirmDeleteEveryone(event.target.checked)} /><span>{t('deleteForEveryone')}</span></label>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => { setConfirmDelete(null); setConfirmDeleteEveryone(false); }}>{t('cancel')}</button><button className="btn btn-danger" onClick={onDelete}>{t('delete')}</button></div></Modal>
    <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title={t('clearHistory')} subtitle={t('clearHistoryConfirm')} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setConfirmClear(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={clearConversation}>{t('clearHistory')}</button></div></Modal>
    <Modal open={confirmDeleteChat} onClose={() => setConfirmDeleteChat(false)} title={t('deleteChat')} subtitle={t('deleteChatConfirm')} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setConfirmDeleteChat(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={deleteChatNow}>{t('deleteChat')}</button></div></Modal>
    <Modal open={confirmBlock} onClose={() => !blockBusy && setConfirmBlock(false)} title={t(blockedConversation ? 'unblockUser' : 'blockUser')} subtitle={t(blockedConversation ? 'unblockConfirm' : 'blockConfirm', { name: other.name })} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setConfirmBlock(false)} disabled={blockBusy}>{t('cancel')}</button><button className={blockedConversation ? 'btn btn-primary' : 'btn btn-danger'} onClick={() => void confirmBlockChange()} disabled={blockBusy}>{t(blockedConversation ? 'unblockUser' : 'blockUser')}</button></div></Modal>
    <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title={t('leaveConfirm')} subtitle={t('leaveHubSub')} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setLeaveOpen(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={() => void confirmLeaveHub()}>{t('leaveHub')}</button></div></Modal>
    <Modal open={newRoomOpen} onClose={() => setNewRoomOpen(false)} title={t('addRoom')} subtitle={t('newRoom')} size="sm"><form className="stack-form" onSubmit={createRoom}><label className="field-label">{t('newRoom')}<span className="input-prefix-wrap"><span className="input-prefix">#</span><input autoFocus className="field-input prefix-field" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="behind-the-scenes" maxLength={24} /></span></label><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setNewRoomOpen(false)}>{t('cancel')}</button><button className="btn btn-primary">{t('create')}</button></div></form></Modal>
    <Modal open={youtubeOpen} onClose={() => setYoutubeOpen(false)} title={t('youtubeAttach')} subtitle={t('youtubePrompt')} size="sm"><form className="stack-form" onSubmit={sendYouTube}><label className="field-label">YouTube URL<input autoFocus className="field-input" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setYoutubeOpen(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary">{t('send')}</button></div></form></Modal>
    <Modal open={editNameOpen} onClose={() => setEditNameOpen(false)} title={t('editContactName')} subtitle={`@${other.username} · ${other.name}`} size="sm">
      <form className="stack-form" onSubmit={(e) => { e.preventDefault(); setCustomNickname(user.id, otherId, nicknameDraft); setEditNameOpen(false); tell(t('contactNameSaved'), 'good'); }}>
        <label className="field-label">{t('displayName')}
          <input autoFocus className="field-input" value={nicknameDraft} maxLength={32} placeholder={t('contactNamePlaceholder')} onChange={(e) => setNicknameDraft(e.target.value)} />
        </label>
        <div className="modal-actions">
          {chatControls.nicknames?.[otherId] && (
            <button type="button" className="btn btn-ghost" onClick={() => { setCustomNickname(user.id, otherId, ''); setEditNameOpen(false); tell(t('contactNameSaved'), 'good'); }}>{t('resetContactName')}</button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setEditNameOpen(false)}>{t('cancel')}</button>
          <button type="submit" className="btn btn-primary">{t('save')}</button>
        </div>
      </form>
    </Modal>
  </div>;
}
