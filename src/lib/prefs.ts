import { createStore } from './store';

export type ThemeMode = 'dark' | 'light' | 'system';
export const themeMode = createStore<ThemeMode>('system', 'sado:theme', (v) => v === 'dark' || v === 'light' || v === 'system');

export interface Prefs {
  /** auto = bubbles in direct chats, stream in hubs */
  layout: 'auto' | 'bubbles' | 'stream';
  density: 'cozy' | 'compact';
  sound: boolean;
  desktop: boolean;
  calm: boolean;
  members: boolean;
  rooms: boolean;
  enterToSend: boolean;
}

const defaults: Prefs = {
  layout: 'auto',
  density: 'cozy',
  sound: true,
  desktop: false,
  calm: false,
  members: true,
  rooms: true,
  enterToSend: true,
};

const stored = createStore<Partial<Prefs>>({}, 'sado:prefs', (v) => typeof v === 'object' && v !== null);

export const prefs = {
  use: (): Prefs => ({ ...defaults, ...stored.use() }),
  get: (): Prefs => ({ ...defaults, ...stored.get() }),
  set: (patch: Partial<Prefs>) => stored.set((p) => ({ ...p, ...patch })),
};

const systemDark = () => typeof matchMedia === 'undefined' || !matchMedia('(prefers-color-scheme: light)').matches;
export const resolveTheme = (mode: ThemeMode): 'dark' | 'light' => (mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode);

function apply() {
  if (typeof document === 'undefined') return;
  const theme = resolveTheme(themeMode.get());
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0c12' : '#f4f1ea');
  document.documentElement.classList.toggle('calm', prefs.get().calm);
}

themeMode.subscribe(apply);
stored.subscribe(apply);
if (typeof matchMedia !== 'undefined') matchMedia('(prefers-color-scheme: light)').addEventListener('change', apply);
apply();
