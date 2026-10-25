# Reproducible test boundary

All persistence and browser checks use a disposable PostgreSQL 18 cluster on
127.0.0.1:55581, never a production database. The game test worktree is
the sibling checkout `../omoba-bevy` (override with `OMOBA_GAME_WORKTREE`); `.agent/` contains local-only data.

Run `OMOBA_PORTAL_TEST_DATABASE_URL=... cargo test -p omoba-account-api --test postgres
-- --ignored --nocapture` in the game worktree for pairing,
privacy, friends, immutable settlement, big IDs and projection tests. The fixture
creates fresh game identities, with native Ed25519 signing and real core settlement.
The limited-role test additionally needs `OMOBA_PORTAL_ROLE_TEST_URL` and roles
prepared using `account-api/ops/grants.sql` in the disposable cluster.

Before browser tests, run the explicit local fixture command in the game workspace:

```sh
OMOBA_PORTAL_TEST_DATABASE_URL=postgres://YOUR_LOCAL_USER@127.0.0.1:55581/postgres cargo run -p omoba-account-api --example seed-local-portal --locked
```

It refuses other hosts/ports, registers the synthetic keys and settles a labelled
test match through the existing career store. The running API projects its stats.

The browser script intentionally uses a public synthetic seed consisting of 32
bytes of value 7. It must correspond to a registered synthetic account with a saved
match in this test database. This is test material, never a recommended or real
account key. The browser performs the real pairing/BFF flow and a synthetic native
signer approves it. Never run this seed or script against production. Browser
screenshots prove rendering, not physical iPhone/Android input or native key storage.

Load preparation: run `account-api/tools/load_seed.sql` only in the disposable
cluster. It creates 100,000 clearly named v2 synthetic results, ten participants per
result, one million projected facts and 10,000 benchmark profiles, with exactly
100 matches per profile. The runner asserts this distribution before measurement. This is query
load data, not evidence that 100,000 real games were played. The separate integration
test proves settlement/projector correctness with genuine game domain operations.

The local load runner expects a private test-only portal secret at
`.agent/tasks/PLAYER-PORTAL-2026-09-15/portal-test-secret` in the game worktree and a
local owner connection to the test cluster. It creates 50 browser sessions, then
sends 20 requests/second for 900 seconds through the production Next BFF. Mix:
50% profile, 30% history, 20% statistics. No credentials enter output. Results go
under `.agent/load/`. `OMOBA_LOAD_SECONDS` can shorten a diagnostic run; shortened
runs do not satisfy the fifteen-minute acceptance criterion.

Run `npm test`, `npm run typecheck`, `npm run build` for frontend verification.
`npm test` includes the contour rules (`tests/contour.test.mjs`) and the dev Vercel
helper against a fake CLI (`tests/vercel-dev.test.mjs`). `npm run test:contour` checks
a production build and, after a dev build, the dev contour; see `docs/vercel.md#contours`.
`npm test` also covers the market rules and VK ID sign-in (`tests/market-profile.test.mjs`,
`tests/vk-id.test.mjs`); `npm run test:market-profiles` checks a global or ru build against
a loopback fake Account API, see `docs/markets.md#verification`. `tests/landing.test.mjs`
and `npm run test:ru-landing` (after a ru or a global build) cover the RU guest home (LR-22).
`tests/legal.test.mjs` covers the legal table against the game's values, the footer and
sign-in links, the document format and that the RU drafts cover every data category;
`OMOBA_GAME_MARKETS_PY=<game repo>/scripts/markets.py npm test` also compares the table
with the game's file.
`VERCEL_CLI=<…/node_modules/vercel/dist/vc.js> npm run test:vercel-cli` runs the same
helper through the real pinned Vercel CLI against a loopback fake of the Vercel API
(fake token, throwaway HOME; no request leaves the machine). Rerun it when the CLI pin moves.
`npm start` runs the standalone build and serves its copied static output. Use an
explicit loopback HTTP override only on this test environment. The game UI tests
remain `cargo test -p client --lib career`; native key/proof and URL tests live in
shared, client and passport crates. Actual device and public download checks are
recorded separately, and may remain NOT_RUN until hardware/artifacts are available.

`node tests/privacy.e2e.mjs` checks two authenticated browser contexts and a guest,
opt-in publication, immediate revocation and actor injection. It restores the
synthetic account preferences and logs both test accounts out when finished.

`node tests/db-outage.e2e.mjs` intentionally stops and restarts ONLY the owned
disposable cluster in the game task directory, on explicit loopback port 55581.
Run after load tests, never concurrently. It checks an authenticated 503, UI error,
and the same persisted profile/session after restart, then revokes its test session.

`npm run test:vk-sign-in` (after `OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=51234567 npm run
build`) runs Sign in with VK ID end to end: it migrates a disposable, empty loopback
database (`OMOBA_E2E_DATABASE_URL` on 55581), starts the real Account API built for the
RU market (`OMOBA_ACCOUNT_API_BIN`, `OMOBA_MARKET=ru cargo build -p omoba-account-api`)
against a loopback VK ID stand-in, starts this RU build on 127.0.0.1:3010 and drives
Chrome through website registration, the game's link (a synthetic Ed25519 signer of the
native requests), VK sign-in via OK and a second device. VK ID itself is never loaded.
`OMOBA_PSQL` names the psql binary used to seed game profiles.

`npm run test:ru-topology` (same build and variables, `tests/ru-topology.e2e.mjs`) runs
the RU host topology without a browser: the RU build with the production RU settings
(`https://omoba.ru`, the loopback Account API, `OMOBA_TRUST_LOOPBACK_PROXY=1`,
no ingress key), the real Account API with the same flag, and a stand-in for Caddy that
overwrites `X-Real-IP` per client and passes only native routes on account.omoba.ru. It checks
`GET /api/me`, `POST /api/me/recovery-codes` (8 codes), web pairing, that 31 VK callbacks
from one address limit only that address, and that no request through the ingress gets
403. `OMOBA_CADDYFILE_RU=<game repo>/ops/vps/ru/Caddyfile.ru` reads the native list
from the real file; `OMOBA_E2E_API_MARKET=global` accepts a global Account API build
(the VK callback and its limit are checked, VK sign-in success is not).
