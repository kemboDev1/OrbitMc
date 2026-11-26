import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Compass,
  Crown,
  ExternalLink,
  Flame,
  Gem,
  Heart,
  Lock,
  LogOut,
  Music,
  Orbit,
  Palette,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  Zap,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { MAIN_SITE_URL, PaidTier, isPaidTier, supabase } from './supabase';

type Lang = 'uz' | 'en' | 'ru';
type AssetKind = 'theme' | 'frame' | 'stickers';

interface VectorDef {
  id: string;
  label: string;
  a: string;
  b: string;
  Icon: typeof Rocket;
}

interface MarketRow {
  id: string;
  creator_id: string;
  kind: AssetKind;
  name: string;
  about: string;
  price: number;
  sales: number;
}

const VECTOR_PACKS: VectorDef[] = [
  { id: 'badge:rocket', label: 'Launch', a: '#ff5b2e', b: '#ff9b54', Icon: Rocket },
  { id: 'badge:crown', label: 'Royalty', a: '#f3c875', b: '#d98a3b', Icon: Crown },
  { id: 'badge:flame', label: 'Blaze', a: '#ff4757', b: '#ff9f43', Icon: Flame },
  { id: 'badge:zap', label: 'Volt', a: '#feca57', b: '#ff6b6b', Icon: Zap },
  { id: 'badge:gem', label: 'Prism', a: '#54a0ff', b: '#8f7dff', Icon: Gem },
  { id: 'badge:orbit', label: 'Orbital', a: '#5f27cd', b: '#48dbfb', Icon: Orbit },
  { id: 'badge:shield', label: 'Guard', a: '#1dd1a1', b: '#10ac84', Icon: ShieldCheck },
  { id: 'badge:star', label: 'Nova', a: '#ff9ff3', b: '#f368e0', Icon: Star },
  { id: 'badge:award', label: 'Trophy', a: '#f6d365', b: '#fda085', Icon: Award },
  { id: 'badge:compass', label: 'Scout', a: '#48dbfb', b: '#0abde3', Icon: Compass },
  { id: 'badge:music', label: 'Pulse', a: '#ff6b81', b: '#a55eea', Icon: Music },
  { id: 'badge:heart', label: 'Care', a: '#ff6b81', b: '#ff4757', Icon: Heart },
];

const THEME_PRESETS = [
  { name: 'Volcanic Night', bg: '#121015', panel: '#1a1621', raised: '#252030', accent: '#ff5b2e' },
  { name: 'Cyber Mint', bg: '#0c1514', panel: '#121f1d', raised: '#1a2c29', accent: '#3dd6a3' },
  { name: 'Astral Indigo', bg: '#101222', panel: '#171b31', raised: '#202642', accent: '#8f7dff' },
  { name: 'Solar Parchment', bg: '#f6f1e8', panel: '#eee7db', raised: '#e5dccd', accent: '#d9532f' },
];

