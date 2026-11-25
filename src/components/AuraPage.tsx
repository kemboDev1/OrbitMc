import { useState } from 'react';
import { AURA } from '../config';
import type { AuraTier, User } from '../data/types';
import { cancelAura, getAura, hasAura, subscribeAura } from '../data/market';
import { useI18n } from '../i18n';
import { fmtMoney, fmtDate } from '../lib/util';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { tell } from './Toast';

const plans: AuraTier[] = ['ember', 'flare', 'nova'];
const costs: Record<AuraTier, { month: number; year: number; daily: number; hubs: number; fee: string }> = {
  ember: { month: AURA.ember.month, year: AURA.ember.year, daily: AURA.ember.stipend, hubs: AURA.ember.hubs, fee: `${AURA.ember.fee * 100}%` },
  flare: { month: AURA.flare.month, year: AURA.flare.year, daily: AURA.flare.stipend, hubs: AURA.flare.hubs, fee: `${AURA.flare.fee * 100}%` },
  nova: { month: AURA.nova.month, year: AURA.nova.year, daily: AURA.nova.stipend, hubs: AURA.nova.hubs, fee: `${AURA.nova.fee * 100}%` },
};

export function AuraPage({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const [cycle, setCycle] = useState<'month' | 'year'>('month');
  const [selectPlan, setSelectPlan] = useState<AuraTier | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeSub = getAura(user);
  const sub = user.serverBacked ? null : activeSub ?? user.aura;
  const active = hasAura(user.id);
  const ended = !!user.aura && !active;
  const renewalOff = active && !!sub && sub.renews < 0;
  const tier = sub?.tier;
  const plan = tier ? costs[tier] : null;

  const subscribe = () => {
    if (!selectPlan) return;
    setSaving(true);
    try { subscribeAura(user.id, selectPlan, cycle); tell(t('subscriptionThanks'), 'good'); setSelectPlan(null); }
    catch { tell(t('err.generic'), 'bad'); }
    finally { setSaving(false); }
  };
  const stop = () => { try { cancelAura(user.id); tell(t('subscriptionCancelled'), 'good'); } catch { tell(t('err.generic'), 'bad'); } setCancelOpen(false); };

  return <div className="page-content aura-page">
    <div className="aura-hero"><div className="aura-orbit aura-orbit-1"/><div className="aura-orbit aura-orbit-2"/><div className="aura-orbit aura-orbit-3"/><div className="aura-hero-copy"><span className="aura-kicker"><Icon name="spark" size={14}/> ORBITMC / ORBIT+</span><h1>{t('auraTitle')}</h1><p>{t('auraSub')}</p><div className="aura-demo-stamp"><Icon name="info" size={14}/>{t('subscriptionDemo')}</div></div><div className="aura-medallion"><span className="medallion-orbit orbit-outer"/><span className="medallion-orbit orbit-inner"/><span className="medallion-center"><Icon name="spark" size={32}/></span><i className="medallion-star">✳</i><i className="medallion-star star-two">✳</i></div><span className="aura-serial">O—M<br/>0001</span></div>

    {user.serverBacked && <div className="privacy-notice subscription-unavailable"><Icon name="info" size={16}/><p>{t('subscriptionUnavailable')}</p></div>}

    {sub && <section className="current-plan-bar"><span className="current-plan-icon"><Icon name="spark" size={19}/></span><div className="current-plan-copy"><span className="eyebrow">{t('currentPlan')}</span><strong>{t(tier === 'ember' ? 'auraEmber' : tier === 'flare' ? 'auraFlare' : 'auraNova')} · {fmtMoney(plan?.[sub.cycle] ?? 0, lang)} / {sub.cycle === 'month' ? t('cycleMonth').toLowerCase() : t('cycleYear').toLowerCase()}</strong><small>{active && renewalOff ? t('endsOn', { date: fmtDate(Math.abs(sub.renews), lang) }) : active ? t('renewsOn', { date: fmtDate(Math.abs(sub.renews), lang) }) : t('authExpired')}</small></div><span className={`plan-state ${active ? 'state-live' : 'state-off'}`}><i/>{active ? t('online') : t('offline')}</span>{active && !renewalOff && <button className="btn btn-outline btn-small" onClick={() => setCancelOpen(true)}>{t('cancelPlan')}</button>}{active && renewalOff && <button className="btn btn-outline btn-small" onClick={() => { subscribeAura(user.id, sub!.tier, sub!.cycle); tell(t('subscriptionThanks'), 'good'); }}>{t('resumePlan')}</button>}{ended && <button className="btn btn-primary btn-small" onClick={() => setSelectPlan(sub.tier)}>{t('changePlan')}</button>}</section>}

    <div className="plan-section-head"><div><span className="eyebrow">{t('auraMood')}</span><h2>{t('billingPeriod')}</h2></div><div className="cycle-switch"><button className={cycle === 'month' ? 'selected' : ''} onClick={() => setCycle('month')}>{t('cycleMonth')}</button><button className={cycle === 'year' ? 'selected' : ''} onClick={() => setCycle('year')}>{t('cycleYear')}<span>{t('auraSaveYear')}</span></button></div></div>
    <div className="plan-grid">
      {plans.map((p, index) => {
        const details = costs[p];
        const subscribedToThis = active && sub?.tier === p;
        return <article className={`plan-card plan-${p} ${p === 'flare' ? 'plan-featured' : ''}`} key={p}>
          {p === 'flare' && <span className="plan-ribbon">{t('popularPlan')}</span>}
          <div className="plan-card-head"><span className="plan-orbit-icon"><Icon name="spark" size={18}/></span><h3>{t(p === 'ember' ? 'auraEmber' : p === 'flare' ? 'auraFlare' : 'auraNova')}</h3></div>
          <p className="plan-desc">{t(p === 'ember' ? 'includedEmber' : p === 'flare' ? 'includedFlare' : 'includedNova')}</p>
          <div className="plan-price"><strong>{fmtMoney(details[cycle], lang)}</strong><span> / {cycle === 'month' ? t('cycleMonth').toLowerCase() : t('cycleYear').toLowerCase()}</span></div>
          {cycle === 'year' && <small className="year-math">{fmtMoney(details.year / 12, lang)} / {t('cycleMonth').toLowerCase()}</small>}
          <ul className="plan-perks"><li><Icon name="check" size={15}/><span>{t('imageAllowance')}</span></li><li><Icon name="check" size={15}/><span>{t('hubAllowance', { count: details.hubs })}</span></li><li><Icon name="check" size={15}/><span>{t('sparksDaily', { count: details.daily.toLocaleString(lang) })}</span></li><li><Icon name="check" size={15}/><span>{t('marketplaceFee', { fee: details.fee })}</span></li></ul>
          <button className={`btn ${subscribedToThis ? 'btn-secondary' : p === 'flare' ? 'btn-primary' : 'btn-outline'} btn-full plan-cta`} disabled={subscribedToThis || user.serverBacked} onClick={() => setSelectPlan(p)}>{user.serverBacked ? t('subscriptionUnavailableShort') : subscribedToThis ? t('currentPlan') : t('choosePlan')}<Icon name="arrowUpRight" size={15}/></button>
          <span className="plan-small">{t('subscriptionDemo')}</span>
        </article>;
      })}
    </div>
    <section className="free-note"><div className="free-mark">S.</div><div><h3>{t('auraFree')}</h3><p>{t('includedFree')}</p></div><span className="free-status">{!active ? <><i/>{t('currentPlan')}</> : '01 / 04'}</span></section>
    <div className="subscription-fine"><Icon name="shield" size={16}/><p>{t('subscriptionFine')}</p></div>

    <Modal open={!!selectPlan} onClose={() => setSelectPlan(null)} title={t('choosePlan')} subtitle={t('subscriptionDemo')} size="sm">{selectPlan && <div className="checkout-preview"><div className={`checkout-token plan-${selectPlan}`}><Icon name="spark" size={22}/></div><div className="checkout-copy"><strong>{t(selectPlan === 'ember' ? 'auraEmber' : selectPlan === 'flare' ? 'auraFlare' : 'auraNova')}</strong><span>{fmtMoney(costs[selectPlan][cycle], lang)} / {cycle === 'month' ? t('cycleMonth').toLowerCase() : t('cycleYear').toLowerCase()}</span></div><div className="demo-payment"><Icon name="info" size={15}/><p>{t('subscriptionDemo')}</p></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setSelectPlan(null)}>{t('cancel')}</button><button className="btn btn-primary" disabled={saving} onClick={subscribe}>{saving ? t('loading') : t('choosePlan')}</button></div></div>}</Modal>
    <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('cancelConfirm')} subtitle={t('cancelSub', { date: sub ? fmtDate(Math.abs(sub.renews), lang) : '' })} size="sm"><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCancelOpen(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={stop}>{t('cancelPlan')}</button></div></Modal>
  </div>;
}
