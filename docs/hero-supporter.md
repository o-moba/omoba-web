# Monthly support and Hero recognition

Hero is the cosmetic benefit of the existing account-bound Supporter membership.
It adds no combat, progression, rating or matchmaking advantage. `/supporter`
keeps the existing aura selection, verified payment confirmation, order recovery
and expiry display. Solana buys one prepaid 30-day period without automatic wallet
debits; Apple remains the native game's monthly purchase/restore boundary. The
website never grants entitlement from a browser flag or a successful wallet launch.
The preview artwork is explicitly an illustration of the effect.

## Public acknowledgement

`/supporters` is available without signing in. It shows the nicknames, lifetime
months and current Hero status of players who opted in and published their
profile. Each row links to `/players/<immutable profile ID>`, where the existing
statistics privacy setting still controls rating, level, wins and win rate.
Inactive supporters retain acknowledgement. A future paid period contributes a
month but does not make Hero active before its start. The directory is ordered by
profile ID and paginated, rather than ranked by spending.

A supported month is one unique verified, nonrevoked monthly payment period.
Expired periods count; refunded periods do not. The Account API computes this
aggregate over all periods. The browser must never derive it from the 100-row
access history or by dividing dates into calendar months.

Public recognition defaults to off. On `/supporter`, the player can choose to show
their nickname and supported months. This does not publish a private profile or
change statistics settings. The page explains the public-profile prerequisite
and links to Settings. Names, wallets, receipt details and provider history are
not otherwise exposed by the public directory.

## Matching Account API

Requires the coordinated game/API Hero-supporter change and portal migration 6:

- `GET /v1/me/supporter` adds `recognition: {months_supported, visible,
  public_profile_enabled}`. Existing shared/game supporter status is unchanged.
- `PATCH /v1/me/supporter/recognition` accepts `{visible: boolean}` and returns
  the updated recognition object. The web BFF preserves session, exact-origin
  CSRF and server permission checks.
- `GET /v1/supporters?limit=24&cursor=<profile ID>` returns
  `{supporters, next_cursor, data_as_of}`. Every row contains only `profile_id`,
  `nickname`, `months_supported`, `hero_active` and nullable epoch `hero_until`.
  The API limits pages to 50 and validates queries. The UI requests 24.
- An eligible public player profile may include `supporter: {months_supported,
  hero_active, hero_until}`. The UI accepts older profiles without this field.

Reads stay `no-store`. The UI reloads the current directory page on focus or every
30 seconds while visible; an explicit Refresh is also available. It discards old
rows during refresh and after failure, and locally stops showing active Hero at
the server-provided expiry. Lifetime count and entitlement remain server-owned.

## Disabled services and deployment

Hosted dev can use the dedicated Account API through the protected ingress in
[the Vercel runbook](vercel.md#hosted-dev-accounts). With
`OMOBA_ACCOUNT_MODE=disabled`, `/supporters` renders a clear unavailable notice
without contacting an upstream, even with a stale session cookie. An unavailable service is never shown
as an empty list or a successful payment. Local enabled mode supports integration
with an isolated Account API/database. This feature changes no deployment,
provider configuration, credentials, price or automatic renewal policy.

## Focused verification

Run `npm test`, `npm run typecheck` and `npm run build` from a clean installation.
`node tests/hero-supporter.e2e.mjs` starts its own loopback production web servers
and a synthetic HTTP upstream. In one English 1280×720 Chrome viewport it checks
public access, loading, pagination/back, more than 100 months, independent stats
privacy, error/retry, empty and disabled states, local expiry, CSRF and no-store.
It does not exercise PostgreSQL, native rendering or real payments. Set
`HERO_WEB_EVIDENCE` to choose an ignored evidence directory.

The separate `node tests/hero-supporter-connected.e2e.mjs` test uses the matching
API’s explicitly synthetic `hero-supporter-fixture seed` / `serve` example against
the isolated `hero_supporter` PostgreSQL database on loopback port 55581. Start the
fixture API on its fixed port 40558 first; the test starts and stops its own web
server on 3034. It restores the synthetic account’s privacy and recognition
settings after exercising them. Fixture-backed results must not be described as a real wallet payment,
Apple sandbox purchase, deployed dev or physical-device verification.
