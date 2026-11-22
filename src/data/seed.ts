import type { DB } from './types';

export function makeSeed(): DB {
  return {
    v: 1,
    users: {},
    hubs: {},
    msgs: {},
    listings: {},
    reads: {},
    dms: {},
    guard: {},
  };
}
