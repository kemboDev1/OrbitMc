import type { AuraTier } from './data/types';

/** Rename the product here. */
export const BRAND = 'Sado';

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
  listings: 10,
  /** OWASP recommendation for PBKDF2-HMAC-SHA256. */
  pbkdf2: 600_000,
};

export const TIERS: AuraTier[] = ['ember', 'flare', 'nova'];

export const AURA: Record<AuraTier, { month: number; year: number; stipend: number; daily: number; hubs: number; fee: number }> = {
  ember: { month: 2.99, year: 29.9, stipend: 200, daily: 2, hubs: 10, fee: 0.1 },
  flare: { month: 5.99, year: 59.9, stipend: 500, daily: 3, hubs: 25, fee: 0.05 },
  nova: { month: 9.99, year: 99.9, stipend: 1200, daily: 4, hubs: 100, fee: 0 },
};

export const FREE = { hubs: 3, fee: 0.15, daily: 25, startSparks: 300 };

export const ACCENTS = ['#ff5b2e', '#37d39b', '#8f7dff', '#3aa8ff', '#ffc233', '#ff4d7e'];

export const SESSION_MS = 12 * 60 * 60 * 1000;
export const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
