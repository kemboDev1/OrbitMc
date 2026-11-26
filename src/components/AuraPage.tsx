import { useState } from 'react';
import { AURA, FREE } from '../config';
import type { AuraTier, User } from '../data/types';
import { cancelAura, getAura, hasAura, subscribeAura } from '../data/market';
import { useI18n } from '../i18n';
import { fmtMoney, fmtDate } from '../lib/util';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';

const plans: AuraTier[] = ['ember', 'flare', 'nova'];

export function AuraPage({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const [cycle, setCycle] = useState<'month' | 'year'>('month');
  const [selectPlan, setSelectPlan] = useState<AuraTier | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeSub = getAura(user);
  const sub = activeSub ?? user.aura;
  const active = hasAura(user.id);
  const ended = !!user.aura && !active;
  const renewalOff = active && !!sub && sub.renews < 0;
  const tier = sub?.tier;
  const plan = tier ? AURA[tier] : null;

  const subscribe = () => {
    if (!selectPlan) return;
    setSaving(true);
    try { subscribeAura(user.id, selectPlan, cycle); tell(t('subscriptionThanks'), 'good'); setSelectPlan(null); }
    catch { tell(t('err.generic'), 'bad'); }
    finally { setSaving(false); }
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
      <div className="aura-medallion"><span className="medallion-orbit orbit-outer" /><span className="medallion-orbit orbit-inner" /><span className="medallion-center"><Icon name="spark" size={32} /></span><i className="medallion-star">✳</i><i className="medallion-star star-two">✳</i></div>
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
          <tr><td>{t('perkAnimatedFrames')}</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
        </tbody>
      </table>
    </section>

    <section className="free-note"><div className="free-mark">O+</div><div><h3>{t('auraFree')}</h3><p>{t('includedFree')}</p></div><span className="free-status">{!active ? <><i />{t('currentPlan')}</> : 'PRO ACTIVE'}</span></section>
    <div className="subscription-fine"><Icon name="shield" size={16} /><p>{t('subscriptionFine')}</p></div>

    <Modal open={!!selectPlan} onClose={() => setSelectPlan(null)} title={t('activatePreviewPass')} subtitle={t('subscriptionDemo')} size="sm">{selectPlan && <div className="checkout-preview"><div className={`checkout-token plan-${selectPlan}`}><Icon name="spark" size={22} /></div><div className="checkout-copy"><strong>{t(selectPlan === 'ember' ? 'auraEmber' : selectPlan === 'flare' ? 'auraFlare' : 'auraNova')}</strong><span>{fmtMoney(AURA[selectPlan][cycle], lang)} / {cycle === 'month' ? t('cycleMonth').toLowerCase() : t('cycleYear').toLowerCase()}</span></div><div className="demo-payment"><Icon name="info" size={15} /><p>{t('previewPassNote')}</p></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setSelectPlan(null)}>{t('cancel')}</button><button className="btn btn-primary" disabled={saving} onClick={subscribe}>{saving ? t('loading') : t('activatePreviewPass')}</button></div></div>}</Modal>
    <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('cancelConfirm')} subtitle={t('cancelSub', { date: sub ? fmtDate(Math.abs(sub.renews), lang) : '' })} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCancelOpen(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={stop}>{t('cancelPlan')}</button></div></Modal>
  </div>;
}
