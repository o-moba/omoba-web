// Server-side rules for "Sign in with Ekza" on the market. The BFF holds the
// Registry link token in an HttpOnly cookie; nothing here is sent to the browser
// except the user code, a verified Studio link and the account name.
import { DEFAULT_STUDIO_URL, MARKET_PROJECT } from "./market.mjs";
import { CONTOURS, contourName, contourServiceOrigin, isDevContourHost } from "./contour.mjs";

// Production defaults; the active contour (OMOBA_CONTOUR, contour.mjs) decides.
export const DEFAULT_REGISTRY_URL = CONTOURS.production.registry;
export { DEFAULT_STUDIO_URL };
export const EKZA_LINK_SCOPE = "library-claim";
export const MAX_LINK_SECONDS = 90 * 86400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OWNED_ID = /^ekza:(weapon|avatar):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const USER_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const DEVICE_CODE = /^[A-Za-z0-9_-]{32,128}$/;
export const LINK_TOKEN = /^[A-Za-z0-9_-]{32,256}$/;
const REASONS = new Set(["created", "saved", "claimed"]);

/**
 * Registry and Studio of the active contour (`OMOBA_CONTOUR`, default production).
 * An unknown contour, or an override outside that contour, throws: the market is
 * then unavailable instead of talking to another contour's services.
 * @returns {{registry: string, studio: string}}
 */
export function ekzaConfig(env = process.env) {
  const contour = contourName(env);
  const allowLocal = env.OMOBA_ALLOW_INSECURE_LOCAL === "1";
  return {
    registry: contourServiceOrigin(env.OMOBA_REGISTRY_URL, contour, "registry", allowLocal, "Registry"),
    studio: contourServiceOrigin(env.OMOBA_STUDIO_URL, contour, "studio", allowLocal, "Studio"),
  };
}

/** @param {string | undefined} raw */
function namesDevHost(raw) {
  try {
    return isDevContourHost(new URL(raw || "").hostname);
  } catch {
    return false;
  }
}

/**
 * Studio links are rendered even when the Registry override is misconfigured.
 * Production keeps its rule: a rejected Studio override links the production
 * Studio. Null (links hidden) when the contour is unknown, under dev for any
 * rejected value, and under production for a dev-contour Studio: a link never
 * crosses contours.
 * @returns {string | null}
 */
export function studioOrigin(env = process.env) {
  let contour;
  try {
    contour = contourName(env);
  } catch {
    return null;
  }
  try {
    return contourServiceOrigin(env.OMOBA_STUDIO_URL, contour, "studio", env.OMOBA_ALLOW_INSECURE_LOCAL === "1", "Studio");
  } catch {
    return contour === "production" && !namesDevHost(env.OMOBA_STUDIO_URL) ? CONTOURS.production.studio : null;
  }
}

export function ekzaCookieNames(secure) {
  const prefix = secure ? "__Host-" : "";
  return {
    link: prefix + "omoba-ekza-link",
    device: prefix + "omoba-ekza-device",
    csrf: prefix + "omoba-ekza-csrf",
  };
}

/** Narrow browser surface: everything else is 404 before any upstream request. */
export function ekzaRoute(path, method) {
  if (typeof path !== "string" || path.length > 128) return null;
  if (method === "GET" && path === "csrf") return { action: "csrf" };
  if (method === "GET" && path === "library") return { action: "library" };
  if (method === "POST" && path === "device") return { action: "start" };
  if (method === "POST" && path === "device/poll") return { action: "poll" };
  if (method === "POST" && path === "sign-out") return { action: "sign-out" };
  const claim = /^library\/([^/]+)$/.exec(path);
  if (claim && UUID.test(claim[1])) {
    if (method === "POST") return { action: "claim", assetId: claim[1] };
    if (method === "DELETE") return { action: "unclaim", assetId: claim[1] };
  }
  return null;
}

function seconds(expiresAt, now, min, max) {
  const at = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(at) || at <= now) return null;
  return Math.max(min, Math.min(max, Math.floor((at - now) / 1000)));
}

