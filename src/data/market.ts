import { AURA, FREE, LIMITS } from '../config';
import { uid } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import type { AuraTier, Listing, ListingKind, ThemeData, FrameData, User } from './types';
import { claimRemoteDaily, createRemoteListing, purchaseRemoteListing, removeRemoteListing } from './cloud';
import { saveCosmetics } from './cosmetics';

export function getAura(user: User) {
  const sub = user.aura;
  return sub && Math.abs(sub.renews) > Date.now() ? sub : null;
}

export function claimDaily(userId: string): number | Promise<number> {
  const current = db.get().users[userId];
  if (!current) throw new AppError('err.notMember');
  if (current.serverBacked) return claimRemoteDaily(userId);
  const day = new Date().toDateString();
  if (new Date(current.lastDaily).toDateString() === day) throw new AppError('dailyDone');
  const activeAura = getAura(current);
  const count = activeAura ? AURA[activeAura.tier].stipend : FREE.daily;
  db.transaction((d) => {
    const user = d.users[userId];
    user.sparks = Math.min(99_999, user.sparks + count);
    user.lastDaily = Date.now();
  });
  return count;
}

export function buyListing(userId: string, listingId: string): void | Promise<void> {
  const remoteUser = db.get().users[userId]?.serverBacked;
  const remoteListing = db.get().listings[listingId]?.remote;
  if (remoteUser && remoteListing) {
    return purchaseRemoteListing(userId, listingId);
  }
  if (remoteUser && !remoteListing) {
    const item = db.get().listings[listingId];
    if (!item || item.kind !== 'stickers') throw new AppError('shopNotReady');
  }
  db.transaction((d) => {
    const user = d.users[userId];
    const listing = d.listings[listingId];
    if (!user || !listing || listing.removed) throw new AppError('err.notMember');
    if (user.inventory.includes(listing.id)) throw new AppError('alreadyOwned');
    if (listing.auraOnly && !getAura(user)) throw new AppError('auraLimit');
    if (user.sparks < listing.price) throw new AppError('notEnough');
    user.sparks -= listing.price;
    user.inventory.push(listing.id);
    listing.sales += 1;
    const seller = d.users[listing.sellerId];
    if (seller && seller.id !== user.id) {
      const sellerAura = getAura(seller);
      const fee = sellerAura ? AURA[sellerAura.tier].fee : FREE.fee;
      seller.sparks = Math.min(99_999, seller.sparks + Math.floor(listing.price * (1 - fee)));
    }
  });
}

export function equipListing(userId: string, listingId: string): void {
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || (!user.inventory.includes(listingId) && d.listings[listingId]?.sellerId !== userId)) {
      throw new AppError('err.notMember');
    }
    const item = d.listings[listingId];
    if (!item) throw new AppError('err.notMember');
    if (item.kind === 'theme') user.theme = user.theme === listingId ? null : listingId;
    if (item.kind === 'stickers') user.stickerPack = user.stickerPack === listingId ? null : listingId;
    if (item.kind === 'frame') {
      if (item.auraOnly && !getAura(user)) throw new AppError('auraLimit');
      user.frame = user.frame === listingId ? null : listingId;
    }
    saveCosmetics(userId, {
      theme: user.theme,
      frame: user.frame,
      stickerPack: user.stickerPack ?? null,
    });
  });
}

export function giftListing(fromId: string, toId: string, listingId: string): void | Promise<void> {
  const remoteUser = db.get().users[fromId]?.serverBacked;
  const remoteListing = db.get().listings[listingId]?.remote;
  if (remoteUser) {
    if (!remoteListing) throw new AppError('shopNotReady');
    return purchaseRemoteListing(fromId, listingId, toId);
  }
  db.transaction((d) => {
    const from = d.users[fromId];
    const to = d.users[toId];
    const item = d.listings[listingId];
    if (!from || !to || !item || fromId === toId || item.removed) throw new AppError('err.notMember');
    if (to.inventory.includes(listingId)) throw new AppError('alreadyOwned');
    if (item.auraOnly && !getAura(to)) throw new AppError('auraLimit');
    if (from.sparks < item.price) throw new AppError('notEnough');
    from.sparks -= item.price;
    to.inventory.push(listingId);
    to.giftsReceived = [...(to.giftsReceived ?? []), listingId].slice(-200);
    item.sales += 1;
    const seller = d.users[item.sellerId];
    if (seller && seller.id !== from.id) {
      const sellerAura = getAura(seller);
      const fee = sellerAura ? AURA[sellerAura.tier].fee : FREE.fee;
      seller.sparks = Math.min(99_999, seller.sparks + Math.floor(item.price * (1 - fee)));
    }
  });
}

