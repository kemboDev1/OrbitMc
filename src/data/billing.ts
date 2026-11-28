import { BRAND_CONFIG, type PaymentProvider, type SparksPack } from '../brand.config';
import { getAuthRedirectUrl, requireSupabase } from '../lib/supabase';
import { db } from './db';
import { AppError } from './errors';
import { syncRemoteMarket, syncRemoteWorkspace } from './cloud';
import { subscribeAura } from './market';
import type { AuraTier } from './types';

export interface BillingOrder {
  id: string;
  kind: 'aura' | 'sparks';
  tier: AuraTier | null;
  cycle: 'month' | 'year' | null;
  sparksAmount: number;
  amountCents: number;
  currency: string;
  provider: PaymentProvider | 'sandbox';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: number;
  paidAt?: number;
}

export interface CheckoutOutcome {
  mode: 'live' | 'unconfigured' | 'sandbox';
  provider: PaymentProvider | 'sandbox';
  orderId?: string;
  url?: string;
}

export const SPARKS_PACKS: SparksPack[] = BRAND_CONFIG.sparksPacks;
export const PAYMENT_PROVIDERS: PaymentProvider[] = BRAND_CONFIG.payments.providers;

/**
 * Starts a server-verified checkout session via the `create-checkout` Supabase Edge Function
 * for authenticated accounts, or previews locally for Demo accounts.
 */
export async function startCheckout(input: {
  userId: string;
  kind: 'aura' | 'sparks';
  tier?: AuraTier;
  cycle?: 'month' | 'year';
  packId?: SparksPack['id'];
  provider: PaymentProvider;
}): Promise<CheckoutOutcome> {
  const user = db.get().users[input.userId];
  if (!user) throw new AppError('err.notMember');

  if (!user.serverBacked) {
    if (input.kind === 'aura' && input.tier) {
      subscribeAura(input.userId, input.tier, input.cycle ?? 'month');
    } else if (input.kind === 'sparks' && input.packId) {
      const pack = SPARKS_PACKS.find((p) => p.id === input.packId);
      if (pack) {
        db.transaction((d) => {
          const u = d.users[input.userId];
          if (u) u.sparks = Math.min(99_999, u.sparks + pack.sparks);
        });
      }
    }
    return { mode: 'sandbox', provider: 'sandbox' };
  }

  const client = requireSupabase();
  const returnUrl = getAuthRedirectUrl();
  const { data, error } = await client.functions.invoke('create-checkout', {
    body: {
      kind: input.kind,
      tier: input.tier,
      cycle: input.cycle,
      packId: input.packId,
      provider: input.provider,
      returnUrl,
    },
  });

  if (error || !data || typeof data !== 'object') {
    throw new AppError('err.backendUnavailable');
  }

  const res = data as { mode?: 'live' | 'unconfigured'; url?: string; orderId?: string; provider?: PaymentProvider; error?: string };
  if (res.error) throw new AppError('err.backendUnavailable');

  return {
    mode: res.mode ?? (res.url ? 'live' : 'unconfigured'),
    provider: res.provider ?? input.provider,
    orderId: res.orderId,
    url: res.url,
  };
}

export async function fetchMyBillingOrders(userId: string): Promise<BillingOrder[]> {
  const user = db.get().users[userId];
  if (!user?.serverBacked) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('billing_orders')
    .select('id, kind, tier, cycle, sparks_amount, amount_cents, currency, provider, status, created_at, paid_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return (data as {
    id: string; kind: 'aura' | 'sparks'; tier: AuraTier | null; cycle: 'month' | 'year' | null;
    sparks_amount: number; amount_cents: number; currency: string; provider: PaymentProvider | 'sandbox';
    status: 'pending' | 'paid' | 'failed' | 'refunded'; created_at: string; paid_at: string | null;
  }[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    tier: row.tier,
    cycle: row.cycle,
    sparksAmount: row.sparks_amount,
    amountCents: row.amount_cents,
    currency: row.currency,
    provider: row.provider,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    paidAt: row.paid_at ? new Date(row.paid_at).getTime() : undefined,
  }));
}

export async function refreshBillingEntitlements(userId: string): Promise<void> {
  const user = db.get().users[userId];
  if (!user?.serverBacked) return;
  await Promise.all([syncRemoteWorkspace(userId), syncRemoteMarket(userId)]);
}
