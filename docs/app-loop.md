# Landing, player app and saved match history

The public landing is `https://omoba.io`; the player app is
`https://app.omoba.io`. The landing exposes `/me`, `/me/matches`, `/creators`
and `/workshop`. The portal, catalogue and workshop link back to the landing.
`OMOBA_SITE_URL` overrides that return destination; it accepts an HTTPS origin,
or loopback HTTP in development. It is server-only.

An unauthenticated player opening history, a match report or another supported
page signs in at `/login?returnTo=…` and returns to that page, including its
filters. Return destinations are restricted to known local pages. Sign-in still
requires approval by the player's game identity; opening the landing does not
create a new account or bypass pairing.

## What is recorded

The game server already writes completed eligible matches to PostgreSQL through
the career store and its durable result outbox. Account API projects settled
results into the portal history, normally within its five-second projection
interval. Game server and Account API must use the **same career database**, with
their separate restricted runtime roles. A completed public casual match with
bots can appear in history and grant XP; local standalone practice does not.
The browser cannot submit an outcome, XP or rating change.

`/me/matches` lists stored results with filters. `/matches/<result_id>` shows a
participant's report and statistics. This is a match record, **not a video or
playable replay**. Private reports require an authenticated participant. Public
player statistics remain subject to the player's privacy settings.

## Production status and activation

On 2026-10-10 the published portal serves the catalogue and workshop in guest
mode; `/api/me` returns `503 account_service_disabled`. The code changes do not
alter that production configuration.

Before activating accounts, the operator must verify an HTTPS Account API
endpoint, career/portal schema migrations, restricted roles, the shared game
database and native-client pairing ingress. See the game repository's
`account-api/README.md`, its `account-api/ops/grants.sql`, and this repository's
`docs/vercel.md`. No production API origin has been established by this change.

After that verification, the intended portal settings are:

```text
OMOBA_PORTAL_ORIGIN=https://app.omoba.io
OMOBA_SITE_URL=https://omoba.io
OMOBA_ACCOUNT_MODE=enabled
OMOBA_ACCOUNT_API_URL=<verified HTTPS Account API origin>
```

The landing defaults to `https://app.omoba.io`. Its optional server-only
`OMOBA_APP_URL` accepts an HTTPS origin. Rebuild the landing when changing it.
Production deployments and configuration changes require the repository owner's
approval; this change prepares them without publishing them.

## Local verification

Use an isolated PostgreSQL database. Apply migrations as its migration owner,
then grant the existing game/portal runtime roles using `grants.sql`. Never seed
test identities or matches in a production database. The game repository's
`seed-local-portal` example explicitly requires loopback port 55581.

Start Account API on `127.0.0.1:40550`, configured for portal origin
`http://127.0.0.1:3010`, a fresh local test secret and the isolated database.
Start the portal in development with:

```sh
OMOBA_ACCOUNT_MODE=enabled \
OMOBA_ACCOUNT_API_URL=http://127.0.0.1:40550 \
OMOBA_PORTAL_ORIGIN=http://127.0.0.1:3010 \
OMOBA_SITE_URL=http://127.0.0.1:3102 npm run dev
```

Start the landing from its `apps/omoba` directory:

```sh
OMOBA_APP_URL=http://127.0.0.1:3010 npm run dev -- --port 3102 --hostname 127.0.0.1
```

Then run from this repository:

```sh
npm test
npm run typecheck
node tests/app-loop.e2e.mjs
npm run test:e2e
```

The app-loop check drives the actual local landing, BFF, Account API and database.
It uses the fixture's public synthetic identity to approve browser pairing,
checks return URLs, stored reports, guest privacy, mobile layout and logout.
It does not drive the physical native-client approval UI.

The separate server check proves signed UDP authentication, an actual cast and
victory, durable settlement, saved acknowledgement and history retrieval:

```sh
OMOBA_TEST_DATABASE_URL=<isolated local database URL> \
OMOBA_REQUIRE_TEST_DATABASE=1 \
cargo test -p server --bin server \
  postgres_live_udp_signed_profiles_queue_real_cast_and_durable_history \
  --locked -- --nocapture
```

These two checks use different test identities. The browser report is seeded;
the UDP result is produced by the real server with accelerated fixture base HP.
