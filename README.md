# IT Tickets

This project runs the copied osTicket source in
[`osTicket-develop-patches/`](osTicket-develop-patches/). Docker builds that
source into the PHP image and starts it with a fresh MariaDB database.

## Run

Copy `.env.example` to `.env`, set strong values, then run:

```powershell
docker compose up -d --build
docker compose ps
```

- Requester portal: http://localhost:8081/
- Staff and admin login: http://localhost:8081/scp/
- Phone on the same network: `http://YOUR-COMPUTER-LAN-IP:8081/scp/`

For phone access, set `OST_HELPDESK_URL` in `.env` to the reachable LAN URL
and restart the service. Allow port 8081 through the host firewall if needed.
Use HTTPS before exposing the service outside a trusted network.

The `source_database` and `source_attachments` Docker volumes store tickets
and attachments. Back up both volumes and `.env` before moving or upgrading.
`docker compose down -v` deletes the stored tickets and attachments.

## Source layout

The copied osTicket tree retains its original structure: `scp/` for the staff
panel, `include/` for PHP classes and templates, `css/` and `js/` for assets,
`api/` for API routes, and `setup/` for installation. The container removes
`setup/` after installing. Change the copied source and rebuild with
`docker compose up -d --build` to apply edits.

## VS Code GitHub buttons

The local [IT Desk Git Buttons](vscode-git-buttons/README.md) extension adds
Pull and Push buttons to the VS Code status bar. This folder's `origin` remote
is `https://github.com/Sireykun/it--tickets.git`.
