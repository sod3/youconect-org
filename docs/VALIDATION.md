# Validation record

Verified locally on 17 November 2026 using Node.js 22.20.0 on Windows.

| Check                             | Result                      | Scope                                                                                                                                   |
| --------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                        | Passed                      | Application, server, scripts and tests                                                                                                  |
| Production build                  | Passed                      | Next.js 16.4.6 optimized build                                                                                                          |
| Unit/integration/durability suite | 24 passed                   | Authentication, scoped authorization, social flows, messaging, concurrency, Bridges, uploads, MFA, billing state and restart durability |
| Playwright workflows              | 5 passed                    | Public routes, desktop publishing/RSVP, registration/approval, real two-session sockets and mobile inbox/refresh                        |
| Dependency audit                  | No vulnerabilities reported | Installed dependency graph at verification time                                                                                         |
| Desktop/mobile visual review      | Performed                   | Light/dark themes and responsive application; screenshots below                                                                         |
| Preview lifecycle                 | Passed                      | Saved data restored after restart; clean shutdown exited and released the local database lock                                           |

The Windows browser suite used an installed Chromium headless executable through the documented `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override. The newly downloaded full Chromium executable initially failed to launch on this machine. This did not bypass a browser security warning or skip the browser tests.

[Desktop capture](preview-desktop.png) · [Mobile capture](preview-mobile.png)

## Measured development API timings

Raw samples and environment details are in [PERFORMANCE.json](PERFORMANCE.json). With a small fictional dataset, measured median HTTP timings were 317 ms for the feed, 315 ms for search, 319 ms for an organization and 325 ms for conversation history. One durable message write took 508 ms. Ten concurrent permitted feed reads all succeeded in 2,469 ms total. Login took 1,728 ms in that run.

These measurements include a local development server and development persistence. They are not production benchmarks, p75 Core Web Vitals, or evidence of institutional-scale load capacity. External PostgreSQL, SMTP, provider integrations and production disaster recovery have not been verified in this workspace.

See [FEATURE_REPORT.md](FEATURE_REPORT.md) for the complete implementation/configuration/partial/later-phase matrix.
