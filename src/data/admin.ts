import { requireSupabase } from '../lib/supabase';
import { AppError } from './errors';
import { db } from './db';

export interface AdminProfile {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  presence: string;
}

export interface FeedbackItem {
  id: string;
  username: string;
  display_name: string;
  category: 'idea' | 'problem' | 'other';
  body: string;
  status: 'new' | 'reviewing' | 'done';
  created_at: string;
}

export async function isOrbitOwner(): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('is_orbit_owner');
  if (error) throw new AppError('err.backendUnavailable');
  return data === true;
}

export async function sendFeedback(category: FeedbackItem['category'], body: string): Promise<void> {
  const { error } = await requireSupabase().rpc('submit_orbit_feedback', { feedback_category: category, feedback_body: body.trim() });
  if (error) throw new AppError(error.code === 'PGRST202' ? 'err.backendUnavailable' : 'err.saveFailed');
}

export async function listAdminProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await requireSupabase().from('profiles').select('id,username,display_name,created_at,presence').order('created_at', { ascending: false }).limit(500);
  if (error) throw new AppError('err.backendUnavailable');
  return (data ?? []) as AdminProfile[];
}

export async function listAdminFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await requireSupabase().rpc('get_orbit_admin_feedback');
  if (error) throw new AppError('err.backendUnavailable');
  return Array.isArray(data) ? data as FeedbackItem[] : [];
}

export async function setFeedbackStatus(id: string, status: FeedbackItem['status']): Promise<void> {
  const { error } = await requireSupabase().rpc('set_orbit_feedback_status', { feedback_id: id, next_status: status });
  if (error) throw new AppError('err.saveFailed');
}

export async function getBirthdayVisibility(): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('get_my_birthday_visibility');
  if (error) throw new AppError('err.backendUnavailable');
  return data === true;
}

export async function setBirthdayVisibility(visible: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('set_birthday_visibility', { show_birthday: visible });
  if (error) throw new AppError('err.saveFailed');
}

export async function getBirthdayUserIds(): Promise<string[]> {
  const { data, error } = await requireSupabase().rpc('get_birthday_profiles_today');
  if (error) throw new AppError('err.backendUnavailable');
  return Array.isArray(data) ? data.map((row: { user_id: string }) => row.user_id) : [];
}

export async function syncOwnerEntitlement(userId: string): Promise<boolean> {
  const owner = await isOrbitOwner();
  db.transaction((state) => { const user = state.users[userId]; if (user) user.isOwner = owner; });
  return owner;
}
