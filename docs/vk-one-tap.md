# RU VK ID OneTap

The owner supplied VK ID web application **54863720**, registered with
`https://omoba.ru` as its redirect URL. The RU sign-in page now embeds the
ordinary OneTap widget, with VK, OK and Mail.ru alternatives. The floating overlay
is not used. `@vkid/sdk` is pinned to **2.6.1** in the lockfile and loaded from the
application bundle only on a configured RU sign-in screen. No unversioned CDN
script or literal `csp_nonce` placeholder is inserted.

## Account integration

The widget and all VK sign-in routes belong only to `OMOBA_MARKET=ru`.
`OMOBA_FEATURE_VK_SIGN_IN=off` disables them within RU; trying to enable VK in
`global` or `cn` fails configuration validation. A Russian interface language
does not select the RU account region or enable VK on the international portal.

Market and environment are separate settings. A Russian dev portal needs:

```text
OMOBA_CONTOUR=dev
OMOBA_MARKET=ru
OMOBA_FEATURE_VK_SIGN_IN=on
OMOBA_PORTAL_ORIGIN=https://dev.omoba.ru
OMOBA_ACCOUNT_API_URL=https://account.dev.omoba.ru
OMOBA_VKID_CLIENT_ID=<separately registered dev app id>
```

Build and start with the same market/features. Leave `OMOBA_SITE_URL` unset for
RU. The separate international dev portal keeps `OMOBA_MARKET=global`, VK off
and no VK app id. Production app 54863720 is registered for `https://omoba.ru`;
merging code into `dev` does not register a new provider redirect or deploy a site.

This boundary uses the account/service region. It does not currently geofence
players by IP: someone abroad can deliberately open the RU portal. A country
allowlist requires trusted ingress geolocation; browser language and arbitrary
request country headers must not be used as access control.

1. The client obtains the existing origin-bound CSRF proof and posts the intended
   local destination to `/api/auth/vk/one-tap/prepare`.
2. The BFF generates secure state and PKCE. The verifier and destination remain in
   a 600-second HttpOnly attempt cookie with a distinct `one-tap.` prefix. The
   browser receives only the app id, exact portal root, public challenge, state
   and `vkid.personal_info` scope. Legacy redirects cannot consume this cookie.
3. The SDK renders its own dark-theme widget and opens its provider window from
   the player's click. Callback mode returns an authorization code, device id and
   state. The browser never invokes `VKID.Auth.exchangeCode` or trusts provider
   tokens/user ids as an OMOBA login.
4. `/api/auth/vk/one-tap/complete` requires the same origin/CSRF proof, bounded
   JSON and the current attempt's state. Only code/device/state are accepted.
   The BFF forwards the code and its private verifier to the Account API.
5. The Account API accepts exactly the configured portal root for OneTap or its
   existing `/api/auth/vk/callback` for ordinary redirects. It exchanges the code,
   checks returned state, resolves the verified provider subject and creates the
   normal OMOBA browser session. Tokens never enter browser storage or the game.
6. Ordinary website entry registers a new profile with database-owned defaults.
   `/connect?code=...` keeps registration off: a new social identity must be linked
   by the active game's signature, preserving progress. Existing linked identities
   return to their existing profile. Native enrollment/approval semantics stay the same.

Success clears the attempt and pre-login CSRF/pairing authority. A lost/foreign
cookie, wrong state, reused code, provider outage or cancellation is a failure.
The destination is allowlisted server-side and preserved for retry. Unmounting
or changing the destination aborts pending widget requests and closes its frame.

The original redirect buttons remain in “Другие способы входа”. If configuration
or the SDK cannot start, they expand with retry. A fast-profile frame error keeps
the SDK's own ordinary authorization buttons working with the root callback.
The legacy buttons' existing callback needs its own allowed
redirect entry in VK ID; the OneTap root URL remains the one supplied by the owner.

## VK ID settings and activation

For the production application:

```text
App ID: 54863720
Site origin / OneTap redirect: https://omoba.ru
Additional redirect for ordinary fallback buttons: https://omoba.ru/api/auth/vk/callback
Scope: vkid.personal_info
```

Set `OMOBA_VKID_CLIENT_ID=54863720` on both the portal and Account API. No VK client
secret is needed for this public PKCE client. Preserve the Account API's existing
private `OMOBA_SOCIAL_SECRET`; first activation must provision one once and include
it in the existing secret backup procedure. Rotating it changes stored identities.

The current live RU website was read-only checked on 2026-10-29: it runs in guest
mode, the Account API is inactive and the game remains the older main release.
Live database versions are career `[1,2,3]` and portal `[1,2,3,4,5]`; this API
requires career `[1,2,3,4,5]` and portal `[1,2,3,4,5,6,7,9,10]`. The game/API
release and migration therefore have to be coordinated, not toggled independently.
Changing only the public App ID cannot enable working account registration.
Owner-approved activation must use compatible frozen portal/API/game contracts,
apply the release's existing migrations and grants, configure the service/ingress
and enable `OMOBA_ACCOUNT_MODE=enabled`. Do not attach this newer API to the older
database without that migration. This change adds no new SQL migration itself.
Follow `docs/ru-nginx.md` and the game's RU activation runbook; protect existing
game data and use the prepared release's rollback procedure.

Production configuration, credentials, services and DNS were not changed by this
implementation. The separate iOS Universal Link work is not a dependency of web
OneTap. Real VK, OK and Mail.ru owner-account checks remain an activation gate.

## Verification

- `npm test`, `npm run typecheck`, RU production build.
- `test:vk-sign-in` now runs the actual pinned SDK with a real RU Account API and
  PostgreSQL. Only the provider frames, grants and SDK telemetry are local doubles;
  no provider request leaves the test. It covers VK/OK/Mail registration, repeat
  identity, HttpOnly sessions, server PKCE exchange, CSRF, state, replay, strict
  bodies, existing progress, cross-tab review, provider failure and fallback.
- One Russian viewport, 852 x 393. Login/fallback screenshots and JSON evidence
  remain under `.agent/vk-sign-in/`. This is Chrome viewport emulation, not a
  physical iPhone or real-provider acceptance result.
- The companion Account API change runs its unit tests and explicit isolated
  PostgreSQL checks for root registration, game-first linking and callback binding.

Use the test's documented isolated database and port 3010, which the Account API
explicitly allows for loopback rehearsals. For the owner app id in the synthetic
test, set `OMOBA_E2E_VK_APP_ID=54863720`. Other fixtures may keep their fake app id.

Provider references: [official VK ID SDK](https://github.com/VKCOM/vkid-web-sdk),
[configuration type, including public codeChallenge](https://github.com/VKCOM/vkid-web-sdk/blob/master/src/core/config/types.ts).
