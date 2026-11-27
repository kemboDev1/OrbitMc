import { db } from './db';
import { AppError } from './errors';
import { saveCosmetics } from './cosmetics';
import { adminRemoteDeleteUser, adminRemoteGrantSparks, adminRemoteSetRole } from './cloud';
import type { AuraTier, DB, ID, User } from './types';

export function isAdminUser(user?: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!user.serverBacked && user.id === 'demo_explorer') return true;
  return false;
}

export function toggleSelfAdminPreview(userId: ID): boolean {
  let next = false;
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user) throw new AppError('err.notMember');
    next = !user.isAdmin;
    user.isAdmin = next;
    saveCosmetics(userId, { isAdmin: next });
  });
  return next;
}

export function adminGrantAura(actorId: ID, targetUserId: ID, tier: AuraTier | null): void {
  db.transaction((d) => {
    const actor = d.users[actorId];
    const target = d.users[targetUserId];
    if (!isAdminUser(actor) || !target) throw new AppError('err.notMember');
    if (tier === null) {
      target.aura = null;
    } else {
      target.aura = {
        tier,
        cycle: 'month',
        since: Date.now(),
        renews: Date.now() + 30 * 86_400_000,
      };
    }
    saveCosmetics(targetUserId, { aura: target.aura });
  });
}

export async function adminAdjustSparks(actorId: ID, targetUserId: ID, delta: number): Promise<void> {
  const state = db.get();
  const actor = state.users[actorId];
  const target = state.users[targetUserId];
  if (!isAdminUser(actor) || !target || !Number.isFinite(delta)) throw new AppError('err.notMember');
  const cleanDelta = Math.round(delta);
  if (actor.serverBacked && target.serverBacked) {
    const nextBalance = await adminRemoteGrantSparks(targetUserId, cleanDelta);
    db.transaction((d) => {
      if (d.users[targetUserId]) d.users[targetUserId].sparks = nextBalance;
    });
    return;
  }
  db.transaction((d) => {
    const u = d.users[targetUserId];
    if (!u) throw new AppError('err.notMember');
    u.sparks = Math.max(0, Math.min(99_999, u.sparks + cleanDelta));
  });
}

export function adminToggleSuspended(actorId: ID, targetUserId: ID): boolean {
  let suspended = false;
  db.transaction((d) => {
    const actor = d.users[actorId];
    const target = d.users[targetUserId];
    if (!isAdminUser(actor) || !target || target.id === actorId) throw new AppError('err.notMember');
    suspended = !target.suspended;
    target.suspended = suspended;
  });
  return suspended;
}

export async function adminSetUserRole(actorId: ID, targetUserId: ID, role: 'member' | 'mod' | 'admin'): Promise<void> {
  const state = db.get();
  const actor = state.users[actorId];
  const target = state.users[targetUserId];
  if (!isAdminUser(actor) || !target || target.id === actorId) throw new AppError('err.notMember');
  if (actor.serverBacked && target.serverBacked) {
    await adminRemoteSetRole(targetUserId, role);
  }
  db.transaction((d) => {
    const u = d.users[targetUserId];
    if (!u) throw new AppError('err.notMember');
    u.role = role;
    u.isAdmin = role === 'admin';
    saveCosmetics(targetUserId, { role, isAdmin: u.isAdmin });
  });
}

export async function adminDeleteUser(actorId: ID, targetUserId: ID): Promise<void> {
  const state = db.get();
  const actor = state.users[actorId];
  const target = state.users[targetUserId];
  if (!isAdminUser(actor) || !target || target.id === actorId) throw new AppError('err.notMember');
  if (actor.serverBacked && target.serverBacked) {
    await adminRemoteDeleteUser(targetUserId);
  }
  db.transaction((d) => {
    delete d.users[targetUserId];
    delete d.dms[targetUserId];
    delete d.reads[targetUserId];
    for (const ch of Object.keys(d.msgs)) {
      if (ch.startsWith('dm:') && ch.split(':').includes(targetUserId)) delete d.msgs[ch];
    }
    for (const hub of Object.values(d.hubs)) {
      delete hub.members[targetUserId];
    }
  });
}

export function adminToggleUserRole(actorId: ID, targetUserId: ID): boolean {
  let nextAdmin = false;
  db.transaction((d) => {
    const actor = d.users[actorId];
    const target = d.users[targetUserId];
    if (!isAdminUser(actor) || !target || target.id === actorId) throw new AppError('err.notMember');
    nextAdmin = !target.isAdmin;
    target.isAdmin = nextAdmin;
    saveCosmetics(targetUserId, { isAdmin: nextAdmin });
  });
  return nextAdmin;
}

export function adminToggleListingFeatured(actorId: ID, listingId: ID): boolean {
  let featured = false;
  db.transaction((d) => {
    const actor = d.users[actorId];
    const listing = d.listings[listingId];
    if (!isAdminUser(actor) || !listing) throw new AppError('err.notMember');
    featured = !listing.featured;
    listing.featured = featured;
  });
  return featured;
}

export function adminSetListingRemoved(actorId: ID, listingId: ID, removed: boolean): void {
  db.transaction((d) => {
    const actor = d.users[actorId];
    const listing = d.listings[listingId];
    if (!isAdminUser(actor) || !listing) throw new AppError('err.notMember');
    listing.removed = removed;
  });
}

export function adminToggleHubPublic(actorId: ID, hubId: ID): boolean {
  let nextPublic = false;
  db.transaction((d) => {
    const actor = d.users[actorId];
    const hub = d.hubs[hubId];
    if (!isAdminUser(actor) || !hub) throw new AppError('err.notMember');
    nextPublic = !hub.public;
    hub.public = nextPublic;
  });
  return nextPublic;
}

export function adminDeleteHub(actorId: ID, hubId: ID): void {
  db.transaction((d) => {
    const actor = d.users[actorId];
    const hub = d.hubs[hubId];
    if (!isAdminUser(actor) || !hub) throw new AppError('err.notMember');
    for (const room of hub.rooms) delete d.msgs[room.id];
    delete d.hubs[hubId];
  });
}

export function getWorkspaceStats(data: DB) {
  const users = Object.values(data.users).filter((u) => u.id !== 'orbit-studio' && !u.bot);
  const onlineUsers = users.filter((u) => u.presence === 'online').length;
  const auraUsers = users.filter((u) => !!u.aura && Math.abs(u.aura.renews) > Date.now()).length;
  const hubs = Object.values(data.hubs);
  const rooms = hubs.reduce((sum, h) => sum + h.rooms.length, 0);
  const messages = Object.values(data.msgs).reduce((sum, list) => sum + list.length, 0);
  const listings = Object.values(data.listings);
  const activeListings = listings.filter((l) => !l.removed);
  const totalSales = listings.reduce((sum, l) => sum + l.sales, 0);
  const totalVolume = listings.reduce((sum, l) => sum + l.sales * l.price, 0);
  return {
    totalUsers: users.length,
    onlineUsers,
    auraUsers,
    totalHubs: hubs.length,
    publicHubs: hubs.filter((h) => h.public).length,
    totalRooms: rooms,
    totalMessages: messages,
    activeListings: activeListings.length,
    removedListings: listings.length - activeListings.length,
    totalSales,
    totalVolume,
  };
}