const COPY: Record<Lang, Record<string, string>> = {
  uz: {
    brandSub: 'OrbitMc Do‘koni uchun rasmiy Creator Platformasi',
    backMain: 'OrbitMc saytiga qaytish',
    signOut: 'Chiqish',
    subRequiredTitle: 'Faqat Orbit+ obunachilari uchun',
    subRequiredBody: 'Orbit Studio Platformada Shop uchun mavzular, avatar halqalari va vektor nishon to‘plamlarini yaratib sotuvga chiqarish faqat faol Orbit+ (Ember, Flare yoki Nova) obunasiga ega foydalanuvchilar uchun ochiq.',
    upgradeCta: 'Orbit+ obunasini yoqish',
    signInTitle: 'OrbitMc hisobingiz bilan kiring',
    signInSub: 'Studio hisobingizdagi Orbit+ obunasini va mualliflik huquqingizni Supabase orqali tekshiradi.',
    email: 'Email manzil',
    password: 'Parol',
    signInBtn: 'Studioga kirish',
    kindTheme: 'Mavzu (Theme)',
    kindFrame: 'Avatar Halqasi',
    kindSticker: 'Vektor Paket',
    editorTitle: 'Creator Workbench',
    editorSub: 'Dizayningizni sozlang va to‘g‘ridan-to‘g‘ri OrbitMc Do‘koniga nashr qiling.',
    assetName: 'Mahsulot nomi',
    assetPrice: 'Narxi (Sparks)',
    assetAbout: 'Qisqa tavsif',
    publishBtn: 'Do‘konga nashr qilish',
    previewTitle: 'Jonli Ko‘rinish (OrbitMc Preview)',
    previewSub: 'Foydalanuvchilar chat va Do‘konda assetni shu ko‘rinishda ko‘radi.',
    myCatalog: 'Mening nashr etilgan assetlarim',
    noAssets: 'Hali Studio orqali asset joylamadingiz.',
    publishedOk: 'Asset muvaffaqiyatli OrbitMc Do‘koniga joylandi!',
    removedOk: 'Asset do‘kondan olib tashlandi.',
    tierUnlocked: 'Obuna faol',
    tierLocked: 'Obuna yo‘q',
    motionPulse: 'Pulsatsiyali Glow',
    motionStatic: 'Statik Halo',
  },
  en: {
    brandSub: 'Official Creator Platform for OrbitMc Shop',
    backMain: 'Back to OrbitMc',
    signOut: 'Sign out',
    subRequiredTitle: 'Orbit+ Subscription Required',
    subRequiredBody: 'Designing and publishing custom Themes, Avatar Halo Frames, and Vector Asset Packs directly into OrbitMc Shop is exclusive to active Orbit+ (Ember, Flare, or Nova) subscribers.',
    upgradeCta: 'Upgrade to Orbit+',
    signInTitle: 'Sign in with your OrbitMc account',
    signInSub: 'Orbit Studio verifies your active Orbit+ subscription and creator rights via Supabase.',
    email: 'Email address',
    password: 'Password',
    signInBtn: 'Enter Studio',
    kindTheme: 'Chat Theme',
    kindFrame: 'Avatar Ring',
    kindSticker: 'Vector Pack',
    editorTitle: 'Creator Workbench',
    editorSub: 'Craft your custom asset with live visual preview and publish straight to OrbitMc Shop.',
    assetName: 'Asset title',
    assetPrice: 'Price (Sparks)',
    assetAbout: 'Description',
    publishBtn: 'Publish to OrbitMc Shop',
    previewTitle: 'Live OrbitMc Preview',
    previewSub: 'Exactly how buyers experience this item inside OrbitMc.',
    myCatalog: 'Your Published Shop Listings',
    noAssets: 'No Studio listings published yet.',
    publishedOk: 'Asset published directly to OrbitMc Shop!',
    removedOk: 'Listing removed from Shop.',
    tierUnlocked: 'Orbit+ Active',
    tierLocked: 'Free Plan',
    motionPulse: 'Pulse Halo',
    motionStatic: 'Static Ring',
  },
  ru: {
    brandSub: 'Официальная Creator-платформа для OrbitMc Shop',
    backMain: 'Вернуться в OrbitMc',
    signOut: 'Выйти',
    subRequiredTitle: 'Требуется подписка Orbit+',
    subRequiredBody: 'Создание и публикация тем, колец аватара и наборов векторных бейджей в OrbitMc Shop доступны только активным подписчикам Orbit+ (Ember, Flare или Nova).',
    upgradeCta: 'Оформить Orbit+',
    signInTitle: 'Войдите через аккаунт OrbitMc',
    signInSub: 'Orbit Studio проверяет вашу активную подписку Orbit+ через Supabase.',
    email: 'Email',
    password: 'Пароль',
    signInBtn: 'Войти в Studio',
    kindTheme: 'Тема чата',
    kindFrame: 'Кольцо аватара',
    kindSticker: 'Вектор-пак',
    editorTitle: 'Creator Workbench',
    editorSub: 'Настройте дизайн, проверьте живое превью и опубликуйте прямо в OrbitMc Shop.',
    assetName: 'Название ассета',
    assetPrice: 'Цена (Sparks)',
    assetAbout: 'Краткое описание',
    publishBtn: 'Опубликовать в Shop',
    previewTitle: 'Живое превью OrbitMc',
    previewSub: 'Так покупатели увидят ваш ассет в OrbitMc.',
    myCatalog: 'Мои опубликованные ассеты',
    noAssets: 'Вы еще не публиковали ассеты из Studio.',
    publishedOk: 'Ассет успешно опубликован в OrbitMc Shop!',
    removedOk: 'Ассет удалён из магазина.',
    tierUnlocked: 'Orbit+ Активна',
    tierLocked: 'Нет подписки',
    motionPulse: 'Пульсирующее сияние',
    motionStatic: 'Статичное кольцо',
  },
};

