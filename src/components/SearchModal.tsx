import { useEffect, useMemo, useRef, useState } from 'react';
import type { DB, User } from '../data/types';
import { parseDM, startDM } from '../data/chat';
import { useI18n } from '../i18n';
import { fmtShort } from '../lib/util';
import { Avatar } from './Avatar';
import { Icon } from './Icons';
import { Modal } from './Modal';

interface SearchDetail { channel?: string; query?: string }

export function SearchModal({ db, user, onSelect }: { db: DB; user: User; onSelect: (channel: string) => void }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const custom = (e: Event) => {
      const detail = (e as CustomEvent<SearchDetail>).detail;
      setScope(detail?.channel);
      setQuery(detail?.query ?? '');
      setOpen(true);
    };
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setScope(undefined); setQuery(''); setOpen(true); }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName ?? '')) { e.preventDefault(); setScope(undefined); setQuery(''); setOpen(true); }
    };
    window.addEventListener('sado:search', custom);
    window.addEventListener('keydown', keys);
    return () => { window.removeEventListener('sado:search', custom); window.removeEventListener('keydown', keys); };
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 40); }, [open]);
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    const messages = Object.entries(db.msgs).flatMap(([ch, rows]) => {
      if (scope && ch !== scope) return [];
      const allowed = parseDM(ch)?.includes(user.id) || Object.values(db.hubs).some((h) => h.members[user.id] && h.rooms.some((r) => r.id === ch));
      if (!allowed) return [];
      return rows.filter((m) => `${m.text} ${m.sticker ?? ''}`.toLowerCase().includes(q)).map((m) => ({ kind: 'message' as const, channel: ch, message: m, person: db.users[m.by] }));
    }).sort((a, b) => b.message.ts - a.message.ts).slice(0, 12);
    const people = Object.values(db.users).filter((p) => p.serverBacked && p.id !== user.id && `${p.name} ${p.username}`.toLowerCase().includes(q)).slice(0, 5).map((person) => ({ kind: 'person' as const, person }));
    return [...people, ...messages];
  }, [db, q, scope, user.id]);

  const openResult = (item: (typeof results)[number]) => {
    if (item.kind === 'person') onSelect(startDM(user.id, item.person.id));
    else onSelect(item.channel);
    setOpen(false);
  };

  return <Modal open={open} onClose={() => setOpen(false)} title={t('openSearch')} size="md"><div className="global-search"><div className="global-search-input"><Icon name="search" size={18}/><input ref={inputRef} placeholder={t('searchHint')} value={query} onChange={(e) => setQuery(e.target.value)}/><kbd>ESC</kbd></div><div className="search-results">
    {!q && <div className="search-empty"><span className="search-key">⌘</span><p>{t('searchHint')}</p></div>}
    {q && results.length === 0 && <div className="search-empty"><Icon name="search" size={22}/><p>{t('noResults')}</p></div>}
    {results.map((item, index) => item.kind === 'person' ? <button className="search-result" key={`p${item.person.id}`} onClick={() => openResult(item)}><Avatar user={item.person} size="sm" showStatus/><span className="search-result-copy"><b>{item.person.name}</b><small>@{item.person.username}</small></span><span className="search-result-tag">{t('people')}</span><Icon name="arrowUpRight" size={15}/></button> : <button className="search-result search-message-result" key={`m${item.message.id}`} onClick={() => openResult(item)}><Avatar user={item.person} size="sm"/><span className="search-result-copy"><b>{item.person?.name ?? t('you')} <small>· {fmtShort(item.message.ts, lang)}</small></b><small>{item.message.text || item.message.sticker}</small></span><span className="search-result-tag">{scope ? t('chat') : db.hubs[Object.keys(db.hubs).find((id) => db.hubs[id].rooms.some((r) => r.id === item.channel)) ?? '']?.name ?? t('chat')}</span><Icon name="arrowUpRight" size={15}/></button>)}
  </div><div className="search-modal-footer"><span><kbd>↑</kbd><kbd>↓</kbd> {t('search')}</span><span><kbd>↵</kbd> {t('openSearch')}</span></div></div></Modal>;
}
