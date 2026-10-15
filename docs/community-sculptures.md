# Community sculptures

`/sponsor` is a free pilot for a temporary decoration beside the Wendigo pit,
opposite the dragon. The game owns the exact position, scale and presentation;
the website does not accept arbitrary coordinates. The placement does not change
collision, combat, objectives or navigation.

## Player and creator flow

1. Open **Community sculptures** from the market or player portal. The public
   page shows the curated location, its occupant and the fixed 24-hour duration.
2. Select an approved `map_prop` model. **View in 3D** opens the existing shared
   Ekza renderer on demand with exact SHA-256 and byte-count verification, a
   maximum 8 MiB GLB, embedded resources, animated model clips, and lighting/material controls.
3. To contribute a new model, follow **Create a sculpture in Ekza Studio**.
   The link chooses `map_prop`, OMOBA and `community.map.sculpture`. Studio's
   existing source validation, publication and game approval lifecycle applies.
4. Connect Ekza for the explicit **map-placement** permission. This is distinct
   from the market's **library-claim** connection. The consent page is in Studio.
5. Enter a title and credit, confirm display rights and content suitability, and
   submit. The Registry reviews eligibility and stores the exact asset,
   revision, rendition hash and text. It enforces one pending/live request per
   account. An idempotency UUID prevents a retried request from creating a second
   placement, including after a lost response.
6. The OMOBA administrator reviews the exact model and text in Studio. A model's
   catalog approval is not a placement approval. An occupied location must be
   free before the administrator activates another request. The 24-hour period
   starts on activation using server time, not when the form is submitted.
7. The website shows pending, active, declined, finished, cancelled and revoked
   states, with review feedback. The owner may cancel a pending/live placement.
   Status refreshes every 30 seconds while the page is visible, or on **Refresh**.

Technical validation is not semantic content moderation. A human administrator
must inspect the model and text; inappropriate content can be rejected or revoked.
The game independently enforces manifest freshness and expiry. The website is
not an authority for activation or the game clock.

## Browser and server boundary

The BFF is `/api/sponsor/*`. Its only routes are `csrf`, `public`, `device`,
`device/poll`, `sign-out`, `placements` and `placements/<UUID>/cancel` with their
declared GET/POST methods. Queries and unknown body fields are rejected. Every
mutation needs the exact portal Origin and a matching CSRF cookie/header.

The BFF requests `map-placement` from `/v1/account/device` and requires that exact
scope in the poll response. Missing, legacy and `library-claim` scopes fail
closed. It stores the access token only in the separate HttpOnly,
SameSite=Lax `omoba-ekza-placement` cookie (`__Host-` and Secure on HTTPS), plus
separate device and CSRF cookies. Credentials never enter HTML, response JSON or
browser storage. Signing out revokes this link and clears only these cookies.

Registry/Studio origins come from the existing contour configuration. Public
models are selected through:

```
GET /v2/assets?kind=map_prop&project=omoba&platform=desktop&profile=map-prop-glb-v1
GET /v1/projects/omoba/placements/slots
```

Only free, OMOBA-approved desktop `map-prop-glb-v1` renditions appear. The model
URL must be the configured Registry's content-addressed rendition route and
match the approved SHA. The shared renderer verifies the downloaded bytes.
Registry reads keep existing five-second/2-MiB JSON limits and reject redirects.
Private requests/statuses use `/v1/account/placements`; only a narrow parsed
response reaches the browser. Administrative identity fields are not forwarded.
Review notes render as text.

Creation accepts exactly `project`, `slotId`, full `assetId`, `revisionId`,
`renditionSha256`, `title` (1–80 characters), `credit` (1–120 characters),
`rightsAccepted: true`, and a UUID `idempotencyKey`. It accepts no model URL,
transform, schedule, approval, transaction hash, payment amount or paid flag.
The Registry remains authoritative and repeats all validation.

## Payment boundary and expansion

There is no operational crypto checkout, wallet link or payment verification
claim in this pilot. Free entitlement, moderation and scheduling are separate
server concerns. Adding a payment provider must not change what the browser may
claim as approved or paid.

A future paid flow should create a server-owned quote/payment intent, verify
chain and network, token contract (USDT requires a network), recipient, amount,
unique transaction allocation and finality, and handle reorgs/refunds before
activating a moderated placement. Solana, Ethereum, BNB and Bitcoin require
provider-specific verification; exposing a wallet selector is not verification.
The existing Supporter checkout is a different entitlement and is unchanged.

Additional locations require curated server/game slot definitions and budgets.
This version intentionally recognizes only `opposite-dragon`; it does not allow
an unbounded set of placements or arbitrary uploaded scene behavior.

## Local verification

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run test:sponsor
npm run test:market
npm run test:market-preview
```

Use the same `OMOBA_CONTOUR` for build and browser checks. Tests default to the
production contour with explicitly allowed loopback service doubles; they never
contact a hosted Registry. To inspect the original cat instead of the generated
triangle fixture:

```sh
OMOBA_SCULPTURE_MODEL=/absolute/path/to/lucky-cat.glb npm run test:sponsor
```

The sponsor browser test uses one English 1280×960 viewport and controlled local
Registry/Studio responses. It checks dedicated consent/cookies, CSRF/allowlists,
exact model preview, lost-response idempotency, status transitions, cancellation,
plain-text review feedback, and sign-out/scope isolation. Its administrator
changes are fixtures, not evidence that a deployed administrator approved a
model. Registry/database and game acceptance are recorded in their separate
feature PRs. Screenshots and raw results are saved under
`.agent/tasks/community-sculptures/raw/` and are not published assets.

This change does not deploy the feature, enable paid providers, or certify a
physical mobile/TestFlight build.

## Sculpture information card

Authors can add an optional description on `/sponsor`. Players click or tap the
approved sculpture to read its title, credit and description in the game. The
description is part of the immutable moderation and idempotency payload, not
mutable catalog copy. Changing it requires a new request and review.

The limit is 1,000 Unicode scalar values, with LF line breaks preserved. Omitted
text defaults to empty; explicit null, invalid controls and unpaired surrogates
are rejected. Plain text renders literally, without HTML, Markdown or active
links. The bounded BFF request limit is 8 KiB to fit supplementary Unicode text.
The form does not silently truncate an overlong description.

The v1 upload profile remains GLB up to 8 MiB, with at most one optional looping
rotation-only animation up to 30 seconds (LINEAR/STEP). It does not accept
textures, skeletal rigs, morphs or translation/scale animation. The common
preview SDK plays the embedded clip; opening a game information card does not
pause its animation.
