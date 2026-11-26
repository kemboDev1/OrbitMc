import { createClient } from '@supabase/supabase-js';

export const MAIN_SITE_URL =
  import.meta.env.VITE_MAIN_SITE_URL?.trim() || 'https://orbitmc.vercel.app';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://oettqfnoievxxkzsgquh.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  'sb_publishable_5zoq8lpSHbSr5qHZMPSB9g_kBG_HGBL';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type PaidTier = 'ember' | 'flare' | 'nova';

export function isPaidTier(value: unknown): value is PaidTier {
  return value === 'ember' || value === 'flare' || value === 'nova';
}
