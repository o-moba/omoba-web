# Market

`/market` lists free community weapons and avatars approved for OMOBA and lets a player add them to their Ekza library in place. The Ekza library in the Registry (`studio.grants`) is the only ownership record; the portal keeps no ledger. The route does not use the OMOBA Account API, so it works in the public guest deployment (`OMOBA_ACCOUNT_MODE=disabled`).

## Catalogue

The page is server-rendered on every request from `GET {registry}/v2/assets?project=omoba` (`ekza.asset.catalog.v2`). `src/lib/market-server.mjs` uses the fixed origin, refuses redirects, allows 5 s including the body and reads at most 2 MiB. `src/lib/market.mjs` parses strictly and lists an item only when:

- its ID is `ekza:weapon:<uuid>` or `ekza:avatar:<uuid>` and matches `assetKind`;
- `access` is `free` and `origin.kind` is `studio` (paid or on-chain templates are not listed);
- one `projectSupport` entry is `omoba` / `desktop` / `handheld-glb-v1` (weapon) or `humanoid-glb-v1` (avatar) / `approved`;
- a matching GLB rendition exists and its download URL is `{registry}/v1/studio/assets/<sha256>/rendition`;
- name, creator, licence and attribution are bounded text without control characters.

A malformed item is skipped on its own. A thumbnail outside `{registry}/v1/studio/assets/<sha256>/rendition-thumbnail` is dropped, not rendered. A Registry outage, a non-200 answer, a non-JSON or oversized body or a malformed document renders **Market unavailable**, never an empty list.

Weapons whose OMOBA approval carries `projectSupport[].requirementId === "wildspark.handheld.set"` (Registry C5) are featured as **Wildspark sets**: one asset carrying both the repeater and the launcher (see the game's `docs/handheld-weapons.md`). Other weapons and avatars follow. Each card shows the thumbnail, name, creator, licence and attribution, kind, a Free chip and the claim action. A missing or placeholder thumbnail (narrower than 8 px, like the Registry's 1×1 default) falls back to the game-owned default repeater and launcher previews for Wildspark sets, or to a "No preview yet" panel. Wildspark cards link to the Wildspark brief in `/creators`; other weapons link to the design briefs.

The featured block's **Make one in Ekza Studio** link opens `{studio}/studio?view=new&kind=weapon&project=omoba&requirement=wildspark.handheld.set`. `/creators` uses the same link for the Wildspark repeater and launcher requirements, and adds **Community sets in the market**. Other supported requirements keep the plain `{studio}/studio?view=new` draft link.

## Sign in with Ekza

The Ekza BFF is `src/app/api/ekza/[...path]/route.ts`, separate from the Account API BFF. Its whole surface:

| Browser request | Registry request |
|---|---|
| `GET /api/ekza/csrf` | none; sets the CSRF cookie |
| `POST /api/ekza/device` | `POST /v1/account/device {"projectId":"omoba","scope":"library-claim"}` |
| `POST /api/ekza/device/poll` | `POST /v1/account/device/poll {"deviceCode":…}` |
| `GET /api/ekza/library` | `GET /v1/account/library` (Bearer link token) |
| `POST /api/ekza/library/<uuid>` | `POST /v1/account/library/<uuid>` (Bearer link token) |
| `DELETE /api/ekza/library/<uuid>` | `DELETE /v1/account/library/<uuid>` (Bearer link token) |
| `POST /api/ekza/sign-out` | `DELETE /v1/account/session` (Bearer link token, best effort, 3 s), then clears the Ekza cookies |

Everything else is 404 before any upstream request. Browser bodies, queries and headers are never forwarded. Mutations need the exact portal origin and the `X-CSRF-Token` matching the HttpOnly CSRF cookie (`mutationAllowed` in `src/lib/security.mjs`).

