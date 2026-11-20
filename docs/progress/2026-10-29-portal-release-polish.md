# Player portal release polish and browser practice

Implemented on isolated branches from portal dev 7279765 and game dev 7ace97c.
An art director checked the current brand, a UI/UX engineer implemented the
career surfaces, and independent reviewers checked both the portal and game.

The portal now has a composed player banner, readable real record metrics,
outcome-led match rows, winner/loser team summaries, aggregate kills/damage,
expanded per-player details, class performance meters and a rating chart with
data-derived bounds. Existing market, privacy, VK, pairing and legal contracts
are preserved. A query transition no longer displays the prior request's rows.

The separate `/play` page loads the actual browser practice package only on
request. It offers existing VK/pairing return-to-play, handles linked and new VK
identities without passing credentials to the frame, and labels local bot
practice as unrated. Build/import instructions: [browser-play.md](../browser-play.md).

Verification: final portal suite 208 passed, with no skips and the companion
game's legal table comparison enabled;
focused importer replacement and presentation/auth checks passed; typecheck and
production build passed; 10 real BFF HTTP checks against a synthetic loopback API
passed. The game passed 398 common/shared native tests, real compiled-WASM
input smoke and an independent verifier. English desktop 1280 x 720 captures
and per-criterion evidence are under `.agent/tasks/PORTAL-RELEASE-20261028/`
and the companion `.agent/tasks/BROWSER-PRACTICE-20261028/`.

The current local game distribution is 37.1 MiB, with WASM SHA-256
`8fae02cde42726102c451bb055bdeb3b69f177259341e2775381a5fb15a6313a`.
It was compiled from the isolated game changes and retains truthful dirty/source
metadata. It is an implementation candidate, not a published release package.

Built and locally tested only. No merge, production deployment, provider change,
CI change, release tag/upload or real account/database mutation was performed.
Online/ranked browser play, real VK login and physical-device acceptance remain
separate work. The preview server binds only to 127.0.0.1 and uses synthetic data.
