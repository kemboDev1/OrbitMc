import { LIMITS, FREE, AURA } from '../config';
import { hueOf, uid } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import type { Hub, Role, Room, User } from './types';
import { getAura } from './market';
import {
  addRemoteHubRoom,
  createRemoteHub,
  joinRemoteHub,
  joinRemoteInvite,
  leaveRemoteHub,
  removeRemoteHubMember,
  removeRemoteHubRoom,
  setRemoteHubMemberRole,
  updateRemoteHubDetails,
  updateRemoteHubRoomSettings,
} from './cloud';

const liveHubs = (d: ReturnType<typeof db.get>, id: string) => Object.values(d.hubs).filter((h) => !!h.members[id]);

export type HubTemplateKey = 'blank' | 'team' | 'friends' | 'community';

export const HUB_TEMPLATES: Record<HubTemplateKey, { emoji: string; rooms: { name: string; kind: 'text' | 'broadcast'; topic: string }[] }> = {
  blank: {
    emoji: '✳',
    rooms: [{ name: 'general', kind: 'text', topic: 'Main conversation room' }],
  },
  team: {
    emoji: '🚀',
    rooms: [
      { name: 'announcements', kind: 'broadcast', topic: 'Important project updates & releases' },
      { name: 'general', kind: 'text', topic: 'Daily coordination and quick questions' },
      { name: 'tasks', kind: 'text', topic: 'Active sprint tasks, links, and blockers' },
      { name: 'showcase', kind: 'text', topic: 'Share builds, mockups, and demos' },
    ],
  },
  friends: {
    emoji: '🪩',
    rooms: [
      { name: 'hangout', kind: 'text', topic: 'Late night chats, memes, and voice vibes' },
      { name: 'media', kind: 'text', topic: 'Photos, clips, and playlists' },
      { name: 'events', kind: 'text', topic: 'Weekend plans and meetups' },
    ],
  },
  community: {
    emoji: '🌐',
    rooms: [
      { name: 'welcome', kind: 'broadcast', topic: 'Rules, links, and onboarding guide' },
      { name: 'general', kind: 'text', topic: 'Open community chat' },
      { name: 'ideas', kind: 'text', topic: 'Feature requests and community feedback' },
      { name: 'off-topic', kind: 'text', topic: 'Everything else' },
    ],
  },
};

export function makeHub(input: { userId: string; name: string; about: string; emoji: string; public: boolean; template?: HubTemplateKey }): Hub | Promise<Hub> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const about = input.about.trim();
  if (name.length < 2 || name.length > LIMITS.hubName) throw new AppError('err.hubName');
  if (about.length > LIMITS.hubAbout) throw new AppError('err.hubAbout');
  const person = db.get().users[input.userId];
  const tier = person ? getAura(person)?.tier : undefined;
  const max = tier ? AURA[tier].hubs : FREE.hubs;
  const ownedHubCount = person?.serverBacked
    ? Object.values(db.get().hubs).filter((hub) => hub.remote && hub.ownerId === input.userId).length
    : liveHubs(db.get(), input.userId).length;
  if (ownedHubCount >= max) throw new AppError('createHubLimit');
  if (person?.serverBacked) return createRemoteHub({ userId: input.userId, name, about, emoji: input.emoji.slice(0, 4), hue: hueOf(name), isPublic: input.public });
  const id = `h_${uid(14)}`;
  const template = HUB_TEMPLATES[input.template ?? 'blank'];
  const rooms: Room[] = template.rooms.map((r, i) => ({
    id: i === 0 && r.name === 'general' ? `${id}_general` : `${id}_r_${uid(8)}`,
    name: r.name,
    kind: r.kind,
    topic: r.topic,
  }));
  const hub: Hub = {
    id,
    name,
    about,
    emoji: input.emoji.slice(0, 4),
    hue: hueOf(name),
    ownerId: input.userId,
    members: { [input.userId]: 'owner' },
    rooms,
    public: input.public,
    invite: uid(9),
    createdAt: Date.now(),
  };
  db.transaction((d) => {
    d.hubs[id] = hub;
    for (const r of rooms) d.msgs[r.id] = [];
  });
  return hub;
}

export function updateHub(hubId: string, userId: string, patch: { name?: string; about?: string; emoji?: string; public?: boolean }): void | Promise<void> {
  const existing = db.get().hubs[hubId];
  if (existing?.remote) {
    const nextName = (patch.name ?? existing.name).trim().replace(/\s+/g, ' ');
    const nextAbout = (patch.about ?? existing.about).trim();
    if (nextName.length < 2 || nextName.length > LIMITS.hubName) throw new AppError('err.hubName');
    if (nextAbout.length > LIMITS.hubAbout) throw new AppError('err.hubAbout');
    return updateRemoteHubDetails(userId, hubId, {
      name: nextName,
      about: nextAbout,
      emoji: (patch.emoji ?? existing.emoji).trim().slice(0, 4) || existing.emoji,
      hue: hueOf(nextName),
      isPublic: patch.public ?? existing.public,
    });
  }
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || (!['owner', 'mod'].includes(hub.members[userId] ?? '') && !d.users[userId]?.isAdmin)) {
      throw new AppError('err.notMember');
    }
    if (patch.name !== undefined) {
      const clean = patch.name.trim().replace(/\s+/g, ' ');
      if (clean.length < 2 || clean.length > LIMITS.hubName) throw new AppError('err.hubName');
      hub.name = clean;
      hub.hue = hueOf(clean);
    }
    if (patch.about !== undefined) {
      const cleanAbout = patch.about.trim();
      if (cleanAbout.length > LIMITS.hubAbout) throw new AppError('err.hubAbout');
      hub.about = cleanAbout;
    }
    if (patch.emoji !== undefined && patch.emoji.trim()) {
      hub.emoji = patch.emoji.trim().slice(0, 4);
    }
    if (patch.public !== undefined) {
      hub.public = patch.public;
    }
  });
}

