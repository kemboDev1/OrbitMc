import { useState, type FormEvent } from 'react';
import { Crown, Lock, Orbit, Palette, RotateCw, Sparkles, UploadCloud } from 'lucide-react';
import type { DB, FrameMotion, GradientStyle, ListingKind, MotionSpeed, User } from '../data/types';
import { createListing, hasAura } from '../data/market';
import { buildGradientCss, frameMotionClass, frameSpeedDuration, GRADIENT_PRESETS } from '../lib/gradient';
import { useI18n } from '../i18n';
import { tell } from './Toast';
import { AppError } from '../data/errors';
import { VECTOR_BADGES, VectorBadge } from './VectorAssets';

const PRESETS = [
  { name: 'Volcanic Night', dark: true, bg: '#121015', panel: '#1a1621', raised: '#252030', line: '#3b324c', accent: '#ff5b2e' },
  { name: 'Cyber Mint', dark: true, bg: '#0c1514', panel: '#121f1d', raised: '#1a2c29', line: '#2a4641', accent: '#3dd6a3' },
  { name: 'Astral Indigo', dark: true, bg: '#101222', panel: '#171b31', raised: '#202642', line: '#313a63', accent: '#8f7dff' },
  { name: 'Solar Paper', dark: false, bg: '#f6f1e8', panel: '#eee7db', raised: '#e5dccd', line: '#cfc4b3', accent: '#d9532f' },
];

