import { REMEMBER_MS, SESSION_MS } from '../config';
import { tab, local } from '../lib/store';
import { createStore } from '../lib/store';
import { uid } from '../lib/util';

export interface Session {
  userId: string;
  token: string;
  expires: number;
}

const validate = (v: unknown): v is Session => {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<Session>;
  return typeof s.userId === 'string' && typeof s.token === 'string' && typeof s.expires === 'number';
};

/** Normal sessions are tab-scoped; the explicit remember option adds a 30-day browser-local session. */
const sessionStore = createStore<Session | null>(null);

function read(): Session | null {
  try {
    for (const raw of [tab?.getItem('sado:session'), local?.getItem('sado:remembered-session')]) {
      if (!raw) continue;
      try {
        const candidate = JSON.parse(raw) as unknown;
        if (validate(candidate) && candidate.expires > Date.now()) {
          tab?.setItem('sado:session', JSON.stringify(candidate));
          return candidate;
        }
      } catch { /* try the next storage source */ }
    }
    tab?.removeItem('sado:session');
    local?.removeItem('sado:remembered-session');
  } catch {
    /* use empty session */
  }
  return null;
}

sessionStore.set(read());

export const session = {
  get: sessionStore.get,
  use: sessionStore.use,
  subscribe: sessionStore.subscribe,
  start(userId: string, remember = false): Session {
    const s: Session = { userId, token: uid(32), expires: Date.now() + (remember ? REMEMBER_MS : SESSION_MS) };
    sessionStore.set(s);
    try {
      tab?.setItem('sado:session', JSON.stringify(s));
      if (remember) local?.setItem('sado:remembered-session', JSON.stringify(s));
      else local?.removeItem('sado:remembered-session');
    } catch {
      /* The active tab still works. */
    }
    return s;
  },
  end(): void {
    try {
      const current = tab?.getItem('sado:session');
      tab?.removeItem('sado:session');
      if (current && local?.getItem('sado:remembered-session') === current) local?.removeItem('sado:remembered-session');
    } catch {
      /* best effort */
    }
    sessionStore.set(null);
  },
};
