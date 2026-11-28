import type { AuraTier } from './data/types';

export type PaymentProvider = 'stripe' | 'lemonsqueezy' | 'click' | 'payme';

export interface SparksPack {
  id: 'pack_250' | 'pack_750' | 'pack_2000';
  sparks: number;
  priceUsd: number;
  badge?: string;
}

/**
 * Central White-Label Configuration.
 * Buyers can rebrand the entire platform, pricing, credit packs, and payment rails here.
 */
export const BRAND_CONFIG = {
  name: 'OrbitMc',
  shortTagline: 'A closer kind of connection.',
  supportEmail: 'support@orbitmc.app',
  websiteUrl: 'https://orbitmc.vercel.app',
  defaultAccent: '#ff5b2e',
  payments: {
    /** Flip enabled providers to display them in Checkout & Top-Up modals. */
    providers: ['stripe', 'lemonsqueezy', 'click', 'payme'] as PaymentProvider[],
    uzsPerUsd: 12850,
  },
  sparksPacks: [
    { id: 'pack_250', sparks: 250, priceUsd: 2.99 },
    { id: 'pack_750', sparks: 750, priceUsd: 7.99, badge: '+15%' },
    { id: 'pack_2000', sparks: 2000, priceUsd: 17.99, badge: 'BEST VALUE' },
  ] as SparksPack[],
  auraPricing: {
    ember: { month: 2.99, year: 29.9 },
    flare: { month: 5.99, year: 59.9 },
    nova: { month: 9.99, year: 99.9 },
  } as Record<AuraTier, { month: number; year: number }>,
};
