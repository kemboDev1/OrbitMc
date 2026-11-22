import { createClient } from '@supabase/supabase-js';
import { AppError } from '../data/errors';

const endpoint = import.meta.env?.VITE_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const publicKey = import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim();

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
  return import.meta.env?.VITE_SUPABASE_REDIRECT_URL?.trim() || window.location.origin;
}
