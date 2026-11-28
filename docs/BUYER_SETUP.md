# OrbitMc Commercial & White-Label Buyer Setup Guide

This guide walks you through deploying and monetizing your own branded instance of **OrbitMc** in ~10 minutes.

---

## 1. Rebrand in One File (`src/brand.config.ts`)
Open [src/brand.config.ts](../src/brand.config.ts) to customize:
- `name`, `shortTagline`, `supportEmail`, `websiteUrl`, `defaultAccent`
- `auraPricing`: monthly & yearly pricing for `ember`, `flare`, `nova`
- `sparksPacks`: top-up credit bundles (`250`, `750`, `2,000`)
- `payments.providers`: enable or disable `stripe`, `lemonsqueezy`, `click`, `payme`

---

## 2. Configure Supabase Database & Storage
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run every SQL migration inside `supabase/migrations/` **in filename order** via the Supabase SQL Editor or CLI:
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```
3. Verify that the `uploads` storage bucket is public (`5 MB` file limit) and RLS policies on `storage.objects` and `public.billing_orders` are active.

---

## 3. Fix Production Email Delivery (Custom SMTP)
Supabase’s built-in mailer (`noreply@mail.app.supabase.io`) is capped at 2 emails/hour. Before launching publicly:
- Go to **Supabase Dashboard -> Project Settings -> Authentication -> SMTP Settings**.
- Connect **Resend**, **Postmark**, or **SendGrid** SMTP credentials so signup confirmation and password recovery emails arrive in 1–2 seconds.
- Also add your production domain to **Authentication -> URL Configuration -> Redirect URLs**.

---

## 4. Deploy Payment Edge Functions & Webhooks
Deploy both Edge Functions included in `supabase/functions/`:
```bash
npx supabase functions deploy create-checkout --verify-jwt
npx supabase functions deploy billing-webhook --no-verify-jwt
```

Set your payment secrets in Supabase (never put these in `VITE_*`):
```bash
# Global cards (Stripe)
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...

# Merchant of Record (LemonSqueezy)
npx supabase secrets set LEMONSQUEEZY_CHECKOUT_URL=https://store.lemonsqueezy.com/buy/... LEMONSQUEEZY_WEBHOOK_SECRET=...

# Uzbekistan (Click / Payme)
npx supabase secrets set CLICK_MERCHANT_ID=... CLICK_SERVICE_ID=... PAYME_MERCHANT_ID=... UZS_PER_USD=12850
```

Point your Stripe or LemonSqueezy webhook endpoint to:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/billing-webhook`
listening for `checkout.session.completed` (Stripe) or `order_created` (LemonSqueezy).

---

## 5. Deploy Frontend to Vercel & Desktop Builds
1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables.
2. Push to `main` — Vercel builds with `npm run build` and applies the CSP security headers in `vercel.json`.
3. For Windows / macOS / Linux Electron installers, push a `v*` Git tag (`.github/workflows/release.yml` builds and attaches binaries automatically).
