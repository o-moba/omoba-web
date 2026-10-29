# RU website on the single VPS

The owner authorized the first public website at `https://omoba.ru` on
`omoba-ru-server` (`212.113.117.105`) from a frozen `dev` commit. Its runtime contour
is **production**, market **ru**. A source branch is not a runtime contour.

Nginx terminates HTTPS and proxies to the standalone Node process on
`127.0.0.1:3010`. `www.omoba.ru` redirects to the canonical domain. PostgreSQL and
the existing game remain on the same VPS; this website deployment does not migrate
their schemas, change game binaries or restart the lobby.

Accounts are explicitly disabled and the VK application id is an empty placeholder.
The landing and public/local workshop are available; login/account/download pages
show the existing guest-mode explanation. The game download catalogue remains empty
until compatible verified artifacts and the Account API are activated. Real social
login must not be simulated or advertised as working.

## Build and activate

1. Export tracked files from an exact clean `dev` commit. Record its SHA and archive
   hash; exclude local environments, `.agent`, build output and Git metadata.
2. Install Ubuntu's official `nginx` and `certbot` packages. Install the official
   Node.js 24 LTS Linux archive under `/opt/omoba-ru/node-releases/`, verifying its
   SHA-256 against the vendor's HTTPS manifest, and select it with `node-current`.
   Ubuntu's Node package omits the TypeScript support used by the test suite.
   Build natively on Linux to package the correct Next/SWC/sharp architecture. Use a
   restricted build user with a bounded systemd scope (1.8 GiB memory, 120% CPU and
   1 GiB Node heap); never build Rust on this production host.
3. Use `ops/ru-nginx/portal.env.example` for the build and runtime. Run `npm ci`,
   tests in a clean environment, then typecheck and `npm run build` with the RU
   environment. General unit tests intentionally exercise default/global settings.
   Read the bundled Next.js self-hosting and
   standalone documentation before changing packaging. Package `.next/standalone`,
   copy `.next/static` and `public` into it, retaining traced legal documents.
4. Install a root-owned immutable release in `/opt/omoba-ru/web-releases/<source>`.
   Its `.next/cache` points to `/var/cache/omoba-portal-ru`, writable only by the
   `omoba-portal-ru` runtime user. Keep the release readable but not writable by it.
5. Save prior affected configuration under `/var/backups/omoba-ru/web-<date>`.
   Install the private runtime environment at `/opt/omoba-ru/portal.env`, the unit
   at `/etc/systemd/system/omoba-portal-ru.service`, and atomically select the release
   with `/opt/omoba-ru/web-current`. Enable/start the service. It has a 512 MiB memory
   cap, one-CPU quota, restart policy and restricted filesystem permissions.
6. Install `http.conf` as `/etc/nginx/sites-available/omoba-ru`, disable the package's
   default site, test Nginx configuration, then enable HTTP/HTTPS in UFW. Verify the
   host-directed HTTP request before changing public DNS. Access logs omit query
   strings so future OAuth callback parameters are not written there.
7. Change only the REG.RU `@` and `www` A records to the VPS address. Preserve
   nameservers and unrelated records. Save old values and verify authoritative DNS.
8. Obtain the certificate with Certbot webroot `/var/www/letsencrypt` for `omoba.ru`
   and `www.omoba.ru`. Replace the bootstrap vhost with `https.conf`, run `nginx -t`
   and reload. A Certbot deploy hook tests/reloads Nginx on renewal. Enable the
   Certbot timer and prove renewal with `certbot renew --dry-run`.

## Verify and roll back

Verify DNS, certificate hostname/chain/expiry, HTTP and www redirects, the landing,
core assets, legal pages, workshop and truthful unavailable account/download pages.
Check account/VK API refusal, loopback-only app/DB sockets, service autostart/restart
and actual game PID/start time/binary hash against the saved baseline. Keep compile,
browser and physical-device testing distinct.

For later website updates, build a new immutable directory and keep the previous
one. Rollback changes `web-current` to that previous release, restarts only the
website and checks the landing through Nginx. The first activation has no previous
website release: stop/disable only `omoba-portal-ru`, restore saved web configuration
and optionally restore the saved web A records. Preserve all game/database state.

Enabling accounts requires a coordinated approved game/API migration and matching
client contract, real VK app/callback configuration and real-provider/device tests.
Do not attach dev's newer Account API to the old main database: its exact schema
validation is incompatible. This delivery does not switch global Vercel or dev VPS
services and creates no CI deployment trigger.
