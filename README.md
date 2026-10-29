# Omoba Player Portal

Standalone Next.js player application backed by the game’s PostgreSQL career data.
The matching Rust Account API and native approval screen are in the game workspace,
`account-api/` and `client/src/career_web.rs`. The implementation branch is
`feature/player-portal-2026-09-15`, based on game main `e62b728` (0.19.0-rc.8).
It deliberately preserves the separate, unmerged iPhone packaging work.

The portal includes game-confirmed sign-in, profile overview, settled match history,
participant-only match reports, class statistics and rating changes, friends and
requests, nickname, privacy, RU/EN preferences, time zone, sessions and downloads.
The downloads list is empty until verified public artifacts are configured.
Cosmetic/NFT loadout editing and passkeys are P1, not shipped in this implementation.

## Local run

Use an official Node.js 24 LTS build; verified with 24.22.2 on Linux and 25.6.1 on
macOS. The tests use TypeScript stripping, which some distribution Node packages
omit. PostgreSQL 15+;
verified with PostgreSQL 18. Use the exact package lock and Rust Cargo.lock.

1. Follow [Account API operations](../omoba-bevy/account-api/README.md)
   to migrate an isolated database and start the Rust API on `127.0.0.1:40550`.
2. `npm ci` and `npm run dev` start this site at `http://127.0.0.1:3010`.
   Optional local values are listed in `.env.example`.
3. Start the game against the **same career database**, with
   `OMOBA_ACCOUNT_API_URL=http://127.0.0.1:40550`,
   `OMOBA_PORTAL_ORIGIN=http://127.0.0.1:3010`,
   `OMOBA_ALLOW_INSECURE_LOCAL=1`. Join the server so your existing game key is registered.
4. Get a code on `/login`; in the game open Profile → Connect player website →
   enter the code → Look up code → inspect the website → Approve website access.
   Never copy a private key into the browser. Accounts are not recreated by the portal.

Production build: `npm run build`, then `npm start`. The start script copies generated
static files into Next’s standalone output and binds to loopback. For an explicit
local production-mode check, set `OMOBA_ALLOW_INSECURE_LOCAL=1`; real deployments
require the trusted HTTPS origin and TLS ingress. [RU self-hosting](docs/ru-nginx.md)
documents the single-VPS Nginx/systemd deployment and its guest-mode boundaries;
templates are in `ops/ru-nginx/`. There is no automatic deploy-on-push trigger.
Do not expose the database or raw Account API publicly.

## Configuration

- `OMOBA_PORTAL_ORIGIN`: exact public HTTPS origin, no path or trailing slash.
- `OMOBA_ACCOUNT_API_URL`: internal Account API origin; server-side only. A loopback
  origin (`http://127.0.0.1:40550`, the API on the same host as on RU) is called
  directly; any other origin is reached through its ingress and needs
  `OMOBA_ACCOUNT_INGRESS_KEY`.
- `OMOBA_ACCOUNT_INGRESS_KEY`: the private portal ingress key (64 lowercase hex), sent
  as `X-Omoba-Portal-Key` only to an enabled Account API that is not on loopback, and
  required there. A malformed value is refused even when unused.
- `OMOBA_ACCOUNT_MODE=disabled`: explicit public guest prototype; no account upstream requests. Defaults to `enabled` for local development.
- `OMOBA_ALLOW_INSECURE_LOCAL=1`: loopback development/testing only.
- `OMOBA_CONTOUR`: `production` (default, also when unset) or `dev`; nothing else. It
  fixes the only hosted Registry, Studio, portal and website origins. A value from the
  other contour fails the build, the server start and the request (fail closed, never a
  fallback to production). See [Contours](docs/vercel.md#contours).
- `OMOBA_REGISTRY_URL`, `OMOBA_STUDIO_URL`: Ekza Registry and Studio origins for the
  market. Default to the contour's origins (`https://registry.ekza.io` and
  `https://hub.ekza.io` in production); other values only on loopback with
  `OMOBA_ALLOW_INSECURE_LOCAL=1`.