export function App() {
  const [lang, setLang] = useState<Lang>('uz');
  const t = COPY[lang];

  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [paidTier, setPaidTier] = useState<PaidTier | null>(() => {
    const param = new URLSearchParams(window.location.search).get('tier');
    return isPaidTier(param) ? param : null;
  });

  const [kind, setKind] = useState<AssetKind>('theme');
  const [name, setName] = useState('Nova Obsidian');
  const [about, setAbout] = useState('Crafted in Orbit Studio Platform with crisp contrast and vibrant accents.');
  const [price, setPrice] = useState(140);

  // Theme state
  const [bg, setBg] = useState('#101222');
  const [panel, setPanel] = useState('#171b31');
  const [raised, setRaised] = useState('#202642');
  const [accent, setAccent] = useState('#ff5b2e');

  // Frame state
  const [frameA, setFrameA] = useState('#ff5b2e');
  const [frameB, setFrameB] = useState('#9d8cff');
  const [motion, setMotion] = useState<'pulse' | 'static'>('pulse');

  // Sticker pack state
  const [pickedBadges, setPickedBadges] = useState<string[]>([
    'badge:rocket',
    'badge:crown',
    'badge:flame',
    'badge:zap',
    'badge:gem',
    'badge:orbit',
  ]);

  const [listings, setListings] = useState<MarketRow[]>([]);
  const [busyPublish, setBusyPublish] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void loadProfileAndCatalog(session.user.id);
  }, [session]);

  async function loadProfileAndCatalog(userId: string) {
    const paramTier = new URLSearchParams(window.location.search).get('tier');
    const [{ data: profile }, { data: snap }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.rpc('get_market_snapshot'),
    ]);

    const profilePlan = (profile as Record<string, unknown> | null)?.plan ??
      (profile as Record<string, unknown> | null)?.orbit_plus ??
      session?.user.user_metadata?.plan;

    if (isPaidTier(profilePlan)) {
      setPaidTier(profilePlan);
    } else if (isPaidTier(paramTier)) {
      setPaidTier(paramTier);
    }

    const rows = (snap as { listings?: MarketRow[] } | null)?.listings ?? [];
    setListings(rows.filter((r) => r.creator_id === userId));
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Sign in failed' });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !paidTier) return;
    setNotice(null);
    setBusyPublish(true);
    try {
      const cleanName = name.trim();
      const cleanAbout = about.trim();
      if (!cleanName || cleanName.length < 2) throw new Error('Enter an asset title');

      const design =
        kind === 'theme'
          ? { dark: bg.toLowerCase().startsWith('#0') || bg.toLowerCase().startsWith('#1') || bg.toLowerCase().startsWith('#2'), bg, panel, raised, line: raised, accent }
          : kind === 'frame'
            ? { colors: [frameA, frameB], spin: motion === 'pulse' }
            : { stickers: pickedBadges };

      const { error } = await supabase.rpc('create_market_listing', {
        item_kind: kind,
        item_name: cleanName,
        item_about: cleanAbout || 'Created with Orbit Studio Platform',
        item_price: Math.max(20, Math.min(2000, Number(price) || 100)),
        item_design: design,
      });

      if (error) throw error;
      setNotice({ type: 'ok', text: t.publishedOk });
      await loadProfileAndCatalog(session.user.id);
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Publish failed' });
    } finally {
      setBusyPublish(false);
    }
  }

  async function handleRemove(id: string) {
    if (!session) return;
    const { error } = await supabase.rpc('remove_market_listing', { listing_id: id });
    if (error) {
      setNotice({ type: 'err', text: error.message });
      return;
    }
    setNotice({ type: 'ok', text: t.removedOk });
    await loadProfileAndCatalog(session.user.id);
  }

  function toggleBadge(id: string) {
    setPickedBadges((prev) =>
      prev.includes(id)
        ? prev.length > 6
          ? prev.filter((item) => item !== id)
          : prev
        : prev.length >= 12
          ? [...prev.slice(1), id]
          : [...prev, id],
    );
  }

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="studio-brand">
          <div className="studio-brand-mark">
            <Orbit size={22} />
          </div>
          <div>
            <h1>ORBIT STUDIO</h1>
            <small>{t.brandSub}</small>
          </div>
        </div>

        <div className="studio-header-actions">
          <div className="lang-group">
            {(['uz', 'en', 'ru'] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                className={lang === code ? 'active' : ''}
                onClick={() => setLang(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          <span className={`tier-pill ${paidTier ? '' : 'locked'}`}>
            {paidTier ? <Crown size={13} /> : <Lock size={13} />}
            {paidTier ? `${t.tierUnlocked} (${paidTier.toUpperCase()})` : t.tierLocked}
          </span>

          <a className="btn" href={MAIN_SITE_URL}>
            <ArrowLeft size={14} />
            {t.backMain}
          </a>

          {session && (
            <button
              type="button"
              className="btn"
              onClick={() => void supabase.auth.signOut()}
              title={t.signOut}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </header>

      {loadingAuth ? (
        <div className="lock-gate">
          <Orbit size={34} />
          <p>Loading Orbit Studio...</p>
        </div>
      ) : !session ? (
        <form className="lock-gate" onSubmit={handleSignIn}>
          <div className="lock-icon">
            <Sparkles size={28} />
          </div>
          <h2>{t.signInTitle}</h2>
          <p className="card-sub">{t.signInSub}</p>
          {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
          <div className="field" style={{ textAlign: 'left' }}>
            <label>{t.email}</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@orbitmc.app"
            />
          </div>
          <div className="field" style={{ textAlign: 'left' }}>
            <label>{t.password}</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={authBusy}>
            {authBusy ? '...' : t.signInBtn}
          </button>
        </form>
      ) : !paidTier ? (
        <div className="lock-gate">
          <div className="lock-icon">
            <Lock size={28} />
          </div>
          <h2>{t.subRequiredTitle}</h2>
          <p className="card-sub">{t.subRequiredBody}</p>
          <a className="btn btn-aura" href={`${MAIN_SITE_URL}/?view=aura`}>
            <Crown size={15} />
            {t.upgradeCta}
            <ExternalLink size={14} />
          </a>
        </div>
      ) : (
        <div className="studio-grid">
          <form className="card" onSubmit={handlePublish}>
            <h2>{t.editorTitle}</h2>
            <p className="card-sub">{t.editorSub}</p>

            {notice && (
              <div className={`notice ${notice.type}`}>
                {notice.type === 'ok' ? <CheckCircle2 size={15} /> : <Lock size={15} />}
                <span>{notice.text}</span>
              </div>
            )}

            <div className="mode-tabs">
              <button
                type="button"
                className={`mode-tab ${kind === 'theme' ? 'active' : ''}`}
                onClick={() => setKind('theme')}
              >
                <Palette size={18} />
                {t.kindTheme}
              </button>
              <button
                type="button"
                className={`mode-tab ${kind === 'frame' ? 'active' : ''}`}
                onClick={() => setKind('frame')}
              >
                <Crown size={18} />
                {t.kindFrame}
              </button>
              <button
                type="button"
                className={`mode-tab ${kind === 'stickers' ? 'active' : ''}`}
                onClick={() => setKind('stickers')}
              >
                <Sparkles size={18} />
                {t.kindSticker}
              </button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>{t.assetName}</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={32}
                  required
                />
              </div>
              <div className="field">
                <label>{t.assetPrice}</label>
                <input
                  className="input"
                  type="number"
                  min={20}
                  max={2000}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="field">
              <label>{t.assetAbout}</label>
              <textarea
                className="input"
                rows={2}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                maxLength={120}
              />
            </div>

            {kind === 'theme' && (
              <>
                <div className="preset-row">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="preset-chip"
                      onClick={() => {
                        setBg(preset.bg);
                        setPanel(preset.panel);
                        setRaised(preset.raised);
                        setAccent(preset.accent);
                      }}
                    >
                      <span className="preset-dot" style={{ background: preset.accent }} />
                      {preset.name}
                    </button>
                  ))}
                </div>
                <div className="swatch-grid">
                  <label className="swatch-tile">
                    <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
                    Background
                  </label>
                  <label className="swatch-tile">
                    <input type="color" value={panel} onChange={(e) => setPanel(e.target.value)} />
                    Panel
                  </label>
                  <label className="swatch-tile">
                    <input type="color" value={raised} onChange={(e) => setRaised(e.target.value)} />
                    Raised
                  </label>
                  <label className="swatch-tile">
                    <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
                    Accent
                  </label>
                </div>
              </>
            )}

            {kind === 'frame' && (
              <>
                <div className="form-grid">
                  <label className="swatch-tile">
                    <input type="color" value={frameA} onChange={(e) => setFrameA(e.target.value)} />
                    Gradient A
                  </label>
                  <label className="swatch-tile">
                    <input type="color" value={frameB} onChange={(e) => setFrameB(e.target.value)} />
                    Gradient B
                  </label>
                </div>
                <div className="preset-row">
                  <button
                    type="button"
                    className={`preset-chip ${motion === 'pulse' ? 'active' : ''}`}
                    style={motion === 'pulse' ? { borderColor: 'var(--accent)' } : undefined}
                    onClick={() => setMotion('pulse')}
                  >
                    {t.motionPulse}
                  </button>
                  <button
                    type="button"
                    className={`preset-chip ${motion === 'static' ? 'active' : ''}`}
                    style={motion === 'static' ? { borderColor: 'var(--accent)' } : undefined}
                    onClick={() => setMotion('static')}
                  >
                    {t.motionStatic}
                  </button>
                </div>
              </>
            )}

            {kind === 'stickers' && (
              <div className="badge-grid">
                {VECTOR_PACKS.map(({ id, label, a, b, Icon }) => {
                  const picked = pickedBadges.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`badge-pick ${picked ? 'picked' : ''}`}
                      onClick={() => toggleBadge(id)}
                      title={label}
                    >
                      <span
                        className="vbadge"
                        style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                      >
                        <Icon size={17} strokeWidth={2.2} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busyPublish}>
              <UploadCloud size={15} />
              {busyPublish ? '...' : t.publishBtn}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section className="card">
              <h2>{t.previewTitle}</h2>
              <p className="card-sub">{t.previewSub}</p>

              <div className="preview-stage">
                {kind === 'theme' && (
                  <div className="theme-mock" style={{ background: bg, borderColor: raised }}>
                    <div className="theme-mock-head" style={{ background: panel, color: accent }}>
                      <span># {name || 'Orbit Theme'}</span>
                      <span>Orbit+</span>
                    </div>
                    <div className="theme-mock-body">
                      <div style={{ background: panel, borderRadius: 8 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ background: raised, height: 28, borderRadius: 8 }} />
                        <div style={{ background: accent, height: 24, width: '70%', borderRadius: 8, marginLeft: 'auto' }} />
                      </div>
                    </div>
                  </div>
                )}

                {kind === 'frame' && (
                  <div className="frame-halo-preview">
                    <div
                      className={`frame-ring ${motion === 'pulse' ? 'pulse' : ''}`}
                      style={{
                        '--frame-a': frameA,
                        '--frame-b': frameB,
                        boxShadow: `0 0 28px ${frameA}66`,
                      } as React.CSSProperties}
                    />
                    <div className="frame-avatar-core">O</div>
                  </div>
                )}

                {kind === 'stickers' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {pickedBadges.map((badgeId) => {
                      const def = VECTOR_PACKS.find((v) => v.id === badgeId) ?? VECTOR_PACKS[0];
                      const Icon = def.Icon;
                      return (
                        <div
                          key={badgeId}
                          className="vbadge"
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: `linear-gradient(135deg, ${def.a}, ${def.b})`,
                          }}
                        >
                          <Icon size={26} strokeWidth={2.2} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <h2>{t.myCatalog}</h2>
              {listings.length === 0 ? (
                <p className="card-sub" style={{ marginBottom: 0 }}>{t.noAssets}</p>
              ) : (
                <div className="catalog-list">
                  {listings.map((item) => (
                    <div key={item.id} className="catalog-row">
                      <div>
                        <strong>{item.name}</strong>
                        <br />
                        <small>{item.kind.toUpperCase()} · {item.price} Sparks · {item.sales} sales</small>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        style={{ minHeight: 32, padding: '0 10px' }}
                        onClick={() => void handleRemove(item.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
