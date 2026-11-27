import { createStore } from '../lib/store';
import { db } from './db';

interface LocalChatControls {
  muted: string[];
  mutedUntil?: Record<string, number>;
  blocked: string[];
  remoteBlocked?: string[];
  clearedAt: Record<string, number>;
  hiddenMessages: Record<string, string[]>;
  nicknames?: Record<string, string>;
}

type ControlState = Record<string, LocalChatControls>;

const validState = (value: unknown): value is ControlState => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
    const item = entry as Partial<LocalChatControls>;
    return Array.isArray(item.muted) && item.muted.every((id) => typeof id === 'string' && id.length <= 100)
      && (item.mutedUntil === undefined || (typeof item.mutedUntil === 'object' && item.mutedUntil !== null && !Array.isArray(item.mutedUntil)))
      && Array.isArray(item.blocked) && item.blocked.every((id) => typeof id === 'string' && id.length <= 100)
      && (item.remoteBlocked === undefined || Array.isArray(item.remoteBlocked) && item.remoteBlocked.every((id) => typeof id === 'string' && id.length <= 100))
      && typeof item.clearedAt === 'object' && item.clearedAt !== null && !Array.isArray(item.clearedAt)
      && Object.entries(item.clearedAt).every(([id, at]) => id.length <= 100 && typeof at === 'number' && Number.isFinite(at))
      && typeof item.hiddenMessages === 'object' && item.hiddenMessages !== null && !Array.isArray(item.hiddenMessages)
      && Object.entries(item.hiddenMessages).every(([channel, ids]) => channel.length <= 100 && Array.isArray(ids) && ids.length <= 4000 && ids.every((id) => typeof id === 'string' && id.length <= 100))
      && (item.nicknames === undefined || (typeof item.nicknames === 'object' && item.nicknames !== null && !Array.isArray(item.nicknames)
        && Object.entries(item.nicknames).every(([id, nick]) => id.length <= 100 && typeof nick === 'string' && nick.length <= 40)));
  });
};

const controls = createStore<ControlState>({}, 'orbitmc:chat-controls', validState);

function forUser(userId: string): LocalChatControls {
  return controls.get()[userId] ?? { muted: [], mutedUntil: {}, blocked: [], remoteBlocked: [], clearedAt: {}, hiddenMessages: {}, nicknames: {} };
}

function update(userId: string, change: (current: LocalChatControls) => LocalChatControls): void {
  controls.set((state) => ({ ...state, [userId]: change(forUser(userId)) }));
}

export function getMuteUntil(userId: string, otherId: string): number {
  const cur = forUser(userId);
  const until = cur.mutedUntil?.[otherId];
  if (typeof until === 'number') {
    if (until < 0) return -1;
    if (until > Date.now()) return until;
    return 0;
  }
  return cur.muted.includes(otherId) ? -1 : 0;
}

export const isMuted = (userId: string, otherId: string) => getMuteUntil(userId, otherId) !== 0;

export const isBlocked = (userId: string, otherId: string) => {
  const current = forUser(userId);
  return current.blocked.includes(otherId) || (current.remoteBlocked ?? []).includes(otherId);
};
export const hiddenBefore = (userId: string, channel: string) => forUser(userId).clearedAt[channel] ?? 0;
export const isMessageHidden = (userId: string, channel: string, messageId: string) => forUser(userId).hiddenMessages[channel]?.includes(messageId) ?? false;
export const getDisplayName = (userId: string, target?: { id: string; name: string } | null): string => {
  if (!target) return '';
  return forUser(userId).nicknames?.[target.id] || target.name;
};

export function setCustomNickname(userId: string, targetId: string, nickname: string): void {
  const clean = nickname.trim().replace(/\s+/g, ' ').slice(0, 32);
  update(userId, (current) => {
    const next = { ...(current.nicknames ?? {}) };
    if (!clean) delete next[targetId];
    else next[targetId] = clean;
    return { ...current, nicknames: next };
  });
}

export function useChatControls(userId: string): LocalChatControls {
  controls.use();
  const current = forUser(userId);
  const now = Date.now();
  const activeMuted = [...new Set([
    ...current.muted.filter((id) => {
      const u = current.mutedUntil?.[id];
      return u === undefined || u < 0 || u > now;
    }),
    ...Object.entries(current.mutedUntil ?? {}).filter(([, until]) => until < 0 || until > now).map(([id]) => id),
  ])];
  return {
    ...current,
    muted: activeMuted,
    blocked: [...new Set([...current.blocked, ...(current.remoteBlocked ?? [])])],
    nicknames: current.nicknames ?? {},
  };
}

export function setMutedFor(userId: string, otherId: string, durationMs: number | 'forever' | 0): void {
  update(userId, (current) => {
    const nextUntil = { ...(current.mutedUntil ?? {}) };
    if (durationMs === 0) {
      delete nextUntil[otherId];
      return { ...current, muted: current.muted.filter((id) => id !== otherId), mutedUntil: nextUntil };
    }
    nextUntil[otherId] = durationMs === 'forever' ? -1 : Date.now() + durationMs;
    return { ...current, muted: [...new Set([...current.muted, otherId])], mutedUntil: nextUntil };
  });
}

export function setMuted(userId: string, otherId: string, muted: boolean): void {
  setMutedFor(userId, otherId, muted ? 'forever' : 0);
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

export function resetContactState(userId: string, otherId: string): void {
  update(userId, (current) => {
    const nextNicks = { ...(current.nicknames ?? {}) };
    const nextMutedUntil = { ...(current.mutedUntil ?? {}) };
    delete nextNicks[otherId];
    delete nextMutedUntil[otherId];
    return {
      ...current,
      nicknames: nextNicks,
      muted: current.muted.filter((id) => id !== otherId),
      mutedUntil: nextMutedUntil,
    };
  });
}

export function deleteConversation(userId: string, channel: string): void {
  const parts = channel.startsWith('dm:') ? channel.split(':').slice(1) : [];
  const otherId = parts.find((id) => id !== userId) ?? (parts[0] === userId ? userId : undefined);
  const now = Date.now();
  update(userId, (current) => {
    const nextHidden = { ...current.hiddenMessages };
    delete nextHidden[channel];
    const nextNicks = { ...(current.nicknames ?? {}) };
    const nextMutedUntil = { ...(current.mutedUntil ?? {}) };
    let nextMuted = current.muted;
    if (otherId) {
      delete nextNicks[otherId];
      delete nextMutedUntil[otherId];
      nextMuted = current.muted.filter((id) => id !== otherId);
    }
    return {
      ...current,
      clearedAt: { ...current.clearedAt, [channel]: now },
      hiddenMessages: nextHidden,
      nicknames: nextNicks,
      muted: nextMuted,
      mutedUntil: nextMutedUntil,
    };
  });
  db.transaction((state) => {
    if (state.dms[userId]) {
      state.dms[userId] = state.dms[userId].filter((id) => id !== channel);
    }
    if (state.reads[userId]) {
      delete state.reads[userId][channel];
    }
    if (!channel.startsWith('dm:') || !state.users[userId]?.serverBacked) {
      delete state.msgs[channel];
    }
  });
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