export function joinHub(hubId: string, userId: string): void | Promise<void> {
  const existing = db.get().hubs[hubId];
  if (existing?.remote) return joinRemoteHub(userId, hubId);
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || !hub.public) throw new AppError('err.notMember');
    hub.members[userId] ??= 'member';
  });
}

export function joinInvite(invite: string, userId: string): Hub | null | Promise<Hub | null> {
  const hub = Object.values(db.get().hubs).find((h) => h.invite === invite);
  if (!hub) return db.get().users[userId]?.serverBacked ? joinRemoteInvite(userId, invite) : null;
  db.transaction((d) => {
    const found = d.hubs[hub.id];
    if (found) found.members[userId] ??= 'member';
  });
  return hub;
}

export function leaveHub(hubId: string, userId: string): void | Promise<void> {
  if (db.get().hubs[hubId]?.remote) return leaveRemoteHub(userId, hubId);
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub?.members[userId]) return;
    if (hub.ownerId === userId) throw new AppError('owner');
    delete hub.members[userId];
  });
}

export function addRoom(hubId: string, userId: string, rawName: string, kind: 'text' | 'broadcast' = 'text', topic = ''): string | Promise<string> {
  const name = rawName.trim().replace(/\s+/g, '-').toLowerCase();
  if (!/^[a-z0-9_-]{2,24}$/.test(name)) throw new AppError('err.roomName');
  if (db.get().hubs[hubId]?.remote) return addRemoteHubRoom(userId, hubId, name);
  const id = `${hubId}_r_${uid(10)}`;
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || !['owner', 'mod'].includes(hub.members[userId])) throw new AppError('err.notMember');
    if (hub.rooms.some((r) => r.name === name)) throw new AppError('err.duplicateName');
    hub.rooms.push({ id, name, kind, topic: topic.trim().slice(0, LIMITS.topic) });
    d.msgs[id] = [];
  });
  return id;
}

export function updateRoom(hubId: string, roomId: string, userId: string, patch: { name?: string; kind?: 'text' | 'broadcast'; topic?: string }): void | Promise<void> {
  const existing = db.get().hubs[hubId];
  if (existing?.remote) {
    const room = existing.rooms.find((r) => r.id === roomId);
    if (!room) throw new AppError('err.notMember');
    return updateRemoteHubRoomSettings(userId, hubId, roomId, {
      topic: (patch.topic ?? room.topic).trim().slice(0, LIMITS.topic),
      kind: patch.kind ?? room.kind,
    });
  }
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || !['owner', 'mod'].includes(hub.members[userId])) throw new AppError('err.notMember');
    const room = hub.rooms.find((r) => r.id === roomId);
    if (!room) throw new AppError('err.notMember');
    if (patch.name !== undefined) {
      const clean = patch.name.trim().replace(/\s+/g, '-').toLowerCase();
      if (!/^[a-z0-9_-]{2,24}$/.test(clean)) throw new AppError('err.roomName');
      if (hub.rooms.some((r) => r.id !== roomId && r.name === clean)) throw new AppError('err.duplicateName');
      room.name = clean;
    }
    if (patch.kind !== undefined) room.kind = patch.kind;
    if (patch.topic !== undefined) room.topic = patch.topic.trim().slice(0, LIMITS.topic);
  });
}

export function removeRoom(hubId: string, roomId: string, userId: string): void | Promise<void> {
  if (db.get().hubs[hubId]?.remote) return removeRemoteHubRoom(userId, hubId, roomId);
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || !['owner', 'mod'].includes(hub.members[userId])) throw new AppError('err.notMember');
    if (hub.rooms.length <= 1) throw new AppError('err.lastRoom');
    hub.rooms = hub.rooms.filter((r) => r.id !== roomId);
    delete d.msgs[roomId];
  });
}

export function setHubMemberRole(hubId: string, actorId: string, targetUserId: string, role: Exclude<Role, 'owner'>): void | Promise<void> {
  if (db.get().hubs[hubId]?.remote) return setRemoteHubMemberRole(actorId, hubId, targetUserId, role);
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || hub.ownerId !== actorId || targetUserId === hub.ownerId || !hub.members[targetUserId]) {
      throw new AppError('err.notMember');
    }
    hub.members[targetUserId] = role;
  });
}

export function kickHubMember(hubId: string, actorId: string, targetUserId: string): void | Promise<void> {
  if (db.get().hubs[hubId]?.remote) return removeRemoteHubMember(actorId, hubId, targetUserId);
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || !['owner', 'mod'].includes(hub.members[actorId] ?? '') || targetUserId === hub.ownerId) {
      throw new AppError('err.notMember');
    }
    delete hub.members[targetUserId];
  });
}

export function membersOf(hubId: string): User[] {
  const d = db.get();
  const hub = d.hubs[hubId];
  return hub ? Object.keys(hub.members).map((id) => d.users[id]).filter(Boolean) : [];
}
