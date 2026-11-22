const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Random id from the browser's cryptographic generator. */
export function uid(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function hueOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = Array.from(parts[0] ?? '?')[0] ?? '?';
  const second = parts[1] ? (Array.from(parts[1])[0] ?? '') : '';
  return (first + second).toUpperCase();
}

export const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

/** Black or white text, whichever reads better on the given colour. */
export function inkFor(hex: string): string {
  if (!isHex(hex)) return '#160a05';
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.3 ? '#160a05' : '#ffffff';
}

export const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export const fmtTime = (ts: number, lang: string) =>
  new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(ts);

export const fmtDate = (ts: number, lang: string) =>
  new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(ts);

/** Time for today, short date otherwise. Used in chat lists. */
export const fmtShort = (ts: number, lang: string) =>
  sameDay(ts, Date.now()) ? fmtTime(ts, lang) : new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(ts);

export const fmtMoney = (n: number, lang: string) =>
  new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD' }).format(n);

export const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
