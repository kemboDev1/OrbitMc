import { db } from './db';
import type { FrameData, Hub, Message, Presence, Role, Room, ThemeData, User } from './types';
import { requireSupabase } from '../lib/supabase';
import { AppError } from './errors';
import { replaceRemoteBlocks, setRemoteBlocked } from './chatControls';
import { getCosmetics } from './cosmetics';
import type { Listing, ListingKind } from './types';

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  hue: number;
  avatar: string | null;
  banner?: string | null;
  profile_stroke?: string | null;
  profile_tags?: string[] | null;
  profile_template?: 'clean' | 'halo' | 'frame' | null;
  presence: Presence;
  status_text: string;
  created_at: string;
}

export interface DirectMessageRow {
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

interface HubMessageRow {
  id: string; room_id: string; sender_id: string; body: string; image: string | null; sticker: string | null;
  reply_to: string | null; edited_at: string | null; pinned: boolean; reactions: Record<string, string[]>; created_at: string;
}

interface RemoteHubRow {
  id: string; name: string; about: string; emoji: string; hue: number; ownerId: string; public: boolean;
  invite: string; createdAt: number; members: Record<string, Role>; rooms: Room[]; remote: true;
}

function conversationId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`;
}

function blockTableMissing(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

type MarketRow = {
  id: string; seller_id: string | null; seller_name: string; kind: ListingKind; name: string; about: string;
  price: number; design: Record<string, unknown>; sales: number; active: boolean; featured?: boolean; created_at: string;
};

type MarketSnapshot = {
  listings: MarketRow[];
  wallet: { sparks: number; daily_claimed_on: string | null };
  purchases: { listing_id: string; gifted_by: string | null }[];
  gift_totals: Record<string, number>;
};

function mapMarketListing(row: MarketRow, previous?: Listing): Listing {
  const design = row.design ?? {};
  return {
    ...previous,
    id: row.id,
    kind: row.kind,
    name: row.name,
    about: row.about,
    price: row.price,
    sellerId: row.seller_id ?? 'orbit-studio',
    sales: row.sales,
    createdAt: new Date(row.created_at).getTime(),
    auraOnly: design.auraOnly === true,
    featured: row.featured === true || previous?.featured === true,
    removed: !row.active,
    stickers: row.kind === 'stickers' && Array.isArray(design.stickers) ? design.stickers as string[] : previous?.stickers,
    theme: row.kind === 'theme' ? design as unknown as ThemeData : undefined,
    frame: row.kind === 'frame' ? design as unknown as FrameData : undefined,
    remote: true,
  };
}

function mapMarketError(error: { code?: string } | null, fallback = 'shopUnavailable'): AppError {
  if (error?.code === '23505') return new AppError('alreadyOwned');
  if (error?.code === 'P0001') return new AppError('notEnough');
  if (error?.code === '54000') return new AppError('listingLimit');
  if (error?.code === 'PGRST202' || error?.code === 'PGRST205') return new AppError('shopNotReady');
  return new AppError(fallback);
}

export async function syncRemoteMarket(userId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_market_snapshot');
  if (error) {
    if (error.code === 'PGRST202' || error.code === 'PGRST205') return;
    throw mapMarketError(error, 'err.backendUnavailable');
  }
  const snapshot = data as unknown as MarketSnapshot;
  if (!snapshot || !Array.isArray(snapshot.listings) || !snapshot.wallet || !Array.isArray(snapshot.purchases) || !snapshot.gift_totals) {
    throw new AppError('err.backendUnavailable');
  }
  db.transaction((state) => {
    for (const row of snapshot.listings) state.listings[row.id] = mapMarketListing(row, state.listings[row.id]);
    for (const person of Object.values(state.users)) {
      if (person.serverBacked) person.giftsReceivedCount = Math.max(0, Number(snapshot.gift_totals[person.id] ?? 0));
    }
    const user = state.users[userId];
    if (user?.serverBacked) {
      user.sparks = Math.max(0, Math.min(99_999, snapshot.wallet.sparks));
      user.lastDaily = snapshot.wallet.daily_claimed_on ? Date.parse(`${snapshot.wallet.daily_claimed_on}T12:00:00Z`) : 0;
      user.inventory = [...new Set(snapshot.purchases.map((purchase) => purchase.listing_id))];
      user.giftsReceived = [...new Set(snapshot.purchases.filter((purchase) => !!purchase.gifted_by).map((purchase) => purchase.listing_id))].slice(-200);
    }
  });
}

export async function createRemoteListing(input: { userId: string; kind: ListingKind; name: string; about: string; price: number; design: Record<string, unknown> }): Promise<Listing> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_market_listing', {
    item_kind: input.kind, item_name: input.name, item_about: input.about, item_price: input.price, item_design: input.design,
  });
  if (error || typeof data !== 'string') throw mapMarketError(error);
  await syncRemoteMarket(input.userId);
  const listing = db.get().listings[data];
  if (!listing) throw new AppError('err.backendUnavailable');
  return listing;
}

export async function purchaseRemoteListing(userId: string, listingId: string, giftTo?: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('purchase_market_listing', { item_id: listingId, gift_to: giftTo ?? null });
  if (error) throw mapMarketError(error);
  await syncRemoteMarket(userId);
}

export async function claimRemoteDaily(userId: string): Promise<number> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('claim_daily_market_sparks');
  if (error) throw error.code === '23505' ? new AppError('dailyDone') : mapMarketError(error);
  await syncRemoteMarket(userId);
  return typeof data === 'number' ? data : 0;
}

export async function removeRemoteListing(userId: string, listingId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('remove_market_listing', { listing_id: listingId });
  if (error) throw mapMarketError(error);
  await syncRemoteMarket(userId);
}

function toUser(row: ProfileRow, previous?: User): User {
  const saved = getCosmetics(row.id);
  return {
    ...previous,
    id: row.id,
    username: row.username,
    name: row.display_name,
    bio: row.bio,
    hue: row.hue,
    avatar: row.avatar ?? undefined,
    banner: row.banner ?? previous?.banner ?? saved?.banner,
    profileStroke: row.profile_stroke ?? previous?.profileStroke ?? saved?.profileStroke,
    profileTags: row.profile_tags ?? previous?.profileTags ?? saved?.profileTags,
    profileTemplate: row.profile_template ?? previous?.profileTemplate ?? saved?.profileTemplate,
    chatFont: previous?.chatFont ?? saved?.chatFont,
    messageEffect: previous?.messageEffect ?? saved?.messageEffect,
    presence: row.presence,
    statusText: row.status_text,
    createdAt: new Date(row.created_at).getTime(),
    serverBacked: true,
    bot: undefined,
    auth: undefined,
    isAdmin: previous?.isAdmin ?? saved?.isAdmin,
    aura: previous?.aura ?? saved?.aura ?? null,
    sparks: previous?.sparks ?? 300,
    inventory: previous?.inventory ?? [],
    frame: previous?.frame ?? saved?.frame ?? null,
    theme: previous?.theme ?? saved?.theme ?? null,
    stickerPack: previous?.stickerPack ?? saved?.stickerPack ?? null,
    accent: previous?.accent ?? saved?.accent ?? null,
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
    remoteCreatedAt: row.created_at,
    image: row.image ?? undefined,
    sticker: row.sticker ?? undefined,
    reply: row.reply_to ?? undefined,
    edited: row.edited_at ? new Date(row.edited_at).getTime() : undefined,
    pinned: row.pinned || undefined,
    reactions: row.reactions ?? {},
  };
}

function cacheRemoteDirectMessage(row: DirectMessageRow): void {
  const message = toMessage(row);
  db.transaction((state) => {
    const messages = state.msgs[message.ch] ?? (state.msgs[message.ch] = []);
    const existing = messages.findIndex((item) => item.id === message.id);
    if (existing >= 0) messages[existing] = message;
    else messages.push(message);
    messages.sort((a, b) => (a.remoteCreatedAt ?? '').localeCompare(b.remoteCreatedAt ?? '') || a.id.localeCompare(b.id));
    for (const participant of [row.sender_id, row.recipient_id]) {
      state.dms[participant] ??= [];
      if (!state.dms[participant].includes(message.ch)) state.dms[participant].unshift(message.ch);
    }
  });
}

function removeCachedDirectMessage(messageId: string): void {
  db.transaction((state) => {
    for (const channelId of Object.keys(state.msgs)) {
      if (channelId.startsWith('dm:')) state.msgs[channelId] = state.msgs[channelId].filter((message) => message.id !== messageId);
    }
  });
}

function toHubMessage(row: HubMessageRow): Message {
  return {
    id: row.id, ch: row.room_id, by: row.sender_id, text: row.body,
    ts: new Date(row.created_at).getTime(), remoteCreatedAt: row.created_at,
    image: row.image ?? undefined, sticker: row.sticker ?? undefined, reply: row.reply_to ?? undefined,
    edited: row.edited_at ? new Date(row.edited_at).getTime() : undefined,
    pinned: row.pinned || undefined, reactions: row.reactions ?? {},
  };
}

function mapHubError(error: { code?: string } | null, fallback = 'hubUnavailable'): AppError {
  if (error?.code === '54000') return new AppError('createHubLimit');
  if (error?.code === 'PGRST202' || error?.code === 'PGRST205') return new AppError('hubNotReady');
  if (error?.code === 'P0002') return new AppError(fallback === 'hubUnavailable' ? 'err.notMember' : fallback);
  return new AppError(fallback);
}

export async function syncRemoteHubs(userId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_hub_snapshot');
  if (error) {
    if (error.code === 'PGRST202' || error.code === 'PGRST205') return;
    throw mapHubError(error, 'err.backendUnavailable');
  }
  const rows = data as unknown as RemoteHubRow[];
  if (!Array.isArray(rows)) throw new AppError('err.backendUnavailable');
  const remoteHubs = rows.filter((hub) => hub && typeof hub.id === 'string' && hub.members && Array.isArray(hub.rooms)) as Hub[];
  db.transaction((state) => {
    const oldRemote = Object.values(state.hubs).filter((hub) => hub.remote);
    const activeRoomIds = new Set(remoteHubs.flatMap((hub) => hub.rooms.map((room) => room.id)));
    for (const hub of oldRemote) for (const room of hub.rooms) if (!activeRoomIds.has(room.id)) delete state.msgs[room.id];
    const localHubs = Object.fromEntries(Object.entries(state.hubs).filter(([, hub]) => !hub.remote));
    state.hubs = { ...localHubs, ...Object.fromEntries(remoteHubs.map((hub) => [hub.id, { ...hub, remote: true as const }])) };
    for (const hub of remoteHubs) for (const room of hub.rooms) state.msgs[room.id] ??= [];
    if (!state.users[userId]?.serverBacked) return;
  });
}

export async function syncRemoteHubMessages(userId: string, roomId?: string): Promise<void> {
  const client = requireSupabase();
  const rooms = Object.values(db.get().hubs).filter((hub) => hub.remote && hub.members[userId]).flatMap((hub) => hub.rooms.map((room) => room.id));
  const targetRooms = roomId ? rooms.includes(roomId) ? [roomId] : [] : rooms;
  if (!targetRooms.length) return;
  let query = client.from('hub_messages').select('*').in('room_id', targetRooms);
  const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(roomId ? 200 : 2000);
  if (error) throw new AppError('err.backendUnavailable');
  const grouped = (data as HubMessageRow[]).map(toHubMessage).reduce<Record<string, Message[]>>((groups, message) => {
    (groups[message.ch] ??= []).push(message);
    return groups;
  }, {});
  db.transaction((state) => {
    for (const id of targetRooms) {
      const previous = state.msgs[id] ?? [];
      const merged = new Map(previous.map((message) => [message.id, message]));
      for (const message of grouped[id] ?? []) merged.set(message.id, message);
      state.msgs[id] = [...merged.values()].sort((a, b) => {
        const aTime = a.remoteCreatedAt ?? new Date(a.ts).toISOString();
        const bTime = b.remoteCreatedAt ?? new Date(b.ts).toISOString();
        return aTime.localeCompare(bTime) || a.id.localeCompare(b.id);
      });
    }
  });
}

export async function createRemoteHub(input: { userId: string; name: string; about: string; emoji: string; hue: number; isPublic: boolean }): Promise<Hub> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_hub', {
    hub_name: input.name, hub_about: input.about, hub_emoji: input.emoji, hub_hue: input.hue, hub_is_public: input.isPublic,
  });
  if (error || typeof data !== 'string') throw mapHubError(error);
  await syncRemoteHubs(input.userId);
  const hub = db.get().hubs[data];
  if (!hub) throw new AppError('err.backendUnavailable');
  return hub;
}

export async function joinRemoteHub(userId: string, hubId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('join_public_hub', { target_hub_id: hubId });
  if (error) throw mapHubError(error);
  await syncRemoteHubs(userId);
}

export async function joinRemoteInvite(userId: string, invite: string): Promise<Hub | null> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('join_hub_by_invite', { invite_token: invite });
  if (error) throw mapHubError(error, 'err.inviteInvalid');
  if (typeof data !== 'string') throw new AppError('err.inviteInvalid');
  await syncRemoteHubs(userId);
  return db.get().hubs[data] ?? null;
}

export async function leaveRemoteHub(userId: string, hubId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('leave_hub', { target_hub_id: hubId });
  if (error) throw mapHubError(error, 'err.notMember');
  await syncRemoteHubs(userId);
}

export async function addRemoteHubRoom(userId: string, hubId: string, name: string): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('add_hub_room', { target_hub_id: hubId, room_name: name });
  if (error || typeof data !== 'string') throw mapHubError(error, 'err.roomName');
  await syncRemoteHubs(userId);
  return data;
}

export async function removeRemoteHubRoom(userId: string, hubId: string, roomId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('remove_hub_room', { target_hub_id: hubId, target_room_id: roomId });
  if (error) throw mapHubError(error, 'err.notMember');
  await syncRemoteHubs(userId);
}

export async function updateRemoteHubDetails(userId: string, hubId: string, input: { name: string; about: string; emoji: string; hue: number; isPublic: boolean }): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('update_hub_details', {
    target_hub_id: hubId,
    next_name: input.name,
    next_about: input.about,
    next_emoji: input.emoji,
    next_hue: input.hue,
    next_public: input.isPublic,
  });
  if (error) throw mapHubError(error, 'err.notMember');
  await syncRemoteHubs(userId);
}

export async function updateRemoteHubRoomSettings(userId: string, hubId: string, roomId: string, input: { topic: string; kind: 'text' | 'broadcast' }): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('update_hub_room_settings', {
    target_hub_id: hubId,
    target_room_id: roomId,
    next_topic: input.topic,
    next_kind: input.kind,
  });
  if (error) throw mapHubError(error, 'err.notMember');
  await syncRemoteHubs(userId);
}

export async function setRemoteHubMemberRole(userId: string, hubId: string, targetUserId: string, role: 'mod' | 'member'): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('set_hub_member_role', {
    target_hub_id: hubId,
    target_user_id: targetUserId,
    next_role: role,
  });
  if (error) throw mapHubError(error, 'err.notMember');
  await syncRemoteHubs(userId);
}

export async function removeRemoteHubMember(userId: string, hubId: string, targetUserId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('remove_hub_member', {
    target_hub_id: hubId,
    target_user_id: targetUserId,
  });
  if (error) throw mapHubError(error, 'err.notMember');
  await syncRemoteHubs(userId);
}

/** The API query fetches newest-first; render and persist conversation history oldest-first. */
export function chronologicalRemoteHistory(rows: DirectMessageRow[]): Message[] {
  return [...rows].reverse().map(toMessage);
}

const OLDER_HISTORY_PAGE_SIZE = 60;

export async function fetchOlderRemoteMessages(channel: string, userId: string, before: Message): Promise<boolean> {
  const recipientId = remoteConversation(channel, userId);
  if (!Number.isFinite(before.ts) || !/^[\da-f-]{36}$/i.test(before.id)) throw new AppError('err.notMember');
  const cursor = before.remoteCreatedAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(before.remoteCreatedAt) && Number.isFinite(Date.parse(before.remoteCreatedAt))
    ? before.remoteCreatedAt
    : new Date(before.ts).toISOString();
  const client = requireSupabase();
  const { data, error } = await client.from('direct_messages').select('*')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${userId})`)
    .or(`created_at.lt.${cursor},and(created_at.eq.${cursor},id.lt.${before.id})`)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(OLDER_HISTORY_PAGE_SIZE);
  if (error) throw new AppError('err.backendUnavailable');
  const older = chronologicalRemoteHistory(data as DirectMessageRow[]);
  db.transaction((state) => {
    const merged = new Map((state.msgs[channel] ?? []).map((message) => [message.id, message]));
    for (const message of older) if (!merged.has(message.id)) merged.set(message.id, message);
    state.msgs[channel] = [...merged.values()].sort((a, b) => {
      const aTime = a.remoteCreatedAt ?? new Date(a.ts).toISOString();
      const bTime = b.remoteCreatedAt ?? new Date(b.ts).toISOString();
      return aTime.localeCompare(bTime) || a.id.localeCompare(b.id);
    });
  });
  return (data as DirectMessageRow[]).length === OLDER_HISTORY_PAGE_SIZE;
}

