import { createClient } from '@supabase/supabase-js';
import { AppError } from '../data/errors';
import { isDesktop } from './electron';

const endpoint = import.meta.env?.VITE_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') || "https://oettqfnoievxxkzsgquh.supabase.co";
// This is a public Supabase publishable key. Database access remains guarded by RLS.
const publicKey = import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() || "sb_publishable_5zoq8lpSHbSr5qHZMPSB9g_kBG_HGBL";

export const supabase = endpoint && publicKey
  ? createClient(endpoint, publicKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!endpoint || !publicKey || !supabase) throw new AppError('err.supabaseConfigMissing');
  return supabase;
}

export function getAuthRedirectUrl() {
  const configuredRedirect = import.meta.env?.VITE_SUPABASE_REDIRECT_URL?.trim();
  if (configuredRedirect) return configuredRedirect;
  if (isDesktop()) return 'https://orbitmc.vercel.app';
  return window.location.origin;
}
