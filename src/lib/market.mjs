// Portable parser for the public Ekza Registry catalogue (ekza.asset.catalog.v2).
// No network, framework or cookie access: the server module fetches, this decides
// what is safe to render. One malformed item is skipped; a malformed document fails.
export const MAX_MARKET_BYTES = 2 * 1024 * 1024;
export const MAX_MARKET_ITEMS = 500;
export const MARKET_PROJECT = "omoba";
export const MARKET_PLATFORM = "desktop";
export const WILDSPARK_SET_REQUIREMENT = "wildspark.handheld.set";
export const DEFAULT_STUDIO_URL = "https://studio.ekza.io";
const PROFILES = { weapon: "handheld-glb-v1", avatar: "humanoid-glb-v1" };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ASSET_ID = new RegExp(`^ekza:(weapon|avatar):(${UUID})$`);
const BARE_UUID = new RegExp(`^${UUID}$`);
const HASH = /^[a-f0-9]{64}$/;
const REQUIREMENT = /^[a-z][a-z0-9_.-]{0,127}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

class Skip extends Error {}
function fail(message) {
  throw new Error("Invalid market catalogue: " + message);
}
function skip(message) {
  throw new Skip(message);
}
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
function text(value, at, max, { empty = false } = {}) {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.length > max ||
    CONTROL.test(value)
  )
    skip(at + " must be bounded text");
  return value.trim();
}
/** Registry files are content-addressed under the configured origin only. */
function registryFile(value, registryOrigin, sha, kinds) {
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const url = new URL(value);
    const match = /^\/v1\/studio\/assets\/([a-f0-9]{64})\/([a-z-]+)$/.exec(url.pathname);
    if (
      url.origin !== registryOrigin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !match ||
      !kinds.includes(match[2]) ||
      (sha && match[1] !== sha)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

/** @returns {import('./market-types').MarketItem} */
function item(value, registryOrigin) {
  if (!object(value)) skip("item must be an object");
  const id = typeof value.id === "string" ? ASSET_ID.exec(value.id) : null;
  if (!id) skip("unsupported asset ID");
  const kind = id[1];
  if (value.assetKind !== kind) skip("asset kind does not match its ID");
  // Only free Studio items can be claimed in place. Owned (paid/on-chain)
  // templates need a purchase flow and are not listed.
  if (value.access !== "free") skip("not free");
  if (!object(value.origin) || value.origin.kind !== "studio") skip("not a Studio item");
  const revisionId =
    typeof value.origin.revisionId === "string" && BARE_UUID.test(value.origin.revisionId)
      ? value.origin.revisionId
      : skip("revision ID");
  const profile = PROFILES[kind];
  if (!Array.isArray(value.projectSupport) || value.projectSupport.length > 64)
    skip("project support");
  const support = value.projectSupport.find(
    (s) =>
      object(s) &&
      s.projectId === MARKET_PROJECT &&
      s.platform === MARKET_PLATFORM &&
      s.profile === profile &&
      s.status === "approved",
  );
  if (!support) skip("not approved for OMOBA");
  let requirementId = null;
  if (support.requirementId != null) {
    if (typeof support.requirementId !== "string" || !REQUIREMENT.test(support.requirementId))
      skip("requirement ID");
    requirementId = support.requirementId;
  }
  if (!Array.isArray(value.renditions) || value.renditions.length > 64) skip("renditions");
  const rendition = value.renditions.find(
    (r) => object(r) && r.platform === MARKET_PLATFORM && r.profile === profile && r.format === "glb",
  );
  if (!rendition || typeof rendition.sha256 !== "string" || !HASH.test(rendition.sha256))
    skip("no OMOBA rendition");
  if (
    !Number.isSafeInteger(rendition.sizeBytes) ||
    rendition.sizeBytes < 1 ||
    rendition.sizeBytes > 256 * 1024 * 1024
  )
    skip("rendition size");
  if (!registryFile(rendition.downloadUrl, registryOrigin, rendition.sha256, ["rendition"]))
    skip("rendition URL is not a Registry file");
  if (!object(value.license) || !object(value.creator)) skip("license or creator");
  return {
    id: value.id,
    assetId: id[2],
    kind,
    name: text(value.name, "name", 160),
    description: text(value.description ?? "", "description", 4000, { empty: true }),
    creator: text(value.creator.name, "creator", 120),
    license: {
      text: text(value.license.text, "license", 64),
      attribution: text(value.license.attribution ?? "", "attribution", 2000, { empty: true }),
    },
    // A foreign or malformed preview is dropped, not rendered.
    thumbnailUrl: registryFile(value.thumbnailUrl, registryOrigin, null, ["rendition-thumbnail"]),
    requirementId,
    wildspark: kind === "weapon" && requirementId === WILDSPARK_SET_REQUIREMENT,
    revisionId,
    profile,
    sha256: rendition.sha256,
    sizeBytes: rendition.sizeBytes,
  };
}

/** @returns {{items: import('./market-types').MarketItem[], skipped: number}} */
export function parseMarket(value, registryOrigin) {
  if (typeof value === "string") {
    if (new TextEncoder().encode(value).length > MAX_MARKET_BYTES) fail("response too large");
    try {
      value = JSON.parse(value);
    } catch {
      fail("malformed JSON");
    }
  }
  if (!object(value) || value.schema !== "ekza.asset.catalog.v2") fail("unsupported schema");
  if (!Array.isArray(value.items) || value.items.length > MAX_MARKET_ITEMS) fail("items");
  let origin = null;
  try {
    origin = new URL(registryOrigin).origin;
  } catch {}
  if (origin !== registryOrigin) fail("registry origin");
  const items = new Map();
  let skipped = 0;
  for (const raw of value.items) {
    try {
      const parsed = item(raw, registryOrigin);
      if (items.has(parsed.id)) skip("duplicate");
      items.set(parsed.id, parsed);
    } catch (error) {
      if (!(error instanceof Skip)) throw error;
      skipped++;
    }
  }
  return {
    items: [...items.values()].sort(
      (a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id),
    ),
    skipped,
  };
}

/** Featured Wildspark sets first; the remaining weapons; then avatars. */
export function marketGroups(items) {
  return {
    wildspark: items.filter((i) => i.wildspark),
    weapons: items.filter((i) => i.kind === "weapon" && !i.wildspark),
    avatars: items.filter((i) => i.kind === "avatar"),
  };
}

/** Wildspark's Q guns are contributed as one repeater + launcher set (C4/C5). */
export function isWildsparkHandheld(requirementId) {
  return (
    requirementId === WILDSPARK_SET_REQUIREMENT ||
    requirementId === "wildspark.handheld.repeater" ||
    requirementId === "wildspark.handheld.launcher"
  );
}

/** Studio draft entry point. Only Wildspark handhelds carry requirement context today. */
export function studioDraftUrl(studioOrigin = DEFAULT_STUDIO_URL, requirementId) {
  const url = new URL("/studio", studioOrigin);
  url.searchParams.set("view", "new");
  if (isWildsparkHandheld(requirementId)) {
    url.searchParams.set("kind", "weapon");
    url.searchParams.set("project", MARKET_PROJECT);
    url.searchParams.set("requirement", WILDSPARK_SET_REQUIREMENT);
  }
  return url.href;
}

/** Device-poll failures that waiting can fix: a busy, cold or unreachable Registry or BFF. */
const TRANSIENT_POLL_FAILURES = new Set(["registry_unavailable", "rate_limited"]);
export const MAX_POLL_BACKOFF_SECONDS = 30;

/**
 * Milliseconds until the next device poll after `failures` consecutive failed
 * polls, the last one ending in `code`; null when waiting cannot help (expired
 * code, wrong scope, stale page, unexpected answer). Backoff doubles from the
 * device interval up to 30 s; a longer Retry-After wins, up to 5 minutes.
 */
export function devicePollRetry(code, failures, interval, retryAfter = null) {
  if (!TRANSIENT_POLL_FAILURES.has(code)) return null;
  const base = Number.isSafeInteger(interval) && interval > 0 ? interval : 3;
  const backoff = Math.min(MAX_POLL_BACKOFF_SECONDS, base * 2 ** Math.min(Math.max(failures, 1) - 1, 8));
  const asked = Number.isSafeInteger(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 300) : 0;
  return Math.max(backoff, asked) * 1000;
}
