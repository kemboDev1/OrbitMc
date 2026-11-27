import { Award, Palette, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AuraTier, DB, Hub, User } from '../data/types';
import {
  adminAdjustSparks,
  adminDeleteHub,
  adminDeleteUser,
  adminGrantAura,
  adminSetListingRemoved,
  adminSetUserRole,
  adminToggleHubPublic,
  adminToggleListingFeatured,
  adminToggleSuspended,
  getWorkspaceStats,
  isAdminUser,
} from '../data/admin';
import { db as dbApi } from '../data/db';
import { hasAura } from '../data/market';
import { useI18n } from '../i18n';
import { Avatar } from './Avatar';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';

type AdminTab = 'overview' | 'users' | 'hubs' | 'shop' | 'system';

export function AdminPage({ db, user, onOpenHub }: { db: DB; user: User; onOpenHub: (hub: Hub) => void }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [query, setQuery] = useState('');
  const [deleteHubTarget, setDeleteHubTarget] = useState<Hub | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [sparkAmount, setSparkAmount] = useState('500');

  const stats = useMemo(() => getWorkspaceStats(db), [db]);
  const users = useMemo(
    () => Object.values(db.users)
      .filter((u) => u.id !== 'orbit-studio' && !u.bot)
      .filter((u) => `${u.name} ${u.username}`.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => Number(!!b.isAdmin) - Number(!!a.isAdmin) || Number(b.presence === 'online') - Number(a.presence === 'online')),
    [db.users, query],
  );
  const hubs = useMemo(
    () => Object.values(db.hubs)
      .filter((h) => `${h.name} ${h.about}`.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => b.createdAt - a.createdAt),
    [db.hubs, query],
  );
  const listings = useMemo(
    () => Object.values(db.listings)
      .filter((l) => `${l.name} ${l.about}`.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.sales - a.sales),
    [db.listings, query],
  );

  if (!isAdminUser(user)) {
    return <div className="page-content admin-page"><div className="inline-empty"><Icon name="shield" size={28} /><p>{t('err.notMember')}</p></div></div>;
  }

  const bytes = dbApi.bytes();
  const storageText = bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;

  const runCheck = () => {
    const brokenRooms = Object.values(db.hubs).filter((h) => h.rooms.length === 0).length;
    if (brokenRooms === 0) tell(t('adminHealthOk'), 'good');
    else tell(`${brokenRooms} hub(s) missing rooms`, 'bad');
  };

  return <div className="page-content admin-page">
    <div className="page-heading">
      <div>
        <div className="eyebrow">{t('adminEyebrow')}</div>
        <h1>{t('adminTitle')}</h1>
        <p>{t('adminSub')}</p>
      </div>
      <div className="admin-head-badge"><Icon name="shield" size={16} /><span>{user.name}</span></div>
    </div>

    <div className="admin-tabs-bar">
      <div className="market-tabs">
        {([
          { id: 'overview', label: t('adminOverview') },
          { id: 'users', label: `${t('adminUsers')} (${stats.totalUsers})` },
          { id: 'hubs', label: `${t('adminHubs')} (${stats.totalHubs})` },
          { id: 'shop', label: `${t('adminShop')} (${listings.length})` },
          { id: 'system', label: t('adminSystem') },
        ] as { id: AdminTab; label: string }[]).map((item) => (
          <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      {tab !== 'overview' && tab !== 'system' && (
        <label className="market-search"><Icon name="search" size={15} /><input placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      )}
    </div>

    {tab === 'overview' && <>
      <div className="admin-kpi-grid">
        <article className="admin-kpi-card"><span className="kpi-icon"><Icon name="people" size={18} /></span><b>{stats.totalUsers}</b><small>{t('adminTotalUsers')} · {stats.onlineUsers} {t('onlineNow')}</small></article>
        <article className="admin-kpi-card"><span className="kpi-icon"><Icon name="grid" size={18} /></span><b>{stats.totalHubs}</b><small>{t('adminTotalHubs')} · {stats.totalRooms} {t('rooms').toLowerCase()}</small></article>
        <article className="admin-kpi-card"><span className="kpi-icon"><Icon name="chat" size={18} /></span><b>{stats.totalMessages}</b><small>{t('adminTotalMessages')}</small></article>
        <article className="admin-kpi-card"><span className="kpi-icon"><Icon name="spark" size={18} /></span><b>{stats.totalVolume.toLocaleString(lang)}</b><small>{t('adminShopVolume')} · {stats.totalSales} sales</small></article>
      </div>

      <div className="admin-overview-panels">
        <section className="admin-panel-card">
          <div className="admin-card-head"><h3>{t('adminUsers')}</h3><button className="text-action" onClick={() => setTab('users')}>{t('allItems')}</button></div>
          <div className="admin-mini-list">
            {users.slice(0, 5).map((u) => (
              <div className="admin-mini-row" key={u.id}>
                <Avatar user={u} size="xs" showStatus />
                <div><b>{u.name}</b><small>@{u.username} · {u.sparks} {t('sparks')}</small></div>
                {u.isAdmin && <span className="admin-tag">{t('admin')}</span>}
                {hasAura(u.id) && <span className="aura-pill">{u.aura?.tier.toUpperCase()}</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel-card">
          <div className="admin-card-head"><h3>{t('adminShop')}</h3><button className="text-action" onClick={() => setTab('shop')}>{t('allItems')}</button></div>
          <div className="admin-mini-list">
            {listings.slice(0, 5).map((l) => (
              <div className="admin-mini-row" key={l.id}>
                <span className="admin-kind-dot">{l.kind === 'theme' ? <Palette size={14} /> : l.kind === 'frame' ? <Sparkles size={14} /> : <Award size={14} />}</span>
                <div><b>{l.name}</b><small>{l.price} {t('sparks')} · {l.sales} sales</small></div>
                {l.featured && <span className="aura-pill">{t('featuredBadge')}</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>}

    {tab === 'users' && <div className="admin-table-list">
      {users.map((u) => {
        const activeAura = hasAura(u.id) ? u.aura?.tier : null;
        return (
          <div className={`admin-row ${u.suspended ? 'is-suspended' : ''}`} key={u.id}>
            <div className="admin-row-main">
              <Avatar user={u} size="sm" showStatus />
              <div className="admin-row-copy">
                <div className="admin-row-title">
                  <b>{u.name}</b>
                  <small>@{u.username}</small>
                  {u.isAdmin && <span className="admin-tag">{t('admin')}</span>}
                  {activeAura && <span className="aura-pill">ORBIT+ {activeAura.toUpperCase()}</span>}
                  {u.suspended && <span className="danger-pill">{t('adminSuspend')}</span>}
                </div>
                <small>{u.sparks.toLocaleString(lang)} {t('sparks')} · {u.inventory.length} items</small>
              </div>
            </div>
            <div className="admin-row-actions">
              <select
                className="sort-select"
                aria-label={t('adminGrantPlan')}
                value={activeAura ?? ''}
                onChange={(e) => {
                  const val = e.target.value as AuraTier | '';
                  adminGrantAura(user.id, u.id, val === '' ? null : val);
                  tell(t('presenceUpdated'), 'good');
                }}
              >
                <option value="">{t('auraFree')}</option>
                <option value="ember">{t('auraEmber')}</option>
                <option value="flare">{t('auraFlare')}</option>
                <option value="nova">{t('auraNova')}</option>
              </select>
              <div className="admin-spark-grant">
                <input
                  type="number"
                  className="field-input admin-spark-input"
                  aria-label={t('customAmount')}
                  value={sparkAmount}
                  onChange={(e) => setSparkAmount(e.target.value)}
                  min={-99999}
                  max={99999}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={() => {
                    const n = parseInt(sparkAmount, 10);
                    if (!Number.isFinite(n) || n === 0) return;
                    void Promise.resolve(adminAdjustSparks(user.id, u.id, n))
                      .then(() => tell(`${n > 0 ? `+${n}` : n} ${t('sparks')}`, 'good'))
                      .catch(() => tell(t('err.generic'), 'bad'));
                  }}
                >
                  {t('grantBtn')}
                </button>
              </div>
              {u.id !== user.id && <>
                <select
                  className="sort-select"
                  aria-label="Role"
                  value={u.isAdmin ? 'admin' : u.role ?? 'member'}
                  onChange={(e) => {
                    const next = e.target.value as 'member' | 'mod' | 'admin';
                    void Promise.resolve(adminSetUserRole(user.id, u.id, next))
                      .then(() => tell(t('memberRoleUpdated'), 'good'))
                      .catch(() => tell(t('err.generic'), 'bad'));
                  }}
                >
                  <option value="member">{t('roleMember')}</option>
                  <option value="mod">{t('roleMod')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                </select>
                <button className={`btn btn-small ${u.suspended ? 'btn-outline' : 'btn-danger-outline'}`} onClick={() => { adminToggleSuspended(user.id, u.id); tell(t('presenceUpdated'), 'good'); }}>{u.suspended ? t('adminUnsuspend') : t('adminSuspend')}</button>
                <button type="button" className="icon-btn danger-ghost" title={t('deleteAccount')} aria-label={t('deleteAccount')} onClick={() => setDeleteUserTarget(u)}><Trash2 size={14} /></button>
              </>}
            </div>
          </div>
        );
      })}
    </div>}

    {tab === 'hubs' && <div className="admin-table-list">
      {hubs.map((h) => (
        <div className="admin-row" key={h.id}>
          <div className="admin-row-main">
            <span className="hub-side-symbol" style={{ '--hub-hue': h.hue } as React.CSSProperties}>{h.emoji}</span>
            <div className="admin-row-copy">
              <div className="admin-row-title"><b>{h.name}</b><span className="aura-pill">{h.public ? t('publicHub') : t('privateHub')}</span></div>
              <small>{Object.keys(h.members).length} {t('members').toLowerCase()} · {h.rooms.length} {t('rooms').toLowerCase()} · {db.users[h.ownerId]?.name ?? 'OrbitMc'}</small>
            </div>
          </div>
          <div className="admin-row-actions">
            {h.members[user.id] && <button className="btn btn-outline btn-small" onClick={() => onOpenHub(h)}>{t('viewHub')}</button>}
            {!h.remote && <button className="btn btn-ghost btn-small" onClick={() => { adminToggleHubPublic(user.id, h.id); tell(t('hubUpdated'), 'good'); }}>{h.public ? t('adminMakePrivate') : t('adminMakePublic')}</button>}
            {!h.remote && <button className="btn btn-danger-outline btn-small" onClick={() => setDeleteHubTarget(h)}>{t('adminDeleteHub')}</button>}
          </div>
        </div>
      ))}
      {hubs.length === 0 && <p className="subtle-empty">{t('noPublicHubs')}</p>}
    </div>}

    {tab === 'shop' && <div className="admin-table-list">
      {listings.map((l) => (
        <div className={`admin-row ${l.removed ? 'is-suspended' : ''}`} key={l.id}>
          <div className="admin-row-main">
            <span className="admin-kind-dot">{l.kind === 'theme' ? <Palette size={14} /> : l.kind === 'frame' ? <Sparkles size={14} /> : <Award size={14} />}</span>
            <div className="admin-row-copy">
              <div className="admin-row-title">
                <b>{l.name}</b>
                <span className="aura-pill">{t(l.kind)}</span>
                {l.featured && <span className="aura-pill">{t('featuredBadge')}</span>}
                {l.removed && <span className="danger-pill">{t('removeListing')}</span>}
              </div>
              <small>{l.price} {t('sparks')} · {l.sales} sales · {db.users[l.sellerId]?.name ?? 'Orbit Studio'}</small>
            </div>
          </div>
          <div className="admin-row-actions">
            {!l.remote && <button className="btn btn-outline btn-small" onClick={() => { adminToggleListingFeatured(user.id, l.id); tell(t('presenceUpdated'), 'good'); }}>{l.featured ? t('adminUnfeature') : t('adminFeature')}</button>}
            {!l.remote && <button className={`btn btn-small ${l.removed ? 'btn-primary' : 'btn-danger-outline'}`} onClick={() => { adminSetListingRemoved(user.id, l.id, !l.removed); tell(t('presenceUpdated'), 'good'); }}>{l.removed ? t('adminRestore') : t('removeListing')}</button>}
          </div>
        </div>
      ))}
    </div>}

    {tab === 'system' && <div className="admin-system-grid">
      <section className="admin-panel-card">
        <h3>{t('storage')}</h3>
        <p className="admin-system-stat">{storageText} / 1.8 MB</p>
        <div className="admin-storage-bar"><span style={{ width: `${Math.min(100, Math.round((bytes / 1_800_000) * 100))}%` }} /></div>
        <div className="admin-system-actions">
          <button className="btn btn-primary btn-small" onClick={runCheck}><Icon name="shield" size={14} />{t('adminHealthCheck')}</button>
          <button className="btn btn-outline btn-small" onClick={() => {
            const blob = new Blob([dbApi.exportJSON(user)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = `orbitmc-admin-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 800);
            tell(t('exportDone'), 'good');
          }}><Icon name="download" size={14} />{t('exportData')}</button>
        </div>
      </section>
      <section className="admin-panel-card">
        <h3>Orbit+ &amp; Sync</h3>
        <p>{user.serverBacked ? t('hubsLiveNotice') : t('demoModeBadge')}</p>
        <p className="admin-sync-pill"><Icon name="check" size={14} />{t('adminHealthOk')} · {stats.auraUsers} Orbit+ active</p>
      </section>
    </div>}

    <Modal open={!!deleteHubTarget} onClose={() => setDeleteHubTarget(null)} title={t('adminDeleteHub')} subtitle={deleteHubTarget?.name} size="sm">
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={() => setDeleteHubTarget(null)}>{t('cancel')}</button>
        <button className="btn btn-danger" onClick={() => { if (deleteHubTarget) { adminDeleteHub(user.id, deleteHubTarget.id); setDeleteHubTarget(null); tell(t('hubLeft'), 'good'); } }}>{t('delete')}</button>
      </div>
    </Modal>

    <Modal open={!!deleteUserTarget} onClose={() => setDeleteUserTarget(null)} title={t('deleteAccount')} subtitle={deleteUserTarget ? t('deleteAccountConfirm', { name: deleteUserTarget.username }) : ''} size="sm">
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={() => setDeleteUserTarget(null)}>{t('cancel')}</button>
        <button className="btn btn-danger" onClick={() => {
          if (!deleteUserTarget) return;
          void Promise.resolve(adminDeleteUser(user.id, deleteUserTarget.id))
            .then(() => { setDeleteUserTarget(null); tell(t('presenceUpdated'), 'good'); })
            .catch(() => tell(t('err.generic'), 'bad'));
        }}>{t('delete')}</button>
      </div>
    </Modal>
  </div>;
}
