# OrbitMc

A bilingual, installable social app with Supabase email accounts, shared direct messages, communities and Orbit Shop, plus local Orbit+ previews.

> **Data boundary:** Authentication, profiles, direct messages, account blocks, communities, shop listings, virtual credits and purchases use the configured Supabase project. Mute preferences and Orbit+ subscription previews are local to this device. Credits have no cash value, and no payments are processed. Messages are not end-to-end encrypted; do not use OrbitMc for sensitive or confidential conversations.

## What's included

- English, Russian and Uzbek UI; dark, light and system themes.
- Email signup/sign-in, confirmation and password recovery through Supabase Auth.
- Shared direct messages with replies, editing, deletion, pinning, reactions and image attachments.
- Account-level blocks synced through Supabase and enforced before direct messages are inserted.
- Shared communities with public discovery, invite-only membership, rooms and messages, plus a shared Orbit Shop with server-validated purchases, gifts and virtual credits.
- Profile editing, presence, global search, optional browser notifications and message sounds.
- PWA installation on supported browsers and a desktop release workflow for tagged builds.
- Strict TypeScript, input limits, local image resizing, validated backups and Vercel response-security headers.

## Run locally

Requirements: Node.js **22.12 or later** and npm.

```bash
npm install
npm run dev
```

The app includes the public Supabase project URL and publishable client key. You can override them with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your local Vite environment. Desktop confirmation and recovery links return to `https://orbitmc.vercel.app` by default; add that URL to Supabase Auth's redirect allow-list. Set `VITE_SUPABASE_REDIRECT_URL` only when using a different HTTPS site. Apply every file in `supabase/migrations/` in filename order before creating accounts. Open the local address printed by Vite and sign up with an email address. Never put a Supabase service-role key or other server secret in a `VITE_*` variable.

### Check the project

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`npm test` covers local chat, hub and shop behavior, backups, validation and release-asset selection. The browser screens should also be checked in desktop and narrow/mobile viewports before publishing.

## Deploy to Vercel

1. Extract the ZIP, put the **contents** of this folder at the root of a GitHub repository, and push the repository.
2. In Vercel, import that repository. Use the included `vercel.json`; the project builds with `npm run build` and serves `dist`.
3. Set the project to a supported Node version (22.12+; Node 22 or later), deploy, then open the HTTPS URL and check both the desktop view and a phone-sized view.
4. Commit the `package-lock.json` produced by `npm i` before a real release so installs are repeatable.

Apply all database migrations in filename order before deploying. Vercel and the desktop release workflow use the app's public Supabase configuration by default; optional `VITE_SUPABASE_*` settings can override it. Keep service-role and OAuth client secrets server-side.

## Install on a device

On HTTPS, OrbitMc can be installed as a PWA when the browser supports installation. Desktop installers are attached to GitHub Releases by `.github/workflows/release.yml` when a `v*` tag is pushed. The landing page checks the latest release and only offers installers that actually exist; until a release is published, install the web app instead.

The service worker caches the Sado shell and same-origin assets for an offline opening. It does **not** create server sync or move messages between devices. Google Fonts are an optional external visual enhancement; system fonts remain the fallback.

## Data and privacy

- Supabase Auth manages account passwords and recovery; OrbitMc does not store passwords in its local app database.
- Profiles, direct messages and account blocks are held in the configured Supabase project. Review its RLS policies, trigger behavior and backup settings before public use.
- Orbit+ previews, mutes, cleared-history preferences and appearance settings are stored locally and can be lost when browser data is cleared. Communities, shop listings, purchases, virtual credits and gifts are stored in Supabase.
- Image attachments are resized and encoded before being sent to Supabase. This is not a malware scanner.
- Local JSON backups cover browser-stored data; they do not export or restore Supabase accounts and direct messages.

The password storage parameters follow the current OWASP Password Storage guidance for PBKDF2-HMAC-SHA-256: <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>.

## Before this can become a real public messenger

The client uses Supabase for accounts and direct messages, but a public release still needs, at minimum:

- Paid plan entitlements and reviewed upload storage, authorization and retention policies for community content.
- Real-time message delivery, multi-device synchronization, delivery/read state and safe attachment hosting.
- A reviewed threat model, independent security review, abuse/spam controls, reporting/moderation, backups and a privacy/retention policy.
- A genuine payment provider, server-verified entitlements, tax/refund handling and cancellation rules before selling Aura.
- A published privacy policy, terms, support contact and accessibility testing in supported browsers.

Never describe OrbitMc as end-to-end encrypted or ready for confidential conversations.

## Project map

```text
src/
  components/       App screens and reusable interface pieces
  data/             Account cache, chat, hub and marketplace rules
  i18n/             English, Russian and Uzbek dictionaries
  lib/              Browser storage, password, image, theme and PWA helpers
  styles/           Responsive light/dark interface
public/             App icon, web manifest and service worker
scripts/            Domain-flow tests
vercel.json         Single-page routing and response-security headers
```