1. **Sign in with Ekza** starts a device link. The device code stays in an HttpOnly cookie; the browser gets only the user code, expiry, poll interval and the Studio approval link. The link is shown only when it is exactly `{studio}/studio?view=connect&code=<userCode>`.
2. The player approves in Studio. Studio shows the `library-claim` consent: OMOBA can read the library for this game and add the free items the player chooses.
3. The page polls the BFF at the device interval. A Registry 5xx, timeout, network error or 429 (`registry_unavailable`, `rate_limited`) keeps polling with backoff: the delay doubles from the interval up to 30 s, a longer `Retry-After` wins (at most 5 minutes), and the panel says "Ekza is not answering. Still trying…". Any other failure, or the code's expiry, ends the sign-in with its message and returns the panel to **Sign in with Ekza**; it never stays waiting without a poll (`devicePollRetry` in `src/lib/market.mjs`). On approval the BFF checks `projectId: "omoba"`, the `library-claim` scope, the token format and a future expiry, then stores the access token **only** in an HttpOnly, SameSite=Lax cookie (Secure and `__Host-` prefixed on HTTPS; plain names on loopback HTTP). Its lifetime follows the Registry expiry (at most 90 days). The browser receives the account name.
4. **Get free** claims the item; **Owned** comes from the library `assets` (C1), with legacy avatar `items` also counted. Only items this link may remove (`library.reason: "claimed"`, i.e. claimed through an OMOBA link; C7) offer **Remove from library**. A removal (Registry 204) returns the card to **Get free** with "Removed from your Ekza library.". Created items, Studio saves and other games' claims show **Owned** with **Manage in Ekza Studio ↗** (`{studio}/studio?view=library`). If the Registry still refuses a removal (`409 claim_not_removable`, for example after the item was saved in Studio while the page was open), the card says "This item was added in Ekza Studio or by another game, so it stays in your library. Manage it in Ekza Studio." and switches to the Studio link.
5. **Sign out of Ekza** first ends this link in the Registry (`DELETE /v1/account/session`, C7: only this link, any scope; `revokeLink` in `src/lib/market-server.mjs`), so repeated sign-ins do not pile up live links under Studio connections. This is best effort with a 3 s budget: the BFF then clears the link, device and CSRF cookies whatever the Registry answered, and replies `{"status":"signed_out","revoked":true|false|null}` (`null` when no link was held). When the Registry did not confirm (down, timeout, or a Registry without C7), the page says the player is signed out here and can disconnect OMOBA under Account → Connected games in Studio. Sign-out keeps the CSRF rule; a forged request reaches neither the Registry nor the cookies. Every deletion repeats the attributes the cookie was set with (`expireCookie` in `src/lib/security.mjs`): a browser ignores a `__Host-` Set-Cookie without Secure, so on HTTPS a bare delete would keep the link.

The first paint reads the library on the server (`src/lib/ekza-server.ts`) so owned items render as Owned without a flash. A server component cannot change cookies, so when that read finds the link dead (401 or a malformed cookie) the page shows **Sign in again** and makes one `GET /api/ekza/library`, which clears the cookie. The token never appears in HTML, the RSC payload, JSON bodies, localStorage or public env.

Upstream errors map to stable codes; Registry messages are not forwarded:

| Registry | Browser code | UI |
|---|---|---|
| 401 on library/claim/remove | `link_expired` (cookie cleared) | Sign in again |
| 403 `link_scope` | `link_scope` (cookie cleared) | Sign in again and allow adding free items |
| 404 `asset_not_available` | `asset_not_available` | Item no longer available for OMOBA |
| 409 `claim_not_removable` on remove | `claim_not_removable` | Added in Ekza Studio or by another game; manage it in Studio |
| 422 on device start, 404/405 without code on claim | `claims_unsupported` | Ekza does not accept claims from this site yet |
| 410 on poll | `device_expired` (cookie cleared) | Code expired, start again |
| 429 | `rate_limited` | Wait and retry (retried while signing in, honouring `Retry-After`) |
| 5xx, timeout, network, oversized or invalid response | `registry_unavailable` | Registry unavailable (retried while signing in) |

`claims_unsupported` is what a Registry without the C2 claim routes produces, for example a hosted Registry before the `library-claim` migration is deployed. Sign-out against a Registry without C7 (`405`) still signs out locally and reports `revoked: false`.

## Beta limits

