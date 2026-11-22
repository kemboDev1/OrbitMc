export type ID = string;
export type Lang = 'en' | 'ru' | 'uz';
export type Presence = 'online' | 'idle' | 'dnd' | 'offline';
export type AuraTier = 'ember' | 'flare' | 'nova';
export type Role = 'owner' | 'mod' | 'member';

export interface AuraSub {
  tier: AuraTier;
  cycle: 'month' | 'year';
  since: number;
  renews: number;
}

export interface User {
  id: ID;
  username: string;
  name: string;
  bio: string;
  hue: number;
  avatar?: string;
  presence: Presence;
  statusText: string;
  createdAt: number;
  /** Built-in demo contact that answers on its own. */
  bot?: boolean;
  serverBacked?: boolean;
  aura: AuraSub | null;
  sparks: number;
  inventory: ID[];
  frame: ID | null;
  theme: ID | null;
  stickerPack?: ID | null;
  accent: string | null;
  ring: boolean;
  lastDaily: number;
  lastStipend: number;
  auth?: { salt: string; hash: string; iter: number };
}

export interface Room {
  id: ID;
  name: string;
  /** broadcast = only the owner and moderators can post */
  kind: 'text' | 'broadcast';
  topic: string;
}

export interface Hub {
  id: ID;
  name: string;
  about: string;
  hue: number;
  emoji: string;
  ownerId: ID;
  members: Record<ID, Role>;
  rooms: Room[];
  public: boolean;
  invite: string;
  createdAt: number;
}

export interface Message {
  id: ID;
  ch: ID;
  by: ID;
  text: string;
  ts: number;
  edited?: number;
  reply?: ID;
  reactions: Record<string, ID[]>;
  pinned?: boolean;
  sticker?: string;
  image?: string;
}

export type ListingKind = 'stickers' | 'theme' | 'frame';

export interface ThemeData {
  dark: boolean;
  bg: string;
  panel: string;
  raised: string;
  line: string;
  accent: string;
}

export interface FrameData {
  colors: string[];
  spin: boolean;
}

export interface Listing {
  id: ID;
  kind: ListingKind;
  name: string;
  nameRu?: string;
  about: string;
  aboutRu?: string;
  price: number;
  sellerId: ID;
  sales: number;
  createdAt: number;
  auraOnly?: boolean;
  removed?: boolean;
  stickers?: string[];
  theme?: ThemeData;
  frame?: FrameData;
}

export interface DB {
  v: 1;
  users: Record<ID, User>;
  hubs: Record<ID, Hub>;
  /** channel id (room id or "dm:a:b") -> messages, oldest first */
  msgs: Record<ID, Message[]>;
  listings: Record<ID, Listing>;
  /** user id -> channel id -> time of the last message they have seen */
  reads: Record<ID, Record<ID, number>>;
  /** user id -> direct chats shown in their list */
  dms: Record<ID, ID[]>;
  /** sign-in throttling: username -> failed attempts */
  guard: Record<string, { n: number; until: number }>;
}
