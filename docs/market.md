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
| `POST /api/ekza/sign-out` | none; clears the Ekza cookies |

Everything else is 404 before any upstream request. Browser bodies, queries and headers are never forwarded. Mutations need the exact portal origin and the `X-CSRF-Token` matching the HttpOnly CSRF cookie (`mutationAllowed` in `src/lib/security.mjs`).

1. **Sign in with Ekza** starts a device link. The device code stays in an HttpOnly cookie; the browser gets only the user code, expiry, poll interval and the Studio approval link. The link is shown only when it is exactly `{studio}/studio?view=connect&code=<userCode>`.
2. The player approves in Studio. Studio shows the `library-claim` consent: OMOBA can read the library for this game and add the free items the player chooses.
3. The page polls the BFF at the device interval. A Registry 5xx, timeout, network error or 429 (`registry_unavailable`, `rate_limited`) keeps polling with backoff: the delay doubles from the interval up to 30 s, a longer `Retry-After` wins (at most 5 minutes), and the panel says "Ekza is not answering. Still trying…". Any other failure, or the code's expiry, ends the sign-in with its message and returns the panel to **Sign in with Ekza**; it never stays waiting without a poll (`devicePollRetry` in `src/lib/market.mjs`). On approval the BFF checks `projectId: "omoba"`, the `library-claim` scope, the token format and a future expiry, then stores the access token **only** in an HttpOnly, SameSite=Lax cookie (Secure and `__Host-` prefixed on HTTPS; plain names on loopback HTTP). Its lifetime follows the Registry expiry (at most 90 days). The browser receives the account name.
4. **Get free** claims the item; **Owned** comes from the library `assets` (C1), with legacy avatar `items` also counted. Only items claimed through a link (`library.reason: "claimed"`) offer **Remove from library**; created and Studio-saved items cannot be removed here.
5. **Sign out of Ekza** clears the link, device and CSRF cookies. Every deletion repeats the attributes the cookie was set with (`expireCookie` in `src/lib/security.mjs`): a browser ignores a `__Host-` Set-Cookie without Secure, so on HTTPS a bare delete would keep the link. The Registry link itself stays valid until it expires or is revoked under Studio connections; the Registry has no self-revoke for link tokens.

The first paint reads the library on the server (`src/lib/ekza-server.ts`) so owned items render as Owned without a flash. The token never appears in HTML, the RSC payload, JSON bodies, localStorage or public env.

Upstream errors map to stable codes; Registry messages are not forwarded:

| Registry | Browser code | UI |
|---|---|---|
| 401 on library/claim | `link_expired` (cookie cleared) | Sign in again |
| 403 `link_scope` | `link_scope` | Sign in again and allow adding free items |
| 404 `asset_not_available` | `asset_not_available` | Item no longer available for OMOBA |
| 422 on device start, 404/405 without code on claim | `claims_unsupported` | Ekza does not accept claims from this site yet |
| 410 on poll | `device_expired` (cookie cleared) | Code expired, start again |
| 429 | `rate_limited` | Wait and retry (retried while signing in, honouring `Retry-After`) |
| 5xx, timeout, network, oversized or invalid response | `registry_unavailable` | Registry unavailable (retried while signing in) |

`claims_unsupported` is what a Registry without the C2 claim routes produces, for example a hosted Registry before the `library-claim` migration is deployed.

## Beta limits

- Free items stay server-admitted by approval; claiming changes what the game lists under "My Ekza library", not what it accepts.
- The game links its own Ekza session (scope `library`). The player sees the account name in both places to confirm it is the same account.
- No paid items. `access: "owned"` items are not listed.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `OMOBA_REGISTRY_URL` | `https://registry.ekza.io` | Any other origin requires `OMOBA_ALLOW_INSECURE_LOCAL=1` and a loopback host. Misconfiguration renders Market unavailable. |
| `OMOBA_STUDIO_URL` | `https://studio.ekza.io` | Same rule. Used for draft links and to verify the approval link. A rejected value falls back to the default for links. |
| `OMOBA_PORTAL_ORIGIN` | `http://127.0.0.1:3010` | Existing. Exact origin for CSRF checks and the Secure/`__Host-` decision. |

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

## Verification

```sh
npm test            # includes tests/market.test.mjs
npm run typecheck
npm run build
npm run test:market # tests/market.e2e.mjs; needs the build
npm run test:https-cookies # tests/https-cookies.e2e.mjs; needs the build
```

`tests/market.e2e.mjs` starts the built app on loopback port 3018 (`MARKET_TEST_PORT`) in guest mode, with a fake Registry, a fake Studio approval page and a trap Account API. It runs in real Chrome. It checks the BFF CSRF, origin, allowlist and query rules; SSR listing, Wildspark grouping, placeholder fallback, licence and attribution; that hostile items are skipped; device sign-in through the Studio page; the HttpOnly SameSite=Lax cookie and that no credential reaches a response body or JS storage; Get free → Owned, a withdrawn item, reload, remove, scope error, expired link; a poll failure that ends the sign-in and a 503 then a 429 during approval that are retried until the player is signed in; sign-out; en/ru/zh; the outage state; and the phone layout. It also asserts zero Account API calls. Evidence and screenshots go to `.agent/tasks/MARKET-20261011/`.

`tests/market.e2e.mjs` runs on loopback HTTP, where cookie names carry no prefix. `tests/https-cookies.e2e.mjs` runs the built app as `https://app.omoba.io` on port 3019 (`HTTPS_COOKIE_TEST_PORT`) behind a Playwright route, with a fake Registry and a fake Account API. It walks every place either BFF sets or clears a cookie and asserts `__Host-`, Secure, HttpOnly, SameSite=Lax, `Path=/` and no Domain, with `Max-Age=0` on deletions. In Chrome it signs in, signs out and reloads (still signed out), then checks that a revoked link is removed. Evidence goes to `.agent/tasks/MARKET-20261011/https-cookies.json`.
