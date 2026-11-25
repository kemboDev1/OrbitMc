import * as React from 'react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { DB, Listing, ListingKind, User } from '../data/types';
import { buyListing, claimDaily, createListing, equipListing, getAura, giftListing, hasAura, removeListing } from '../data/market';
import { useI18n } from '../i18n';
import { fmtMoney } from '../lib/util';
import { AppError } from '../data/errors';
import { LIMITS } from '../config';
import { Avatar } from './Avatar';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';
import { useChatControls } from '../data/chatControls';
import { fileToDataUrl } from '../lib/image';

const hues = ['#ff5b2e', '#e7aa56', '#e95f87', '#9078ff', '#58a7e8', '#35be8c', '#d2bd85', '#314c6b'];

type Kind = 'all' | Exclude<ListingKind, 'stickers'> | 'owned' | 'made';

function kindLabel(kind: ListingKind, t: (key: string) => string) {
  return t(kind);
}

function dailyCollected(user: User): boolean {
  if (!user.lastDaily) return false;
  return user.serverBacked
    ? new Date(user.lastDaily).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
    : new Date(user.lastDaily).toDateString() === new Date().toDateString();
}

export function BazaarPage({ db, user }: { db: DB; user: User }) {
  const { t, lang } = useI18n();
  const chatControls = useChatControls(user.id);
  const [kind, setKind] = useState<Kind>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'featured' | 'latest' | 'popular' | 'low' | 'high'>('featured');
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [giftItem, setGiftItem] = useState<Listing | null>(null);

  useEffect(() => {
    const openCreator = () => setCreatorOpen(true);
    window.addEventListener('sado:market-create', openCreator);
    return () => window.removeEventListener('sado:market-create', openCreator);
  }, []);

  const aura = getAura(user);
  const hasCollectedDaily = dailyCollected(user);
  const all = useMemo(() => Object.values(db.listings).filter((l) => !l.removed && l.kind !== 'stickers'), [db.listings]);
  const myListings = all.filter((l) => l.sellerId === user.id);
  const owned = Object.values(db.listings).filter((l) => user.inventory.includes(l.id) && l.kind !== 'stickers');
  const filtered = useMemo(() => {
    let items = all.filter((l) => !l.auraOnly || aura);
    if (kind !== 'all' && kind !== 'owned' && kind !== 'made') items = items.filter((l) => l.kind === kind);
    if (kind === 'owned') items = owned;
    if (kind === 'made') items = myListings;
    const q = query.trim().toLowerCase();
    if (q) items = items.filter((l) => `${l.name} ${l.about} ${db.users[l.sellerId]?.name ?? ''}`.toLowerCase().includes(q));
    if (sort === 'latest') items.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'popular') items.sort((a, b) => b.sales - a.sales);
    if (sort === 'low') items.sort((a, b) => a.price - b.price);
    if (sort === 'high') items.sort((a, b) => b.price - a.price);
    return items;
  }, [all, kind, query, sort, aura, user.inventory, owned, myListings, db.users]);

  const report = (e: unknown) => tell(e instanceof AppError ? t(e.key) : t('err.generic'), 'bad');
  const buy = async (l: Listing) => { try { await buyListing(user.id, l.id); tell(t('bought'), 'good'); } catch (e) { report(e); } };
  const useItem = (l: Listing) => { try { equipListing(user.id, l.id); tell(t('equipped'), 'good'); } catch (e) { report(e); } };
  const daily = async () => { try { const n = await claimDaily(user.id); tell(t('dailyEarned', { count: n }), 'good'); } catch (e) { report(e); } };
  const remove = async (l: Listing) => { try { await removeListing(user.id, l.id); tell(t('removeListing'), 'good'); } catch (e) { report(e); } };
  const gift = async (recipientId: string) => {
    if (!giftItem) return;
    try { await giftListing(user.id, recipientId, giftItem.id); tell(t('giftSent'), 'good'); setGiftItem(null); }
    catch (e) { report(e); }
  };

  return <div className="page-content market-page">
    <div className="market-heading">
      <div className="market-copy"><div className="eyebrow">{t('marketEyebrow')}</div><h1>{t('marketTitle')}</h1><p>{t('marketSub')}</p></div>
      <div className="market-wallet"><div className="spark-wallet"><Icon name="spark" size={17}/><span><b>{user.sparks.toLocaleString(lang)}</b><small>{t('yourSparks')}</small></span></div><button className="btn btn-outline btn-small" onClick={() => void daily()} disabled={hasCollectedDaily}>{hasCollectedDaily ? t('dailyDone') : t('dailyClaim', { count: aura ? { ember: 200, flare: 500, nova: 1200 }[aura.tier] : 25 })}</button></div>
    </div>
    <p className="local-feature-note">{t(user.serverBacked ? 'marketLiveNotice' : 'marketLocalNotice')}</p>
    <div className="market-tools"><div className="market-tabs">{(['all', 'theme', 'frame', 'bundle', 'owned', 'made'] as Kind[]).map((k) => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k === 'all' ? t('allItems') : k === 'owned' ? t('bag') : k === 'made' ? t('yourShop') : t(k === 'theme' ? 'themes' : k === 'frame' ? 'frames' : 'bundle')}</button>)}</div><div className="market-filters"><label className="market-search"><Icon name="search" size={16}/><input placeholder={t('searchMarket')} value={query} onChange={(e) => setQuery(e.target.value)}/></label><select className="sort-select" aria-label={t('filters')} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="featured">{t('featured')}</option><option value="latest">{t('latest')}</option><option value="popular">{t('popular')}</option><option value="low">{t('priceLow')}</option><option value="high">{t('priceHigh')}</option></select><button className="icon-btn bag-button" title={t('bag')} aria-label={t('bag')} onClick={() => setBagOpen(true)}><Icon name="grid" size={17}/>{owned.length > 0 && <span className="bag-count">{owned.length}</span>}</button></div></div>
    {kind === 'all' && !query && <div className="market-banner"><div className="market-banner-copy"><span className="banner-kicker">{t('marketBannerKicker')}</span><h2>{t('marketBannerTitle')}</h2><p>{t('marketBannerText')}</p><button className="btn btn-light" onClick={() => setKind('theme')}>{t('themes')}<Icon name="arrowUpRight" size={15}/></button></div><div className="banner-product-art" aria-hidden="true"><i/><i/><i/><b/></div><div className="banner-planet"/><div className="banner-outline"/></div>}
    <div className="market-section-title"><h2>{kind === 'owned' ? t('bag') : kind === 'made' ? t('yourShop') : sort === 'featured' ? t('featured') : t(sort === 'latest' ? 'latest' : sort === 'popular' ? 'popular' : 'allItems')}</h2><span>{filtered.length.toLocaleString(lang)} {t('allItems').toLowerCase()}</span></div>
    {filtered.length ? <div className="product-grid">{filtered.map((l, index) => {
      const seller = db.users[l.sellerId];
      const listingName = lang === 'uz' ? l.nameUz ?? l.name : lang === 'ru' ? l.nameRu ?? l.name : l.name;
      const listingAbout = lang === 'uz' ? l.aboutUz ?? l.about : lang === 'ru' ? l.aboutRu ?? l.about : l.about;
      const isOwned = user.inventory.includes(l.id);
      const isInUse = user.theme === l.id || user.frame === l.id;
      return <article className="product-card" key={l.id} style={{ '--product-order': index } as React.CSSProperties}>
        <button className={`product-art art-${l.kind} art-${l.id.replace(/[^a-z0-9]/gi, '-')}`} style={{ '--product-hue': l.theme?.accent ?? l.frame?.colors[0] ?? (l.kind === 'stickers' ? '#f5e5d8' : '#f1ded6') } as React.CSSProperties} onClick={() => isOwned ? useItem(l) : buy(l)} aria-label={`${listingName}, ${l.price} ${t('sparks')}`}>
          {l.kind === 'stickers' ? <div className="sticker-preview">{l.stickers?.slice(0, 6).map((x, i) => <span className={`sticker-pos sticker-pos-${i + 1}`} key={`${x}${i}`}>{x}</span>)}</div> : l.kind === 'theme' || l.kind === 'bundle' ? <div className={`theme-preview ${l.kind === 'bundle' ? 'bundle-preview' : ''}`} style={{ '--preview-bg': l.theme?.bg, '--preview-panel': l.theme?.panel, '--preview-raised': l.theme?.raised, '--preview-line': l.theme?.line, '--preview-accent': l.theme?.accent, '--design-image': l.theme?.image ? `url("${l.theme.image}")` : undefined } as React.CSSProperties}><span className="preview-window"><i/><i/><i/><b/><em/><em/><strong/></span>{l.kind === 'bundle' && <span className="bundle-frame-mini" style={{ '--frame-a': l.frame?.colors[0], '--frame-b': l.frame?.colors[1] } as React.CSSProperties}>◎</span>}<span className="theme-name-preview">{l.name}</span></div> : <div className="frame-preview"><span className={`frame-orbit ${l.frame?.spin ? 'spin' : ''}`} style={{ '--frame-a': l.frame?.colors[0], '--frame-b': l.frame?.colors[1] } as React.CSSProperties}/><span className="frame-face" style={{ backgroundImage: seller?.avatar ? `url(${seller.avatar})` : undefined }}>{seller?.avatar ? '' : seller?.name.slice(0, 1)}</span><span className="frame-stars">✳</span></div>}
          {l.auraOnly && <span className="product-aura-tag"><Icon name="spark" size={11}/> ORBIT</span>}
          {isOwned && <span className="product-owned"><Icon name={isInUse ? 'check' : 'spark'} size={12}/>{isInUse ? t('equipped') : t('bag')}</span>}
        </button>
        <div className="product-meta"><div className="product-title-line"><h3 title={listingName}>{listingName}</h3><span className="product-price"><Icon name="spark" size={13}/>{l.price}</span></div><p>{listingAbout}</p><div className="product-foot"><span className="seller"><Avatar user={seller} size="xs"/>{seller?.name ?? t('you')}</span><span className="product-sales">{l.sales.toLocaleString(lang)} <Icon name="heart" size={12}/></span></div><div className="product-actions">{isOwned ? <button className={`btn ${isInUse ? 'btn-secondary' : 'btn-outline'} btn-small`} onClick={() => useItem(l)}>{isInUse ? t('equipped') : t('equip')}</button> : <button className="btn btn-primary btn-small" onClick={() => buy(l)}><Icon name="spark" size={14}/>{l.price} {t('sparks')}</button>}{l.sellerId !== user.id && <button className="icon-btn gift-action" title={t('sendGift')} aria-label={t('sendGift')} onClick={() => setGiftItem(l)}><Icon name="gift" size={15}/></button>}{l.sellerId === user.id && <button className="icon-btn danger-ghost" title={t('removeListing')} aria-label={t('removeListing')} onClick={() => remove(l)}><Icon name="trash" size={14}/></button>}</div></div>
      </article>;
    })}</div> : <div className="inline-empty market-empty"><div className="empty-mark">✳</div><p>{kind === 'owned' ? t('bagEmpty') : t('noResults')}</p>{kind === 'made' && <button className="btn btn-secondary btn-small" onClick={() => setCreatorOpen(true)}>{t('makeListing')}</button>}</div>}
    <div className="market-maker-callout"><div><span className="eyebrow">{t('makerTitle')}</span><h2>{t('creator')}</h2><p>{t('marketSub')}</p></div><button className="btn btn-primary" onClick={() => setCreatorOpen(true)}><Icon name="plus" size={16}/>{t('makeListing')}</button></div>
    <CreatorModal open={creatorOpen} onClose={() => setCreatorOpen(false)} user={user}/>
    <BagModal open={bagOpen} onClose={() => setBagOpen(false)} items={owned} user={user} onUse={useItem}/>
    <GiftModal open={!!giftItem} onClose={() => setGiftItem(null)} listing={giftItem} balance={user.sparks} shared={!!user.serverBacked} people={Object.values(db.users).filter((person) => person.id !== user.id && person.id !== 'orbit-studio' && !person.bot && !chatControls.blocked.includes(person.id))} onGift={gift}/>
  </div>;
}

