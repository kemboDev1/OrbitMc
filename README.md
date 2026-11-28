# OrbitMc

A multi-language (**EN / RU / UZ**), installable community & messaging SaaS platform built with **React 19 + TypeScript + Vite + Supabase + Electron**, featuring Direct Messaging, Discord-style Hubs with collapsible Rooms, Voice & YouTube embeds, a Creator Asset Shop with animated gradient frames & banners, OrbitXP milestones, 3-tier Verified Badges, Admin Moderation Panel, and server-verified **Orbit+ & Credits Billing** (Stripe, LemonSqueezy, Click, Payme).

## Core Highlights

- **Direct Messages & Hubs:** Replies, inline edit/delete, pin/unpin, reactions, rich formatting (`**bold**`, `` `code` ``, `||spoiler||`), polls, YouTube card embeds, voice recordings, per-contact display nicknames, and collapsible Hub Rooms panel.
- **Supabase Storage Media Pipeline:** Authenticated CDN uploads (`uploads` bucket) for voice messages, images, GIFs, avatars, and profile banners — with automatic local fallback in Demo mode.
- **Monetization Ready:** Server-verified **Orbit+** subscriptions (`ember`, `flare`, `nova`) and **Orbit Credits** top-up packs backed by `billing_orders`, `create-checkout`, and `billing-webhook` Supabase Edge Functions (Stripe, LemonSqueezy, Click, Payme).
- **Creator Asset Shop & Profile Flex:** Build custom color themes, animated conic/linear/radial avatar rings (`spin`, `shimmer`, `pulse`), and sticker/vector packs; gift items; earn OrbitXP & automatic 50/100 XP milestone rewards.
- **White-Label & Multi-Platform:** Rebrand in minutes via [`src/brand.config.ts`](src/brand.config.ts). Ships as Web app, installable PWA, and Electron desktop app.

## Quick Start

Requirements: **Node.js 22.12+** and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Apply all migrations in `supabase/migrations/` in filename order, then see [docs/BUYER_SETUP.md](docs/BUYER_SETUP.md) for Custom SMTP, Edge Function secrets, Stripe/Click/Payme webhook setup, and Vercel deployment.

## Verification Scripts

```bash
npm run typecheck
npm test
npm run build
```

## Project Map

```text
src/
  brand.config.ts         Central white-label branding, pricing & payment rails
  components/             UI views (ChatScreen, BazaarPage, AuraPage, AdminPage, SettingsPage)
  data/                   Domain logic, billing client, Supabase sync, cosmetics & chat controls
  i18n/                   English, Russian and Uzbek translations
  lib/                    Supabase client, Storage uploads, image compression, theme & PWA
supabase/
  migrations/             Ordered PostgreSQL & Storage RLS migrations
  functions/              create-checkout & billing-webhook Edge Functions
docs/
  BUYER_SETUP.md          Turnkey commercial deployment guide
```
