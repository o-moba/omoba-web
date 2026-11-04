# Browser play and player portal polish

The player portal retains the Arena/Armory navy/cobalt brand, complete OMOBA
logo, local fonts, locale/market/legal controls, and existing account BFF.
Overview, history, match reports and statistics now emphasize actual player
results. Team scores and damage totals are derived from saved participants;
interrupted/abandoned or missing-winner results remain neutral. Query changes
hide the prior request's rows while same-query background refreshes retain data.

## Browser practice package

`/play` starts the real WASM practice package on demand. This first browser
renderer uses the game's existing authoritative local simulation and seven
standard classes, not the native client's UDP/account/filesystem stack. It is
desktop keyboard/mouse practice with bots. It does not join online matchmaking,
settle results, earn XP/rating, or write account state.

Build the companion game branch with its existing Rust/Trunk tools and assigned
shared cache, then import the complete bounded distribution:

```sh
# In omoba-bevy, with an assigned existing shared Cargo cache:
CARGO_TARGET_DIR=/Volumes/Orico/omoba-build-cache/target-b scripts/build-web.sh

# In omoba-web:
npm run game:import -- /absolute/path/to/omoba-bevy/builds/browser-practice
npm run game:check
OMOBA_MARKET=ru npm run build
```

`public/game/` is generated and ignored. Deployment packaging must include this
directory, as the existing standalone start script does. Merely checking out
the portal branch does not compile the game. The page reports an unavailable
artifact and offers native downloads rather than pretending a missing build is
playable. No CI or deployment configuration was changed by this work.

The importer verifies entry/mode, explicit non-networked/non-ranked flags,
file budgets, WASM magic and every SHA-256. Replacing a distribution first
verifies the destination and removes only obsolete files owned by that verified
build. An unrelated or modified file blocks replacement.

## Identity and framing

The existing VK ID and game-pairing flows accept the allowlisted `/play` return
destination. The server passes only the public display name of a linked account
or an unlinked VK ticket to the outer page. An unlinked VK identity may practise
without being misrepresented as a career account.

The frame receives no token, device key, profile ID or account data. Its fixed
entry is `/game/index.html`; readiness/error messages require the exact current
frame source and same origin. Only `/game/*` allows same-origin embedding; other
pages retain frame denial. Missing game files return 404 instead of portal HTML.

## Verification and limits

Portal unit/security checks, typecheck and production build passed. The existing
legal table was also compared with the companion game's `scripts/markets.py`.
`tests/portal-release.http.mjs` checks the real BFF against an isolated synthetic
Account API, including linked/new VK callbacks, HttpOnly state, return-to-play,
foreign-state rejection, embedding headers and actual WASM MIME/magic.

```sh
node tests/portal-release.fixture.mjs
# In a second terminal, run the portal with loopback test configuration:
OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=51234567 OMOBA_ALLOW_INSECURE_LOCAL=1 \
OMOBA_PORTAL_ORIGIN=http://127.0.0.1:3018 \
OMOBA_ACCOUNT_API_URL=http://127.0.0.1:40558 PORT=3018 npm start
# In a third terminal:
REQUIRE_BROWSER_GAME=1 node tests/portal-release.http.mjs
```

The test client ID is synthetic; these checks never contact VK. Actual provider
configuration and a real user's login are separate acceptance steps. Production
Chrome and in-app-browser checks used English at one desktop viewport,
1280 x 720. Fixture profiles/results are visibly named Preview. No production
database, additional UI device/language matrix, touch controls, long-session
load test, completed browser match or online/ranked browser game was accepted.

Online browser play needs a reviewed browser transport/admission bridge to the
UDP lobby/workers, account-bound admission and reconnection proof, and an
authorized server rollout. The local package does not claim to provide them.
