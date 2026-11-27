import { createStore, local } from '../lib/store';
import { makeSeed } from './seed';
import { LIMITS } from '../config';
import { AppError } from './errors';
import type { DB, User } from './types';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 10_000): v is string => typeof v === 'string' && v.length <= max;
const idKey = (v: string) => /^[a-z0-9:_-]{1,100}$/i.test(v);
const image = (v: unknown, max: number) => v === undefined || v === null || (typeof v === 'string' && v.length <= max && (/^grad:[a-z0-9_-]{2,32}$/i.test(v) || /^data:image\/(?:jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(v)));
const hex = (v: unknown): v is string => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v);

function validDB(x: unknown): x is DB {
  if (!record(x)) return false;
  const d = x as Partial<DB>;
  if (d.v !== 1 || !record(d.users) || !record(d.hubs) || !record(d.msgs) || !record(d.listings) || !record(d.reads) || !record(d.dms) || !record(d.guard)) return false;
  try { if (JSON.stringify(x).length > 1_800_000) return false; } catch { return false; }
  const users = d.users as Record<string, User>;

  for (const [id, raw] of Object.entries(d.users)) {
    if (!idKey(id) || !record(raw)) return false;
    const u = raw as Partial<User>;
    if (u.id !== id || !text(u.username, 32) || !/^[a-z0-9._-]{1,32}$/i.test(u.username) || !text(u.name, LIMITS.name) || u.name.length < 2 || !text(u.bio, LIMITS.bio) || typeof u.hue !== 'number' || !Number.isFinite(u.hue) || u.hue < 0 || u.hue > 360 || !['online', 'idle', 'dnd', 'offline'].includes(u.presence ?? '') || !text(u.statusText, LIMITS.status) || typeof u.createdAt !== 'number' || !Number.isFinite(u.createdAt) || typeof u.bot !== 'undefined' && typeof u.bot !== 'boolean' || typeof u.serverBacked !== 'undefined' && typeof u.serverBacked !== 'boolean' || typeof u.isAdmin !== 'undefined' && typeof u.isAdmin !== 'boolean' || typeof u.suspended !== 'undefined' && typeof u.suspended !== 'boolean' || !image(u.avatar, LIMITS.imageCharsAura) || !Array.isArray(u.inventory) || u.inventory.length > 200 || !u.inventory.every((v) => text(v, 100)) || (u.giftsReceived !== undefined && (!Array.isArray(u.giftsReceived) || u.giftsReceived.length > 200 || !u.giftsReceived.every((v) => text(v, 100)))) || !(u.frame === null || text(u.frame, 100)) || !(u.theme === null || text(u.theme, 100)) || !(u.stickerPack === undefined || u.stickerPack === null || text(u.stickerPack, 100)) || typeof u.ring !== 'boolean' || typeof u.sparks !== 'number' || !Number.isFinite(u.sparks) || u.sparks < 0 || u.sparks > 99_999 || typeof u.lastDaily !== 'number' || !Number.isFinite(u.lastDaily) || typeof u.lastStipend !== 'number' || !Number.isFinite(u.lastStipend) || !(u.accent === null || u.accent === undefined || hex(u.accent))) return false;
    if (u.auth !== undefined && (!record(u.auth) || typeof u.auth.salt !== 'string' || typeof u.auth.hash !== 'string' || u.auth.iter !== LIMITS.pbkdf2 || !/^[A-Za-z0-9+/]{20,28}={0,2}$/.test(u.auth.salt) || !/^[A-Za-z0-9+/]{40,48}={0,2}$/.test(u.auth.hash))) return false;
    if (u.giftsReceivedCount !== undefined && (typeof u.giftsReceivedCount !== 'number' || !Number.isInteger(u.giftsReceivedCount) || u.giftsReceivedCount < 0 || u.giftsReceivedCount > 1_000_000)) return false;
    if (u.aura !== null && u.aura !== undefined) {
      if (!record(u.aura) || !['ember', 'flare', 'nova'].includes(u.aura.tier as string) || !['month', 'year'].includes(u.aura.cycle as string) || typeof u.aura.since !== 'number' || !Number.isFinite(u.aura.since) || typeof u.aura.renews !== 'number' || !Number.isFinite(u.aura.renews)) return false;
    }
  }

  for (const [id, raw] of Object.entries(d.hubs)) {
    if (!idKey(id) || !record(raw)) return false;
    const h = raw as DB['hubs'][string];
    if (h.id !== id || !text(h.name, LIMITS.hubName) || h.name.length < 2 || !text(h.about, LIMITS.hubAbout) || typeof h.emoji !== 'string' || h.emoji.length > 8 || typeof h.hue !== 'number' || !Number.isFinite(h.hue) || !idKey(h.ownerId) || !users[h.ownerId] || typeof h.public !== 'boolean' || !/^[a-z0-9]{6,32}$/i.test(h.invite) || typeof h.createdAt !== 'number' || !Number.isFinite(h.createdAt) || !record(h.members) || !Array.isArray(h.rooms) || h.rooms.length < 1 || h.rooms.length > 100 || h.members[h.ownerId] !== 'owner') return false;
    for (const [member, role] of Object.entries(h.members)) if (!users[member] || !['owner', 'mod', 'member'].includes(role)) return false;
    for (const room of h.rooms) if (!record(room) || !idKey(room.id) || !text(room.name, LIMITS.roomName) || room.name.length < 2 || !['text', 'broadcast'].includes(room.kind) || !text(room.topic, LIMITS.topic)) return false;
  }

  for (const [channel, raw] of Object.entries(d.msgs)) {
    if (!idKey(channel) || !Array.isArray(raw) || raw.length > LIMITS.perChannel) return false;
    for (const msg of raw) {
      if (!record(msg) || msg.ch !== channel || !idKey(msg.id) || !users[msg.by] || !text(msg.text, LIMITS.messageNova) || typeof msg.ts !== 'number' || !Number.isFinite(msg.ts) || typeof msg.remoteCreatedAt !== 'undefined' && (typeof msg.remoteCreatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(msg.remoteCreatedAt) || !Number.isFinite(Date.parse(msg.remoteCreatedAt))) || typeof msg.edited !== 'undefined' && typeof msg.edited !== 'number' || typeof msg.pinned !== 'undefined' && typeof msg.pinned !== 'boolean' || typeof msg.reply !== 'undefined' && !text(msg.reply, 100) || typeof msg.sticker !== 'undefined' && !text(msg.sticker, 24) || !image(msg.image, LIMITS.imageCharsAura) || (msg.audio !== undefined && !text(msg.audio, LIMITS.imageCharsAura)) || !record(msg.reactions)) return false;
      if (msg.poll !== undefined && (!record(msg.poll) || !text(msg.poll.question, 160) || !Array.isArray(msg.poll.options) || msg.poll.options.length < 2 || msg.poll.options.length > 6)) return false;
      for (const reactors of Object.values(msg.reactions)) if (!Array.isArray(reactors) || reactors.length > 100 || !reactors.every((id) => typeof id === 'string' && !!users[id])) return false;
    }
  }

  for (const [id, raw] of Object.entries(d.listings)) {
    if (!idKey(id) || !record(raw)) return false;
    const l = raw as DB['listings'][string];
    if (l.id !== id || !['stickers', 'theme', 'frame', 'bundle'].includes(l.kind) || !text(l.name, LIMITS.hubName) || l.name.length < 1 || !text(l.about, LIMITS.hubAbout) || typeof l.price !== 'number' || !Number.isInteger(l.price) || l.price < 10 || l.price > 9999 || !users[l.sellerId] || typeof l.sales !== 'number' || !Number.isFinite(l.sales) || l.sales < 0 || typeof l.createdAt !== 'number' || !Number.isFinite(l.createdAt) || typeof l.removed !== 'undefined' && typeof l.removed !== 'boolean' || typeof l.featured !== 'undefined' && typeof l.featured !== 'boolean') return false;
    if (l.stickers !== undefined && (!Array.isArray(l.stickers) || l.stickers.length < 1 || l.stickers.length > 12 || !l.stickers.every((v) => text(v, 24)))) return false;
    if (l.theme !== undefined && (!record(l.theme) || typeof l.theme.dark !== 'boolean' || !hex(l.theme.bg) || !hex(l.theme.panel) || !hex(l.theme.raised) || !hex(l.theme.line) || !hex(l.theme.accent))) return false;
    if (l.frame !== undefined && (!record(l.frame) || typeof l.frame.spin !== 'boolean' || !Array.isArray(l.frame.colors) || l.frame.colors.length < 1 || l.frame.colors.length > 5 || !l.frame.colors.every(hex))) return false;
  }

  for (const [userId, channels] of Object.entries(d.reads)) if (!users[userId] || !record(channels) || !Object.values(channels).every((v) => typeof v === 'number' && Number.isFinite(v))) return false;
  for (const [userId, channels] of Object.entries(d.dms)) if (!users[userId] || !Array.isArray(channels) || channels.length > 200 || !channels.every((v) => text(v, 100))) return false;
  for (const [key, value] of Object.entries(d.guard)) if (!text(key, 32) || !record(value) || typeof value.n !== 'number' || value.n < 0 || value.n > 7 || typeof value.until !== 'number' || !Number.isFinite(value.until)) return false;
  return true;
}

