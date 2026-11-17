# YouConect 3.0

A working social and organizational application with a public website, one personal identity, separate organization memberships, and a unified inbox. This is a **development release**, with a substantial functional core and an explicit completion report. It is not yet approved for real institutional deployment.

## Run locally

Requirements: Node.js 22.20 or later and npm. Docker and external accounts are not needed for the local demo.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open [YouConect](http://localhost:3000) or [the working demo](http://localhost:3000/demo). Choose Ayla, Zara, Omar, or Daniel. All demo organizations, people, posts, and verification states are fictional. Changes are actually saved.

Use a second browser profile with another demo person to exchange messages between independent authenticated sessions. Multiple tabs in the same browser profile share a session cookie.

To stop the preview cleanly from another terminal:

```powershell
npm run dev:stop
```

The ordinary terminal Ctrl+C shutdown is also supported. Local data lives in ignored `.data/`. An exclusive lock prevents two processes from opening the same local database. Database scripts should run while the preview is stopped.

## What works

- Registration, email verification, password recovery, onboarding, secure sessions, logout, and encrypted TOTP enrollment with single-use recovery codes.
- Public and organization feeds, publishing, media/document uploads, polls, reactions, saves, editing, reporting, comments, and replies.
- Organization discovery and verification requests, membership approval/suspension, scoped roles, departments, channels, and organization switching.
- Community discovery, creation, and joining; independent and organization-owned spaces.
- Direct/group/channel conversations, authenticated Socket.IO delivery, persistence before acknowledgment, deduplication, reply/edit/delete, reactions, attachments, typing, read state, and a retryable local outbox.
- Bilateral Bridge approval, explicit participant access, shared feeds, and revocation.
- Events with capacity-safe registration and calendar export; opportunities with saved listings and internal applications.
- Organization administration, platform verification and moderation, actual record counts, audit logs, plan limits, invoice requests, and manual payment reconciliation.
- Responsive layouts, a mobile inbox, command search, light/dark/system themes, privacy controls, account export, and account deletion after ownership transfer.

See [the completion report](docs/FEATURE_REPORT.md) for the boundaries of each implementation and the remaining work. For example, this release does not claim calling, short-video delivery, external AI, S3 uploads, or automated payment processing.

## Storage and services

**Local:** PostgreSQL runs in-process through PGlite. Committed application records are captured in checksum-verified, atomic logical snapshots before write acknowledgments. A previous snapshot is retained. This avoids raw NodeFS WAL recovery problems on abrupt Windows restarts. It is a development fallback intended for small datasets, not a production database service.

**Production:** set `DATABASE_URL` to a real PostgreSQL server. The `pg` adapter uses the same parameterized PostgreSQL queries and migrations. Production startup refuses to use the development database. Deployment, backups, TLS, SMTP, and secret configuration are described in [deployment instructions](docs/DEPLOYMENT.md).

**Email:** without SMTP, development messages are written to `.data/mail-outbox.jsonl`, and a clearly labeled development link appears after registration/recovery. No external email is claimed. Production registration requires SMTP configuration.

**Uploads:** JPEG, PNG, WebP, and PDF files, 5 MB each; byte signatures are checked. Private files are served through an authorized API, not public disk paths. The current storage adapter uses a persistent local volume. Object storage and malware scanning remain deployment work.

**Payments and AI:** invoice requests do not charge money. No payment gateway or external AI provider is called.

## Commands

| Command                                               | Purpose                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                                         | Start Next.js and Socket.IO on the same server                                 |
| `npm run dev:stop`                                    | Stop the owned local preview cleanly                                           |
| `npm run build`                                       | Compile and type-check the production application                              |
| `npm start`                                           | Start production; requires PostgreSQL and HTTPS origin configuration           |
| `npm run typecheck`                                   | Check application, scripts, and tests                                          |
| `npm test`                                            | Unit, integration, authorization, MFA, and restart durability tests            |
| `npm run test:e2e`                                    | Browser, two-session HTTP, and actual WebSocket tests; preview must be running |
| `npm run db:migrate`                                  | Apply versioned migrations; stop local preview first                           |
| `npm run db:seed`                                     | Add fictional demo fixtures when enabled                                       |
| `npm run db:backup`                                   | Local logical snapshot or external `pg_dump` backup                            |
| `npm run db:restore -- path/to/backup.json --confirm` | Restore a local snapshot after preserving the current one                      |
| `npm run admin:promote -- email@example.com`          | Bootstrap a verified platform administrator from a trusted terminal            |

## Project map

- `app/`: public routes, authenticated application entry point, and API routing.
- `components/`: shared UI, app shell, and feature screens.
- `lib/`: authentication, policy, services, typed domain models, and data access.
- `migrations/`: PostgreSQL schema and versioned changes.
- `tests/`: service/authorization tests, persistence restart tests, and Playwright workflows.
- `scripts/`: migrations, backup/restore, development controls, and verification helpers.

Read [architecture](docs/ARCHITECTURE.md), [API reference](docs/API.md), [design system](docs/DESIGN_SYSTEM.md), [testing](docs/TESTING.md), and [deployment](docs/DEPLOYMENT.md).

The workspace was empty when implementation started. No pre-existing application, customer records, or business logic was migrated or replaced.
