# CIA IT Ticket System — Architecture

_Snapshot of `main` as of 2026-11-01. Sections 1–4 describe the system as built; sections 5–7 are trade-offs, risks and a recommended roadmap._

## 1. Requirements (inferred)

**Functional**
- Requesters (students and staff on `@ciaschool.edu.kh`) open tickets on the web or by email, reply, add CCs, close and reopen, and give kudos.
- Agents work the queue for their campuses: replies, internal notes, assignment, links, merges, tasks, canned replies, reports and CSV export.
- Campus admins manage users at campuses where they hold `users.manage`. Superadmins own all shared settings: SLA, help topics, departments, teams, templates, the knowledge base and campuses.
- Email both ways: outbound notifications and inbound replies or new tickets, threaded by signed Message-IDs.
- Full audit trail of every change.

**Non-functional assumptions** (please correct if wrong)
- Scale: one school with 4 campuses, about 2–5k users and 50–300 tickets a day. Peak load is bursts at term start and after outages.
- Availability: business hours matter most. A few minutes of downtime is acceptable; losing data is not.
- Latency: pages under 500 ms. Email within about 1 minute.
- Team: 1–2 developers, Windows hosts, Docker-first.

**Constraints**
- Node runs only in Docker.
- osTicket features must be re-implemented, never copied (GPL).
- Google Workspace provides mail and SSO.

---

## 2. High-level design

```
                 Browser (desktop / iPhone)
                        │  HTTPS
                        ▼
 ┌──────────────── web: Next.js 16 (App Router) ────────────────┐
 │ proxy.ts (cookie gate) → pages / server actions / API routes │
 │        └─ src/server/*  (authz, roles, tickets, admin, …)    │
 │             • every mutation: $transaction{ change + audit   │
 │               + notify*() → email_outbox rows }              │
 └──────────────┬───────────────────────────────┬───────────────┘
                │ Prisma 7 (pg adapter)         │ fs
                ▼                               ▼
        PostgreSQL 17                    uploads volume (local disk)
   (tickets, users, campuses,
    audit_events, email_outbox,
    inbound_emails, …)
                ▲
                │ SKIP LOCKED claim / insert
 ┌──────────────┴──── worker (tsx src/worker/index.ts) ──────────┐
 │ loop A (5s): outbox → SMTP (nodemailer) → Google Workspace     │
 │ loop B (30s): IMAP poll UNSEEN → processInbound → ticket/reply │
 └────────────────────────────────────────────────────────────────┘
```

**Request path:** `proxy.ts` only checks that the cookie exists. Each page or action calls `requireUser/requireStaff/requireUserManager/requireSuperadmin` (`src/server/authz.ts`), which reloads the user and campus scope from the database on every request. `src/server/*` then applies campus scope again with `canViewTicket`, `canWorkTicket` and `campusWhere` (`src/server/roles.ts`, `src/server/tickets.ts:15`).

**Write path:** one Prisma transaction holds the domain change, `audit(tx, …)` (`src/server/audit.ts`) and `notify*()` outbox rows (`src/server/email/notify.ts`). This is a transactional outbox, so no email is sent for a change that rolled back and none is lost for a change that committed.

**Email in:** an IMAP poll picks up mail. `processInbound` de-duplicates by Message-ID and checks `isAutomated` for loops. It matches the ticket by signed token first, then by `[TKT-…]` subject tag plus sender membership. A reply to a closed ticket opens a new linked ticket.

---

## 3. Deep dive

### 3.1 Data model
- Ids are `uuid(7)`, which are time-ordered and friendly to indexes. Timestamps are `Timestamptz(3)`.
- Key tables: `Ticket` (DB sequence `TKT-000001`, `priorityLevel` set by trigger), `TicketThread` (message, reply, note, system event), `Attachment` (metadata only, with sha256), `Campus` and `StaffCampus(permissions[])`, `EmailOutbox`, `InboundEmail` (unique messageId), `AuditEvent` (Json data).
- Integrity lives in the database: CHECK constraints (lowercase email, SLA hours > 0, no self-links), the ticket-number sequence and the priority trigger.
- Indexes fit the queue's access patterns: (campusId, status), (status, priorityLevel), (assignedAgentId, status), (assignedTeamId, status).
- **Gap:** queue search uses `contains … insensitive` on subject and requester fields. That is a sequential scan, fine below about 100k tickets.

