import { createStore } from '../lib/store';

interface LocalChatControls {
  muted: string[];
  mutedUntil?: Record<string, number>;
  blocked: string[];
  remoteBlocked?: string[];
  clearedAt: Record<string, number>;
  hiddenMessages: Record<string, string[]>;
  deletedChats?: string[];
  chatThemes?: Record<string, 'default' | 'ember' | 'ocean' | 'moss' | 'violet'>;
}

type ControlState = Record<string, LocalChatControls>;

const validState = (value: unknown): value is ControlState => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
    const item = entry as Partial<LocalChatControls>;
    return Array.isArray(item.muted) && item.muted.every((id) => typeof id === 'string' && id.length <= 100)
      && (item.mutedUntil === undefined || typeof item.mutedUntil === 'object' && item.mutedUntil !== null && !Array.isArray(item.mutedUntil) && Object.values(item.mutedUntil).every((at) => typeof at === 'number' && Number.isFinite(at)))
      && Array.isArray(item.blocked) && item.blocked.every((id) => typeof id === 'string' && id.length <= 100)
      && (item.remoteBlocked === undefined || Array.isArray(item.remoteBlocked) && item.remoteBlocked.every((id) => typeof id === 'string' && id.length <= 100))
      && typeof item.clearedAt === 'object' && item.clearedAt !== null && !Array.isArray(item.clearedAt)
      && Object.entries(item.clearedAt).every(([id, at]) => id.length <= 100 && typeof at === 'number' && Number.isFinite(at))
      && typeof item.hiddenMessages === 'object' && item.hiddenMessages !== null && !Array.isArray(item.hiddenMessages)
      && Object.entries(item.hiddenMessages).every(([channel, ids]) => channel.length <= 100 && Array.isArray(ids) && ids.length <= 4000 && ids.every((id) => typeof id === 'string' && id.length <= 100))
      && (item.deletedChats === undefined || Array.isArray(item.deletedChats) && item.deletedChats.every((id) => typeof id === 'string' && id.length <= 100))
      && (item.chatThemes === undefined || typeof item.chatThemes === 'object' && item.chatThemes !== null && !Array.isArray(item.chatThemes) && Object.entries(item.chatThemes).every(([channel, theme]) => channel.length <= 100 && ['default', 'ember', 'ocean', 'moss', 'violet'].includes(theme as string)));
  });
};

const controls = createStore<ControlState>({}, 'orbitmc:chat-controls', validState);

function forUser(userId: string): LocalChatControls {
  return controls.get()[userId] ?? { muted: [], mutedUntil: {}, blocked: [], remoteBlocked: [], clearedAt: {}, hiddenMessages: {}, deletedChats: [], chatThemes: {} };
}

function update(userId: string, change: (current: LocalChatControls) => LocalChatControls): void {
  controls.set((state) => ({ ...state, [userId]: change(forUser(userId)) }));
}

export const isMuted = (userId: string, otherId: string) => {
  const current = forUser(userId);
  return current.muted.includes(otherId) && (!(current.mutedUntil?.[otherId]) || current.mutedUntil[otherId] > Date.now());
};
export const isChatDeleted = (userId: string, channel: string) => forUser(userId).deletedChats?.includes(channel) ?? false;
export const getChatTheme = (userId: string, channel: string) => forUser(userId).chatThemes?.[channel] ?? 'default';
export const isBlocked = (userId: string, otherId: string) => {
  const current = forUser(userId);
  return current.blocked.includes(otherId) || (current.remoteBlocked ?? []).includes(otherId);
};
export const hiddenBefore = (userId: string, channel: string) => forUser(userId).clearedAt[channel] ?? 0;
export const isMessageHidden = (userId: string, channel: string, messageId: string) => forUser(userId).hiddenMessages[channel]?.includes(messageId) ?? false;

export function useChatControls(userId: string): LocalChatControls {
  controls.use();
  const current = forUser(userId);
  return { ...current, muted: current.muted.filter((id) => !current.mutedUntil?.[id] || current.mutedUntil[id] > Date.now()), blocked: [...new Set([...current.blocked, ...(current.remoteBlocked ?? [])])] };
}

export function setMuted(userId: string, otherId: string, muted: boolean, durationMs?: number): void {
  update(userId, (current) => {
    const mutedUntil = { ...(current.mutedUntil ?? {}) };
    if (muted && durationMs) mutedUntil[otherId] = Date.now() + durationMs;
    else delete mutedUntil[otherId];
    return { ...current, muted: muted ? [...new Set([...current.muted, otherId])] : current.muted.filter((id) => id !== otherId), mutedUntil };
  });
}

export function deleteChatForUser(userId: string, channel: string): void {
  update(userId, (current) => ({ ...current, deletedChats: [...new Set([...(current.deletedChats ?? []), channel])].slice(-500) }));
}

export function restoreChatForUser(userId: string, channel: string): void {
  update(userId, (current) => ({ ...current, deletedChats: (current.deletedChats ?? []).filter((id) => id !== channel) }));
}

export function setChatTheme(userId: string, channel: string, theme: NonNullable<LocalChatControls['chatThemes']>[string]): void {
  update(userId, (current) => {
    const chatThemes = { ...(current.chatThemes ?? {}) };
    if (theme === 'default') delete chatThemes[channel];
    else chatThemes[channel] = theme;
    return { ...current, chatThemes };
  });
}

export function setBlocked(userId: string, otherId: string, blocked: boolean): void {
  update(userId, (current) => ({
    ...current,
    blocked: blocked ? [...new Set([...current.blocked, otherId])] : current.blocked.filter((id) => id !== otherId),
  }));
}

export function replaceRemoteBlocks(userId: string, blockedIds: string[]): void {
  const safeIds = [...new Set(blockedIds.filter((id) => typeof id === 'string' && id.length <= 100))];
  update(userId, (current) => ({ ...current, remoteBlocked: safeIds }));
}

export function setRemoteBlocked(userId: string, otherId: string, blocked: boolean): void {
  update(userId, (current) => ({
    ...current,
    remoteBlocked: blocked
      ? [...new Set([...(current.remoteBlocked ?? []), otherId])]
      : (current.remoteBlocked ?? []).filter((id) => id !== otherId),
  }));
}

export function clearHistory(userId: string, channel: string): number | undefined {
  const previous = forUser(userId).clearedAt[channel];
  update(userId, (current) => ({ ...current, clearedAt: { ...current.clearedAt, [channel]: Date.now() } }));
  return previous;
}

export function restoreHistory(userId: string, channel: string, previous: number | undefined): void {
  update(userId, (current) => {
    const clearedAt = { ...current.clearedAt };
    if (previous === undefined) delete clearedAt[channel];
    else clearedAt[channel] = previous;
    return { ...current, clearedAt };
  });
}

export function hideMessage(userId: string, channel: string, messageId: string): void {
  update(userId, (current) => ({
    ...current,
    hiddenMessages: { ...current.hiddenMessages, [channel]: [...new Set([...(current.hiddenMessages[channel] ?? []), messageId])].slice(-4000) },
  }));
}
