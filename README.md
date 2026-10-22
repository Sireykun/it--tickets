# CIA FIRST IT Help Desk

This is the Next.js help desk from the `nextjs-helpdesk` branch, merged with the local CIA FIRST branding and login changes. It has a requester portal, a mobile-friendly staff console, campus settings, ticket threads, attachments, email processing, and Google login support.

## Run locally

```powershell
docker compose up -d --build db mail
docker compose run --rm app npm ci
docker compose run --rm app npx prisma migrate deploy
docker compose run --rm app npm run db:seed
docker compose up -d web worker
```

Open <http://localhost:3000>. Staff use `/staff`; superadmins use `/staff/admin`. The development accounts and passwords are defined in `docker-compose.yml`. This checkout also maps the previous local admin and temporary requester logins through an ignored `.env` file. Change development passwords before using the app beyond a trusted machine.

Docker runs PostgreSQL for this app. Its data lives in the `pgdata` volume; uploaded files live in `uploads`. The earlier osTicket MariaDB volumes and its running container are separate and are not removed by this merge. Existing osTicket tickets do not automatically appear in the Next.js database.

## Google login

Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` on the host or in a local, ignored `.env` file, then restart `web`. The Google OAuth callback for this app is `http://localhost:3000/api/auth/callback/google`. Add that exact URI in Google Cloud. The Google button appears only when both values are set. The local email/password form remains available for requester and staff accounts.

## Development

```powershell
docker compose run --rm app npm test
docker compose run --rm app npm run typecheck
docker compose run --rm app npm run build
```

See `CLAUDE.md` for the app layout, data rules, and Docker workflows. The prior local osTicket code is preserved on the `codex/osticket-before-nextjs` branch.

The [VS Code Git buttons](vscode-git-buttons/README.md) extension remains available for one-click Pull and Push with this repository.
