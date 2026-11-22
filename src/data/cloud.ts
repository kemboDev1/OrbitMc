import { db } from './db';
import type { Message, Presence, User } from './types';
import { requireSupabase } from '../lib/supabase';
import { AppError } from './errors';

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  hue: number;
  avatar: string | null;
  presence: Presence;
  status_text: string;
  created_at: string;
}

interface DirectMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  image: string | null;
  sticker: string | null;
  reply_to: string | null;
  edited_at: string | null;
  pinned: boolean;
  reactions: Record<string, string[]>;
  created_at: string;
}

function conversationId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`;
}

function toUser(row: ProfileRow, previous?: User): User {
  return {
    ...previous,
    id: row.id,
    username: row.username,
    name: row.display_name,
    bio: row.bio,
    hue: row.hue,
    avatar: row.avatar ?? undefined,
    presence: row.presence,
    statusText: row.status_text,
    createdAt: new Date(row.created_at).getTime(),
    serverBacked: true,
    bot: undefined,
    auth: undefined,
    aura: previous?.aura ?? null,
    sparks: previous?.sparks ?? 300,
    inventory: previous?.inventory ?? [],
    frame: previous?.frame ?? null,
    theme: previous?.theme ?? null,
    stickerPack: previous?.stickerPack ?? null,
    accent: previous?.accent ?? null,
    ring: previous?.ring ?? false,
    lastDaily: previous?.lastDaily ?? 0,
    lastStipend: previous?.lastStipend ?? 0,
  };
}

function toMessage(row: DirectMessageRow): Message {
  return {
    id: row.id,
    ch: conversationId(row.sender_id, row.recipient_id),
    by: row.sender_id,
    text: row.body,
    ts: new Date(row.created_at).getTime(),
    image: row.image ?? undefined,
    sticker: row.sticker ?? undefined,
    reply: row.reply_to ?? undefined,
    edited: row.edited_at ? new Date(row.edited_at).getTime() : undefined,
    pinned: row.pinned || undefined,
    reactions: row.reactions ?? {},
  };
}

export async function fetchProfile(userId: string): Promise<User> {
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
  if (error) throw new AppError(error.code === 'PGRST116' ? 'err.profileMissing' : 'err.backendUnavailable');
  return toUser(data as ProfileRow, db.get().users[userId]);
}

export async function syncRemoteWorkspace(userId: string): Promise<void> {
  const client = requireSupabase();
  const [profilesResult, messagesResult] = await Promise.all([
    client.from('profiles').select('*').order('username'),
    client.from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at')
      .limit(2000),
  ]);
  if (profilesResult.error || messagesResult.error) throw new AppError('err.backendUnavailable');

  const remoteUsers = (profilesResult.data as ProfileRow[]).map((row) => toUser(row, db.get().users[row.id]));
  const messages = (messagesResult.data as DirectMessageRow[]).map(toMessage);
  const remoteChannels = new Set(messages.map((message) => message.ch));
  const groupedMessages = messages.reduce<Record<string, Message[]>>((groups, message) => {
    (groups[message.ch] ??= []).push(message);
    return groups;
  }, {});

  db.transaction((data) => {
    const localOnlyUsers = Object.fromEntries(
      Object.entries(data.users).filter(([, user]) => !user.serverBacked && !user.bot),
    );
    data.users = { ...localOnlyUsers, ...Object.fromEntries(remoteUsers.map((user) => [user.id, user])) };

    for (const channel of Object.keys(data.msgs)) {
      if (channel.startsWith('dm:')) delete data.msgs[channel];
    }
    for (const channel of Object.keys(data.dms)) {
      data.dms[channel] = data.dms[channel].filter((id) => !id.startsWith('dm:'));
    }
    data.msgs = { ...data.msgs, ...groupedMessages };
    for (const channel of remoteChannels) {
      const [prefix, left, right] = channel.split(':');
      if (prefix !== 'dm' || !left || !right) continue;
      for (const participant of [left, right]) {
        data.dms[participant] ??= [];
        if (!data.dms[participant].includes(channel)) data.dms[participant].unshift(channel);
      }
    }
  });
}

export function subscribeRemoteWorkspace(userId: string, onError: (error: Error) => void): () => void {
  const client = requireSupabase();
  const channel = client.channel(`workspace:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      void syncRemoteWorkspace(userId).catch((error: unknown) => onError(error instanceof Error ? error : new Error('Profile sync failed')));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () => {
      void syncRemoteWorkspace(userId).catch((error: unknown) => onError(error instanceof Error ? error : new Error('Message sync failed')));
    })
    .subscribe((status, error) => {
      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && error) onError(error);
    });
  return () => { void client.removeChannel(channel); };
}

