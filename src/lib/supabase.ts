import { createClient } from '@supabase/supabase-js';
import { AppError } from '../data/errors';

const endpoint = import.meta.env?.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const publicKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

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
  if (!supabase) throw new AppError('err.backendUnavailable');
  return supabase;
}