export async function fetchOlderRemoteHubMessages(channel: string, userId: string, before: Message): Promise<boolean> {
  const hub = Object.values(db.get().hubs).find((item) => item.remote && item.members[userId] && item.rooms.some((room) => room.id === channel));
  if (!hub || !Number.isFinite(before.ts) || !/^[\da-f-]{36}$/i.test(before.id)) throw new AppError('err.notMember');
  const cursor = before.remoteCreatedAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(before.remoteCreatedAt) && Number.isFinite(Date.parse(before.remoteCreatedAt))
    ? before.remoteCreatedAt : new Date(before.ts).toISOString();
  const client = requireSupabase();
  const { data, error } = await client.from('hub_messages').select('*').eq('room_id', channel)
    .or(`created_at.lt.${cursor},and(created_at.eq.${cursor},id.lt.${before.id})`)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(OLDER_HISTORY_PAGE_SIZE);
  if (error) throw new AppError('err.backendUnavailable');
  const older = (data as HubMessageRow[]).map(toHubMessage);
  db.transaction((state) => {
    const merged = new Map((state.msgs[channel] ?? []).map((message) => [message.id, message]));
    for (const message of older) if (!merged.has(message.id)) merged.set(message.id, message);
    state.msgs[channel] = [...merged.values()].sort((a, b) => {
      const aTime = a.remoteCreatedAt ?? new Date(a.ts).toISOString();
      const bTime = b.remoteCreatedAt ?? new Date(b.ts).toISOString();
      return aTime.localeCompare(bTime) || a.id.localeCompare(b.id);
    });
  });
  return older.length === OLDER_HISTORY_PAGE_SIZE;
}