### 3.2 AuthN / AuthZ
- next-auth v5 with 7-day JWTs. Credentials use bcrypt plus a dummy hash so timing doesn't reveal valid emails. Google sign-in requires a verified email and the `hd` domain.
- Reloading the user on every request means revoking a role or campus applies at once. The trade-off is one extra query per request, which is acceptable.
- Defense in depth: route guards plus checks in the server layer, tested without HTTP (`tests/fixtures.ts` `makeUser`).
- **Gaps:** login rate limiting is in memory (`src/server/rate-limit.ts`), so it resets on restart and isn't shared across instances. JWT sessions can't be revoked individually; deactivation still works because `loadAppUser` checks `isActive`.

### 3.3 Email pipeline
- Outbox claim: `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, batches of 20, sent one at a time. Backoff is 1, 2, 4 and 8 minutes, then `FAILED` after 5 attempts.
- Inbound: a new IMAP connection on each poll, UNSEEN only, flagged `\Seen` after processing. Idempotent through the unique Message-ID.
- **Gaps:**
  1. `requeueStuck()` runs only at worker startup, so a row left in `SENDING` by a hung send waits for the next restart.
  2. There is no admin action to retry `FAILED` rows, and the email page shows only the latest 25.
  3. If the message fails after being read and the row is marked FAILED, nothing retries it.
  4. Nothing removes old rows from `email_outbox` and `inbound_emails`.

### 3.4 Files
- `FileStorage` interface with a `LocalDiskStorage` implementation. Keys look like `YYYY/MM/<uuid>`, writes are exclusive (`wx`), and paths are guarded against traversal.
- `withStoredFiles` deletes orphaned files if the database write fails.
- Downloads are served with a sandbox CSP and `nosniff`. Only raster images are shown inline, and a missing file and a file you can't access both return 404.
- The interface is the right seam. Moving to S3 or GCS later means one new class.

### 3.5 Background work
- Only the email worker. SLA due dates are set when a ticket is created, and "overdue" is a read-time filter. **Nothing notifies anyone when a ticket breaches SLA**, and there is no auto-close for resolved tickets and no lock sweeper. Expired locks are harmless but pile up.

### 3.6 Caching and pagination
- No data cache. React `cache()` covers the current user, and `revalidatePath` runs after writes.
- Pagination is offset-based (50 per page), with hard caps elsewhere (my tickets 100, users 200). Both are fine at the expected scale.

### 3.7 Theming (on `feature/themes-main`, not yet merged)
- `users.color_mode` holds light, dark or system, enforced by a CHECK constraint. The accent color stays in `themePreference`.
- Resolution order is account setting, then cookie, then system default. The server renders `<html data-theme>`, so the page doesn't flash the wrong theme.
- The cookie is cleared on logout so the next person on a shared PC doesn't inherit it. Changes are audited.

### 3.8 Testing
- Vitest uses a separate `_test` database, reset on each run. There are 15 files, including email.
- Playwright runs against the live dev server on desktop and iPhone, with GreenMail for email. There are 9 specs.
- Tests are strong for the business layer. Nothing runs them automatically because there is no CI.

---

## 4. Scale and reliability

**Load estimate:** 300 tickets a day × about 6 thread entries is roughly 2k writes a day, under 0.1 writes per second. Even 10× that is trivial for a single Postgres. The expected bottlenecks are operational (deploys, backups, mail-provider limits), not throughput.

**Scaling path:**

| Stage | Trigger | Change |
|---|---|---|
| Now | — | 1 web + 1 worker + 1 Postgres on one host |
| 2 web instances | HA, or CPU saturation | Move the rate limit to Postgres or Redis. Put uploads on shared storage (S3, GCS or NFS) through `FileStorage`. Sticky sessions are not needed because sessions are JWTs. |
| Multiple workers | Already safe for the outbox (SKIP LOCKED) | Inbound IMAP must stay a single runner (take a Postgres advisory lock). |
| Search | Queue gets slow, roughly 100k+ tickets | `pg_trgm` GIN indexes on subject and requester name/email, or a `tsvector` column |
| Archival | Audit, outbox or inbound tables reach millions of rows | Retention job, partitioning `audit_events` by month |

**Single points of failure today:** the one host, the one Postgres with **no backups** (the `backups/` folder is empty), and the local uploads volume.

**Monitoring today:** none. The worker logs with `console.log`. There is no health endpoint and no error tracking.

---

## 5. Trade-off analysis

| Decision | Benefit | Cost | Verdict |
|---|---|---|---|
| Monolith: Next.js, server actions and a server layer | One codebase, fast for a small team, types flow end to end | Web and business logic deploy together | Keep |
| Postgres as the queue (outbox) | Atomic with the business change, no extra infrastructure | Polling latency (5s); table grows | Keep. Add retention. |
| IMAP polling instead of webhooks | Works with Google Workspace and no public endpoint needed | Up to 30s delay, a new connection every poll | Keep. IMAP IDLE is optional later. |
| JWT sessions plus a DB reload per request | Stateless, but revocation still applies at once | One query per request | Keep |
| Authz in the server layer, not routes | Testable, hard to bypass | Must be repeated for every new query | Keep. Enforced by the CLAUDE.md rules. |
| Local disk uploads | Simple | Blocks multi-instance setups and complicates backups | Revisit at the HA stage |
| In-memory rate limit | No dependency | Resets on restart, single instance only | Fix before production |
| Offset pagination, ILIKE search | Simple | Degrades on large tables | Fine for years at this scale |
| Read-time SLA | No scheduler needed | No proactive alerts | Add a sweeper (see §7) |

---

## 6. Risks, ranked
1. **No production deployment path.** Compose runs `next dev`, and there is no production Dockerfile stage, no CI and no TLS or reverse-proxy config.
2. **No database or upload backups.** One disk failure loses everything.
3. **Dev secrets are written into `docker-compose.yml`.** Production needs a separate env or secrets source.
4. **No SLA breach alerts.** The SLA feature exists, but nothing reminds anyone when a ticket goes overdue.
5. **Email dead letters are invisible.** FAILED rows can't be retried, and stuck SENDING rows recover only when the worker restarts.
6. **No observability.** No health endpoints and no error tracking.
7. Unbounded table growth: outbox, inbound, audit and expired locks.

---

## 7. Recommended roadmap (what to revisit as it grows)

**P0, before production**
- Multi-stage `Dockerfile` (`npm ci && next build`, then `next start` with standalone output). Add a `docker-compose.prod.yml` with a reverse proxy (Caddy for automatic TLS), env from `.env.prod`, healthchecks and `restart: unless-stopped`.
- Nightly `pg_dump` plus an uploads tarball to off-host storage, keeping 14 days. Test a restore once.
- `/api/health`, which runs `SELECT 1`, plus a worker heartbeat. Container healthchecks use them.
- CI with GitHub Actions: typecheck, Vitest against a Postgres service container, then build.

**P1, first months**
- Add a third worker loop, a "maintenance" loop that runs every minute:
  - run `requeueStuck` (not only at startup)
  - queue SLA-breach notifications through the existing `notify*` functions
  - delete expired `ticket_locks`
  - auto-close resolved tickets (if wanted)
- Admin "retry" action for FAILED outbox rows, with filters on the email page.
- Move the rate limit to Postgres (a `rate_limits` table with an upsert).
- Structured logging (pino) and error tracking (Sentry, or a self-hosted GlitchTip).

**P2, when the triggers in §4 occur**
- Object storage behind `FileStorage`, plus a second web instance.
- `pg_trgm` search indexes.
- A retention or partitioning policy for `audit_events`, `email_outbox` and `inbound_emails`.
- An advisory lock around inbound IMAP if the worker is scaled out.

