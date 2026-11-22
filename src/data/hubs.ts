import { LIMITS, FREE, AURA } from '../config';
import { hueOf, uid } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import type { Hub, User } from './types';
import { getAura } from './market';

const liveHubs = (d: ReturnType<typeof db.get>, id: string) => Object.values(d.hubs).filter((h) => !!h.members[id]);

export function makeHub(input: { userId: string; name: string; about: string; emoji: string; public: boolean }): Hub {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const about = input.about.trim();
  if (name.length < 2 || name.length > LIMITS.hubName) throw new AppError('err.hubName');
  if (about.length > LIMITS.hubAbout) throw new AppError('err.hubAbout');
  const tier = db.get().users[input.userId] ? getAura(db.get().users[input.userId])?.tier : undefined;
  const max = tier ? AURA[tier].hubs : FREE.hubs;
  if (liveHubs(db.get(), input.userId).length >= max) throw new AppError('createHubLimit');
  const id = `h_${uid(14)}`;
  const room = { id: `${id}_general`, name: 'general', kind: 'text' as const, topic: '' };
  const hub: Hub = {
    id,
    name,
    about,
    emoji: input.emoji.slice(0, 4),
    hue: hueOf(name),
    ownerId: input.userId,
    members: { [input.userId]: 'owner' },
    rooms: [room],
    public: input.public,
    invite: uid(9),
    createdAt: Date.now(),
  };
  db.transaction((d) => {
    d.hubs[id] = hub;
    d.msgs[room.id] = [];
  });
  return hub;
}

export function joinHub(hubId: string, userId: string): void {
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || !hub.public) throw new AppError('err.notMember');
    hub.members[userId] ??= 'member';
  });
}

export function joinInvite(invite: string, userId: string): Hub | null {
  const hub = Object.values(db.get().hubs).find((h) => h.invite === invite);
  if (!hub) return null;
  db.transaction((d) => {
    const found = d.hubs[hub.id];
    if (found) found.members[userId] ??= 'member';
  });
  return hub;
}

export function leaveHub(hubId: string, userId: string): void {
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub?.members[userId]) return;
    if (hub.ownerId === userId) throw new AppError('owner');
    delete hub.members[userId];
  });
}

export function addRoom(hubId: string, userId: string, rawName: string): string {
  const name = rawName.trim().replace(/\s+/g, '-').toLowerCase();
  if (!/^[a-z0-9_-]{2,24}$/.test(name)) throw new AppError('err.roomName');
  const id = `${hubId}_r_${uid(10)}`;
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || !['owner', 'mod'].includes(hub.members[userId])) throw new AppError('err.notMember');
    if (hub.rooms.some((r) => r.name === name)) throw new AppError('err.duplicateName');
    hub.rooms.push({ id, name, kind: 'text', topic: '' });
    d.msgs[id] = [];
  });
  return id;
}

export function removeRoom(hubId: string, roomId: string, userId: string): void {
  db.transaction((d) => {
    const hub = d.hubs[hubId];
    if (!hub || !['owner', 'mod'].includes(hub.members[userId])) throw new AppError('err.notMember');
    if (hub.rooms.length <= 1) throw new AppError('err.lastRoom');
    hub.rooms = hub.rooms.filter((r) => r.id !== roomId);
    delete d.msgs[roomId];
  });
}

export function membersOf(hubId: string): User[] {
  const d = db.get();
  const hub = d.hubs[hubId];
  return hub ? Object.keys(hub.members).map((id) => d.users[id]).filter(Boolean) : [];
}
