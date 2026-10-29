# iOS Universal Link return

Prepared production URL for the VK ID iOS Universal Link field:
**`https://ios.omoba.ru/auth`**. Do not advertise it as active until the website,
DNS/TLS and newly signed iOS app have all been verified. No live rollout is
performed by this source change.

The current native VK login remains a web enrollment flow. Its OAuth callback
is still `https://omoba.ru/api/auth/vk/callback`; do not replace that callback
with the iOS return link. This feature does not install or configure a native
VK iOS SDK and never exchanges VK codes in the iOS app.

## Contract

- Production host `ios.omoba.ru`: `QSRX2Y2RJB.space.ekza.omoba.beta`.
- Dev host `ios.dev.omoba.io`: `QSRX2Y2RJB.space.ekza.omoba.dev`.
- `GET` and `HEAD /.well-known/apple-app-site-association` return JSON with only
  `/auth` associated. Ordinary site hosts, foreign hosts, other markets and the
  opposite contour return 404. Explicit local tests may use loopback.
- No cookies, authorization, upstream API call, query or redirect on the association
  endpoint. `/connect` and `/api/auth/vk/callback` stay in the browser.
- The completed `/connect` confirmation offers an ordinary cross-domain anchor
  to iPhone/iPad users. No Next router interception, automatic redirect, account
  id, device code, session or provider token travels in the link.
- `/auth` is an informational fallback for an absent/older app or an unavailable
  OS association. It never reports that a visitor has signed in.

The companion game change includes a UIKit main-nib delegate, exact URL policy
and per-contour entitlements. Foregrounding resumes the pending signed enrollment
poll. Opening the link itself cannot approve or switch an account.

## Concrete production activation, owner approval required

The RU website currently runs on `212.113.117.105`, Nginx to the standalone portal
on `127.0.0.1:3010`. Follow `docs/ru-nginx.md` for a new immutable website release.
The following additional changes are narrow, but remain production changes:

1. Add only `ios.omoba.ru` DNS A to `212.113.117.105`. Preserve all unrelated DNS.
2. Add an HTTP ACME webroot vhost for that host, obtain a certificate with the
   existing Certbot webroot mechanism and use a dedicated HTTPS vhost. The main
   site's TLS and routing need not change.
3. Proxy only the two exact locations to the existing portal, preserving
   `Host: ios.omoba.ru`. Everything else on this hostname returns 404. Use the
   existing query-free access-log format; do not log OAuth parameters.

```nginx
# Inside a dedicated HTTPS server for ios.omoba.ru, after TLS is configured:
location = /.well-known/apple-app-site-association {
    proxy_set_header Host ios.omoba.ru;
    proxy_pass http://127.0.0.1:3010;
}
location = /auth {
    proxy_set_header Host ios.omoba.ru;
    proxy_pass http://127.0.0.1:3010;
}
# Next assets used by the fallback page only. No account/API routes on this host.
location /_next/static/ {
    proxy_set_header Host ios.omoba.ru;
    proxy_pass http://127.0.0.1:3010;
}
location /brand/ {
    proxy_set_header Host ios.omoba.ru;
    proxy_pass http://127.0.0.1:3010;
}
location / { return 404; }
```

4. Verify DNS and certificate, 200 `application/json` with no redirects or cookies,
   exact App ID/path and HEAD behavior. Verify `/api/` is unavailable on the new
   hostname and existing login/callback behavior on `omoba.ru` is unchanged.
5. Enable Associated Domains on the existing Apple App ID, refresh its profile,
   then compile/install the new native source. Current local profiles lack the
   entitlement. No Apple credentials or profiles were changed here.
6. Check the link from Notes/a different domain on a physical iPhone, warm and
   cold starts, then the real VK confirmation and return from Safari. Safari keeps
   a same-domain link in the browser, hence the dedicated subdomain. Apple's CDN
   may delay association updates.

Dev uses its own DNS/TLS and app domain, with the `dev` runtime contour and RU
market. It must never reuse the production association. No dev deployment is
included either.

Full real-provider sign-in also requires the Account API and VK configuration.
The current guest deployment cannot be treated as an authenticated production
service merely because a Universal Link is published.

## Verification

`npm test`, `npm run typecheck`, a RU production build and direct HTTP checks of
the two routes (`OMOBA_IOS_HTTP_ORIGIN=http://127.0.0.1:3022 node
tests/ios-universal-links.http.mjs`). Unit checks cover market/contour/host isolation, exact App IDs,
HEAD/MIME/cookies, fixed return URL and the iOS-only completed-confirmation offer.
The companion game verifies the real Swift URL policy, device bridge compilation,
nib compilation, Xcode settings and provisioning/archive handling. These do not
replace the final signed-app/Apple-CDN/device check.
