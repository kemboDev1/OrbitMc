import { createStore } from '../lib/store';
import type { AuraSub, ID } from './types';

export interface UserCosmetics {
  theme: ID | null;
  frame: ID | null;
  stickerPack: ID | null;
  accent: string | null;
  aura: AuraSub | null;
  isAdmin?: boolean;
  chatFont?: 'sans' | 'display' | 'mono' | 'serif';
  messageEffect?: 'none' | 'glow' | 'aurora' | 'ember';
  banner?: string;
  profileStroke?: string;
  profileTags?: string[];
  profileTemplate?: 'clean' | 'halo' | 'frame';
}

type CosmeticsMap = Record<ID, UserCosmetics>;

const store = createStore<CosmeticsMap>({}, 'orbitmc:cosmetics', (v) => typeof v === 'object' && v !== null && !Array.isArray(v));

export function getCosmetics(userId: ID): UserCosmetics | undefined {
  return store.get()[userId];
}

export function saveCosmetics(userId: ID, patch: Partial<UserCosmetics>): void {
  store.set((prev) => {
    const cur = prev[userId] ?? { theme: null, frame: null, stickerPack: null, accent: null, aura: null };
    return { ...prev, [userId]: { ...cur, ...patch } };
  });
}
