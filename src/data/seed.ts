import { FREE } from '../config';
import type { DB, Hub, Listing, Message, User } from './types';
import { hueOf, uid } from '../lib/util';

const now = Date.now();
const ago = (minutes: number) => now - minutes * 60_000;

function bot(id: string, username: string, name: string, presence: User['presence'], statusText: string): User {
  return {
    id,
    username,
    name,
    bio: 'A friendly face from the Sado crew.',
    hue: hueOf(username),
    presence,
    statusText,
    createdAt: now - 60 * 86400_000,
    bot: true,
    aura: null,
    sparks: 0,
    inventory: [],
    frame: null,
    theme: null,
    stickerPack: null,
    accent: null,
    ring: false,
    lastDaily: 0,
    lastStipend: 0,
  };
}

const users: Record<string, User> = {
  u_mila: bot('u_mila', 'mila', 'Mila Chen', 'online', 'collecting little moments'),
  u_leo: bot('u_leo', 'leo.wav', 'Leo Park', 'online', '🎧 in the mix'),
  u_nika: bot('u_nika', 'nikita', 'Nika Volkov', 'idle', 'gone to get tea'),
  u_sam: bot('u_sam', 'sam.codes', 'Sam Rivers', 'dnd', 'heads-down until 4'),
  u_arya: bot('u_arya', 'arya', 'Arya Sen', 'offline', '🌙'),
};

const makers = ['Mila Chen', 'Leo Park', 'Nika Volkov', 'Sam Rivers', 'Arya Sen'];
const makerIds = ['u_mila', 'u_leo', 'u_nika', 'u_sam', 'u_arya'];

function hub(id: string, name: string, about: string, emoji: string, rooms: string[], colorIndex: number): Hub {
  const ownerId = makerIds[colorIndex % makerIds.length];
  const members: Hub['members'] = { [ownerId]: 'owner' };
  makerIds.filter((x) => x !== ownerId).slice(0, 3 + colorIndex % 3).forEach((id) => (members[id] = 'member'));
  const r = rooms.map((room, i) => ({ id: `${id}_r${i + 1}`, name: room, kind: 'text' as const, topic: i === 0 ? 'Say hello and settle in.' : '' }));
  return {
    id,
    name,
    about,
    hue: [21, 156, 258, 329, 42][colorIndex % 5],
    emoji,
    ownerId,
    members,
    rooms: r,
    public: true,
    invite: uid(8),
    createdAt: now - colorIndex * 1_000_000,
  };
}

const hubs: Record<string, Hub> = {
  h_slow: hub('h_slow', 'After Hours', 'Small conversations, softer music, and the space to just be.', '🌙', ['lobby', 'what-listening', 'night-owls'], 0),
  h_studio: hub('h_studio', 'Soft Launch Studio', 'A cozy corner for people making things and showing the messy middle.', '✳', ['front-room', 'work-in-progress', 'feedback'], 1),
  h_arcade: hub('h_arcade', 'Arcade Club', 'Good games, friendly lobbies, absolutely no backseating.', '◎', ['lobby', 'looking-for-group', 'high-scores'], 2),
  h_garden: hub('h_garden', 'Tiny Gardeners', 'A corner to grow plants, patience, and a few surprising tomatoes.', '❋', ['potting-shed', 'show-your-plants', 'plant-help'], 3),
  h_books: hub('h_books', 'Page Turner', 'Readers with a weakness for one-more-chapter nights.', '⁖', ['the-stacks', 'currently-reading', 'monthly-pick'], 4),
};

