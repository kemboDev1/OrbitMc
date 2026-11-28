import { LIMITS } from '../config';
import { db } from './db';
import { AppError } from './errors';
import { fetchProfile, syncRemoteWorkspace, updateRemoteProfile } from './cloud';
import { getAuthRedirectUrl, requireSupabase } from '../lib/supabase';
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

function mapAuthError(error: { message?: string; code?: string; status?: number }): AppError {
  const lower = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (lower.includes('no api key') || lower.includes('api key')) return new AppError('err.supabaseConfigMissing');
  if (lower.includes('profiles_username_key') || (lower.includes('username') && (lower.includes('duplicate') || lower.includes('unique') || lower.includes('already')))) return new AppError('err.usernameTaken');
  if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('user already exists')) return new AppError('err.emailTaken');
  if (error.status === 429 || lower.includes('over_email_send_rate_limit') || lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) return new AppError('err.rateLimit');
  if (lower.includes('invalid login credentials')) return new AppError('err.signIn');
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) return new AppError('err.emailUnconfirmed');
  return new AppError('err.backendUnavailable');
}

export async function register(input: { email: string; username: string; name: string; password: string; birthDate?: string }): Promise<AuthResult> {
  const email = cleanEmail(input.email);
  const username = cleanUsername(input.username);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('err.emailInvalid');
  if (!usernameOK(username)) throw new AppError('err.username');
  const name = validateName(input.name);
  validatePassword(input.password);
  if (input.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) || Number.isNaN(Date.parse(`${input.birthDate}T00:00:00Z`)) || input.birthDate > new Date().toISOString().slice(0, 10))) throw new AppError('err.badText');

  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password: input.password,
    options: { data: { username, display_name: name, ...(input.birthDate ? { birth_date: input.birthDate } : {}) }, emailRedirectTo: getAuthRedirectUrl() },
  });
  if (error) throw mapAuthError(error);
  if (!data.user) throw new AppError('err.backendUnavailable');
  if (!data.session && data.user.identities?.length === 0) throw new AppError('err.emailTaken');
  if (!data.session) return { user: null, isNew: true, needsEmailConfirmation: true };

  try {
    const user = await fetchProfile(data.user.id);
    await syncRemoteWorkspace(data.user.id);
    session.start(data.user.id, data.session.access_token, data.session.expires_at);
    return { user, isNew: true };
  } catch {
    await client.auth.signOut().catch(() => undefined);
    session.end();
    throw new AppError('err.accountCreatedSetupIssue');
  }
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const client = requireSupabase();
  const email = cleanEmail(input.email);
  const { data, error } = await client.auth.signInWithPassword({ email, password: input.password });
  if (error) throw mapAuthError(error);
  if (!data.user || !data.session) throw new AppError('err.signIn');

  const user = await fetchProfile(data.user.id);
  await syncRemoteWorkspace(data.user.id);
  session.start(data.user.id, data.session.access_token, data.session.expires_at);
  return { user, isNew: false };
}

