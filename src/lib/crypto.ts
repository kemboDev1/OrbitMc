import { LIMITS } from '../config';

const encoder = new TextEncoder();

const toB64 = (buf: ArrayBuffer) => {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
};

const fromB64 = (s: string) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export interface PasswordHash {
  salt: string;
  hash: string;
  iter: number;
}

/** Salted PBKDF2-HMAC-SHA256. The plain password is never stored. */
export async function hashPassword(password: string, saltB64?: string, iter = LIMITS.pbkdf2): Promise<PasswordHash> {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return { salt: toB64(salt.buffer as ArrayBuffer), hash: toB64(bits), iter };
}

/** Comparison that does not stop at the first different character. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 0 (very weak) to 4 (strong). A rough guide for the meter, not a guarantee. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw) || /^(1234|qwer|pass|abcd)/i.test(pw)) score = Math.min(score, 1);
  return score;
}
