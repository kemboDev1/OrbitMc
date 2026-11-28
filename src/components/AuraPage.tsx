import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Lock, Sparkles } from 'lucide-react';
import { AURA, FREE, STUDIO_URL } from '../config';
import type { PaymentProvider, SparksPack } from '../brand.config';
import { PAYMENT_PROVIDERS, refreshBillingEntitlements, SPARKS_PACKS, startCheckout } from '../data/billing';
import type { AuraTier, User } from '../data/types';
import { cancelAura, getAura, hasAura, subscribeAura } from '../data/market';
import { useI18n } from '../i18n';
import { fmtMoney, fmtDate } from '../lib/util';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';

const plans: AuraTier[] = ['ember', 'flare', 'nova'];

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: 'Stripe (Card)',
  lemonsqueezy: 'LemonSqueezy',
  click: 'Click (UZ)',
  payme: 'Payme (UZ)',
};

export function AuraPage({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const [cycle, setCycle] = useState<'month' | 'year'>('month');
  const [selectPlan, setSelectPlan] = useState<AuraTier | null>(null);
  const [selectPack, setSelectPack] = useState<SparksPack | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>(PAYMENT_PROVIDERS[0] ?? 'stripe');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeSub = getAura(user);
  const sub = activeSub ?? user.aura;
  const active = hasAura(user.id);
  const ended = !!user.aura && !active;
  const renewalOff = active && !!sub && sub.renews < 0;
  const tier = sub?.tier;
  const plan = tier ? AURA[tier] : null;
  const studioHref = `${STUDIO_URL}?tier=${activeSub?.tier ?? 'none'}&user=${encodeURIComponent(user.username)}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') {
      void refreshBillingEntitlements(user.id).then(() => {
        tell(t('billingSuccessNotice'), 'good');
      }).catch(() => undefined);
      params.delete('billing');
      params.delete('order');
      const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', clean);
    }
  }, [user.id, t]);

  const subscribe = async () => {
    if (!selectPlan && !selectPack) return;
    setSaving(true);
    setCheckoutNote('');
    try {
      const outcome = await startCheckout(selectPlan
        ? { userId: user.id, kind: 'aura', tier: selectPlan, cycle, provider }
        : { userId: user.id, kind: 'sparks', packId: selectPack!.id, provider });
      if (outcome.mode === 'live' && outcome.url) {
        window.location.assign(outcome.url);
        return;
      }
      if (outcome.mode === 'sandbox') {
        tell(selectPlan ? t('subscriptionThanks') : t('billingSuccessNotice'), 'good');
        setSelectPlan(null);
        setSelectPack(null);
        return;
      }
      setCheckoutNote(t('checkoutUnconfigured', { provider: PROVIDER_LABELS[provider], order: outcome.orderId?.slice(0, 8) ?? '' }));
    } catch {
      tell(t('err.generic'), 'bad');
    } finally {
      setSaving(false);
    }
  };
  const stop = () => { try { cancelAura(user.id); tell(t('subscriptionCancelled'), 'good'); } catch { tell(t('err.generic'), 'bad'); } setCancelOpen(false); };

  const showcases = [
    { icon: 'spark' as const, title: t('proShowcase1Title'), desc: t('proShowcase1Desc') },
    { icon: 'image' as const, title: t('proShowcase2Title'), desc: t('proShowcase2Desc') },
    { icon: 'palette' as const, title: t('proShowcase3Title'), desc: t('proShowcase3Desc') },
    { icon: 'grid' as const, title: t('proShowcase4Title'), desc: t('proShowcase4Desc') },
  ];

  return <div className="page-content aura-page">
    <div className="aura-hero">
      <div className="aura-orbit aura-orbit-1" /><div className="aura-orbit aura-orbit-2" /><div className="aura-orbit aura-orbit-3" />
      <div className="aura-hero-copy">
        <span className="aura-kicker"><Icon name="spark" size={14} /> ORBITMC / ORBIT+ PRO</span>
        <h1>{t('auraTitle')}</h1>
        <p>{t('auraSub')}</p>
        <div className="aura-demo-stamp"><Icon name="spark" size={14} />{t('previewPassNote')}</div>
      </div>
      <div className="aura-medallion"><span className="medallion-orbit orbit-outer" /><span className="medallion-orbit orbit-inner" /><span className="medallion-center"><Icon name="spark" size={32} /></span></div>
      <span className="aura-serial">O+M<br />PRO</span>
    </div>

    {sub && <section className="current-plan-bar">
      <span className="current-plan-icon"><Icon name="spark" size={19} /></span>
      <div className="current-plan-copy">
        <span className="eyebrow">{t('currentPlan')}</span>
        <strong>{t(tier === 'ember' ? 'auraEmber' : tier === 'flare' ? 'auraFlare' : 'auraNova')} · {fmtMoney(plan?.[sub.cycle] ?? 0, lang)} / {sub.cycle === 'month' ? t('cycleMonth').toLowerCase() : t('cycleYear').toLowerCase()}</strong>
        <small>{active && renewalOff ? t('endsOn', { date: fmtDate(Math.abs(sub.renews), lang) }) : active ? t('renewsOn', { date: fmtDate(Math.abs(sub.renews), lang) }) : t('authExpired')}</small>
      </div>
      <span className={`plan-state ${active ? 'state-live' : 'state-off'}`}><i />{active ? t('online') : t('offline')}</span>
      {active && !renewalOff && <button className="btn btn-outline btn-small" onClick={() => setCancelOpen(true)}>{t('cancelPlan')}</button>}
      {active && renewalOff && <button className="btn btn-outline btn-small" onClick={() => { subscribeAura(user.id, sub!.tier, sub!.cycle); tell(t('subscriptionThanks'), 'good'); }}>{t('resumePlan')}</button>}
      {ended && <button className="btn btn-primary btn-small" onClick={() => setSelectPlan(sub.tier)}>{t('changePlan')}</button>}
    </section>}

    <div className="studio-platform-card">
      <div className="studio-platform-copy">
        <span className="pill-mini"><Sparkles size={11} /> ORBIT+ STUDIO</span>
        <h3>{t('studioPlatform')}</h3>
        <p>{t('studioPlatformSub')}</p>
      </div>
      {active ? (
        STUDIO_URL ? (
          <a className="btn btn-primary" href={studioHref} target="_blank" rel="noopener noreferrer">
            <span>{t('openStudioPlatform')}</span>
            <ExternalLink size={15} />
          </a>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('orbit:nav', { detail: 'studio' }))}>
            <Sparkles size={15} />
            <span>{t('openStudioPlatform')}</span>
          </button>
        )
      ) : (
        <button type="button" className="btn btn-outline" onClick={() => setSelectPlan('flare')}>
          <Lock size={14} />
          <span>{t('activatePreviewPass')}</span>
        </button>
      )}
    </div>

    <section className="pro-showcase-section">
      <div className="plan-section-head"><div><span className="eyebrow">ORBIT+ PRO</span><h2>{t('proFeaturesTitle')}</h2></div></div>
      <div className="pro-showcase-grid">
        {showcases.map((s) => (
          <article className="pro-showcase-card" key={s.title}>
            <span className="pro-showcase-icon"><Icon name={s.icon} size={20} /></span>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
          </article>
        ))}
      </div>
    </section>

    <div className="plan-section-head">
      <div><span className="eyebrow">{t('auraMood')}</span><h2>{t('billingPeriod')}</h2></div>
      <div className="cycle-switch">
        <button className={cycle === 'month' ? 'selected' : ''} onClick={() => setCycle('month')}>{t('cycleMonth')}</button>
        <button className={cycle === 'year' ? 'selected' : ''} onClick={() => setCycle('year')}>{t('cycleYear')}<span>{t('auraSaveYear')}</span></button>
      </div>
    </div>

    <div className="plan-grid">
      {plans.map((p) => {
        const details = AURA[p];
        const subscribedToThis = active && sub?.tier === p;
        return <article className={`plan-card plan-${p} ${p === 'flare' ? 'plan-featured' : ''}`} key={p}>
          {p === 'flare' && <span className="plan-ribbon">{t('popularPlan')}</span>}
          <div className="plan-card-head"><span className="plan-orbit-icon"><Icon name="spark" size={18} /></span><h3>{t(p === 'ember' ? 'auraEmber' : p === 'flare' ? 'auraFlare' : 'auraNova')}</h3></div>
          <p className="plan-desc">{t(p === 'ember' ? 'includedEmber' : p === 'flare' ? 'includedFlare' : 'includedNova')}</p>
          <div className="plan-price"><strong>{fmtMoney(details[cycle], lang)}</strong><span> / {cycle === 'month' ? t('cycleMonth').toLowerCase() : t('cycleYear').toLowerCase()}</span></div>
          {cycle === 'year' && <small className="year-math">{fmtMoney(details.year / 12, lang)} / {t('cycleMonth').toLowerCase()}</small>}
          <ul className="plan-perks">
            <li><Icon name="check" size={15} /><span>{t('perkExtendedText', { count: details.maxChars.toLocaleString(lang) })}</span></li>
            <li><Icon name="check" size={15} /><span>{t('perkRichMedia')}</span></li>
            <li><Icon name="check" size={15} /><span>{t('perkAnimatedFrames')}</span></li>
            <li><Icon name="check" size={15} /><span>{t('perkCustomStickers')}</span></li>
            <li><Icon name="check" size={15} /><span>{t('perkHubTemplates', { count: details.hubs })}</span></li>
            <li><Icon name="check" size={15} /><span>{t('sparksDaily', { count: details.stipend.toLocaleString(lang) })}</span></li>
            <li><Icon name="check" size={15} /><span>{t('perkZeroFee', { fee: `${details.fee * 100}%` })}</span></li>
          </ul>
          <button className={`btn ${subscribedToThis ? 'btn-secondary' : p === 'flare' ? 'btn-primary' : 'btn-outline'} btn-full plan-cta`} disabled={subscribedToThis} onClick={() => setSelectPlan(p)}>
            {subscribedToThis ? t('currentPlan') : t('activatePreviewPass')}
            <Icon name="arrowUpRight" size={15} />
          </button>
          <span className="plan-small">{t('subscriptionDemo')}</span>
        </article>;
      })}
    </div>

    <section className="pro-compare-wrap">
      <table className="pro-compare-table">
        <thead>
          <tr>
            <th>{t('proCompareFeature')}</th>
            <th>{t('proCompareFree')}</th>
            <th>{t('auraEmber')}</th>
            <th>{t('auraFlare')}</th>
            <th>{t('auraNova')}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>{t('perkExtendedText', { count: '4,000' })}</td><td>2,000</td><td>2,500</td><td>3,200</td><td>4,000</td></tr>
          <tr><td>{t('hubs')}</td><td>{FREE.hubs}</td><td>{AURA.ember.hubs}</td><td>{AURA.flare.hubs}</td><td>{AURA.nova.hubs}</td></tr>
          <tr><td>{t('yourSparks')} / {t('aMonth')}</td><td>{FREE.daily}</td><td>{AURA.ember.stipend}</td><td>{AURA.flare.stipend}</td><td>{AURA.nova.stipend}</td></tr>
          <tr><td>{t('perkZeroFee', { fee: '%' })}</td><td>15%</td><td>10%</td><td>5%</td><td>0%</td></tr>
          <tr><td>{t('studioPlatform')}</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
        </tbody>
      </table>
    </section>

    <section className="sparks-packs-section">
      <div className="plan-section-head">
        <div><span className="eyebrow">CREDITS TOP-UP</span><h2>{t('sparksPacksTitle')}</h2><p className="field-hint">{t('sparksPacksSub')}</p></div>
      </div>
      <div className="sparks-pack-grid">
        {SPARKS_PACKS.map((pack) => (
          <article className="sparks-pack-card" key={pack.id}>
            {pack.badge && <span className="plan-ribbon">{pack.badge}</span>}
            <div className="sparks-pack-top"><Icon name="spark" size={18} /><strong>{pack.sparks.toLocaleString(lang)} {t('sparks')}</strong></div>
            <div className="plan-price"><strong>{fmtMoney(pack.priceUsd, lang)}</strong><span>{t('oneTimeLabel')}</span></div>
            <button type="button" className="btn btn-outline btn-small btn-full" onClick={() => { setCheckoutNote(''); setSelectPlan(null); setSelectPack(pack); }}>
              <CreditCard size={14} /><span>{t('buyCredits')}</span>
            </button>
          </article>
        ))}
      </div>
    </section>

    <section className="free-note"><div className="free-mark">O+</div><div><h3>{t('auraFree')}</h3><p>{t('includedFree')}</p></div><span className="free-status">{!active ? <><i />{t('currentPlan')}</> : 'PRO ACTIVE'}</span></section>
    <div className="subscription-fine"><Icon name="shield" size={16} /><p>{t('billingLiveNote')}</p></div>

    <Modal open={!!selectPlan || !!selectPack} onClose={() => { setSelectPlan(null); setSelectPack(null); setCheckoutNote(''); }} title={t('choosePlan')} subtitle={selectPlan ? `${t(selectPlan === 'ember' ? 'auraEmber' : selectPlan === 'flare' ? 'auraFlare' : 'auraNova')} · ${fmtMoney(AURA[selectPlan][cycle], lang)}` : selectPack ? `${selectPack.sparks.toLocaleString(lang)} ${t('sparks')} · ${fmtMoney(selectPack.priceUsd, lang)}` : ''} size="sm">
      {(selectPlan || selectPack) && (
        <div className="checkout-preview">
          <div className={`checkout-token plan-${selectPlan ?? 'flare'}`}><Icon name="spark" size={22} /></div>
          <div className="checkout-copy">
            <strong>{selectPlan ? t(selectPlan === 'ember' ? 'auraEmber' : selectPlan === 'flare' ? 'auraFlare' : 'auraNova') : `${selectPack!.sparks.toLocaleString(lang)} ${t('sparks')}`}</strong>
            <span>{selectPlan ? `${fmtMoney(AURA[selectPlan][cycle], lang)} / ${cycle === 'month' ? t('cycleMonth').toLowerCase() : t('cycleYear').toLowerCase()}` : fmtMoney(selectPack!.priceUsd, lang)}</span>
          </div>
          {user.serverBacked && (
            <div className="provider-picker">
              <span className="field-label">{t('paymentMethod')}</span>
              <div className="provider-grid">
                {PAYMENT_PROVIDERS.map((p) => (
                  <button key={p} type="button" className={`provider-pill ${provider === p ? 'selected' : ''}`} onClick={() => { setProvider(p); setCheckoutNote(''); }}>
                    <CreditCard size={13} /><span>{PROVIDER_LABELS[p]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="demo-payment"><Icon name="shield" size={15} /><p>{t(user.serverBacked ? 'billingLiveNote' : 'previewPassNote')}</p></div>
          {checkoutNote && <div className="inline-note" role="status"><Icon name="info" size={15} /><span>{checkoutNote}</span></div>}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => { setSelectPlan(null); setSelectPack(null); setCheckoutNote(''); }}>{t('cancel')}</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => void subscribe()}>{saving ? t('loading') : t(user.serverBacked ? 'continueCheckout' : 'activatePreviewPass')}</button>
          </div>
        </div>
      )}
    </Modal>
    <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('cancelConfirm')} subtitle={t('cancelSub', { date: sub ? fmtDate(Math.abs(sub.renews), lang) : '' })} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCancelOpen(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={stop}>{t('cancelPlan')}</button></div></Modal>
  </div>;
}
