import { AURA, LIMITS } from '../config';
import { uid } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import type { Message, PollData, User } from './types';
import { getAura } from './market';
import { deleteRemoteHubMessage, deleteRemoteMessage, editRemoteHubMessage, editRemoteMessage, fetchOlderRemoteHubMessages, fetchOlderRemoteMessages, insertRemoteHubMessage, insertRemoteMessage, pinRemoteHubMessage, pinRemoteMessage, toggleRemoteHubReaction, toggleRemoteReaction, updateRemoteBlock, updateRemoteProfile } from './cloud';
import { setBlocked } from './chatControls';

export function dmId(a: string, b: string): string {
  if (a === b) return `dm:${a}:${a}`;
  return `dm:${[a, b].sort().join(':')}`;
}

export function parseDM(id: string): [string, string] | null {
  if (!id.startsWith('dm:')) return null;
  const parts = id.split(':');
  return parts.length === 3 ? [parts[1], parts[2]] : null;
}

export function startDM(currentId: string, otherId: string): string {
  const person = db.get().users[otherId];
  if (!person) throw new AppError('err.notMember');
  const id = dmId(currentId, otherId);
  db.transaction((d) => {
    for (const userId of new Set([currentId, otherId])) {
      d.dms[userId] ??= [];
      if (!d.dms[userId].includes(id)) d.dms[userId].unshift(id);
    }
    d.msgs[id] ??= [];
  });
  return id;
}

export function hasAccess(channel: string, userId: string): boolean {
  const dm = parseDM(channel);
  if (dm) return dm.includes(userId);
  for (const hub of Object.values(db.get().hubs)) {
    if (hub.rooms.some((r) => r.id === channel)) return !!hub.members[userId];
  }
  return false;
}

export function canPostInChannel(channel: string, userId: string): boolean {
  if (!hasAccess(channel, userId)) return false;
  const user = db.get().users[userId];
  if (user?.suspended) return false;
  for (const hub of Object.values(db.get().hubs)) {
    const room = hub.rooms.find((r) => r.id === channel);
    if (room) {
      if (room.kind === 'broadcast') return ['owner', 'mod'].includes(hub.members[userId] ?? '');
      return true;
    }
  }
  return true;
}

function isRemoteHubChannel(channel: string, userId: string): boolean {
  return Object.values(db.get().hubs).some((hub) => hub.remote && !!hub.members[userId] && hub.rooms.some((room) => room.id === channel));
}

export function sendMessage(input: { channel: string; userId: string; text: string; reply?: string; sticker?: string; image?: string; poll?: PollData }): Message | Promise<Message> {
  if (!canPostInChannel(input.channel, input.userId)) throw new AppError('err.messageRestricted');
  const text = input.text.replace(/\r\n?/g, '\n').trim();
  const user = db.get().users[input.userId];
  if (!user) throw new AppError('err.notMember');
  const activeAura = getAura(user);
  const imageMax = activeAura?.tier === 'nova' ? LIMITS.imageCharsAura : activeAura ? LIMITS.imageChars : LIMITS.avatarChars;
  if (!text && !input.sticker && !input.image && !input.poll) throw new AppError('err.emptyMessage');
  const max = activeAura ? AURA[activeAura.tier].maxChars : LIMITS.message;
  if (text.length > max) throw new AppError('err.messageLong');
  if (input.image && (!/^data:image\/(?:jpeg|gif);base64,[a-zA-Z0-9+/=]+$/.test(input.image) || input.image.length > imageMax)) throw new AppError('err.imageTooBig');
  if (input.sticker && !/^[\p{Extended_Pictographic}\u200d\ufe0f\u{1f1e6}-\u{1f1ff}]{1,24}$/u.test(input.sticker)) throw new AppError('err.badText');
  const dm = parseDM(input.channel);
  if (dm && dm[0] !== dm[1] && dm.every((id) => db.get().users[id]?.serverBacked)) {
    return insertRemoteMessage({ ...input, text });
  }
  if (isRemoteHubChannel(input.channel, input.userId)) return insertRemoteHubMessage({ ...input, text });
  const id = uid(18);
  const msg: Message = { id, ch: input.channel, by: input.userId, text, ts: Date.now(), reactions: {}, reply: input.reply, sticker: input.sticker, image: input.image, poll: input.poll };
  db.transaction((d) => {
    d.msgs[input.channel] ??= [];
    if (d.msgs[input.channel].length >= LIMITS.perChannel) d.msgs[input.channel].shift();
    d.msgs[input.channel].push(msg);
  });
  return msg;
}

export function votePoll(channel: string, messageId: string, optionId: string, userId: string): void {
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg?.poll || !hasAccess(channel, userId)) throw new AppError('err.notMember');
    for (const opt of msg.poll.options) {
      opt.votes = opt.votes.filter((id) => id !== userId);
      if (opt.id === optionId) opt.votes.push(userId);
    }
  });
}

export function updateRead(userId: string, channel: string, at = Date.now()): void {
  try {
    db.transaction((d) => {
      d.reads[userId] ??= {};
      d.reads[userId][channel] = at;
    });
  } catch {
    // Read markers are optional; a full local store should not break opening a conversation.
  }
}

