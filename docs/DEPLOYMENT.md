# Deployment and operations

## Hosting

Deploy this application to a Node-capable host or container behind an HTTPS reverse proxy. WebSocket upgrades and long-lived connections must be supported. The custom Socket.IO server is not compatible with a static export or an unmodified Cloudflare Worker. No hosted deployment was created during this local repository build.

The supplied Dockerfile builds the application, runs as a non-root user, and starts the custom server. Provision PostgreSQL separately; `docker-compose.yml` supplies a local PostgreSQL service when Docker Desktop is available.

```powershell
$env:POSTGRES_PASSWORD = 'set-a-unique-password-here'
docker compose up -d postgres
```

Configure `DATABASE_URL` in your secret manager or ignored local `.env`, not source code. For production, use TLS according to the provider’s connection instructions and never disable certificate verification to bypass an error.

## Environment

| Variable                              | Production purpose                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV=production`                 | Enables secure cookies and administrative MFA enforcement                    |
| `APP_URL=https://your-domain.example` | Trusted origin; HTTPS is required at startup                                 |
| `DATABASE_URL`                        | Required external PostgreSQL connection                                      |
| `AUTH_ENCRYPTION_KEY`                 | 32 random bytes as 64 hex characters, protecting TOTP secrets                |
| `SMTP_URL`, `MAIL_FROM`               | Verified email delivery and recovery                                         |
| `DEMO_ENABLED=false`                  | Prevent fictional demo access on a real deployment                           |
| `HOSTNAME_BIND=0.0.0.0`               | Container/server bind address                                                |
| `PORT=3000`                           | Internal HTTP/WebSocket port                                                 |
| `DATA_DIR`                            | Persistent private volume for uploads and operational files                  |
| `TRUST_PROXY`                         | Enable only behind a controlled proxy that strips incoming forwarded headers |

Generate an encryption key using a trusted secret manager or `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` in a private terminal. Store and back up this key securely. Losing it prevents use of existing TOTP secrets.

## Release

1. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
2. Back up the existing production database and uploads.
3. Set environment variables, with demo disabled.
4. Apply `npm run db:migrate` once against PostgreSQL before starting new replicas.
5. Start `npm start`; route HTTPS and WebSocket upgrades to this server.
6. Verify `/api/health`, registration/email delivery, two-session messaging, access revocation, upload access, and rollback.
7. Register the initial administrator normally, verify email, then use `npm run admin:promote -- email@example.com` from a trusted administrative terminal. Enroll TOTP in account settings. Production administrative API access requires an MFA-verified session.

Do not run multiple production replicas yet. The current realtime layer is single-instance. A shared adapter/queue and storage architecture must be added and tested before scaling horizontally.

## Backup and restoration

Stop the local preview before standalone database scripts. `npm run db:backup` writes a local logical backup under `.data/backups/`, or invokes `pg_dump` for an external PostgreSQL connection. Production `pg_dump` must be installed on the execution host.

Local restoration is explicit:

```powershell
npm run dev:stop
npm run db:restore -- .data/backups/your-backup.json --confirm
npm run dev
```

The restore tool validates the format and preserves the current snapshot before atomically replacing it. Backups contain private account and session records; protect them like the database. Upload files and the TOTP encryption key require their own backup.

For PostgreSQL use your provider’s point-in-time recovery or `pg_restore` into a new database, then verify data before switching traffic. Rehearse restoration and define RPO/RTO before institutional launch. The provided local restart tests are not a production disaster recovery rehearsal.

## Before accepting real institutional data

- Review tenant isolation, moderation policy, safeguarding for younger users, verification evidence, retention, export/deletion, and jurisdiction-specific agreements.
- Configure encrypted disks/object storage, backup encryption, restricted file permissions, malware scanning, monitoring, alerts, and HTTPS termination.
- Implement the remaining object storage, background job, email digest, and provider integrations that the launch actually needs.
- Replace the development privacy/terms copy with reviewed agreements and remove demo fixtures.
- Run external PostgreSQL integration tests and realistic concurrency/load tests. Measure actual Core Web Vitals and representative phones; no scale or p75 performance claim is made by this release.

## Development recovery notes

An interrupted raw NodeFS PGlite instance exposed a WAL recovery failure during implementation. The original development directory was preserved. The active adapter now uses a memory-backed PostgreSQL engine and checksum-verified atomic logical snapshots, with a tested acknowledged-write restart path. Old `.data/postgres/` and diagnostic copies are not used by the active adapter. The production adapter always uses external PostgreSQL.
