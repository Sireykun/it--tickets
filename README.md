# IT Help Desk — osTicket

Open http://localhost:8080/ for the customer portal.
Open http://localhost:8080/scp/ for staff sign-in.

Initial administrator email: admin@example.com
Initial administrator password: see OST_ADMIN_PASSWD in .env.
Change the administrator email to your real address in the staff profile after signing in. Email sending and mailbox fetching require your own mail settings.

## First setup on another computer
Copy .env.example to .env and replace every placeholder with a unique random value before starting. Existing installations must keep their original .env values.

## Start and stop
Run from this folder:

    docker compose up -d
    docker compose stop

Check status and recent logs:

    docker compose ps
    docker compose logs --tail 50 osticket

## Data
Tickets and configuration live in the database Docker volume. Uploaded attachments live in the attachments volume. Both survive container recreation. Keep .env: it contains database access and the application secret. Do not commit or share it.

Do not run `docker compose down -v`: it deletes the stored data.
Back up the database, attachments volume, and .env before upgrading or moving machines.

## Local access
The portal is bound to this computer at 127.0.0.1:8080. Network access, a public domain, HTTPS, and email delivery are not configured.

The application image is maintained by https://github.com/rinkp/osticket-dockerized and uses upstream osTicket. The image versions are pinned by digest after initial verification.
