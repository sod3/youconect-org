# Testing

```powershell
npm run typecheck
npm test
npm run build
```

Service tests use isolated temporary databases. Unit tests cover password hashing, cookie parsing, origin protection, and RFC 6238 authenticator vectors. Integration tests cover sessions, verification/recovery, organization roles, cross-tenant denial, membership revocation, community privacy, reactions/replies, message persistence/idempotency, event capacity, Bridge approval and revocation, private uploads, plan limits, applications, rate limits, and MFA recovery/replay protection.

A separate durability test starts child processes, exits immediately after an acknowledged write, and reloads that record on two subsequent starts. Temporary test directories are checked before cleanup. No production database is used by these tests.

For browser tests, start the development server in another terminal:

```powershell
npx playwright install chromium
npm run dev
# In another terminal:
npm run test:e2e
```

Playwright covers public routes, mobile overflow/navigation, publishing/commenting/saving, organization switching, RSVP persistence, registration and member approval over HTTP, and two-session live Socket.IO messaging with duplicate/reconnect reconciliation.

If Windows cannot launch a newly downloaded Chromium build, point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at an installed Playwright Chromium/headless executable. This is an optional local override; CI uses its matching installed browser.

This workspace stores its working Windows override in ignored `.env.test.local`, loaded by the Playwright configuration. It is local configuration and is not committed or used by CI.

Tests intentionally create fictional records in the demo database. Unit/integration tests use separate temporary directories. End-to-end tests use the running demo, so do not point them at an environment with real institutions or customers.

The CI workflow runs type checking, service tests, a production build, and the end-to-end suite. On failure it uploads browser traces.

Passing these tests is not a claim of production scale, legal compliance, independent security review, or WCAG certification. External PostgreSQL, SMTP deliverability, production storage, provider billing, load, and real-user performance need deployment-specific verification.