- `OMOBA_SITE_URL`: the OMOBA website for "About the game" links. Defaults to
  `https://omoba.io` (production) or `https://dev.omoba.io` (dev). Leave it unset in the
  `ru` market: its landing is this portal's own guest home at `/` (LR-22), every website
  link leads there, and a value fails the build and the start
  ([Markets › RU landing](docs/markets.md#ru-landing-the-guest-home-lr-22)).
- `OMOBA_MARKET`: `global` (default, also when unset), `ru` or `cn`, the same switch as the
  game's separate builds. `ru` and `cn` have no Ekza surfaces and no payments; `ru` signs in
  with VK ID. `OMOBA_FEATURE_EKZA`, `OMOBA_FEATURE_SUPPORTER`, `OMOBA_FEATURE_VK_SIGN_IN`
  (`on`/`off`, empty = preset) override one feature. Unknown values fail the build and the
  server start; a server refuses a market other than the one it was built for. See
  [Markets](docs/markets.md).
- `OMOBA_VKID_CLIENT_ID`: numeric VK ID app id (VK, OK and Mail.ru; public client, no secret).
  Only with the VK sign-in feature; without it the VK ID buttons and `/api/auth/vk/*` are absent.
- `OMOBA_TRUST_LOOPBACK_PROXY=1`: only behind an ingress that **overwrites**
  `X-Real-IP`, with both Node and Rust listeners inaccessible except through that
  trusted ingress. Enable the same option on the API. Otherwise forwarded headers
  are ignored. Configure per-IP edge limits too. Never trust client-supplied IP headers.
  Required for a portal on a public origin that calls the loopback Account API, or
  every player would share the portal's address in per-IP limits.

The server checks these at startup (`src/instrumentation.ts`, `assertPortalConfig`)
and refuses to serve a bad combination with `OMOBA portal misconfigured, refusing to
serve (fail closed)`.

The browser receives HttpOnly session/preauth cookies. Pair secrets and API bearer
values never enter localStorage, public environment variables or rendered JSON.
Mutations require same-origin CSRF proof; private reads and HTML are dynamic/no-store.
On HTTPS every cookie is `__Host-` prefixed and Secure. Deletions repeat those
attributes (`expireCookie` in `src/lib/security.mjs`): a browser ignores a `__Host-`
Set-Cookie without Secure, so a bare delete would leave the cookie in place.

## Verification

- `npm test`: BFF path, origin and cookie-token security rules.
- `npm run typecheck` and `npm run build`.
- `npm run test:https-cookies`: after the build, every cookie write and deletion of
  both BFFs on an HTTPS portal origin, by header and in real Chrome.
- `npm run test:e2e`: real Chrome + running local BFF/API/PostgreSQL, after the
  synthetic identity fixture described in [testing](docs/TESTING.md).
- `npm run test:load`: dedicated synthetic local benchmark only; see testing.

Screenshots and raw artifacts are under ignored `.agent/`. The human-readable
[verification record](docs/VERIFICATION.md) distinguishes executed tests from
physical-device and public-release prerequisites. Full specification:
[PLAYER_PORTAL_SPEC.md](docs/PLAYER_PORTAL_SPEC.md), [backlog](docs/IMPLEMENTATION_BACKLOG.md).

Source files are MPL-2.0; original standalone documentation is CC-BY-4.0.
Third-party packages retain their licenses. The game Account API is AGPL-3.0-only.

## Player handles

Current game accounts use editable `nickname#1234` addresses in profiles, settings
and invitations. Exact lookup shows only the player name before adding a friend;
friend mutations still use immutable internal IDs. Requires game/API career schema
v2 (PostgreSQL ICU). See `../omoba-bevy/docs/player-handles.md`.
Run `node tests/handles.e2e.mjs` against isolated local fixtures to verify editing,
case-insensitive lookup, collisions and mobile layout.

## Shared accounts and Supporter

`/devices` supports fresh game-confirmed device enrollment, device revocation and
one-time recovery codes. `/supporter` shows the server-owned membership, three
aura previews, expiry/renewal source and cosmetic preferences. Solana orders are
account-bound and recoverable after reload. Payment providers remain unavailable
until explicitly configured; no purchase is simulated as successful in the UI.

Requires matching game Account API career v3 / portal v3. Existing limited browser
sessions must be reauthorized for the expanded device/recovery scopes. See
[Supporter operations](../omoba-bevy/docs/supporter.md) and
`tests/supporter.e2e.mjs` for the disposable real API/database browser fixture.

## Monthly Hero and public supporters

`/supporters` publicly acknowledges opted-in supporters with their paid month
count and links to the existing privacy-aware game profiles. `/supporter` provides
monthly Hero cosmetic access and the public recognition preference. Payment
providers remain disabled until configured, and hosted guest mode explicitly
shows that the directory is unavailable. See [Hero support](docs/hero-supporter.md)
for the API contract, migration prerequisite and focused verification.

## Creator library

The public `/creators` route browses the game-owned asset snapshot without an account. See [Creator catalogue v1](docs/creator-catalog.md) for the import bridge, read-only SDK, contribution briefs and rollout limits. Run `npm run catalog:check` to verify the snapshot and `npm run test:creators` for the focused desktop flow.

## Market

`/market` lists free community weapons and avatars approved for OMOBA in the Ekza
Registry, with Wildspark repeater + launcher sets featured first. "Sign in with Ekza"
links the player's Ekza library (scope `library-claim`); "Get free" adds an item to
that library, which the game reads for "My Ekza library"; "Remove from library" takes
back only what the market claimed. The Registry link token stays in an HttpOnly cookie
behind the separate `/api/ekza/*` BFF, and sign-out also ends that link in the
Registry (best effort; the cookies are cleared either way). It does not use
the Account API, so it works in guest mode. See [Market](docs/market.md);
`npm run test:market` runs the browser flow against a fake Registry.

## Community sculptures

`/sponsor` offers a free, moderated 24-hour decoration at a curated map location.
It uses approved `map_prop` models, the shared 3D viewer and a separate
`map-placement` Ekza permission. Administrators review and activate requests in
Studio. Crypto checkout is not enabled. See [Community sculptures](docs/community-sculptures.md);
`npm run test:sponsor` exercises the browser/BFF against local service fixtures.

## Class Workshop

`/workshop` composes local combat-test recipes, saves browser drafts, and supports private saves under the central OMOBA account. See [Class Workshop](docs/class-workshop.md) for game import, account and Ekza boundaries, snapshot refresh and the reproducible synthetic local demo.

## Markets and VK ID

The same build axis as the game: `global` (today's product), `ru` (free, no Ekza, no
payments, Sign in with VK ID) and `cn` (free, no Ekza, no payments). In `ru` the login
view offers VK ID, OK and Mail.ru above game pairing, and `/connect?code=…` (opened by the
game) confirms a device or links an unlinked VK account. The portal never exchanges VK
codes: the Account API does. The RU portal is self-hosted in Russia with the standalone
output, not on Vercel. See [Markets](docs/markets.md); `npm run test:market-profiles`
checks a global or ru build against a fake Account API.

`ru` also serves its legal documents (LR-06): `/privacy`, `/terms` and `/offer` render the
versioned Russian files in [`legal/`](legal/README.md) (now the `0-draft` drafts with a
visible «Проект — требует проверки юристом» banner); the login card and `/connect` show a
notice linking the user agreement and the privacy policy, and the footer links Privacy,
Terms, account deletion, Support and Source. The public `/delete` page describes how to
have an account deleted (the operator's e-mail procedure, O-15). `global` and `cn` have no
legal table and are unchanged.

See [Vercel deployment](docs/vercel.md) for the initial public guest mode, upload exclusions and the account-service boundary. The site root opens `/workshop`; the player account area remains `/me`.

## RU registration

Website-first VK ID/OK/Mail.ru signup creates a regional profile; game-first linking
preserves existing progress. See [registration](docs/registration.md) for the native
bridge, schema10 requirement, isolated E2E proof and live rollout limits.
