# Security notes and reporting

## Scope

Sado in this repository is a local browser prototype. It has no production API, central identity system, hosted database, payment service, device synchronization, moderation service or end-to-end encryption. The visible sign-in only gates one browser's local data. Browser profile access, malicious same-origin JavaScript, a compromised device, stolen backup files and browser extensions are outside that demo's protection.

Please do not submit a password, token, personal information or sensitive conversation to a public issue. There is no production service in this repository to report a live-service vulnerability against. For code-level security questions, open a private repository discussion with a minimal, non-sensitive reproduction.

## Existing safeguards

- React renders user-authored text as text; user content is not interpreted as HTML.
- Registration applies field limits, normalizes account names and hashes the password with a random salt using PBKDF2-HMAC-SHA-256 before storing the verifier.
- The local database and imported backups are size-bounded and structurally validated. Conversation and profile text are length-limited. Uploads are re-encoded to bounded JPEG data URLs.
- `vercel.json` sends a restrictive Content Security Policy, frame protection, MIME-sniffing protection, a strict referrer policy, HSTS, a restrictive Permissions Policy and same-origin opener policy.
- The CSP permits JavaScript only from the site itself. Inline JavaScript is not required. Inline style attributes are allowed for the app's calculated theme colours; do not broaden `script-src` to accommodate an inline script.

These controls reduce some browser risks; they do not replace server-side security, application security testing, or an external review.

## Production launch checklist

- Add a trusted backend and verify each viewer's identity and permissions on every read/write. Never trust a client-supplied user ID or hub role.
- Move password authentication and session management to reviewed server-side code. Add verified recovery, session revocation, secure cookie settings, MFA where appropriate, and server-side throttling.
- Choose an appropriate end-to-end encryption design only if the product can safely support key creation, verification, recovery and multi-device operation; do not market transport encryption as end-to-end encryption.
- Store uploads outside the application bundle with authorization, type/size checks, malware scanning and retention controls. Use signed, scoped access where suitable.
- Replace demo replies, local sparks and local Aura toggles with audited services. Do not grant a paid plan from a browser-only update.
- Implement anti-spam, reporting, blocking, moderation escalation and incident-response processes.
- Review dependency versions and advisories, lock dependencies, audit the deployed headers, test the CSP, perform accessibility checks and obtain independent security review.
- Publish clear privacy, retention, deletion, payment, subscription cancellation and support policies before collecting real user data or money.