export async function updateRemoteProfile(userId: string, values: { name?: string; bio?: string; avatar?: string | null; presence?: Presence; statusText?: string }) {
  const client = requireSupabase();
  const update: Record<string, unknown> = {};
  if (values.name !== undefined) update.display_name = values.name;
  if (values.bio !== undefined) update.bio = values.bio;
  if (values.avatar !== undefined) update.avatar = values.avatar;
  if (values.presence !== undefined) update.presence = values.presence;
  if (values.statusText !== undefined) update.status_text = values.statusText;
  const { data, error } = await client.from('profiles').update(update).eq('id', userId).select('id').single();
  if (error || !data) throw new AppError('err.profileUpdateFailed');
  await syncRemoteWorkspace(userId);
}

function remoteConversation(channel: string, userId: string): string {
  const [prefix, left, right, ...extra] = channel.split(':');
  if (prefix !== 'dm' || !left || !right || extra.length || ![left, right].includes(userId) || left === right) {
    throw new AppError('err.notMember');
  }
  return left === userId ? right : left;
}

export async function insertRemoteMessage(input: {
  channel: string;
  userId: string;
  text: string;
  reply?: string;
  sticker?: string;
  image?: string;
}): Promise<Message> {
  const recipientId = remoteConversation(input.channel, input.userId);
  const client = requireSupabase();
  const { data, error } = await client.from('direct_messages').insert({
    sender_id: input.userId,
    recipient_id: recipientId,
    body: input.text,
    image: input.image ?? null,
    sticker: input.sticker ?? null,
    reply_to: input.reply ?? null,
  }).select('*').single();
  if (error) throw new AppError('err.messageSendFailed');
  const message = toMessage(data as DirectMessageRow);
  db.transaction((state) => {
    state.msgs[input.channel] ??= [];
    if (!state.msgs[input.channel].some((item) => item.id === message.id)) state.msgs[input.channel].push(message);
    for (const id of [input.userId, recipientId]) {
      state.dms[id] ??= [];
      if (!state.dms[id].includes(input.channel)) state.dms[id].unshift(input.channel);
    }
  });
  return message;
}

async function mutateRemoteMessage(
  rpc: 'edit_direct_message' | 'delete_direct_message' | 'toggle_direct_message_pin' | 'toggle_direct_message_reaction',
  channel: string,
  messageId: string,
  userId: string,
  value?: string,
): Promise<void> {
  remoteConversation(channel, userId);
  const client = requireSupabase();
  const args = rpc === 'edit_direct_message'
    ? { message_id: messageId, new_body: value }
    : rpc === 'toggle_direct_message_reaction'
      ? { message_id: messageId, emoji: value }
      : { message_id: messageId };
  const { error } = await client.rpc(rpc, args);
  if (error) throw new AppError('err.messageUpdateFailed');
  await syncRemoteWorkspace(userId);
}

export function editRemoteMessage(channel: string, messageId: string, userId: string, text: string): Promise<void> {
  return mutateRemoteMessage('edit_direct_message', channel, messageId, userId, text);
}

export function deleteRemoteMessage(channel: string, messageId: string, userId: string): Promise<void> {
  return mutateRemoteMessage('delete_direct_message', channel, messageId, userId);
}

export function pinRemoteMessage(channel: string, messageId: string, userId: string): Promise<void> {
  return mutateRemoteMessage('toggle_direct_message_pin', channel, messageId, userId);
}

export function toggleRemoteReaction(channel: string, messageId: string, userId: string, emoji: string): Promise<void> {
  return mutateRemoteMessage('toggle_direct_message_reaction', channel, messageId, userId, emoji);
}
