// Deployment contour of this web app. One explicit switch, OMOBA_CONTOUR, decides
// which Ekza services and which public origins are legitimate. A wrong switch, or
// a setting that belongs to the other contour, is an error: nothing here ever
// falls back to the production services on behalf of a dev deployment.
// Portable: no framework, network or Node-only APIs (also bundled for the browser).

export const CONTOUR_VARIABLE = "OMOBA_CONTOUR";
export const DEFAULT_CONTOUR = "production";
export const DEV_ACCOUNT_API_ORIGIN = "https://account.dev.omoba.io";

/** The only hosted origins each contour may talk to, serve from or link to. */
export const CONTOURS = Object.freeze({
  production: Object.freeze({
    registry: "https://registry.ekza.io",
    studio: "https://studio.ekza.io",
    portal: "https://app.omoba.io",
    site: "https://omoba.io",
  }),
  dev: Object.freeze({
    registry: "https://registry.dev.ekza.io",
    studio: "https://studio.dev.ekza.io",
    portal: "https://app.dev.omoba.io",
    site: "https://dev.omoba.io",
  }),
});

/** DNS zones whose hosts belong to production unless they are dev-contour hosts. */
const PRODUCTION_ZONES = ["omoba.io", "ekza.io"];
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Lower-case, without a trailing dot; anything but a string is "". @param {unknown} hostname */
function normalHost(hostname) {
  return typeof hostname === "string" ? hostname.toLowerCase().replace(/\.$/, "") : "";
}

/** @param {string} hostname */
export function isLoopbackHost(hostname) {
  return LOOPBACK.has(hostname);
}

/**
 * Hosts of the dev contour: `dev.omoba.io`, `*.dev.omoba.io`, `dev.ekza.io`,
 * `*.dev.ekza.io`. A production deployment must never be configured with one.
 * @param {unknown} hostname
 */
export function isDevContourHost(hostname) {
  return /(^|\.)dev\.(omoba|ekza)\.io$/.test(normalHost(hostname));
}

/**
 * Hosts of production: `omoba.io`, `ekza.io` and their subdomains, except the
 * dev-contour hosts. A dev deployment must never be configured with one.
 * @param {unknown} hostname
 */
export function isProductionContourHost(hostname) {
  const host = normalHost(hostname);
  if (!host || isDevContourHost(host)) return false;
  return PRODUCTION_ZONES.some((zone) => host === zone || host.endsWith("." + zone));
}

/**
 * `OMOBA_CONTOUR`: unset or empty means `production`; only `production` and `dev`
 * are valid. Anything else (`prod`, `Dev`, `staging`) throws.
 * @param {Record<string, string | undefined>} [env]
 * @returns {"production" | "dev"}
 */
export function contourName(env = process.env) {
  const raw = env[CONTOUR_VARIABLE];
  if (raw === undefined || raw === "") return DEFAULT_CONTOUR;
  if (raw === "production" || raw === "dev") return raw;
  throw new Error(
    CONTOUR_VARIABLE + ' must be "production" or "dev" (got ' + JSON.stringify(String(raw).slice(0, 40)) + ")",
  );
}

/**
 * Explains an origin that belongs to the other contour, or returns null.
 * @param {"production" | "dev"} contour
 * @param {URL} url
 */
export function foreignOrigin(contour, url) {
  if (contour === "production" && isDevContourHost(url.hostname))
    return "is a dev-contour origin, but " + CONTOUR_VARIABLE + " is production (unset means production); set " + CONTOUR_VARIABLE + "=dev";
  if (contour === "dev" && isProductionContourHost(url.hostname))
    return "is a production origin, but " + CONTOUR_VARIABLE + "=dev";
  return null;
}

/**
 * A hosted service origin for one contour.
 * - unset or empty: the contour's own origin;
 * - the contour's own origin: accepted;
 * - loopback http(s): accepted only with `OMOBA_ALLOW_INSECURE_LOCAL=1` (test doubles);
 * - anything else, in particular the other contour's origin: an error.
 * @param {string | undefined} raw
 * @param {"production" | "dev"} contour
 * @param {"registry" | "studio"} service
 * @param {boolean} allowLocal
 * @param {string} label
 * @returns {string}
 */
export function contourServiceOrigin(raw, contour, service, allowLocal, label) {
  const expected = CONTOURS[contour][service];
  if (raw === undefined || raw === "") return expected;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid " + label + " URL");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error(label + " URL must be a bare origin");
  if (url.origin === expected) return expected;
  if (allowLocal && isLoopbackHost(url.hostname) && (url.protocol === "http:" || url.protocol === "https:"))
    return url.origin;
  const foreign = foreignOrigin(contour, url);
  if (foreign) throw new Error(label + " URL " + url.origin + " " + foreign);
  throw new Error(label + " URL must be " + expected + " (loopback only with OMOBA_ALLOW_INSECURE_LOCAL=1)");
}

/** Host header (`host[:port]`, `[v6]:port`) to a bare hostname; "" when unusable. @param {string | null | undefined} value */
export function requestHostname(value) {
  if (typeof value !== "string" || !value || value.length > 255) return "";
  try {
    return new URL("http://" + value).hostname;
  } catch {
    return "";
  }
}

/**
 * The host a request reached must belong to the contour that answers it: a
 * production build on a dev host (a dev domain attached to the production
 * project) or a dev build on a production host is refused. Loopback and
 * provider hosts such as `*.vercel.app` belong to neither and are accepted.
 * @param {"production" | "dev"} contour
 * @param {unknown} hostname
 * @returns {string | null}
 */
export function contourHostProblem(contour, hostname) {
  const host = normalHost(hostname);
  if (contour === "production" && isDevContourHost(host))
    return "request host " + host + " is a dev-contour host, but this deployment runs with " + CONTOUR_VARIABLE + "=production";
  if (contour === "dev" && isProductionContourHost(host))
    return "request host " + host + " is a production host, but this deployment runs with " + CONTOUR_VARIABLE + "=dev";
  return null;
}

/**
 * `/robots.txt`. The dev contour is public but disallows every crawler;
 * production publishes no robots policy (404), as before.
 * @param {"production" | "dev"} contour
 * @returns {{status: 200, body: string} | {status: 404, body: null}}
 */
export function robotsTxt(contour) {
  if (contour === "dev") return { status: 200, body: "User-agent: *\nDisallow: /\n" };
  return { status: 404, body: null };
}
