# Project Instructions

CIA IT Ticket System: Next.js 16 (App Router) + Prisma 7 + PostgreSQL 17, all run through Docker.
Requester portal at `/`, staff console at `/staff`, admin settings at `/staff/admin/*`.

Node is not installed on the host. Run all npm/Prisma commands through the `app` container.

## Commands

```bash
docker compose up -d db web worker mail           # Postgres (5433), app (3000), email worker, dev mail server (API on 8025)
docker compose logs -f worker                      # outbox sends and inbox processing results
docker compose run --rm app npm install            # install deps into the node_modules volume
docker compose run --rm app npx prisma migrate dev # apply migrations (add --name x --create-only for a new one)
docker compose run --rm app npx prisma generate    # regenerate client into src/generated/prisma
docker compose run --rm app npm run db:seed        # idempotent seed (admin + sample agent/student in dev)
docker compose run --rm app npm test               # Vitest; resets and uses the separate ticketdb_test database
docker compose run --rm app npm run typecheck      # run `npx next typegen` first on a fresh checkout
docker compose run --rm e2e                        # Playwright (desktop + iPhone) against the running web service
docker compose run --rm app npm run db:reset       # drop and re-migrate the dev DB (then run db:seed)
```

**Hot reload doesn't see edits made on Windows** (Turbopack ignores polling on the bind mount). After changing code, run `docker compose restart web worker` before testing in the browser or running e2e; otherwise you're testing stale code.

Dev logins (dev seed only): the admin uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; the requester uses `SEED_REQUESTER_EMAIL` / `SEED_REQUESTER_PASSWORD` (falling back to `student@ciaschool.edu.kh` / `SEED_SAMPLE_PASSWORD`). Agents use the sample credentials in `docker-compose.yml`. This checkout's ignored `.env` maps the previous local admin and requester credentials. The seed creates 4 placeholder campuses only if none exist, so renames survive re-seeding.

## Rules

- Authorization lives in `src/server/` (`tickets.ts`, `admin.ts`, `roles.ts`), not just in routes. Pages and actions call `requireUser/requireStaff/requireAdmin` from `src/server/authz.ts`; `src/proxy.ts` is only a cookie gate.
- Business logic takes the acting user as an argument so it can be tested without a request (see `tests/tickets.test.ts`).
- Every mutation in `src/server/*` writes an `AuditEvent` via `audit(tx, …)` (`src/server/audit.ts`), inside the same transaction.
- Forms whose action calls `revalidatePath("/staff", "layout")` get remounted, so show success via a redirect with `?saved=1`, not action state.
- `datetime-local` inputs are in the school timezone: parse/format with `src/lib/time.ts`, never `new Date(value)`.
- osTicket parity features are re-implemented, never copied (osTicket is GPL).
- Never pass raw `User` rows to client components (they contain `passwordHash`); pick fields explicitly.
- Hand-written SQL lives in migrations: ticket-number sequence, `priority_level` trigger, CHECK constraints (incl. lowercase emails). Keep them when editing migrations.
- Email: never send directly. Queue it with the `notify*` functions in `src/server/email/notify.ts` inside the same transaction as the change; the worker sends it. Inside a transaction, run queries sequentially (no `Promise.all` on `tx`).
- Inbound email matches tickets by signed Message-ID tokens (`src/server/email/tokens.ts`), with the `[TKT-…]` subject tag as a fallback that also requires the sender to be on the ticket. Keep the auto-reply checks in `isAutomated` to prevent mail loops.
- Campuses: roles are USER < AGENT < ADMIN (campus admin) < SUPERADMIN. Staff work only at the campuses in `StaffCampus`; `AppUser.campusScope` is `"all"` for superadmins. Every ticket query/mutation for staff must respect it (`canViewTicket`/`canWorkTicket`/`inScope` in `src/server/roles.ts`, `campusWhere` in `tickets.ts`); pass `campusId` and `collaborators` when checking.
- The only grantable campus permission is `"users.manage"` (`CAMPUS_PERMISSIONS`); only superadmins grant it. All shared settings, campuses and CSV export are superadmin-only (`requireSuperadmin`); the Users page uses `requireUserManager`.
- Build test users with `tests/fixtures.ts` `makeUser` (real `StaffCampus` rows, loaded via `loadAppUser`), never hand-written `AppUser` objects.
- Config comes from `docker-compose.yml` environment. An ignored local `.env` may supply seed logins and Google credentials to Compose. Google sign-in turns on when `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set on the host.
