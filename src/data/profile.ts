import { LIMITS } from '../config';
import { isHex } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import { validateBio, validateName } from './auth';
import type { Presence } from './types';
import { updateRemoteProfile } from './cloud';

export async function updateProfile(userId: string, input: { name: string; bio: string; avatar?: string | null }): Promise<void> {
  const name = validateName(input.name);
  const bio = validateBio(input.bio);
  const currentUser = db.get().users[userId];
  if (!currentUser || currentUser.bot) throw new AppError('err.notMember');
  if (input.avatar !== undefined && input.avatar !== null && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.avatar) || input.avatar.length > LIMITS.imageChars)) {
    throw new AppError('err.imgBig');
  }
  if (currentUser.serverBacked) {
    await updateRemoteProfile(userId, { name, bio, avatar: input.avatar });
    return;
  }
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) throw new AppError('err.notMember');
    user.name = name;
    user.bio = bio;
    if (input.avatar !== undefined) {
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
