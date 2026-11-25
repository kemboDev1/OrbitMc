# Security notes and reporting

## Current architecture

OrbitMc uses Supabase Auth for accounts. Profiles, direct messages, account blocks, community metadata, memberships, rooms, community messages, marketplace listings, virtual-credit balances, purchases and gifts are stored in Supabase. Mute preferences, cleared-history markers, appearance settings and Orbit+ subscription previews remain local. Virtual credits are not money and no payment is processed.

Messages are not end-to-end encrypted. The client sends message text and image data to the configured Supabase project. Do not use OrbitMc for sensitive or confidential conversations. The marketplace ledger is server-authoritative for virtual credits only; there is no payment processing, malware scanning, or abuse moderation.

## Existing safeguards

- Supabase Auth handles passwords and recovery; the client does not store account passwords in its app database.
- The SQL migration enables RLS. Authenticated users can discover profiles and update their own profile. Direct-message reads are limited to participants; inserts must be from the authenticated sender; message mutations use narrowly scoped database functions that check message ownership or participation.
- The server-side block migration lets each account manage only its own block rows. A database trigger rejects new direct messages in either direction for a blocked pair; old messages remain in history. The marketplace migration restricts wallet changes to server functions, validates item creation and performs purchases, gifts and seller credits atomically. The community migration restricts membership and room changes to checked database functions and lets only members read room messages.
- Database functions use a fixed empty search path, validate message edits and reaction length, and have execution revoked from `public` and `anon` before being granted to `authenticated`.
- The client validates profiles, messages, shop data, and imported backups; limits text and image sizes; and re-encodes avatar uploads. These client checks improve usability but are not a substitute for server-side validation.
- `vercel.json` configures a restrictive Content Security Policy, frame protection, MIME-sniffing protection, a strict referrer policy, HSTS, a restrictive Permissions Policy, and same-origin opener policy.
- Electron limits in-app navigation to the app entry point and opens external HTTPS links through the system browser.

## Deployment requirements

- Apply all files in `supabase/migrations/` in filename order to the intended Supabase project. Keep service-role keys and other server secrets out of the client bundle; only the Supabase URL and anon key belong in client environment variables.
- Review the migration and the project's effective RLS policies, grants, realtime publication, Auth settings, backup and retention settings before public use. Test policies using separate authenticated users and anonymous access.
- Treat Orbit+ status as a prototype. Do not sell credits or plans until there is a payment provider, server-verified plan entitlement, and reviewed purchase policy. Mute remains a local notification preference.
- Do not describe OrbitMc as end-to-end encrypted. Supabase transport and storage controls do not provide end-to-end encryption.

## Before a public launch

- Add paid-plan entitlements and moderation actions as server-validated transactions with anti-abuse limits. Community images still need storage controls, rate limits and moderation workflows before public launch.
- Add reporting, rate limits, upload storage with type checks and malware scanning, and a retention/deletion process.
- Define privacy, payment, cancellation, refund, support, and incident-response policies. Review dependency advisories, deployed headers, RLS behavior, and Electron packaging, and obtain an independent security review.

Do not submit passwords, tokens, personal information, or private conversations to public issues. Report code-level security concerns through a private repository channel with a minimal, non-sensitive reproduction.
