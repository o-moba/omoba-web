# Class Workshop prototype

`/workshop` composes playable local class recipes using a game-owned rules snapshot. The asset library `/creators` remains public and does not request an account. A link connects the two pages, while their coverage is deliberately explicit: 17 classes and 68 skills for visual discovery; 12 modular cores and 48 executable skills for composition.

Choose a core, edit the name and notes, and assign any four distinct composable skills to QWER. The page shows canonical costs, range, cooldown, targeting and original unlock levels. Native requirements remain visible: Switchfire needs a repeater core, and orbital dependents need a controller skill. Selecting another core loads its preset. The editor defaults to the core passive and preserves valid imported nondefault passives. It does not edit arbitrary combat values, avatars or equipment.

The visual needs panel combines the core basic attack and selected skills. Borrowing Riftshot's skill does not give another core the Wildspark repeater. Model references remain a separate creative workflow with their existing license and approval boundaries.

## Documents and local testing

The portable document has exactly four fields:

```json
{
  "schema": "omoba.class-build.v1",
  "name": "Radiant Rift",
  "description": "A local experiment",
  "recipe": {
    "schema_version": 1,
    "catalog_revision": "standard-kits-8",
    "core": "dawnweaver",
    "passive": "radiance",
    "skills": ["rift_needle", "dawn_barrier", "dawn_field", "dawn_ray"]
  }
}
```

Names allow 1–80 Unicode characters without control characters. Notes allow up to 1,000 characters, including line breaks. Imported JSON is bounded to 8 KiB, requires valid UTF-8 bytes, rejects duplicate object fields, unpaired Unicode surrogates and unknown properties, and must match the game rules. Recipe versions must use integer JSON literals, matching the native parser. Invalid imports leave the current editor intact. Different gameplay revisions are rejected without silently upgrading a build.

Valid edits recover automatically in this browser. **Save browser draft** keeps a separate local copy; **Load browser draft** restores that copy. Neither uploads anything. An incompatible recovery pauses autosave and preserves its exact original bytes, which remain downloadable; the separate saved draft and current-build downloads still work. Recovery and saved documents contain no account tokens. Storage errors are visible; downloading JSON remains available.

**Download build JSON** exports the strict document. **Download Combat Test** exports a full safe native `SandboxConfig`, derived from the game's own template. It enables a target dummy with normal resources and sets only the selected core, recipe and canonical base health. No imported arbitrary sandbox parameters are accepted by the web editor.

From a compatible game checkout:

```sh
python3 scripts/combat_test.py --class-build /absolute/path/to/omoba-class-build.json
# Or use the complete preset downloaded from the website:
python3 scripts/combat_test.py --hero dawnweaver --preset /absolute/path/to/omoba-combat-test.json
```

The native game validates the recipe again before admission. This prototype is for the local Combat Test; public matchmaking and ranked recipe admission remain unchanged.

## Central account and private persistence

The existing game-pairing flow signs into the central OMOBA account. `/login?returnTo=/workshop` has an exact allowlisted return path; it cannot redirect to arbitrary destinations. The browser draft survives the trip to login. Account status distinguishes a guest from a temporarily unavailable service.

Saving to an account is explicit. The Account API owns the actor from the authenticated `Session.profile_id`, stores private documents in PostgreSQL, and enforces quotas, strict shared game validation, idempotency and optimistic versions. The portal retains pending save idempotency keys for an unchanged operation, preserves editor content on failures, and offers a saved-build refresh or a new copy after a conflict. It never autosubmits local drafts after login.

The BFF allows only these new routes:

- `GET/POST /api/me/class-builds`
- `GET/PATCH/DELETE /api/me/class-builds/{64-hex-id}`
- `GET/DELETE /api/me/ekza-library`
- `POST /api/me/ekza-library/connect` and `/poll`

Class build creation sends `{document}`. Update sends `{expected_version, document}`. Delete includes `?version=N`. Existing HttpOnly session, Origin checks, CSRF and bounded request bodies apply. The BFF forwards the bounded original class-build JSON so native duplicate-field and numeric checks cannot be erased by reserialization. Private saved builds use existing personal-settings consent; they introduce no public publishing right or runtime equip action. Changes to account schema, grants and service configuration must be rolled out separately; this patch performs no production deployment.

## Ekza library boundary

An authenticated user can start the existing separate Studio device flow, visit its verification page and explicitly approve library access, then check the connection. Only verified username and connection state reach the browser. Tokens stay encrypted on the server. Disconnect acts on the library link; it does not delete class builds.

This is read-only library access, not unified SSO: the current Registry protocol exposes a username rather than an immutable account subject. Connecting a library does not approve assets or abilities for the game. Upstream outage does not silently unlink an existing connection.

Production verification links must use `https://studio.ekza.io/studio?view=connect`. A loopback verification link is accepted only when both the portal is loopback and the API explicitly marks the response `prototype: true`. The interface labels the local synthetic Registry fixture visibly. No hosted Ekza account is connected by that demo fixture.

## Refresh and verify

The game exporter `scripts/export_workshop.py` owns `shared/assets/catalog/workshop.json`. It supplies exact shared-Rust rules, presets, limits, a safe sandbox template and source digests. The portal imports this reviewed bounded snapshot and verifies the content revision before build and use:

```sh
npm run workshop:import -- /absolute/path/to/omoba-bevy/shared/assets/catalog/workshop.json
npm run workshop:check
npm test
npm run typecheck
npm run build
```

Catalogue and workshop gameplay revisions must agree. The UI exposes both source commits so separate snapshots cannot masquerade as one binary release. A source commit and exact inputs digest identify the rules; recipe revision and network protocol establish the native compatibility contract. Re-export both snapshots after final game source changes and before shipping.

For the isolated local demo, the Account API and disposable database setup are described in the game repository. The portal expects the existing allowed local origin:

```sh
OMOBA_PORTAL_ORIGIN=http://127.0.0.1:3010 \
OMOBA_ALLOW_INSECURE_LOCAL=1 \
OMOBA_ACCOUNT_API_URL=http://127.0.0.1:40560 \
PORT=3010 npm start
npm run test:workshop
```

The browser test uses the existing synthetic Ed25519 seed `[7; 32]` registered by the game's `seed-local-portal` example, requests a normal pairing code in the portal, signs the real pairing challenge and approves it through the Account API. It does not add or use an authentication bypass. It then exercises account save/load/update, a real optimistic conflict, a delayed save while replacing the editor, strict raw BFF imports, recovery preservation and explicit synthetic Registry consent. The fixture must be enabled only in the disposable local environment; its Registry HTTP listener is `127.0.0.1:40561`.

The one-viewport desktop test writes screenshots, actual downloaded mixed-build JSON and its complete Combat Test preset to `.agent/tasks/CLASS-WORKSHOP-20261010/`. The game-side native proof consumes those downloaded files. Account-backed tests use disposable PostgreSQL data and synthetic identity, not personal credentials. Physical devices, production rollout, public variant galleries and ranked integration are outside this prototype.
