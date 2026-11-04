# Market 3D previews

The `/market` catalogue keeps its posters until a visitor chooses **View in 3D**.
One native modal owns one lazy-loaded canvas. Closing it releases the renderer,
model, controls and GPU resources and returns focus to the opener. No login is
needed to inspect an approved public item.

Rendering is shared with Ekza's `@ekza/avatar-renderer/preview` package through
`AssetPreview`. Space's `AvatarModel` stays unchanged. The portal pins the SDK to
an immutable Git SHA over HTTPS and uses Three directly; it does not add R3F.

## Responsibilities

- SDK: GLB/VRM parsing, posed bounds, framing, lighting, material overrides,
  lifecycle, optional exact size/SHA checks and named node variants.
- OMOBA: approved Registry selection and the Wildspark node-name convention.
- UI: original/clay/wireframe materials, three light presets, exposure, orbit,
  zoom, opt-in auto rotation, reset and the two Wildspark weapon modes.

Controls update the existing scene without reloading model bytes (reset/retry
starts a fresh viewer). Settings apply to this preview only and do not change the
asset, ownership or game appearance. Original materials can be unlit; lighting
will not affect such surfaces. Web lighting is not identical to Bevy lighting.

## Loading and failure behavior

`parseMarket` only exposes a model URL from the configured Registry origin whose
content-addressed path matches the approved rendition SHA. The SDK reads that
file without credentials or redirects, checks size/SHA before parsing, and blocks
external model-resource URLs. Preview budgets are 8 MiB for weapons and 64 MiB for
avatars, with a 30-second loading timeout. Larger catalogue entries remain
claimable but show the poster fallback. Existing SDK Draco decoding may load its
shared decoder; no HDR environment download was added.

On HTTP errors, integrity mismatch, missing set parts or unsupported/lost WebGL,
the dialog shows a localized fallback and retry. Closing the preview never blocks
claiming an item. Registry file routes already permit anonymous CORS from the dev
portal; no Registry deployment or schema change is required.

## Verification

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:market
npm run test:market-preview
```

The preview test owns local Registry and portal processes and needs installed
Chrome. Its generated GLB makes it self-contained. To inspect actual assets:

```sh
OMOBA_PREVIEW_MODEL=/absolute/path/to/wildspark-set.glb \
OMOBA_PREVIEW_AVATAR=/absolute/path/to/avatar.glb \
npm run test:market-preview
```

Screenshots and results go to `.agent/tasks/MARKET-3D-20261014` (or
`PREVIEW_EVIDENCE_DIR`). Verified locally with Astral Ivory and the DEV-approved
Pyre Sorcerer: both variants, avatar rendering, no eager downloads, live settings,
Escape/focus return, unmount cleanup, bad hash/retry, lost WebGL and a 390px viewport.
The existing market sign-in/claim/removal browser test also passes. This is local
browser acceptance, not an assertion that a hosted deployment has been updated.