/** Local interactive preview workspace so users can test Chats, Hubs, Shop, Orbit+ and Admin immediately. */
export function enterDemoWorkspace(): User {
  const demoId = 'demo_explorer';
  const friendA = 'demo_friend_ayla';
  const friendB = 'demo_friend_kamron';
  const now = Date.now();
  db.transaction((state) => {
    if (!state.users[demoId]) {
      state.users[demoId] = {
        id: demoId,
        username: 'orbit_founder',
        name: 'Orbit Founder',
        bio: 'Building communities and custom assets inside OrbitMc.',
        hue: 18,
        presence: 'online',
        statusText: 'Designing in OrbitMc ✨',
        createdAt: now - 86_400_000 * 14,
        serverBacked: false,
        isAdmin: true,
        aura: { tier: 'flare', cycle: 'month', since: now - 86_400_000 * 5, renews: now + 86_400_000 * 25 },
        sparks: 1450,
        inventory: ['orbit_theme_nightglass', 'orbit_frame_arc'],
        giftsReceived: ['orbit_theme_nightglass'],
        giftsReceivedCount: 1,
        frame: 'orbit_frame_arc',
        theme: null,
        stickerPack: null,
        accent: null,
        ring: true,
        lastDaily: 0,
        lastStipend: 0,
      };
    } else {
      state.users[demoId].presence = 'online';
      state.users[demoId].isAdmin = true;
    }
    if (!state.users[friendA]) {
      state.users[friendA] = {
        id: friendA, username: 'ayla_design', name: 'Ayla Design',
        bio: 'Theme maker & community host.', hue: 268, presence: 'online',
        statusText: 'Crafting Nightglass palettes', createdAt: now - 86_400_000 * 40,
        serverBacked: false, aura: { tier: 'nova', cycle: 'year', since: now - 86_400_000 * 20, renews: now + 86_400_000 * 340 },
        sparks: 820, inventory: ['orbit_theme_nightglass'], frame: null, theme: null, accent: null, ring: false, lastDaily: 0, lastStipend: 0,
      };
    }
    if (!state.users[friendB]) {
      state.users[friendB] = {
        id: friendB, username: 'kamron_dev', name: 'Kamron Dev',
        bio: 'Shipping hubs, bots & quick tools.', hue: 155, presence: 'idle',
        statusText: 'In #tasks room', createdAt: now - 86_400_000 * 22,
        serverBacked: false, aura: null, sparks: 410, inventory: [], frame: null, theme: null, accent: null, ring: false, lastDaily: 0, lastStipend: 0,
      };
    }
    const dmIdA = `dm:${[demoId, friendA].sort().join(':')}`;
    state.dms[demoId] ??= [];
    if (!state.dms[demoId].includes(dmIdA)) state.dms[demoId].unshift(dmIdA);
    if (!state.msgs[dmIdA]?.length) {
      state.msgs[dmIdA] = [
        { id: 'demo_m1', ch: dmIdA, by: friendA, text: 'Welcome to **OrbitMc**! Try out `inline code`, ||tap-to-reveal spoilers||, polls, or create your own theme & frame in the Shop ✨', ts: now - 240_000, reactions: { '✨': [demoId] }, pinned: true },
        { id: 'demo_m2', ch: dmIdA, by: demoId, text: 'Awesome! Also check out our work Hub and the Admin Studio.', ts: now - 120_000, reactions: {} },
      ];
    }
    const hubId = 'h_orbit_builders';
    if (!state.hubs[hubId]) {
      state.hubs[hubId] = {
        id: hubId,
        name: 'Orbit Builders',
        about: 'Product design, dev sprints, and community asset drops.',
        hue: 16,
        emoji: '🚀',
        ownerId: demoId,
        members: { [demoId]: 'owner', [friendA]: 'mod', [friendB]: 'member' },
        rooms: [
          { id: `${hubId}_announcements`, name: 'announcements', kind: 'broadcast', topic: 'Official OrbitMc updates & drops' },
          { id: `${hubId}_general`, name: 'general', kind: 'text', topic: 'Team chat and feedback' },
          { id: `${hubId}_tasks`, name: 'tasks', kind: 'text', topic: 'Daily tasks and sprint notes' },
        ],
        public: true,
        invite: 'orbit999',
        createdAt: now - 86_400_000 * 10,
      };
      state.msgs[`${hubId}_announcements`] = [
        { id: 'demo_hm1', ch: `${hubId}_announcements`, by: demoId, text: '🚀 **OrbitMc Remake Live!** Welcome to the new workspace — Telegram speed meets Discord structure.', ts: now - 600_000, reactions: { '🔥': [friendA, friendB] }, pinned: true },
      ];
      state.msgs[`${hubId}_general`] = [
        { id: 'demo_hm2', ch: `${hubId}_general`, by: friendA, text: 'Dropped a new theme in the **Orbit Shop** — check it out and send feedback!', ts: now - 300_000, reactions: { '🫶': [demoId] } },
      ];
      state.msgs[`${hubId}_tasks`] = [];
    }
  });
  session.start(demoId, 'demo-local', Math.floor((Date.now() + 7 * 86_400_000) / 1000));
  return db.get().users[demoId];
}

export async function restoreSession(): Promise<void> {
  const existing = session.get();
  if (existing?.token === 'demo-local' && db.get().users[existing.userId]) {
    return;
  }
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw mapAuthError(error);
  if (!data.session?.user) {
    session.end();
    return;
  }
  const user = await fetchProfile(data.session.user.id);
  db.transaction((state) => {
    state.users[user.id] = user;
  });
  session.start(user.id, data.session.access_token, data.session.expires_at);
  await syncRemoteWorkspace(user.id);
}

export async function signOut(): Promise<void> {
  const current = session.get();
  if (current?.token === 'demo-local') {
    session.end();
    return;
  }
  const client = requireSupabase();
  const userId = current?.userId;
  let presenceUpdateFailed = false;
  if (userId) {
    try {
      await updateRemoteProfile(userId, { presence: 'offline' });
    } catch {
      presenceUpdateFailed = true;
    }
  }
  const { error } = await client.auth.signOut();
  if (error) throw mapAuthError(error);
  session.end();
  if (presenceUpdateFailed) throw new AppError('err.backendUnavailable');
}

export async function resetPassword(email: string): Promise<void> {
  const client = requireSupabase();
  const normalized = cleanEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new AppError('err.emailInvalid');
  const { error } = await client.auth.resetPasswordForEmail(normalized, { redirectTo: getAuthRedirectUrl() });
  if (error) throw mapAuthError(error);
}

export async function resendConfirmation(email: string): Promise<void> {
  const client = requireSupabase();
  const normalized = cleanEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new AppError('err.emailInvalid');
  const { error } = await client.auth.resend({
    type: 'signup',
    email: normalized,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
  if (error) throw mapAuthError(error);
}

export function getCurrentUser(): User | null {
  const id = session.get()?.userId;
  return id ? db.get().users[id] ?? null : null;
}