export function StudioView({ user, db, onBackToShop }: { user: User; db: DB; onBackToShop: () => void }) {
  const { t } = useI18n();
  const isPro = hasAura(user.id);
  const [kind, setKind] = useState<ListingKind>('frame');
  const [name, setName] = useState('Nova Obsidian');
  const [about, setAbout] = useState('Crafted in Orbit Studio Workbench with animated gradients.');
  const [price, setPrice] = useState(140);

  const [dark, setDark] = useState(true);
  const [bg, setBg] = useState('#101222');
  const [panel, setPanel] = useState('#171b31');
  const [raised, setRaised] = useState('#202642');
  const [line, setLine] = useState('#313a63');
  const [accent, setAccent] = useState('#ff5b2e');

  const [frameA, setFrameA] = useState('#ff5b2e');
  const [frameB, setFrameB] = useState('#9d8cff');
  const [frameC, setFrameC] = useState('#3aa8ff');
  const [useThird, setUseThird] = useState(true);
  const [angle, setAngle] = useState(135);
  const [gradStyle, setGradStyle] = useState<GradientStyle>('conic');
  const [motion, setMotion] = useState<FrameMotion>('spin');
  const [speed, setSpeed] = useState<MotionSpeed>('normal');

  const [stickers, setStickers] = useState<string[]>(VECTOR_BADGES.slice(0, 6).map((b) => b.id));
  const [busy, setBusy] = useState(false);

  const myPublished = Object.values(db.listings).filter((l) => !l.removed && l.sellerId === user.id);
  const frameDraft = {
    colors: useThird ? [frameA, frameB, frameC] : [frameA, frameB],
    spin: motion !== 'none',
    angle,
    style: gradStyle,
    motion,
    speed,
  };

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    if (!isPro || busy) return;
    setBusy(true);
    try {
      await createListing({
        userId: user.id,
        kind,
        name: name.trim(),
        about: about.trim(),
        price: Math.max(10, Math.min(9999, Number(price) || 120)),
        theme: kind === 'theme' ? { dark, bg, panel, raised, line, accent } : undefined,
        frame: kind === 'frame' ? frameDraft : undefined,
        stickers: kind === 'stickers' ? stickers : undefined,
      });
      tell(t('listingCreated'), 'good');
      onBackToShop();
    } catch (err) {
      tell(err instanceof AppError ? t(err.key) : t('err.generic'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (!isPro) {
    return (
      <div className="page-content">
        <div className="inline-empty" style={{ minHeight: 320 }}>
          <div className="empty-mark"><Lock size={22} /></div>
          <h2>{t('studioPlatform')}</h2>
          <p>{t('studioSubRequired')}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('orbit:nav', { detail: 'aura' }))}>
            <Crown size={15} /> {t('aura')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content market-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ORBIT+ STUDIO WORKBENCH</div>
          <h1>{t('studioPlatform')}</h1>
          <p>{t('studioPlatformSub')}</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={onBackToShop}>
          <Orbit size={15} /> {t('bazaar')} ({myPublished.length})
        </button>
      </div>

      <div className="studio-workbench-grid">
        <form className="settings-section stack-form" onSubmit={publish}>
          <div className="creator-kinds">
            {([
              { id: 'theme', label: t('themes'), icon: <Palette size={17} /> },
              { id: 'frame', label: t('frames'), icon: <Crown size={17} /> },
              { id: 'stickers', label: t('stickers'), icon: <Sparkles size={17} /> },
            ] as const).map((item) => (
              <button key={item.id} type="button" className={`creator-kind ${kind === item.id ? 'active' : ''}`} onClick={() => setKind(item.id)}>
                {item.icon}
                <small>{item.label}</small>
              </button>
            ))}
          </div>

          <div className="auth-two-col">
            <label className="field-label">{t('listingName')}
              <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
            </label>
            <label className="field-label">{t('listingPrice')}
              <input className="field-input" type="number" min={10} max={9999} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </label>
          </div>
          <label className="field-label">{t('listingAbout')}
            <textarea className="field-input field-textarea" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={160} />
          </label>

          {kind === 'theme' && (
            <>
              <div className="preset-row">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" className="preset-chip" onClick={() => { setDark(p.dark); setBg(p.bg); setPanel(p.panel); setRaised(p.raised); setLine(p.line); setAccent(p.accent); }}>
                    <span className="preset-dot" style={{ background: p.accent }} /> {p.name}
                  </button>
                ))}
              </div>
              <div className="custom-color-grid">
                <label className="color-pick-tile"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />Background</label>
                <label className="color-pick-tile"><input type="color" value={panel} onChange={(e) => setPanel(e.target.value)} />Panel</label>
                <label className="color-pick-tile"><input type="color" value={raised} onChange={(e) => setRaised(e.target.value)} />Raised</label>
                <label className="color-pick-tile"><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />Accent</label>
              </div>
            </>
          )}

          {kind === 'frame' && (
            <>
              <div className="preset-row">
                {GRADIENT_PRESETS.map((p) => (
                  <button key={p.name} type="button" className="preset-chip" onClick={() => {
                    setFrameA(p.colors[0]);
                    setFrameB(p.colors[1]);
                    if (p.colors[2]) { setFrameC(p.colors[2]); setUseThird(true); } else setUseThird(false);
                    setAngle(p.angle);
                    setGradStyle(p.style);
                    setMotion(p.motion);
                  }}>
                    <span className="preset-dot" style={{ background: `linear-gradient(135deg, ${p.colors.join(', ')})` }} /> {p.name}
                  </button>
                ))}
              </div>
              <div className="custom-color-grid">
                <label className="color-pick-tile"><input type="color" value={frameA} onChange={(e) => setFrameA(e.target.value)} />Stop A</label>
                <label className="color-pick-tile"><input type="color" value={frameB} onChange={(e) => setFrameB(e.target.value)} />Stop B</label>
                {useThird ? (
                  <label className="color-pick-tile"><input type="color" value={frameC} onChange={(e) => setFrameC(e.target.value)} />Stop C</label>
                ) : (
                  <button type="button" className="color-pick-tile" onClick={() => setUseThird(true)}>+ Stop C</button>
                )}
                {useThird && <button type="button" className="color-pick-tile" onClick={() => setUseThird(false)}>2 Stops</button>}
              </div>
              <div className="field-label">{t('gradientTypeLabel')}
                <div className="segmented-choice">
                  {(['linear', 'conic', 'radial'] as const).map((st) => (
                    <button key={st} type="button" className={gradStyle === st ? 'selected' : ''} onClick={() => setGradStyle(st)}>{st.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div className="field-label">
                <span className="range-head"><span>{t('gradientAngleLabel')}</span><b>{angle}°</b></span>
                <div className="angle-control-row">
                  <input type="range" min={0} max={360} step={5} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
                  <button type="button" className="btn btn-outline btn-small" onClick={() => setAngle((a) => (a + 45) % 360)}><RotateCw size={13} /> +45°</button>
                </div>
              </div>
              <div className="field-label">{t('frameMotionLabel')}
                <div className="segmented-choice">
                  {(['none', 'pulse', 'spin', 'shimmer'] as const).map((m) => (
                    <button key={m} type="button" className={motion === m ? 'selected' : ''} onClick={() => setMotion(m)}>{m.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              {motion !== 'none' && (
                <div className="field-label">{t('motionSpeedLabel')}
                  <div className="segmented-choice">
                    {(['slow', 'normal', 'fast'] as const).map((sp) => (
                      <button key={sp} type="button" className={speed === sp ? 'selected' : ''} onClick={() => setSpeed(sp)}>{sp.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {kind === 'stickers' && (
            <div className="sticker-picker-grid">
              {VECTOR_BADGES.map((b) => {
                const picked = stickers.includes(b.id);
                return (
                  <button key={b.id} type="button" className={`sticker-pick-btn ${picked ? 'picked' : ''}`} onClick={() => setStickers((prev) => prev.includes(b.id) ? (prev.length > 6 ? prev.filter((x) => x !== b.id) : prev) : (prev.length < 12 ? [...prev, b.id] : prev))}>
                    <VectorBadge id={b.id} size="md" />
                  </button>
                );
              })}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            <UploadCloud size={15} /> {busy ? t('loading') : t('listingSubmit')}
          </button>
        </form>

        <section className="settings-section">
          <div className="creator-live-preview">
            <span className="creator-live-label">{t('assetPreview')}</span>
            <div className="creator-preview-stage">
              {kind === 'theme' ? (
                <div className="theme-preview" style={{ '--preview-bg': bg, '--preview-panel': panel, '--preview-raised': raised, '--preview-line': line, '--preview-accent': accent } as React.CSSProperties}>
                  <span className="preview-window"><i /><i /><i /><b /><em /><em /><strong /></span>
                  <span className="theme-name-preview">{name || 'Theme'}</span>
                </div>
              ) : kind === 'frame' ? (
                <div className="creator-frame-banner-preview">
                  <div className={`creator-mini-banner banner-animated ${frameMotionClass(frameDraft)}`} style={{ backgroundImage: buildGradientCss(frameDraft), backgroundSize: motion === 'shimmer' ? '220% 220%' : undefined, '--frame-speed': frameSpeedDuration(speed) } as React.CSSProperties} />
                  <div className="frame-preview-clean">
                    <span className={`frame-halo-ring ${frameMotionClass(frameDraft)}`} style={{ '--frame-a': frameA, '--frame-b': frameB, '--frame-grad': buildGradientCss(frameDraft), '--frame-speed': frameSpeedDuration(speed) } as React.CSSProperties} />
                    <span className="frame-face-clean">{user.name.slice(0, 1).toUpperCase()}</span>
                  </div>
                </div>
              ) : (
                <div className="sticker-preview vector-pack-preview">
                  {stickers.slice(0, 6).map((id, i) => <span key={`${id}-${i}`} className={`sticker-pos sticker-pos-${i + 1}`}><VectorBadge id={id} size="md" /></span>)}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
