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
  banner?: string;
  profileStroke?: string;
  profileTags?: string[];
  profileTemplate?: 'clean' | 'halo' | 'frame';
  presence: Presence;
  statusText: string;
  createdAt: number;
  /** Built-in demo contact that answers on its own. */
  bot?: boolean;
  serverBacked?: boolean;
  isAdmin?: boolean;
  suspended?: boolean;
  aura: AuraSub | null;
  sparks: number;
  inventory: ID[];
  /** Local gift activity; server-backed gifts need a server ledger before public display. */
  giftsReceived?: ID[];
  /** Public total only; gift sender and item history stay private. */
  giftsReceivedCount?: number;
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
  /** True when the community and rooms are stored in Supabase. */
  remote?: true;
}

export interface PollOption {
  id: ID;
  text: string;
  votes: ID[];
}

export interface PollData {
  question: string;
  options: PollOption[];
}

export interface Message {
  id: ID;
  ch: ID;
  by: ID;
  text: string;
  ts: number;
  /** Exact server timestamp for stable pagination; local display uses millisecond ts. */
  remoteCreatedAt?: string;
  edited?: number;
  reply?: ID;
  reactions: Record<string, ID[]>;
  pinned?: boolean;
  sticker?: string;
  image?: string;
  poll?: PollData;
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
  nameUz?: string;
  about: string;
  aboutRu?: string;
  aboutUz?: string;
  price: number;
  sellerId: ID;
  sales: number;
  createdAt: number;
  auraOnly?: boolean;
  featured?: boolean;
  removed?: boolean;
  stickers?: string[];
  theme?: ThemeData;
  frame?: FrameData;
  /** True when the listing is persisted and sold through Supabase. */
  remote?: true;
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