export async function fetchProfile(userId: string): Promise<User> {
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
  if (error) throw new AppError(error.code === 'PGRST116' ? 'err.profileMissing' : 'err.backendUnavailable');
  return toUser(data as ProfileRow, db.get().users[userId]);
}

export async function syncRemoteWorkspace(userId: string): Promise<void> {
  const client = requireSupabase();
  const [profilesResult, messagesResult, blocksResult] = await Promise.all([
    client.from('profiles').select('*').order('username'),
    client.from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(2000),
    client.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
  ]);
  if (profilesResult.error || messagesResult.error || blocksResult.error && !blockTableMissing(blocksResult.error)) throw new AppError('err.backendUnavailable');

  const remoteUsers = (profilesResult.data as ProfileRow[]).map((row) => toUser(row, db.get().users[row.id]));
  const messages = chronologicalRemoteHistory(messagesResult.data as DirectMessageRow[]);
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
  replaceRemoteBlocks(userId, (blocksResult.data as { blocked_id: string }[] | null ?? []).map((row) => row.blocked_id));
  await syncRemoteMarket(userId);
  await syncRemoteHubs(userId);
  await syncRemoteHubMessages(userId);
}

export function subscribeRemoteWorkspace(userId: string, onError: (error: Error) => void): () => void {
  const client = requireSupabase();
  const channel = client.channel(`workspace:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const row = payload.old as Partial<ProfileRow>;
        if (typeof row.id === 'string') db.transaction((state) => { delete state.users[row.id!]; });
        return;
      }
      const row = payload.new as ProfileRow;
      if (!row || typeof row.id !== 'string' || typeof row.username !== 'string' || typeof row.display_name !== 'string') return;
      db.transaction((state) => { state.users[row.id] = toUser(row, state.users[row.id]); });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const row = payload.old as Partial<DirectMessageRow>;
        if (typeof row.id === 'string') removeCachedDirectMessage(row.id);
        return;
      }
      const row = payload.new as DirectMessageRow;
      if (!row || typeof row.id !== 'string' || typeof row.sender_id !== 'string' || typeof row.recipient_id !== 'string') return;
      cacheRemoteDirectMessage(row);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_listings' }, () => {
      void syncRemoteMarket(userId).catch((error: unknown) => onError(error instanceof Error ? error : new Error('Shop sync failed')));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_wallets', filter: `user_id=eq.${userId}` }, () => {
      void syncRemoteMarket(userId).catch((error: unknown) => onError(error instanceof Error ? error : new Error('Wallet sync failed')));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hubs' }, () => {
      void syncRemoteHubs(userId).then(() => syncRemoteHubMessages(userId)).catch((error: unknown) => onError(error instanceof Error ? error : new Error('Community sync failed')));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_rooms' }, () => {
      void syncRemoteHubs(userId).then(() => syncRemoteHubMessages(userId)).catch((error: unknown) => onError(error instanceof Error ? error : new Error('Room sync failed')));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_members' }, () => {
      void syncRemoteHubs(userId).then(() => syncRemoteHubMessages(userId)).catch((error: unknown) => onError(error instanceof Error ? error : new Error('Membership sync failed')));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_messages' }, (payload) => {
      const row = (payload.new ?? payload.old) as { room_id?: string };
      if (row?.room_id) void syncRemoteHubMessages(userId, row.room_id).catch((error: unknown) => onError(error instanceof Error ? error : new Error('Room message sync failed')));
    })
    .subscribe((status, error) => {
      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && error) onError(error);
    });
  return () => { void client.removeChannel(channel); };
}

export async function updateRemoteProfile(userId: string, values: { name?: string; bio?: string; avatar?: string | null; banner?: string | null; profileStroke?: string | null; profileTags?: string[]; profileTemplate?: 'clean' | 'halo' | 'frame'; presence?: Presence; statusText?: string }) {
  const client = requireSupabase();
  const update: Record<string, unknown> = {};
  if (values.name !== undefined) update.display_name = values.name;
  if (values.bio !== undefined) update.bio = values.bio;
  if (values.avatar !== undefined) update.avatar = values.avatar;
  if (values.banner !== undefined) update.banner = values.banner;
  if (values.profileStroke !== undefined) update.profile_stroke = values.profileStroke;
  if (values.profileTags !== undefined) update.profile_tags = values.profileTags;
  if (values.profileTemplate !== undefined) update.profile_template = values.profileTemplate;
  if (values.presence !== undefined) update.presence = values.presence;
  if (values.statusText !== undefined) update.status_text = values.statusText;
  const { data, error } = await client.from('profiles').update(update).eq('id', userId).select('*').single();
  if (error || !data) throw new AppError('err.profileUpdateFailed');
  const row = data as ProfileRow;
  db.transaction((state) => { state.users[userId] = toUser(row, state.users[userId]); });
}

export async function updateRemoteBlock(userId: string, otherId: string, blocked: boolean): Promise<void> {
  if (userId === otherId) throw new AppError('err.notMember');
  const client = requireSupabase();
  const result = blocked
    ? await client.from('user_blocks').insert({ blocker_id: userId, blocked_id: otherId })
    : await client.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', otherId);
  if (result.error) throw new AppError('err.blockUpdateFailed');
  setRemoteBlocked(userId, otherId, blocked);
}

export async function syncRemoteBlocks(userId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.from('user_blocks').select('blocked_id').eq('blocker_id', userId);
  if (error && !blockTableMissing(error)) throw new AppError('err.backendUnavailable');
  replaceRemoteBlocks(userId, (data as { blocked_id: string }[] | null ?? []).map((row) => row.blocked_id));
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
  if (error) throw new AppError(error.code === '42501' ? 'err.messageRestricted' : 'err.messageSendFailed');
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

export async function insertRemoteHubMessage(input: { channel: string; userId: string; text: string; reply?: string; sticker?: string; image?: string }): Promise<Message> {
  const hub = Object.values(db.get().hubs).find((item) => item.remote && item.members[input.userId] && item.rooms.some((room) => room.id === input.channel));
  if (!hub) throw new AppError('err.notMember');
  const client = requireSupabase();
  const { data, error } = await client.rpc('send_hub_message', {
    target_room_id: input.channel, message_body: input.text, message_image: input.image ?? null,
    message_sticker: input.sticker ?? null, reply_id: input.reply ?? null,
  });
  if (error || !data) throw mapHubError(error, error?.code === '42501' ? 'err.notMember' : 'err.messageSendFailed');
  const message = toHubMessage(data as HubMessageRow);
  db.transaction((state) => {
    state.msgs[input.channel] ??= [];
    if (!state.msgs[input.channel].some((item) => item.id === message.id)) state.msgs[input.channel].push(message);
  });
  return message;
}

async function mutateRemoteHubMessage(
  rpc: 'edit_hub_message' | 'delete_hub_message' | 'toggle_hub_message_pin' | 'toggle_hub_message_reaction',
  channel: string,
  messageId: string,
  userId: string,
  value?: string,
): Promise<void> {
  if (!Object.values(db.get().hubs).some((hub) => hub.remote && hub.members[userId] && hub.rooms.some((room) => room.id === channel))) throw new AppError('err.notMember');
  const client = requireSupabase();
  const args = rpc === 'edit_hub_message'
    ? { message_id: messageId, new_body: value }
    : rpc === 'toggle_hub_message_reaction'
      ? { message_id: messageId, emoji: value }
      : { message_id: messageId };
  const { error } = await client.rpc(rpc, args);
  if (error) throw new AppError('err.messageUpdateFailed');
  await syncRemoteHubMessages(userId, channel);
}

export const editRemoteHubMessage = (channel: string, messageId: string, userId: string, text: string) =>
  mutateRemoteHubMessage('edit_hub_message', channel, messageId, userId, text);
export const deleteRemoteHubMessage = (channel: string, messageId: string, userId: string) =>
  mutateRemoteHubMessage('delete_hub_message', channel, messageId, userId);
export const pinRemoteHubMessage = (channel: string, messageId: string, userId: string) =>
  mutateRemoteHubMessage('toggle_hub_message_pin', channel, messageId, userId);
export const toggleRemoteHubReaction = (channel: string, messageId: string, userId: string, emoji: string) =>
  mutateRemoteHubMessage('toggle_hub_message_reaction', channel, messageId, userId, emoji);

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
  if (rpc === 'delete_direct_message') {
    removeCachedDirectMessage(messageId);
    return;
  }
  const { data } = await client.from('direct_messages').select('*').eq('id', messageId).single();
  if (data) cacheRemoteDirectMessage(data as DirectMessageRow);
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
