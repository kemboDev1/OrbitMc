import en from './en';
import ru from './ru';
import uz from './uz';
import { createStore } from '../lib/store';
import type { Lang } from '../data/types';

export const language = createStore<Lang>('en', 'sado:lang', (v) => v === 'en' || v === 'ru' || v === 'uz');

type Widen<T> = T extends string ? string : T extends object ? { [K in keyof T]: Widen<T[K]> } : T;
type Strings = Widen<typeof en>;
export type Key = keyof Strings;

export function useI18n() {
  const lang = language.use();
  const dict: Strings = lang === 'ru' ? ru : lang === 'uz' ? uz : en;
  const t = (key: string, values?: Record<string, string | number>): string => {
    let value: unknown = dict;
    for (const part of key.split('.')) value = (value as Record<string, unknown>)[part];
    if (typeof value !== 'string') return key;
    return value.replace(/\{([\w]+)\}/g, (_match, name: string) => String(values?.[name] ?? `{${name}}`));
  };
  return { t, lang, setLanguage: language.set };
}
