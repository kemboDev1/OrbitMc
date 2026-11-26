import type { AuraTier } from './data/types';

/** Rename the product here. */
export const BRAND = 'OrbitMc';

export const STUDIO_URL = import.meta.env?.VITE_STUDIO_URL?.trim() || 'https://orbit-studio-platform.vercel.app';

export const LIMITS = {
  message: 2000,
  messageNova: 4000,
  name: 32,
  bio: 160,
  status: 60,
  hubName: 40,
  hubAbout: 160,
  roomName: 24,
  topic: 120,
  avatarChars: 60_000,
  imageChars: 320_000,
  imageCharsAura: 640_000,
  perChannel: 400,
  listings: 12,
  /** OWASP recommendation for PBKDF2-HMAC-SHA256. */
  pbkdf2: 600_000,
};

export const TIERS: AuraTier[] = ['ember', 'flare', 'nova'];

export const AURA: Record<AuraTier, {
  month: number;
  year: number;
  stipend: number;
  daily: number;
  hubs: number;
  fee: number;
  maxChars: number;
  animatedFrames: boolean;
  customThemes: boolean;
  polls: boolean;
  stickerPacks: boolean;
}> = {
  ember: {
    month: 2.99,
    year: 29.9,
    stipend: 200,
    daily: 2,
    hubs: 10,
    fee: 0.1,
    maxChars: 2500,
    animatedFrames: true,
    customThemes: true,
    polls: true,
    stickerPacks: true,
  },
  flare: {
    month: 5.99,
    year: 59.9,
    stipend: 500,
    daily: 3,
    hubs: 25,
    fee: 0.05,
    maxChars: 3200,
    animatedFrames: true,
    customThemes: true,
    polls: true,
    stickerPacks: true,
  },
  nova: {
    month: 9.99,
    year: 99.9,
    stipend: 1200,
    daily: 4,
    hubs: 100,
    fee: 0,
    maxChars: 4000,
    animatedFrames: true,
    customThemes: true,
    polls: true,
    stickerPacks: true,
  },
};

export const FREE = { hubs: 3, fee: 0.15, daily: 25, startSparks: 300 };

export const ACCENTS = ['#ff5b2e', '#37d39b', '#8f7dff', '#3aa8ff', '#ffc233', '#ff4d7e'];

export const BANNER_GRADIENTS: { id: string; label: string; css: string }[] = [
  { id: 'grad:cosmic', label: 'Cosmic', css: 'linear-gradient(135deg, #1b1536 0%, #3b2667 48%, #bc4e4e 100%)' },
  { id: 'grad:sunset', label: 'Sunset', css: 'linear-gradient(135deg, #3b1710 0%, #c94b2c 52%, #f09c42 100%)' },
  { id: 'grad:aurora', label: 'Aurora', css: 'linear-gradient(135deg, #0b2429 0%, #165e63 50%, #5e43b8 100%)' },
  { id: 'grad:emerald', label: 'Emerald', css: 'linear-gradient(135deg, #0c2119 0%, #1a5941 55%, #37d39b 100%)' },
  { id: 'grad:obsidian', label: 'Obsidian', css: 'linear-gradient(135deg, #12141c 0%, #242938 55%, #46506e 100%)' },
];

export const CHAT_FONTS = ['sans', 'display', 'mono', 'serif'] as const;
export const MESSAGE_EFFECTS = ['none', 'glow', 'aurora', 'ember'] as const;

export const SESSION_MS = 12 * 60 * 60 * 1000;
export const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
