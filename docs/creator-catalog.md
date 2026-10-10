# Creator catalogue v1

`/creators` is a public, English-language asset library. It reads a reviewed local game export, independently of the Account API and database. Class kits remain separate from avatar appearance. The initial catalogue has 17 classes, 68 skills, QWER placements, basic attacks, and authored presentation requirements. The page shows skill icons, licensed default model thumbnails and downloads, engine references, contribution readiness, and precise usage relationships.

This iteration supports discovery and preparation. A downloaded JSON brief pins the game source, catalogue revision, requirement ID, class, profile, baseline, and creative brief. For supported static handheld requirements, the page links to the existing `https://studio.ekza.io/studio?view=new` route. Creators must carry the brief manually alongside their design; the link does not pass a hidden requirement ID or claim to submit, approve, publish, or equip a specific slot. Existing Studio cosmetic workflows are separate from future exact-slot approval and equipping.

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

1. Add explicit requirement ID, catalogue revision, profile version and license consent to Registry submissions. Preserve immutable original submissions and validate GLBs against the matching profile.
2. Show public variants and moderated review state. Keep generic cosmetic approval distinct from exact requirement approval and compatibility.
3. Define approved sets, class/skill bindings, rollback and fallback behavior in the game. Add runtime validation and visual regression evidence for attachment transforms, scale, VFX and motion.
4. Add interactive 3D previews only after agreeing on a renderer/profile contract; these model reference thumbnails currently do not reproduce combat rendering.
5. Release the public portal route and then configure the marketing destination. Deployment, backend schemas and runtime equipping are outside this patch.
