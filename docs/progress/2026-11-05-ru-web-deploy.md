# RU website update: Hero tiers page and the published offer

The owner asked for the Russian release with donations and approved submitting the
`omoba.ru` shop to YooKassa moderation. Moderation reads the live site, so the website
on `omoba-ru-server` (`212.113.117.105`) moved from `dev` `c537e0d` to `dev`
`1bd2924e50b6eb057ba9fee129d4dedf6ca8d429` (PR #28 Hero tiers page, LR-67c; PR #29
seller requisites and the offer as edition 1). The source archive SHA-256 is
`55655e76d557c22ec5b5eabae651ad8e35ffc9e3fd6a0defc4f7edf55a301ccf`.

What changed for a visitor: `/supporter` shows the seven tiers with prices and the
custom amount without sign-in and says «Оплата скоро откроется…» while accounts stay
disabled; `/offer` is edition 1 (`status: final`, effective 2026-11-05, owner-approved
without counsel review) with the seller's name, ИНН, ОГРНИП, address, phone and e-mail;
`/privacy` and `/terms` remain `0-draft` with their banner. Runtime contour, market,
account mode (`disabled`) and the empty VK application id did not change; no account,
payment or download is simulated. The game service, its database and Nginx were not
touched (game PID 5426, binary hash unchanged).

Build: the same bounded Linux build as 2026-10-29 (vendor Node 24.22.2, restricted build
user, systemd-run with 1.8 GiB / 120 % CPU): `npm ci`, 236 unit tests passed (3 skipped),
typecheck, RU production build. Peak build memory 1.7 GiB, 3 min. Logs are under
`/var/backups/omoba-ru/web-20261105/` with the source archive, the previous `portal.env`,
unit file and `web-current` target.

Release: root-owned immutable `/opt/omoba-ru/web-releases/1bd2924-20261105` (85 MB;
`BUILD.json`, `FILES.sha256.json` with manifest SHA-256
`615988c0cf935b24e8228e7abf71f2b8b99d06b6372e576a20175489f1514384`), selected through
`web-current`; the service restarted once (`NRestarts=0` after, peak 105 MiB). The
previous release `c537e0d-20261029` is kept. Rollback:

    ln -sfn /opt/omoba-ru/web-releases/c537e0d-20261029 /opt/omoba-ru/web-current.new \
      && mv -Tf /opt/omoba-ru/web-current.new /opt/omoba-ru/web-current \
      && systemctl restart omoba-portal-ru

Verified from outside: `/`, `/supporter`, `/offer`, `/privacy`, `/terms`, `/delete`
answer 200; `/offer` renders `data-legal-version="1" data-legal-status="final"` and no
draft banner; the seven `data-price` values and the requisites are in the HTML;
`http://omoba.ru`, `http://www.omoba.ru` and `https://www.omoba.ru` redirect 308 to
`https://omoba.ru`; the certificate is valid to 2027-01-27.

YooKassa: live shop `omoba.ru` submitted (site `https://omoba.ru`, requisites page
`https://omoba.ru/offer`, ОКВЭД 62.01, category «Цифровые товары — игры»); the portal
answered «Заявка принята». The ShopID appears after moderation. Test shop
`Test (2), omoba.ru` 1519761 already has the webhook
`https://account.omoba.ru/v1/supporter/yookassa/notifications` and receipt checks.
Still owner-only: API keys (never handled by agents), the real VK ID application, DNS for
`account.omoba.ru`/`lobby.omoba.ru`, the Account API deployment that turns payments on.