export function createListing(input: {
  userId: string; kind: ListingKind; name: string; about: string; price: number;
  stickers?: string[]; theme?: ThemeData; frame?: FrameData; auraOnly?: boolean;
}): Listing | Promise<Listing> {
  const name = input.name.trim().slice(0, LIMITS.hubName);
  const about = input.about.trim().slice(0, LIMITS.hubAbout);
  const person = db.get().users[input.userId];
  if (!name) throw new AppError('err.listingName');
  if (about.length < 3) throw new AppError('err.listingAbout');
  if (!Number.isInteger(input.price) || input.price < 10 || input.price > 9999) throw new AppError('err.listingPrice');
  if (!person) throw new AppError('err.notMember');
  const userListings = Object.values(db.get().listings).filter((x) => x.sellerId === input.userId && !x.removed).length;
  if (userListings >= LIMITS.listings) throw new AppError('listingLimit');
  if (input.kind === 'stickers' && (!input.stickers || input.stickers.length < 6 || input.stickers.length > 12)) throw new AppError('err.stickerCount');
  if (input.kind === 'theme' && (!input.theme || !/^#[\da-f]{6}$/i.test(input.theme.accent))) throw new AppError('err.badText');
  if (input.kind === 'frame') {
    if (!input.frame?.colors.every((x) => /^#[\da-f]{6}$/i.test(x))) throw new AppError('err.badText');
    if (input.frame.spin && !getAura(person)) throw new AppError('auraLimit');
  }
  if (person.serverBacked) {
    return createRemoteListing({
      userId: input.userId, kind: input.kind, name, about, price: input.price,
      design: input.kind === 'theme'
        ? { ...input.theme! }
        : input.kind === 'frame'
          ? { ...input.frame!, auraOnly: input.auraOnly === true }
          : { stickers: input.stickers!, auraOnly: input.auraOnly === true },
    });
  }
  const listing: Listing = {
    id: `l_${uid(16)}`, kind: input.kind, name, about, price: input.price,
    sellerId: input.userId, sales: 0, createdAt: Date.now(), auraOnly: input.auraOnly,
    stickers: input.stickers, theme: input.theme, frame: input.frame,
  };
  db.transaction((d) => {
    d.listings[listing.id] = listing;
    const creator = d.users[input.userId];
    if (creator && !creator.inventory.includes(listing.id)) {
      creator.inventory.push(listing.id);
    }
  });
  return listing;
}

export function removeListing(userId: string, listingId: string): void | Promise<void> {
  if (db.get().users[userId]?.serverBacked && db.get().listings[listingId]?.remote) {
    return removeRemoteListing(userId, listingId);
  }
  db.transaction((d) => {
    const l = d.listings[listingId];
    const actor = d.users[userId];
    if (!l || (l.sellerId !== userId && !actor?.isAdmin)) throw new AppError('err.notMember');
    l.removed = true;
  });
}

export function subscribeAura(userId: string, tier: AuraTier, cycle: 'month' | 'year'): void {
  db.transaction((d) => {
    const current = d.users[userId];
    if (!current) throw new AppError('err.notMember');
    const days = cycle === 'month' ? 30 : 365;
    current.aura = { tier, cycle, since: Date.now(), renews: Date.now() + days * 86_400_000 };
    saveCosmetics(userId, { aura: current.aura });
  });
}

export function cancelAura(userId: string): void {
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user?.aura) return;
    user.aura.renews = -Math.abs(user.aura.renews); // negative expiry means no renewal; retain perks until its absolute date
    saveCosmetics(userId, { aura: user.aura });
  });
}

export function hasAura(userId: string): boolean {
  const user = db.get().users[userId];
  return !!user && !!getAura(user);
}