/**
 * The local store is a cache for the authenticated account and UI preferences.
 */
export const dbStore = createStore<DB>(makeSeed(), 'sado:db', validDB);

function addStudioCatalog(data: DB): boolean {
  const starter = makeSeed();
  let changed = false;
  for (const [id, user] of Object.entries(starter.users)) {
    if (!data.users[id]) { data.users[id] = user; changed = true; }
  }
  for (const [id, listing] of Object.entries(starter.listings)) {
    if (!data.listings[id]) { data.listings[id] = listing; changed = true; }
  }
  return changed;
}

if (addStudioCatalog(dbStore.get())) dbStore.set(dbStore.get());

function removeBuiltInProfiles(data: DB): boolean {
  const botIds = new Set(Object.values(data.users).filter((user) => user.bot).map((user) => user.id));
  if (!botIds.size) return false;

  const removedHubs = new Set(
    Object.values(data.hubs)
      .filter((hub) => botIds.has(hub.ownerId) || Object.keys(hub.members).some((id) => botIds.has(id)))
      .map((hub) => hub.id),
  );
  const removedRooms = new Set(Object.values(data.hubs).filter((hub) => removedHubs.has(hub.id)).flatMap((hub) => hub.rooms.map((room) => room.id)));

  for (const id of botIds) delete data.users[id];
  for (const id of removedHubs) delete data.hubs[id];

  for (const [channel, messages] of Object.entries(data.msgs)) {
    const parts = channel.split(':');
    const referencesBot = channel.startsWith('dm:') && parts.some((id) => botIds.has(id));
    if (removedRooms.has(channel) || referencesBot) {
      delete data.msgs[channel];
      continue;
    }
    data.msgs[channel] = messages
      .filter((message) => !botIds.has(message.by))
      .map((message) => {
        for (const [emoji, ids] of Object.entries(message.reactions)) {
          message.reactions[emoji] = ids.filter((id) => !botIds.has(id));
          if (!message.reactions[emoji].length) delete message.reactions[emoji];
        }
        return message;
      });
  }

  const removedListings = new Set(
    Object.values(data.listings).filter((listing) => botIds.has(listing.sellerId)).map((listing) => listing.id),
  );
  for (const id of removedListings) delete data.listings[id];
  for (const user of Object.values(data.users)) {
    user.inventory = user.inventory.filter((id) => !removedListings.has(id));
    if (user.frame && removedListings.has(user.frame)) user.frame = null;
    if (user.theme && removedListings.has(user.theme)) user.theme = null;
    if (user.stickerPack && removedListings.has(user.stickerPack)) user.stickerPack = null;
    if (data.dms[user.id]) data.dms[user.id] = data.dms[user.id].filter((channel) => !!data.msgs[channel] || !channel.startsWith('dm:'));
    if (data.reads[user.id]) {
      for (const channel of Object.keys(data.reads[user.id])) {
        if (!data.msgs[channel] && !Object.values(data.hubs).some((hub) => hub.rooms.some((room) => room.id === channel))) {
          delete data.reads[user.id][channel];
        }
      }
    }
  }
  for (const id of botIds) {
    delete data.dms[id];
    delete data.reads[id];
  }
  return true;
}

