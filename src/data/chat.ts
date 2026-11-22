import { LIMITS } from '../config';
import { uid } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import type { Message, User } from './types';
import { getAura } from './market';

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

export function sendMessage(input: { channel: string; userId: string; text: string; reply?: string; sticker?: string; image?: string }): Message {
  if (!hasAccess(input.channel, input.userId)) throw new AppError('err.notMember');
  const text = input.text.replace(/\r\n?/g, '\n').trim();
  const user = db.get().users[input.userId];
  if (!user) throw new AppError('err.notMember');
  const activeAura = getAura(user);
  const imageMax = activeAura?.tier === 'nova' ? LIMITS.imageCharsAura : activeAura ? LIMITS.imageChars : LIMITS.avatarChars;
  if (!text && !input.sticker && !input.image) throw new AppError('err.emptyMessage');
  const max = activeAura?.tier === 'nova' ? LIMITS.messageNova : LIMITS.message;
  if (text.length > max) throw new AppError('err.messageLong');
  if (input.image && (!/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(input.image) || input.image.length > imageMax)) throw new AppError('err.imageTooBig');
  if (input.sticker && !/^[\p{Extended_Pictographic}\u200d\ufe0f\u{1f1e6}-\u{1f1ff}]{1,24}$/u.test(input.sticker)) throw new AppError('err.badText');
  const id = uid(18);
  const msg: Message = { id, ch: input.channel, by: input.userId, text, ts: Date.now(), reactions: {}, reply: input.reply, sticker: input.sticker, image: input.image };
  db.transaction((d) => {
    d.msgs[input.channel] ??= [];
    if (d.msgs[input.channel].length >= LIMITS.perChannel) d.msgs[input.channel].shift();
    d.msgs[input.channel].push(msg);
  });
  return msg;
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

export function addReaction(channel: string, messageId: string, userId: string, emoji: string): void {
  if (!/^\p{Extended_Pictographic}.{0,5}$/u.test(emoji)) throw new AppError('err.badText');
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg || !hasAccess(channel, userId)) throw new AppError('err.notMember');
    const people = msg.reactions[emoji] ?? [];
    msg.reactions[emoji] = people.includes(userId) ? people.filter((id) => id !== userId) : [...people, userId];
    if (!msg.reactions[emoji].length) delete msg.reactions[emoji];
  });
}

export function editMessage(channel: string, messageId: string, userId: string, text: string): void {
  const clean = text.trim().replace(/\r\n?/g, '\n');
  if (!clean) throw new AppError('err.emptyMessage');
  const user = db.get().users[userId];
  const max = user && getAura(user)?.tier === 'nova' ? LIMITS.messageNova : LIMITS.message;
  if (clean.length > max) throw new AppError('err.messageLong');
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg || msg.by !== userId) throw new AppError('err.notMember');
    msg.text = clean;
    msg.edited = Date.now();
  });
}

export function deleteMessage(channel: string, messageId: string, userId: string): void {
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg || msg.by !== userId) throw new AppError('err.notMember');
    d.msgs[channel] = d.msgs[channel].filter((m) => m.id !== messageId);
  });
}

export function pinMessage(channel: string, messageId: string, userId: string): void {
  if (!hasAccess(channel, userId)) throw new AppError('err.notMember');
  db.transaction((d) => {
    const msg = d.msgs[channel]?.find((m) => m.id === messageId);
    if (!msg) throw new AppError('err.notMember');
    if (msg.pinned) delete msg.pinned;
    else msg.pinned = true;
  });
}

export function setPresence(userId: string, presence: User['presence'], statusText?: string): void {
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) return;
    user.presence = presence;
    if (statusText !== undefined) user.statusText = statusText.slice(0, LIMITS.status);
  });
}
