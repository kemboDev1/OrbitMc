import { LIMITS } from '../config';
import { isHex } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import { validateBio, validateName } from './auth';
import type { Presence } from './types';

export function updateProfile(userId: string, input: { name: string; bio: string; avatar?: string | null }): void {
  const name = validateName(input.name);
  const bio = validateBio(input.bio);
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) throw new AppError('err.notMember');
    user.name = name;
    user.bio = bio;
    if (input.avatar !== undefined) {
      if (input.avatar !== null && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.avatar) || input.avatar.length > LIMITS.imageChars)) throw new AppError('err.imgBig');
      user.avatar = input.avatar ?? undefined;
    }
  });
}

export function updateAccent(userId: string, accent: string | null): void {
  if (accent !== null && !isHex(accent)) throw new AppError('err.badText');
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) throw new AppError('err.notMember');
    user.accent = accent;
  });
}

export function presence(userId: string, value: Presence): void {
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) return;
    user.presence = value;
  });
}