function CreatorModal({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<ListingKind>('theme');
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [price, setPrice] = useState('90');
  const [accent, setAccent] = useState('#ff5b2e');
  const [secondColor, setSecondColor] = useState('#e7aa56');
  const [darkTheme, setDarkTheme] = useState(false);
  const [gradientEnabled, setGradientEnabled] = useState(true);
  const [spinFrame, setSpinFrame] = useState(false);
  const [designImage, setDesignImage] = useState('');
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (busy) return;
    setBusy(true);
    try {
      const theme = kind === 'theme' || kind === 'bundle' ? {
        dark: darkTheme,
        bg: darkTheme ? '#10161C' : '#F4F2EC',
        panel: darkTheme ? '#172129' : '#FBF9F4',
        raised: darkTheme ? '#202D36' : '#E9E6DC',
        line: darkTheme ? '#34444F' : '#D4D1C7',
        accent,
        gradient: gradientEnabled ? `linear-gradient(135deg, ${accent}, ${secondColor})` : undefined,
        image: designImage || undefined,
      } : undefined;
      const frame = kind === 'frame' || kind === 'bundle' ? { colors: [accent, secondColor], spin: spinFrame } : undefined;
      await createListing({ userId: user.id, kind, name, about, price: Number(price), theme, frame, auraOnly: kind === 'frame' });
      tell(t('listingCreated'), 'good'); onClose(); setName(''); setAbout('');
    } catch (e) { setError(e instanceof AppError ? t(e.key) : t('err.generic')); }
    finally { setBusy(false); }
  };
  const themePreviewStyle = {
    '--preview-bg': darkTheme ? '#10161C' : '#F4F2EC',
    '--preview-panel': darkTheme ? '#172129' : '#FBF9F4',
    '--preview-raised': darkTheme ? '#202D36' : '#E9E6DC',
    '--preview-line': darkTheme ? '#34444F' : '#D4D1C7',
    '--preview-accent': accent,
    '--preview-gradient': gradientEnabled ? `linear-gradient(135deg, ${accent}, ${secondColor})` : 'none',
  } as React.CSSProperties;
  return <Modal open={open} onClose={onClose} title={t('makeListing')} subtitle={t('creator')} size="md"><form className="stack-form creator-form" onSubmit={submit}>
    <div className="field-label">{t('listingKind')}<div className="creator-kinds">{(['theme', 'frame', 'bundle'] as ListingKind[]).map((k) => <button type="button" aria-pressed={kind === k} className={`creator-kind ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)} key={k}><span>{k === 'theme' ? '◐' : k === 'frame' ? '◎' : '✦'}</span><small>{t(k === 'theme' ? 'creatorTheme' : k === 'frame' ? 'creatorFrame' : 'bundle')}</small></button>)}</div></div>
    {(kind === 'theme' || kind === 'bundle') && <div className="field-label">{t('themeTone')}<div className="segmented-choice"><button type="button" aria-pressed={!darkTheme} className={!darkTheme ? 'selected' : ''} onClick={() => setDarkTheme(false)}>{t('light')}</button><button type="button" aria-pressed={darkTheme} className={darkTheme ? 'selected' : ''} onClick={() => setDarkTheme(true)}>{t('dark')}</button></div><div className="creator-color-pair"><label>{t('chooseColor')}<input type="color" value={accent} onChange={(event) => setAccent(event.target.value)}/></label><label>{t('frameSecondColor')}<input type="color" value={secondColor} onChange={(event) => setSecondColor(event.target.value)}/></label><label className="creator-motion"><input type="checkbox" checked={gradientEnabled} onChange={(event) => setGradientEnabled(event.target.checked)}/>{t('gradientTheme')}</label></div></div>}
    <div className="field-label">{t('chooseColor')}<div className="color-swatches">{hues.map((h) => <button type="button" key={h} title={h} aria-label={`${t('chooseColor')} ${h}`} aria-pressed={accent === h} className={accent === h ? 'selected' : ''} style={{ '--swatch': h } as React.CSSProperties} onClick={() => setAccent(h)}/>)}</div></div>
    {(kind === 'frame' || kind === 'bundle') && <><div className="field-label">{t('frameSecondColor')}<div className="color-swatches">{hues.map((h) => <button type="button" key={h} title={h} aria-label={`${t('frameSecondColor')} ${h}`} aria-pressed={secondColor === h} className={secondColor === h ? 'selected' : ''} style={{ '--swatch': h } as React.CSSProperties} onClick={() => setSecondColor(h)}/>)}</div></div><label className="creator-motion"><input type="checkbox" checked={spinFrame} onChange={(event) => setSpinFrame(event.target.checked)}/>{t('frameMotion')}</label></>}
    {(kind === 'theme' || kind === 'bundle') && <div className="image-upload-card"><label className="btn btn-outline btn-small">{t('uploadDesignImage')}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setImageError(''); try { setDesignImage(await fileToDataUrl(file, 1200, 600_000)); } catch (err) { setImageError(err instanceof AppError ? t(err.key) : t('err.generic')); } }}/></label>{designImage && <button className="text-action" type="button" onClick={() => setDesignImage('')}>{t('removeListing')}</button>}{imageError && <small role="alert">{imageError}</small>}{designImage && <img src={designImage} alt={t('uploadDesignImage')}/>}</div>}
    <div className="creator-live-preview"><span className="creator-live-label">{t('creatorPreview')}</span><div className="creator-preview-stage">{kind !== 'frame' ? <div className={`theme-preview ${kind === 'bundle' ? 'bundle-preview' : ''}`} style={{ ...themePreviewStyle, '--design-image': designImage ? `url("${designImage}")` : undefined } as React.CSSProperties}><div className="preview-window"><i/><i/><i/><b/><em/><em/><strong/></div>{kind === 'bundle' && <span className="bundle-frame-mini" style={{ '--frame-a': accent, '--frame-b': secondColor } as React.CSSProperties}>◎</span>}<span className="theme-name-preview">{name.trim() || t('creatorTheme')}</span></div> : <div className="frame-preview" style={{ '--frame-a': accent, '--frame-b': secondColor } as React.CSSProperties}><span className={`frame-orbit ${spinFrame ? 'spin' : ''}`}/><span className="frame-face">{user.name.slice(0, 1).toUpperCase()}</span><span className="frame-stars">✳</span></div>}</div></div>
    <label className="field-label">{t('listingName')}<input className="field-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.hubName} placeholder={t('listingName')}/></label>
    <label className="field-label">{t('listingAbout')}<textarea className="field-input field-textarea" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={LIMITS.hubAbout} placeholder={t('listingAbout')}/></label>
    <label className="field-label">{t('listingPrice')}<span className="input-prefix-wrap"><span className="input-prefix">✳</span><input className="field-input prefix-field" type="number" min="10" max="9999" step="1" value={price} onChange={(e) => setPrice(e.target.value)}/></span></label>
    {kind === 'frame' && !hasAura(user.id) && <div className="inline-note"><Icon name="spark" size={15}/>{t('AuraRequirement')}</div>}
    {error && <div className="inline-error" role="alert"><Icon name="info" size={15}/>{error}</div>}
    <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('cancel')}</button><button className="btn btn-primary" disabled={busy}>{busy ? t('loading') : <><Icon name="arrowUpRight" size={15}/>{t('listingSubmit')}</>}</button></div>
  </form></Modal>;
}

function BagModal({ open, onClose, items, user, onUse }: { open: boolean; onClose: () => void; items: Listing[]; user: User; onUse: (l: Listing) => void }) {
  const { t } = useI18n();
  return <Modal open={open} onClose={onClose} title={t('bag')} subtitle={`${items.length} · ${t('yourSparks')}: ${user.sparks}`} size="md">{items.length ? <div className="bag-list">{items.map((l) => { const equipped = user.frame === l.id || user.theme === l.id; return <div className="bag-row" key={l.id}><span className={`bag-thumb thumb-${l.kind}`} style={{ '--product-hue': l.theme?.accent ?? l.frame?.colors[0] ?? '#ffb987' } as React.CSSProperties}>{l.kind === 'stickers' ? l.stickers?.[0] : l.kind === 'theme' ? '◐' : '◎'}</span><div className="bag-copy"><b>{l.name}</b><small>{t(l.kind)}</small></div><button className={`btn btn-small ${equipped ? 'btn-secondary' : 'btn-outline'}`} onClick={() => onUse(l)}>{equipped ? t('equipped') : t('equip')}</button></div>; })}</div> : <div className="inline-empty"><div className="empty-mark">✳</div><p>{t('bagEmpty')}</p></div>}</Modal>;
}

function GiftModal({ open, onClose, listing, balance, shared, people, onGift }: { open: boolean; onClose: () => void; listing: Listing | null; balance: number; shared: boolean; people: User[]; onGift: (recipientId: string) => void }) {
  const { t } = useI18n();
  return <Modal open={open && !!listing} onClose={onClose} title={t('sendGift')} subtitle={listing ? `${listing.name} · ${listing.price} ${t('sparks')}` : undefined} size="sm">
    <p className="gift-local-note">{t(shared ? 'giftSharedNotice' : 'giftLocalOnly')}</p>
    {people.length ? <div className="gift-people">{people.map((person) => <button className="gift-person" key={person.id} onClick={() => onGift(person.id)}><Avatar user={person} size="sm" showStatus/><span><b>{person.name}</b><small>@{person.username}</small></span><span className="gift-send-price"><Icon name="spark" size={12}/>{listing?.price}</span></button>)}</div> : <div className="inline-empty"><p>{t('noPeople')}</p></div>}
    <div className="gift-modal-footer"><span>{t('yourSparks')}: {balance.toLocaleString()}</span><button className="btn btn-secondary btn-small" onClick={onClose}>{t('cancel')}</button></div>
  </Modal>;
}