export function loadOlderMessages(channel: string, userId: string, before: Message): Promise<boolean> {
  if (!hasAccess(channel, userId)) throw new AppError('err.notMember');
  const dm = parseDM(channel);
  if (dm && dm[0] !== dm[1] && dm.every((id) => db.get().users[id]?.serverBacked)) return fetchOlderRemoteMessages(channel, userId, before);
  if (isRemoteHubChannel(channel, userId)) return fetchOlderRemoteHubMessages(channel, userId, before);
  return Promise.resolve(false);
}

export function addReaction(channel: string, messageId: string, userId: string, emoji: string): void | Promise<void> {
  if (!/^\p{Extended_Pictographic}.{0,5}$/u.test(emoji)) throw new AppError('err.badText');
  const dm = parseDM(channel);
  if (dm && dm[0] !== dm[1] && dm.every((id) => db.get().users[id]?.serverBacked)) {
    return toggleRemoteReaction(channel, messageId, userId, emoji);
  }
  if (isRemoteHubChannel(channel, userId)) return toggleRemoteHubReaction(channel, messageId, userId, emoji);
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg || !hasAccess(channel, userId)) throw new AppError('err.notMember');
    const people = msg.reactions[emoji] ?? [];
    msg.reactions[emoji] = people.includes(userId) ? people.filter((id) => id !== userId) : [...people, userId];
    if (!msg.reactions[emoji].length) delete msg.reactions[emoji];
  });
}

export function editMessage(channel: string, messageId: string, userId: string, text: string): void | Promise<void> {
  const clean = text.trim().replace(/\r\n?/g, '\n');
  if (!clean) throw new AppError('err.emptyMessage');
  const user = db.get().users[userId];
  const activeAura = user ? getAura(user) : null;
  const max = activeAura ? AURA[activeAura.tier].maxChars : LIMITS.message;
  if (clean.length > max) throw new AppError('err.messageLong');
  const dm = parseDM(channel);
  if (dm && dm[0] !== dm[1] && dm.every((id) => db.get().users[id]?.serverBacked)) {
    return editRemoteMessage(channel, messageId, userId, clean);
  }
  if (isRemoteHubChannel(channel, userId)) return editRemoteHubMessage(channel, messageId, userId, clean);
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg || msg.by !== userId) throw new AppError('err.notMember');
    msg.text = clean;
    msg.edited = Date.now();
  });
}

export function deleteMessage(channel: string, messageId: string, userId: string): void | Promise<void> {
  const dm = parseDM(channel);
  const hub = Object.values(db.get().hubs).find((item) => item.rooms.some((room) => room.id === channel));
  const message = db.get().msgs[channel]?.find((item) => item.id === messageId);
  const actor = db.get().users[userId];
  const canDelete = !!message && (message.by === userId
    || !!actor?.isAdmin
    || (!!dm && dm[0] !== dm[1] && dm.includes(userId))
    || (!!hub && ['owner', 'mod'].includes(hub.members[userId] ?? '')));
  if (!canDelete) throw new AppError('err.notMember');
  if (dm && dm[0] !== dm[1] && dm.every((id) => db.get().users[id]?.serverBacked)) {
    return deleteRemoteMessage(channel, messageId, userId);
  }
  if (isRemoteHubChannel(channel, userId)) return deleteRemoteHubMessage(channel, messageId, userId);
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg || !canDelete) throw new AppError('err.notMember');
    d.msgs[channel] = d.msgs[channel].filter((m) => m.id !== messageId);
  });
}

export function canDeleteMessageForEveryone(channel: string, message: Message, userId: string): boolean {
  if (message.by === userId) return true;
  if (db.get().users[userId]?.isAdmin) return true;
  const dm = parseDM(channel);
  if (dm && dm[0] !== dm[1] && dm.includes(userId)) return true;
  const hub = Object.values(db.get().hubs).find((item) => item.rooms.some((room) => room.id === channel));
  return !!hub && ['owner', 'mod'].includes(hub.members[userId] ?? '');
}

export function pinMessage(channel: string, messageId: string, userId: string): void | Promise<void> {
  if (!hasAccess(channel, userId)) throw new AppError('err.notMember');
  const dm = parseDM(channel);
  if (dm && dm[0] !== dm[1] && dm.every((id) => db.get().users[id]?.serverBacked)) {
    return pinRemoteMessage(channel, messageId, userId);
  }
  if (isRemoteHubChannel(channel, userId)) return pinRemoteHubMessage(channel, messageId, userId);
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg) throw new AppError('err.notMember');
    if (msg.pinned) delete msg.pinned;
    else msg.pinned = true;
  });
}

export function setPresence(userId: string, presence: User['presence'], statusText?: string): void | Promise<void> {
  const currentUser = db.get().users[userId];
  if (currentUser?.serverBacked) return updateRemoteProfile(userId, { presence, statusText });
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) return;
    user.presence = presence;
    if (statusText !== undefined) user.statusText = statusText.slice(0, LIMITS.status);
  });
}

export async function setUserBlocked(userId: string, otherId: string, blocked: boolean): Promise<void> {
  if (db.get().users[userId]?.serverBacked) {
    await updateRemoteBlock(userId, otherId, blocked);
    if (!blocked) setBlocked(userId, otherId, false);
    return;
  }
  setBlocked(userId, otherId, blocked);
}
