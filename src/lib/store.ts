import { useSyncExternalStore } from 'react';

function safeStorage(name: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    const s = (globalThis as unknown as Record<string, Storage>)[name];
    s.setItem('__sado', '1');
    s.removeItem('__sado');
    return s;
  } catch {
    return null; // private mode or blocked storage
  }
}

/** Shared between tabs. */
export const local = safeStorage('localStorage');
/** One per tab: lets two tabs be signed in as two different people. */
export const tab = safeStorage('sessionStorage');

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: () => void): () => void;
  use(): T;
}

/** Tiny observable value, optionally persisted to localStorage as JSON. */
export function createStore<T>(initial: T, key?: string, valid?: (v: unknown) => boolean): Store<T> {
  let value = initial;
  const defaultValue = initial;
  if (key) {
    try {
      const raw = local?.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as unknown;
        if (!valid || valid(parsed)) value = parsed as T;
      }
    } catch {
      /* keep the default */
    }
  }
  const subs = new Set<() => void>();
  if (key && typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return;
      try {
        if (event.newValue == null) value = defaultValue;
        else {
          const parsed = JSON.parse(event.newValue) as unknown;
          if (!valid || valid(parsed)) value = parsed as T;
        }
        subs.forEach((fn) => fn());
      } catch {
        /* keep the last valid value */
      }
    });
  }
  const get = () => value;
  const subscribe = (fn: () => void) => {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  };
  return {
    get,
    subscribe,
    set(next) {
      value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      if (key) {
        try {
          local?.setItem(key, JSON.stringify(value));
        } catch {
          /* storage full: the value still works for this session */
        }
      }
      subs.forEach((fn) => fn());
    },
    use: () => useSyncExternalStore(subscribe, get, get),
  };
}
