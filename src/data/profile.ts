import { LIMITS } from '../config';
import { isHex } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import { validateBio, validateName } from './auth';
import type { Presence } from './types';
import { updateRemoteProfile, setRemoteBirthday } from './cloud';
import { saveCosmetics } from './cosmetics';

export async function updateProfile(userId: string, input: {
  name: string;
  bio: string;
  avatar?: string | null;
  banner?: string | null;
  profileStroke?: string | null;
  profileTags?: string[];
  profileTemplate?: 'clean' | 'halo' | 'frame';
  birthday?: string;
  birthdayVisible?: boolean;
  hideGiftSenders?: boolean;
}): Promise<void> {
  const name = validateName(input.name);
  const bio = validateBio(input.bio);
  const currentUser = db.get().users[userId];
  if (!currentUser || currentUser.bot) throw new AppError('err.notMember');
  if (input.avatar !== undefined && input.avatar !== null && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.avatar) || input.avatar.length > LIMITS.imageChars)) {
    throw new AppError('err.imgBig');
  }
  if (input.banner !== undefined && input.banner !== null && !input.banner.startsWith('grad:') && !input.banner.startsWith('frame:') && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.banner) || input.banner.length > LIMITS.imageChars)) throw new AppError('err.imgBig');
  if (input.profileStroke !== undefined && input.profileStroke !== null && !/^#[0-9a-f]{6}$/i.test(input.profileStroke)) throw new AppError('err.badText');
  const tags = (input.profileTags ?? currentUser?.profileTags ?? []).map((tag) => tag.trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (tags.length > 5 || tags.some((tag) => tag.length > 20 || !/^[\p{L}\p{N} _-]+$/u.test(tag))) throw new AppError('err.badText');
  if (input.profileTemplate !== undefined && !['clean', 'halo', 'frame'].includes(input.profileTemplate)) throw new AppError('err.badText');
  if (input.birthday !== undefined && input.birthday !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(input.birthday)) throw new AppError('err.badText');
  if (currentUser.serverBacked) {
    saveCosmetics(userId, {
      ...(input.banner !== undefined ? { banner: input.banner ?? undefined } : {}),
      ...(input.profileStroke !== undefined ? { profileStroke: input.profileStroke ?? undefined, profileStrokeCustom: !!input.profileStroke } : {}),
      ...(input.profileTags !== undefined ? { profileTags: tags } : {}),
      ...(input.profileTemplate !== undefined ? { profileTemplate: input.profileTemplate } : {}),
      ...(input.birthday !== undefined ? { birthday: input.birthday || undefined } : {}),
      ...(input.birthdayVisible !== undefined ? { birthdayVisible: input.birthdayVisible } : {}),
      ...(input.hideGiftSenders !== undefined ? { hideGiftSenders: input.hideGiftSenders } : {}),
    });
    const remoteBanner = input.banner && (input.banner.startsWith('grad:') || input.banner.startsWith('frame:')) ? undefined : input.banner;
    await updateRemoteProfile(userId, {
      name,
      bio,
      avatar: input.avatar,
      banner: remoteBanner,
      profileStroke: input.profileStroke,
      profileTags: input.profileTags === undefined ? undefined : tags,
      profileTemplate: input.profileTemplate,
      hideGiftSenders: input.hideGiftSenders,
    });
    if (input.birthday !== undefined || input.birthdayVisible !== undefined) {
      await setRemoteBirthday(userId, input.birthday, input.birthdayVisible);
    }
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
    if (input.banner !== undefined) user.banner = input.banner ?? undefined;
    if (input.profileStroke !== undefined) user.profileStroke = input.profileStroke ?? undefined;
    if (input.profileTags !== undefined) user.profileTags = tags;
    if (input.profileTemplate !== undefined) user.profileTemplate = input.profileTemplate;
    if (input.birthday !== undefined) user.birthday = input.birthday || undefined;
    if (input.birthdayVisible !== undefined) user.birthdayVisible = input.birthdayVisible;
    if (input.hideGiftSenders !== undefined) user.hideGiftSenders = input.hideGiftSenders;
  });
}

export function updateProFlex(userId: string, patch: { chatFont?: 'sans' | 'display' | 'mono' | 'serif'; messageEffect?: 'none' | 'glow' | 'aurora' | 'ember' }): void {
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) throw new AppError('err.notMember');
    if (patch.chatFont !== undefined) user.chatFont = patch.chatFont;
    if (patch.messageEffect !== undefined) user.messageEffect = patch.messageEffect;
    saveCosmetics(userId, { chatFont: user.chatFont, messageEffect: user.messageEffect });
  });
}

export function updateAccent(userId: string, accent: string | null): void {
  if (accent !== null && !isHex(accent)) throw new AppError('err.badText');
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) throw new AppError('err.notMember');
    user.accent = accent;
    saveCosmetics(userId, { accent });
  });
}

export function presence(userId: string, value: Presence): void {
  db.transaction((d) => {
    const user = d.users[userId];
    if (!user || user.bot) return;
    user.presence = value;
  });
}