if (removeBuiltInProfiles(dbStore.get())) dbStore.set(dbStore.get());

export const db = {
  use: dbStore.use,
  get: dbStore.get,
  subscribe: dbStore.subscribe,
  transaction(fn: (copy: DB) => void): DB {
    const copy = structuredClone(dbStore.get());
    fn(copy);
    if (JSON.stringify(copy).length > 1_800_000) throw new AppError('err.storageFull');
    dbStore.set(copy);
    return copy;
  },
  snapshot(): DB {
    return structuredClone(dbStore.get());
  },
  exportJSON(user: User): string {
    const data = dbStore.get();
    const ownedHubs = Object.values(data.hubs).filter((h) => !!h.members[user.id]);
    const allMemberIds = new Set(ownedHubs.flatMap((h) => Object.keys(h.members)));
    const dmIds = new Set(data.dms[user.id] ?? []);
    const msgs = Object.fromEntries(Object.entries(data.msgs).filter(([ch]) => {
      if (dmIds.has(ch)) return true;
      return ownedHubs.some((h) => h.rooms.some((r) => r.id === ch));
    }));
    const messageAuthors = new Set(Object.values(msgs).flat().map((m) => m.by));
    const ownListings = Object.fromEntries(Object.entries(data.listings).filter(([, l]) => l.sellerId === user.id || !l.removed));
    const listingSellers = new Set(Object.values(ownListings).map((listing) => listing.sellerId));
    const users = Object.fromEntries(Object.entries(data.users).filter(([id]) => id === user.id || allMemberIds.has(id) || messageAuthors.has(id) || listingSellers.has(id)));
    const bundle: DB = { v: 1, users, hubs: Object.fromEntries(ownedHubs.map((h) => [h.id, h])), msgs, listings: ownListings, reads: { [user.id]: data.reads[user.id] ?? {} }, dms: { [user.id]: [...dmIds] }, guard: {} };
    return JSON.stringify({ format: 'sado-backup', version: 1, exportedAt: new Date().toISOString(), data: bundle }, null, 2);
  },
  importJSON(textValue: string): void {
    if (textValue.length > 3_600_000) throw new AppError('backupError');
    const parsed: unknown = JSON.parse(textValue);
    if (!record(parsed) || parsed.format !== 'sado-backup' || parsed.version !== 1 || !('data' in parsed)) throw new AppError('backupError');
    const candidate = parsed.data;
    if (!validDB(candidate)) throw new AppError('backupError');
    dbStore.set(candidate);
  },
  wipe(): void {
    dbStore.set(makeSeed());
  },
  bytes(): number {
    try {
      return new Blob([JSON.stringify(dbStore.get())]).size;
    } catch {
      return 0;
    }
  },
  clearStorage(): void {
    try {
      local?.removeItem('sado:db');
    } catch {
      /* best-effort */
    }
  },
};
