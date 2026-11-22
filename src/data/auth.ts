import { LIMITS } from '../config';
import { db } from './db';
import { AppError } from './errors';
import { fetchProfile, syncRemoteWorkspace, updateRemoteProfile } from './cloud';
import { requireSupabase } from '../lib/supabase';
import { session } from './session';
import type { User } from './types';

export type AuthResult = { user: User; isNew: boolean; needsEmailConfirmation?: false }
  | { user: null; isNew: true; needsEmailConfirmation: true };

const cleanUsername = (s: string) => s.trim().normalize('NFKC').toLowerCase();
const cleanEmail = (s: string) => s.trim().normalize('NFKC').toLowerCase();
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

function mapAuthError(message: string): AppError {
  const lower = message.toLowerCase();
  if (lower.includes('username') && (lower.includes('duplicate') || lower.includes('unique') || lower.includes('already'))) return new AppError('err.usernameTaken');
  if (lower.includes('already registered') || lower.includes('already exists')) return new AppError('err.emailTaken');
  if (lower.includes('invalid login credentials')) return new AppError('err.signIn');
  if (lower.includes('email not confirmed')) return new AppError('err.emailUnconfirmed');
  return new AppError('err.backendUnavailable');
}

export async function register(input: { email: string; username: string; name: string; password: string }): Promise<AuthResult> {
  const email = cleanEmail(input.email);
  const username = cleanUsername(input.username);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('err.emailInvalid');
  if (!usernameOK(username)) throw new AppError('err.username');
  const name = validateName(input.name);
  validatePassword(input.password);

  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password: input.password,
    options: { data: { username, display_name: name } },
  });
  if (error) throw mapAuthError(error.message);
  if (!data.user) throw new AppError('err.backendUnavailable');
  if (!data.session) return { user: null, isNew: true, needsEmailConfirmation: true };

  const user = await fetchProfile(data.user.id);
  await syncRemoteWorkspace(data.user.id);
  session.start(data.user.id, data.session.access_token, data.session.expires_at);
  return { user, isNew: true };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const client = requireSupabase();
  const email = cleanEmail(input.email);
  const { data, error } = await client.auth.signInWithPassword({ email, password: input.password });
  if (error) throw mapAuthError(error.message);
  if (!data.user || !data.session) throw new AppError('err.signIn');

  const user = await fetchProfile(data.user.id);
  await syncRemoteWorkspace(data.user.id);
  session.start(data.user.id, data.session.access_token, data.session.expires_at);
  return { user, isNew: false };
}

export async function restoreSession(): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw mapAuthError(error.message);
  if (!data.session?.user) {
    session.end();
    return;
  }
  const user = await fetchProfile(data.session.user.id);
  await syncRemoteWorkspace(user.id);
  session.start(user.id, data.session.access_token, data.session.expires_at);
}

export async function signOut(): Promise<void> {
  const client = requireSupabase();
  const userId = session.get()?.userId;
  let presenceUpdateFailed = false;
  if (userId) {
    try {
      await updateRemoteProfile(userId, { presence: 'offline' });
    } catch {
      presenceUpdateFailed = true;
    }
  }
  const { error } = await client.auth.signOut();
  if (error) throw mapAuthError(error.message);
  session.end();
  if (presenceUpdateFailed) throw new AppError('err.backendUnavailable');
}

export async function resetPassword(email: string): Promise<void> {
  const client = requireSupabase();
  const normalized = cleanEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new AppError('err.emailInvalid');
  const { error } = await client.auth.resetPasswordForEmail(normalized, { redirectTo: window.location.origin });
  if (error) throw mapAuthError(error.message);
}

export function getCurrentUser(): User | null {
  const id = session.get()?.userId;
  return id ? db.get().users[id] ?? null : null;
}
