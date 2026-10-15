# Creator catalogue v1

`/creators` is a public, English-language asset library. It reads a reviewed local game export, independently of the Account API and database. Class kits remain separate from avatar appearance. The initial catalogue has 17 classes, 68 skills, QWER placements, basic attacks, and authored presentation requirements. The page shows skill icons, licensed default model thumbnails and downloads, engine references, contribution readiness, and precise usage relationships.

This iteration supports discovery and preparation. A downloaded JSON brief pins the game source, catalogue revision, requirement ID, class, profile, baseline, and creative brief. For supported static handheld requirements, the page links to the existing `https://studio.ekza.io/studio?view=new` route (origin from `OMOBA_STUDIO_URL`, see [Market](market.md)). Creators must carry the brief manually alongside their design; the link does not claim to submit, approve, publish, or equip a specific slot. The Wildspark repeater and launcher are the exception: both link to `…/studio?view=new&kind=weapon&project=omoba&requirement=wildspark.handheld.set`, because the two Q guns are contributed as one set asset, and to the community sets in `/market#wildspark`. Their game-authored briefs describe that set (the `WildsparkSetRepeater` / `WildsparkSetLauncher` node convention and the game's `docs/wildspark-skin-sets.md`). A Studio item reaches the market and the game only after OMOBA approves it; approval is per item, and exact-slot approval and equipping for other requirements are still future work.

## Refresh the snapshot

Use an explicit game checkout. The importer never guesses a sibling path or fetches remote data:

```sh
npm run catalog:import -- --game /absolute/path/to/omoba-bevy
# Include rendered thumbnails when available:
npm run catalog:import -- --game /absolute/path/to/omoba-bevy --preview-dir /absolute/path/to/previews
# Or import an export already prepared by the game exporter:
npm run catalog:import -- /absolute/path/to/export-directory
npm run catalog:check
```

The game owns `scripts/export_asset_catalog.py`, authored briefs, runtime source mapping, asset license decisions, and semantic IDs. Exporting without thumbnails deliberately yields `preview: null`; the portal displays that absence. The source commit identifies the checkout base; input hashes identify the exact exported bytes, including uncommitted source and optional thumbnail input. A reviewed snapshot should be regenerated from the final game commit before publishing its portal change.

`public/asset-catalog/catalog.json` and its content-addressed `files/` are checked into this portal. Imports validate before replacing the snapshot and copy only referenced assets. The importer rejects symlinks, unsafe paths, unsupported schemas/profiles, inconsistent relationships, missing files, wrong hashes or sizes, malformed file headers, unlicensed downloads, and modified catalogue content under an old revision. It refuses to replace a destination with unrelated files. Failed validation preserves the existing snapshot.

The catalogue is bounded to 2 MiB JSON, 64 classes, 256 skills, 1,024 requirements, 64 MiB per file, and 256 MiB total assets. URLs must be `/asset-catalog/files/<sha256>.glb` or `.png`. No runtime remote URL or arbitrary file path is accepted. The build runs `catalog:check` before Next.js compilation.

## SDK contract

The portable `src/lib/asset-catalog.mjs` module provides `parseAssetCatalog(unknown)`, `catalogFiles(catalog)`, and `contributionBrief(catalog, requirementId, classId)`. TypeScript contracts live in `asset-catalog-types.ts` and `.d.mts`. The Node-only companion verifies content identity. This is a read-only SDK; there is no submission API.

The `omoba.asset-catalog.v1` contract includes classes, canonical skills and requirements. A requirement has a stable semantic ID, class and skill/basic-attack/state use edges, authored brief, status, profile and baseline. The supported profile is `handheld-glb-v1` version 1. `planned` means a dedicated validated game binding is future work; `engine_owned` describes procedural presentation or motion with no asset upload path. Neither receives a Studio action.

`revision` is `sha256-` plus SHA-256 of the manifest excluding `revision`, with recursively sorted ASCII object keys, UTF-8 JSON, compact separators and no ASCII escaping. The exporter normalizes integral floats to integers and uses finite JavaScript-safe numbers in its defined numeric range, so Python and JavaScript produce the same bytes. This hash covers all extra exported metadata as well as fields used by the UI. `source.inputsSha256` is game-owned evidence of the underlying inputs. File digests are raw lowercase SHA-256 hex.

Deep links use `/creators?class=wildspark&skill=wild_switch&requirement=wildspark.handheld.repeater`. Class, skill and requirement relationships must agree. Unknown or incompatible links show an explicit unavailable state. The game skill ID is stable across QWER placements; the slot itself belongs to the class recipe.

## Verification

```sh
npm test
npm run typecheck
npm run build
# In a second terminal; no Account API is started:
OMOBA_ACCOUNT_API_URL=http://127.0.0.1:40559 PORT=3012 npm start
npm run test:creators
```

The browser test runs one desktop Chrome viewport (1440 × 1000), places a rejecting Account API trap on port 40559, and checks that no browser or server Account requests occur. It covers class/asset search, both Wildspark Q weapons, deep links and history, a real brief download and GLB response, absent previews, invalid relationships, and empty search. Evidence is saved under `.agent/tasks/ASSET-CATALOG-20261010/`. Existing account-backed end-to-end suites are separate; this feature does not require their database fixture.

Next.js bundled guides were initially unavailable before dependency installation, so official page and server/client docs were consulted. After installation, the local `page.md`, `use-search-params.md`, and `05-server-and-client-components.md` guides were read. The static page wraps query-string client interactivity in Suspense and reads the bounded snapshot on the server.

## Class composition now available

The [Class Workshop](class-workshop.md) implements private class composition, central-account persistence and native local Combat Test export. This does not implement exact-slot creative asset submissions or public/ranked class admission.

## Next iterations

1. Registry submissions can now name a project requirement (`requirementId`, Registry C5; seeded for `wildspark.handheld.set` only). Still to add: catalogue revision, profile version and license consent on submissions, immutable original submissions and GLB validation against the matching profile.
2. Approved free items are public in [`/market`](market.md). Still to add: moderated review state, and keeping generic cosmetic approval distinct from exact requirement approval and compatibility.
3. The game binds one set, Wildspark's repeater + launcher, by node names, with the class-default pair as fallback. Still to define: other class/skill bindings and rollback, plus runtime validation and visual regression evidence for attachment transforms, scale, VFX and motion.
4. Add interactive 3D previews only after agreeing on a renderer/profile contract; these model reference thumbnails currently do not reproduce combat rendering.
5. Release the public portal route and then configure the marketing destination. Deployment, backend schemas and runtime equipping are outside this patch.

## Dawnweaver dev integration snapshot

The current dev catalogue is `sha256-41f7286321af14c7ae0e527dff2e8ee93469c9fa01a4c8b944879afefc7c5563`, exported from the combined game commit `4c93caa737b7f51239f3b3f95b6e2dfff78dd06d`. It uses `standard-kits-8` alongside workshop snapshot `sha256-c1df475057420f442344941124dc8983f3a18dd4bc37980fdd821bd08e7c1b2c`. The workshop records `dcee2ba19d1c4d4a5799d14e3f48a47ecb0648ab` as the latest commit affecting its tracked inputs; its exact input digest is `fddbb5918af417ed6c7a3873cc124f5387094ed3d9e8be371d931d8b6cd0a63d`.

This refresh includes Dawnweaver's centre-weighted Horizon Ray description, the self-shield and automatic field detonation descriptions, and the charge/release motion references. All seven existing model preview hashes and all content-addressed model/image files remain unchanged. Russian and Chinese descriptions follow the updated game text. The existing workshop test now checks that the two snapshots use the same gameplay revision before browser rendering.

Class builds saved with `standard-kits-7` remain incompatible and retain their original bytes for download; this refresh does not silently upgrade them. New default recipes and Combat Test exports use `standard-kits-8`. Deploy the matching game/API and portal together; this source update does not deploy either service.

## Previous Wildspark set snapshot

The previous snapshot was revision `sha256-e53b09cccd7d534943af4f2ecb70156e65972ba9f0503d3f22da55c31221951c`, exported from a clean `omoba-bevy` checkout at `70d15bd9648cc0d342aef7fb2d139a0c1501191e` (branch `feat/wildspark-set-skins`) with the 0.44 thumbnails reused byte for byte. Compared with the 0.44.0 snapshot only the briefs of `wildspark.handheld.repeater` and `wildspark.handheld.launcher` changed: both now describe the one-GLB set under the Studio requirement `wildspark.handheld.set`. Gameplay revision and assets are unchanged (`standard-kits-7`). Re-export from the merged game commit before release; with unchanged inputs only `source.commit` and `revision` move.

## 0.44.0 snapshot

The 0.44.0 snapshot followed game main commit `1952af24125dce8dc5be7926a56fced1a48f6b84`, including Wildspark PR #77. Wildspark’s default repeater is distinct from Riftshot’s repeater; rocket-mode attacks reference the actual bundled rocket GLB. The corresponding workshop uses `standard-kits-7`. Older class-build documents are rejected by revision validation, preserving their saved bytes for download. New static weapon previews retain content-addressed provenance.