const listings: Record<string, Listing> = {};
const products: Array<{ name: string; about: string; price: number; kind: Listing['kind']; stickers?: string[]; auraOnly?: boolean; hue: string; theme?: Listing['theme']; frame?: Listing['frame'] }> = [
  { name: 'Little feelings', about: 'Tiny expressive friends, for when words miss.', price: 90, kind: 'stickers', stickers: ['🥹', '🫠', '🫶', '🥲', '😮‍💨', '🙃', '😵‍💫', '🤍'], hue: 'coral' },
  { name: 'Pocket garden', about: 'Soft, sunlit sticker set for plant people.', price: 120, kind: 'stickers', stickers: ['🌱', '🌷', '🪴', '🍃', '🌻', '🌿', '🌼', '🌵'], hue: 'green' },
  { name: 'Midnight doodles', about: 'A little ink, a little moonlight, lots of personality.', price: 150, kind: 'stickers', stickers: ['🌘', '✨', '🖋️', '🫧', '🌒', '🪐', '🕯️', '☄️'], hue: 'purple' },
  { name: 'Lemon fizz', about: 'A bright little patch of sunshine for your screen.', price: 180, kind: 'theme', hue: 'yellow', theme: { dark: false, bg: '#fffbee', panel: '#fffdf5', raised: '#fff7dd', line: '#eadfb8', accent: '#dc8c08' } },
  { name: 'Blue hour', about: 'Slow dusk. Deep ink. Warm lights in the distance.', price: 220, kind: 'theme', hue: 'blue', theme: { dark: true, bg: '#10151d', panel: '#161d29', raised: '#1e2836', line: '#293547', accent: '#78aafc' } },
  { name: 'Sunday paper', about: 'Oat milk and good stationery, in screen form.', price: 180, kind: 'theme', hue: 'paper', theme: { dark: false, bg: '#f5f0e5', panel: '#fdf9f0', raised: '#eee7d9', line: '#ded4c2', accent: '#8b6348' } },
  { name: 'Orbit ring', about: 'A quiet orbit that says you are here.', price: 240, kind: 'frame', hue: 'orange', auraOnly: true, frame: { colors: ['#ff4f2e', '#e7aa56', '#e85e39'], spin: true } },
  { name: 'Jade light', about: 'Soft green moving light, made for slow mornings.', price: 200, kind: 'frame', hue: 'green', auraOnly: true, frame: { colors: ['#30e3a1', '#9be8ba', '#61ccb1'], spin: true } },
  { name: 'Lilac noise', about: 'A playful handmade ring with lavender edges.', price: 170, kind: 'frame', hue: 'purple', auraOnly: true, frame: { colors: ['#a278ff', '#fb86c8', '#777bff'], spin: false } },
  { name: 'Star map', about: 'A constellation, roughly where you are.', price: 210, kind: 'frame', hue: 'blue', auraOnly: true, frame: { colors: ['#6bd1ff', '#8d78ff', '#42d4c3'], spin: true } },
];

products.forEach((p, i) => {
  const id = `l_seed_${i + 1}`;
  listings[id] = {
    id,
    kind: p.kind,
    name: p.name,
    about: p.about,
    price: p.price,
    sellerId: makerIds[i % makerIds.length],
    sales: 12 + i * 7,
    createdAt: now - i * 86_400_000,
    auraOnly: p.auraOnly,
    stickers: p.stickers,
    theme: p.theme,
    frame: p.frame,
  };
});

const messages: Record<string, Message[]> = {};
const roomIds = Object.values(hubs).flatMap((h) => h.rooms.map((r) => r.id));
for (const [i, id] of roomIds.entries()) {
  const hubObj = Object.values(hubs).find((h) => h.rooms.some((r) => r.id === id));
  const ownerId = hubObj?.ownerId ?? 'u_mila';
  messages[id] = [
    { id: uid(), ch: id, by: ownerId, text: 'Made it through the week. Putting the kettle on and landing here for a bit.', ts: ago(93 - i * 2), reactions: { '☕': ['u_nika'], '🫶': ['u_mila'] } },
    { id: uid(), ch: id, by: 'u_mila', text: 'Exactly what my nervous system ordered ✨', ts: ago(89 - i * 2), reactions: { '✨': ['u_leo', 'u_arya'] } },
    { id: uid(), ch: id, by: 'u_leo', text: 'Put something good on the speakers. Whoever joins late, no skips.', ts: ago(81 - i * 2), reactions: { '🎧': ['u_sam'] } },
    { id: uid(), ch: id, by: 'u_arya', text: 'Deal. Bringing biscuits.', ts: ago(75 - i * 2), reactions: { '🫡': ['u_leo'] } },
    { id: uid(), ch: id, by: 'u_nika', text: 'Arrived late, saw “no skips,” and somehow feel safe already.', ts: ago(68 - i * 2), reactions: { '🤍': ['u_mila', 'u_arya'] } },
  ];
}

export function makeSeed(): DB {
  return {
    v: 1,
    users,
    hubs,
    msgs: messages,
    listings,
    reads: {},
    dms: {},
    guard: {},
  };
}
