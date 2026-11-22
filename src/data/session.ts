import { createStore } from '../lib/store';

export interface Session {
  userId: string;
  token: string;
  expires: number;
}

const sessionStore = createStore<Session | null>(null);

export const session = {
  get: sessionStore.get,
  use: sessionStore.use,
  subscribe: sessionStore.subscribe,
  start(userId: string, token = '', expires = 0): Session {
    const value = { userId, token, expires };
    sessionStore.set(value);
    return value;
  },
  end(): void {
    sessionStore.set(null);
  },
};