/** The Studio approval page is the only link a player is sent to. */
export function safeVerificationUrl(value, studio, userCode) {
  try {
    const url = new URL(value);
    if (
      url.origin !== studio ||
      url.username ||
      url.password ||
      url.hash ||
      url.pathname !== "/studio" ||
      url.searchParams.get("view") !== "connect" ||
      url.searchParams.get("code") !== userCode ||
      [...url.searchParams.keys()].some((key) => key !== "view" && key !== "code")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function parseDeviceStart(value, studio, now = Date.now()) {
  if (
    !value ||
    typeof value.deviceCode !== "string" ||
    !DEVICE_CODE.test(value.deviceCode) ||
    typeof value.userCode !== "string" ||
    !USER_CODE.test(value.userCode)
  )
    throw new Error("Invalid device response");
  const maxAge = seconds(value.expiresAt, now, 30, 900);
  if (maxAge === null) throw new Error("Invalid device expiry");
  const interval = Number.isSafeInteger(value.interval) ? Math.max(1, Math.min(30, value.interval)) : 3;
  return {
    deviceCode: value.deviceCode,
    maxAge,
    browser: {
      userCode: value.userCode,
      verificationUrl: safeVerificationUrl(value.verificationUrl, studio, value.userCode),
      expiresAt: new Date(Date.parse(value.expiresAt)).toISOString(),
      interval,
    },
  };
}

export function parsePoll(value, now = Date.now()) {
  if (value?.status === "pending") return { status: "pending" };
  if (value?.status !== "approved") throw new Error("Invalid poll response");
  if (typeof value.accessToken !== "string" || !LINK_TOKEN.test(value.accessToken))
    throw new Error("Invalid link token");
  if (value.projectId !== MARKET_PROJECT) throw new Error("Link is for another project");
  const username = value.account?.username;
  if (typeof username !== "string" || !username.trim() || username.length > 120 || /[\u0000-\u001f\u007f]/.test(username))
    throw new Error("Invalid account");
  const maxAge = seconds(value.expiresAt, now, 60, MAX_LINK_SECONDS);
  if (maxAge === null) throw new Error("Invalid link expiry");
  return {
    status: "approved",
    // Older Registries omit the scope; a wrong scope is reported on first claim.
    scope: typeof value.scope === "string" ? value.scope : null,
    accessToken: value.accessToken,
    maxAge,
    username: username.trim(),
    expiresAt: new Date(Date.parse(value.expiresAt)).toISOString(),
  };
}

/** Library ownership: additive `assets` (C1) plus legacy avatar `items`. */
export function parseLibrary(value) {
  if (!value || value.schema !== "ekza.account.library.v1" || value.projectId !== MARKET_PROJECT)
    throw new Error("Invalid library response");
  const username = value.account?.username;
  if (typeof username !== "string" || !username.trim() || username.length > 120 || /[\u0000-\u001f\u007f]/.test(username))
    throw new Error("Invalid account");
  const owned = new Map();
  const add = (entry, legacy) => {
    const match = typeof entry?.id === "string" ? OWNED_ID.exec(entry.id) : null;
    if (!match || owned.has(match[2])) return;
    if (legacy && match[1] !== "avatar") return;
    const reason = REASONS.has(entry.library?.reason) ? entry.library.reason : null;
    owned.set(match[2], { assetId: match[2], kind: match[1], reason });
  };
  // One malformed entry never drops the session.
  if (Array.isArray(value.assets)) value.assets.slice(0, 2000).forEach((entry) => add(entry, false));
  if (Array.isArray(value.items)) value.items.slice(0, 2000).forEach((entry) => add(entry, true));
  const expires = Date.parse(value.expiresAt);
  return {
    username: username.trim(),
    expiresAt: Number.isFinite(expires) ? new Date(expires).toISOString() : "",
    owned: [...owned.values()],
  };
}

/**
 * Upstream failure -> stable browser code. Raw Registry messages are not forwarded.
 * A link the Registry will never accept again (401, or 403 `link_scope`) is cleared,
 * so a reload does not show a sign-in that cannot work.
 */
export function upstreamFailure(action, status, body) {
  const code = body && typeof body === "object" && body.error && typeof body.error.code === "string" ? body.error.code : null;
  const linked = action !== "start" && action !== "poll";
  if (status === 401) return { status: 401, code: "link_expired", clearLink: linked };
  if (status === 403 && code === "link_scope") return { status: 403, code: "link_scope", clearLink: linked };
  if (status === 404 && code === "asset_not_available") return { status: 404, code: "asset_not_available" };
  // Created items, Studio saves and other games' claims stay; the player manages them in Studio.
  if (action === "unclaim" && status === 409 && code === "claim_not_removable") return { status: 409, code: "claim_not_removable" };
  // An older Registry rejects the scope (422) or has no claim route (404/405).
  if ((action === "start" && status === 422) || ((action === "claim" || action === "unclaim") && (status === 404 || status === 405)))
    return { status: 501, code: "claims_unsupported" };
  if (action === "poll" && status === 410) return { status: 410, code: "device_expired", clearDevice: true };
  if (status === 429) return { status: 429, code: "rate_limited" };
  if (status >= 500) return { status: 503, code: "registry_unavailable" };
  return { status: 502, code: "registry_error" };
}
