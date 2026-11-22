import { LIMITS } from '../config';
import { hashPassword, safeEqual } from '../lib/crypto';
import { uid } from '../lib/util';
import { db } from './db';
import { AppError } from './errors';
import { session } from './session';
import type { User } from './types';

export type AuthResult = { user: User; isNew: boolean };

const cleanUsername = (s: string) => s.trim().normalize('NFKC').toLowerCase();
const usernameOK = (s: string) => /^[a-z0-9][a-z0-9_]{2,18}[a-z0-9]$/.test(s);

export function validateName(name: string) {
  const s = name.trim().replace(/\s+/g, ' ');
  if (s.length < 2) throw new AppError('err.nameShort');
  if (s.length > LIMITS.name) throw new AppError('err.nameLong');
  if (/[\u0000-\u001f<>]/.test(s)) throw new AppError('err.nameChars');
  return s;
}

export function validateBio(bio: string) {
  const s = bio.trim();
  if (s.length > LIMITS.bio) throw new AppError('err.bioLong');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) throw new AppError('err.badText');
  return s;
}

export function validatePassword(password: string) {
  if (password.length < 10) throw new AppError('err.passwordShort');
  if (password.length > 128) throw new AppError('err.passwordLong');
  if (/[\u0000-\u001f\u007f]/.test(password)) throw new AppError('err.badText');
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) throw new AppError('err.passwordMix');
  return password;
}

function bucket(name: string) {
  return name.slice(0, 32);
}

function checkRate(key: string) {
  const g = db.get().guard[bucket(key)];
  if (g && g.until > Date.now()) throw new AppError('err.rateLimit');
}

function failed(key: string) {
  db.transaction((d) => {
    const k = bucket(key);
    const was = d.guard[k];
    const n = Math.min(7, (was && was.until > Date.now() ? was.n : 0) + 1);
    const delay = Math.min(30 * 60_000, 1_000 * 2 ** (n - 1));
    d.guard[k] = { n, until: Date.now() + delay };
  });
}

function succeeded(key: string) {
  db.transaction((d) => {
    delete d.guard[bucket(key)];
  });
}

export async function register(input: { username: string; name: string; password: string; remember?: boolean }): Promise<AuthResult> {
  const username = cleanUsername(input.username);
  if (!usernameOK(username)) throw new AppError('err.username');
  const name = validateName(input.name);
  validatePassword(input.password);
  const pass = await hashPassword(input.password);
  const key = `name:${username}`;
  checkRate(key);
  if (Object.values(db.get().users).some((u) => u.username.toLowerCase() === username)) throw new AppError('err.usernameTaken');
  const user: User = {
    id: `u_${uid(18)}`,
    username,
    name,
    bio: '',
    hue: Math.floor(Math.random() * 360),
    presence: 'online',
    statusText: '',
    createdAt: Date.now(),
    aura: null,
    sparks: 300,
    inventory: [],
    frame: null,
    theme: null,
    stickerPack: null,
    accent: null,
    ring: false,
    lastDaily: 0,
    lastStipend: 0,
    auth: pass,
  };
  db.transaction((d) => {
    // Re-check inside the serialized local transaction to avoid duplicate usernames across tabs.
    if (Object.values(d.users).some((u) => u.username.toLowerCase() === username)) throw new AppError('err.usernameTaken');
    d.users[user.id] = user;
  });
  session.start(user.id, !!input.remember);
  return { user, isNew: true };
}

export async function signIn(input: { username: string; password: string; remember?: boolean }): Promise<AuthResult> {
  const username = cleanUsername(input.username);
  const key = `name:${username}`;
  checkRate(key);
  const person = Object.values(db.get().users).find((u) => u.username.toLowerCase() === username);
  if (!person || !person.auth) {
    failed(key);
    throw new AppError('err.signIn');
  }
  const computed = await hashPassword(input.password.slice(0, 128), person.auth.salt, person.auth.iter);
  if (!safeEqual(computed.hash, person.auth.hash)) {
    failed(key);
    throw new AppError('err.signIn');
  }
  succeeded(key);
  db.transaction((d) => {
    d.users[person.id].presence = 'online';
  });
  session.start(person.id, !!input.remember);
  return { user: person, isNew: false };
}

export function signOut(): void {
  const userId = session.get()?.userId;
  if (userId) db.transaction((d) => {
    const person = d.users[userId];
    if (person && !person.bot) person.presence = 'offline';
  });
  session.end();
}

export function resetPasswordHelp(): void {
  throw new AppError('auth.resetNotAvailable');
}

export function getCurrentUser(): User | null {
  const id = session.get()?.userId;
  if (!id) return null;
  return db.get().users[id] ?? null;
}