- Free items stay server-admitted by approval; claiming changes what the game lists under "My Ekza library", not what it accepts.
- The game links its own Ekza session (scope `library`). The player sees the account name in both places to confirm it is the same account. The market's copy quotes the game's own label for that list: "My Ekza library", «Моя библиотека Ekza», “我的 Ekza 收藏”.
- No paid items. `access: "owned"` items are not listed.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `OMOBA_CONTOUR` | `production` | `production` or `dev`, nothing else. Selects the only Registry and Studio origins below. See [Contours](vercel.md#contours). |
| `OMOBA_REGISTRY_URL` | the contour's: `https://registry.ekza.io` (production), `https://registry.dev.ekza.io` (dev) | Any other origin requires `OMOBA_ALLOW_INSECURE_LOCAL=1` and a loopback host. The other contour's origin is always refused. Misconfiguration renders Market unavailable. |
| `OMOBA_STUDIO_URL` | the contour's: `https://hub.ekza.io` (production), `https://hub.dev.ekza.io` (dev) | Same rule. Used for draft links and to verify the approval link. In production a rejected value links the production Studio, as before; under dev, or for a dev-contour value under production, the Studio links are hidden. A link never crosses contours. |
| `OMOBA_PORTAL_ORIGIN` | `http://127.0.0.1:3010` | Existing. Exact origin for CSRF checks and the Secure/`__Host-` decision. In dev it must be `https://app.dev.omoba.io` (loopback only with `OMOBA_ALLOW_INSECURE_LOCAL=1`). |

## Local run

Against the local Registry rig (Registry API on 8018 with `EKZA_STUDIO_WEB_URL=http://127.0.0.1:5188`, Studio web on 5188):

```sh
OMOBA_ACCOUNT_MODE=disabled \
OMOBA_REGISTRY_URL=http://127.0.0.1:8018 \
OMOBA_STUDIO_URL=http://127.0.0.1:5188 \
OMOBA_ALLOW_INSECURE_LOCAL=1 \
npm run dev
```

Open `http://127.0.0.1:3010/market`.

Against the hosted dev contour (`registry.dev.ekza.io`, `hub.dev.ekza.io`); the local portal origin needs the loopback flag there too:

```sh
OMOBA_CONTOUR=dev \
OMOBA_ACCOUNT_MODE=disabled \
OMOBA_PORTAL_ORIGIN=http://127.0.0.1:3010 \
OMOBA_ALLOW_INSECURE_LOCAL=1 \
npm run dev
```

## Verification

```sh
npm test            # includes tests/market.test.mjs
npm run typecheck
npm run build
npm run test:market # tests/market.e2e.mjs; needs the build
npm run test:https-cookies # tests/https-cookies.e2e.mjs; needs the build
npm run test:contour # tests/contour.e2e.mjs; needs the build, see vercel.md#contours
```

`tests/market.e2e.mjs` starts the built app on loopback port 3018 (`MARKET_TEST_PORT`) in guest mode, with a fake Registry, a fake Studio approval page and a trap Account API. It runs in real Chrome. It checks the BFF CSRF, origin, allowlist and query rules; SSR listing, Wildspark grouping, placeholder fallback, licence and attribution; that hostile items are skipped; device sign-in through the Studio page; the HttpOnly SameSite=Lax cookie and that no credential reaches a response body or JS storage; Get free → Owned, a withdrawn item, reload, remove (204) with its notice, a refused remove (409 `claim_not_removable`) that keeps the item Owned with the Studio link, a scope error that clears the link cookie, an expired link found on a claim and on first paint (both clear the cookie); a poll failure that ends the sign-in and a 503 then a 429 during approval that are retried until the player is signed in; sign-out that calls `DELETE /v1/account/session` with the link token, and sign-out while that call fails (cookies cleared, Studio hint shown); a forged sign-out that reaches nothing; en/ru/zh; the outage state; and the phone layout. It also asserts zero Account API calls. Evidence and screenshots go to `.agent/tasks/MARKET-20261011/`.

`tests/market.e2e.mjs` runs on loopback HTTP, where cookie names carry no prefix. `tests/https-cookies.e2e.mjs` runs the built app as `https://app.omoba.io` on port 3019 (`HTTPS_COOKIE_TEST_PORT`) behind a Playwright route, with a fake Registry and a fake Account API. It walks every place either BFF sets or clears a cookie (including a `link_scope` refusal and sign-out after the Registry revoke) and asserts `__Host-`, Secure, HttpOnly, SameSite=Lax, `Path=/` and no Domain, with `Max-Age=0` on deletions. In Chrome it signs in, signs out and reloads (still signed out), then checks that a revoked link is removed. Evidence goes to `.agent/tasks/MARKET-20261011/https-cookies.json`.
