# Deployment

Production runs from `docker-compose.prod.yml` on one Linux host with Docker:

| Service | What it does |
|---|---|
| `db` | PostgreSQL 17 (`pgdata` volume) |
| `migrate` | Runs `prisma migrate deploy`, then exits. `web` and `worker` start after it succeeds. |
| `web` | `next start` on port 3000, reachable only through Caddy. Healthcheck: `GET /api/health`. |
| `worker` | Sends email, reads the helpdesk inbox, and every minute requeues stuck email, sends SLA-overdue alerts and clears old ticket locks. Healthcheck: heartbeat file. |
| `caddy` | HTTPS on 80/443 with an automatic certificate for `APP_DOMAIN` |
| `backup` | Nightly `pg_dump` plus an uploads archive into `BACKUP_DIR`, kept `BACKUP_KEEP_DAYS` days |

## First start

1. Point the DNS name for `APP_DOMAIN` at the host and open ports 80 and 443. Caddy needs both to get a certificate.
2. `cp env.prod.example .env.prod` and fill it in. Generate each secret with `openssl rand -hex 32`.
3. Start everything:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
   ```
4. Create the shared settings and the first superadmin (safe to re-run; it adds no sample accounts in production):
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate npm run db:seed
   ```
   Then remove `SEED_ADMIN_PASSWORD` from `.env.prod` and change the password after signing in.
5. Check: `curl https://<APP_DOMAIN>/api/health` returns `{"status":"ok"}`, and `docker compose -f docker-compose.prod.yml ps` shows `web` and `worker` as healthy.

If the help desk is only reachable inside the school network, Caddy can't get a public certificate. Use `tls internal` in the `Caddyfile`, or put the app behind the school's existing reverse proxy.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

`migrate` applies new migrations before the new `web` and `worker` start.

## Backups

- By default they run at 19:00 UTC (02:00 in Phnom Penh). Run one now with:
  ```bash
  docker compose -f docker-compose.prod.yml --env-file .env.prod exec backup sh /usr/local/bin/backup.sh
  ```
- Each run writes `db-<time>.dump` and `uploads-<time>.tar.gz` into `BACKUP_DIR`.
- **Copy `BACKUP_DIR` to another machine or cloud storage every day.** A backup on the same disk doesn't survive that disk failing.

## Restore

Stop the app so nothing writes during the restore, restore the database and files, then start again:

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env.prod"
$C stop web worker
$C exec backup sh -c 'dropdb --if-exists "$PGDATABASE" && createdb "$PGDATABASE" && pg_restore --no-owner -d "$PGDATABASE" /backups/db-<time>.dump'
$C run --rm --no-deps -u root -v "$PWD/backups:/backups:ro" web sh -c 'rm -rf /data/uploads/* && tar -xzf /backups/uploads-<time>.tar.gz -C /data && chown -R node:node /data/uploads'
$C up -d
```

Test a restore once, before you need one.

## Email problems

Email that fails 5 times is marked failed. Superadmins can see it under **Admin → Email → Failed** and retry one or all of it there once the cause (for example an expired app password) is fixed.
