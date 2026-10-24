// Build market of this web app: which storefront rules, services and sign-in one
// deployment of the player portal serves. Mirrors the game's `shared/src/market.rs`
// exactly: the same variable names, values, presets and override semantics.
//
// - `global` (unset or empty `OMOBA_MARKET`): Europe and the rest of the world,
//   today's product: the Ekza ecosystem and paid Hero Supporter cosmetics.
// - `ru`: Russia. Free, no Ekza, no payments, sign-in with VK ID (VK, OK, Mail.ru).
// - `cn`: mainland China. Free, no Ekza, no payments; providers not decided yet.
//
// One feature may be flipped per build with `OMOBA_FEATURE_<NAME>=on|off` (empty
// keeps the preset). An unknown market or switch value is an error (fail closed),
// never a fallback. The market is independent of the contour (contour.mjs).
// Portable: no framework, network or Node-only APIs (also bundled for the browser).

export const MARKET_VARIABLE = "OMOBA_MARKET";
export const DEFAULT_MARKET = "global";
export const MARKETS = Object.freeze(["global", "ru", "cn"]);
/** The VK ID app (one public client for VK, OK and Mail.ru); server-only, never a secret. */
export const VKID_CLIENT_VARIABLE = "OMOBA_VKID_CLIENT_ID";

/** `release.py --feature <key>` and `OMOBA_FEATURE_<KEY>`, as in market.rs `Feature`. */
export const FEATURES = Object.freeze([
  Object.freeze({ name: "ekza", key: "ekza", env: "OMOBA_FEATURE_EKZA" }),
  Object.freeze({ name: "supporter", key: "supporter", env: "OMOBA_FEATURE_SUPPORTER" }),
  Object.freeze({ name: "vkSignIn", key: "vk_sign_in", env: "OMOBA_FEATURE_VK_SIGN_IN" }),
]);

/** Each market's preset (market.rs `Market::default_features`). */
export const MARKET_PRESETS = Object.freeze({
  global: Object.freeze({ ekza: true, supporter: true, vkSignIn: false }),
  ru: Object.freeze({ ekza: false, supporter: false, vkSignIn: true }),
  cn: Object.freeze({ ekza: false, supporter: false, vkSignIn: false }),
});

/** Fallback page language when the player has not chosen one; null keeps negotiation. */
export const MARKET_LOCALES = Object.freeze({ global: null, ru: "ru", cn: "zh" });

/**
 * Pages that exist only with a feature. `/creators`, `/market` and `/sponsor` are
 * Ekza surfaces (Registry, Studio, Ekza library); `/supporter` and `/supporters`
 * belong to the paid Hero membership.
 */
export const FEATURE_ROUTES = Object.freeze({
  "/creators": "ekza",
  "/market": "ekza",
  "/sponsor": "ekza",
  "/supporter": "supporter",
  "/supporters": "supporter",
});

/** @param {unknown} value */
function shown(value) {
  return JSON.stringify(String(value).slice(0, 40));
}

/**
 * `OMOBA_MARKET`: unset or empty is `global`; only `global`, `ru` and `cn` (exact,
 * lower case) are valid. Anything else throws.
 * @param {Record<string, string | undefined>} [env]
 * @returns {"global" | "ru" | "cn"}
 */
export function marketName(env = process.env) {
  const raw = env[MARKET_VARIABLE];
  if (raw === undefined || raw === "") return DEFAULT_MARKET;
  if (raw === "global" || raw === "ru" || raw === "cn") return raw;
  throw new Error(MARKET_VARIABLE + ' must be empty, "global", "ru" or "cn" (got ' + shown(raw) + ")");
}

/**
 * One override: unset or empty keeps the preset, `on`/`off` (exact) flip it.
 * @param {string | undefined} raw @param {boolean} preset @param {string} variable
 */
function featureSwitch(raw, preset, variable) {
  if (raw === undefined || raw === "") return preset;
  if (raw === "on") return true;
  if (raw === "off") return false;
  throw new Error(variable + ' must be empty, "on" or "off" (got ' + shown(raw) + ")");
}

/**
 * The market's preset with its `OMOBA_FEATURE_*` overrides applied.
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ekza: boolean, supporter: boolean, vkSignIn: boolean}}
 */
export function marketFeatures(env = process.env) {
  const preset = MARKET_PRESETS[marketName(env)];
  /** @type {Record<string, boolean>} */
  const features = {};
  for (const feature of FEATURES)
    features[feature.name] = featureSwitch(env[feature.env], preset[/** @type {"ekza"} */ (feature.name)], feature.env);
  return /** @type {{ekza: boolean, supporter: boolean, vkSignIn: boolean}} */ (Object.freeze(features));
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{market: "global" | "ru" | "cn", features: {ekza: boolean, supporter: boolean, vkSignIn: boolean}}}
 */
export function marketProfile(env = process.env) {
  return { market: marketName(env), features: marketFeatures(env) };
}

/**
 * The same line as market.rs `describe`: `ru (ekza off, supporter off, vk_sign_in on)`.
 * @param {{market: string, features: Record<string, boolean>}} profile
 */
export function describeMarket(profile) {
  const flags = FEATURES.map((f) => f.key + " " + (profile.features[f.name] ? "on" : "off")).join(", ");
  return profile.market + " (" + flags + ")";
}

/**
 * `OMOBA_VKID_CLIENT_ID`: the numeric VK ID app id, or null when unset/empty.
 * A non-numeric value throws (a typo must not silently hide sign-in).
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null}
 */
export function vkIdClientId(env = process.env) {
  const raw = env[VKID_CLIENT_VARIABLE];
  if (raw === undefined || raw === "") return null;
  if (/^[1-9][0-9]{0,19}$/.test(raw)) return raw;
  throw new Error(VKID_CLIENT_VARIABLE + " must be the numeric VK ID app id (got " + shown(raw) + ")");
}

/**
 * Sign in with VK ID is offered only when the feature is on AND the app id is set.
 * @param {Record<string, string | undefined>} [env]
 */
export function vkSignInClientId(env = process.env) {
  return marketFeatures(env).vkSignIn ? vkIdClientId(env) : null;
}

/** @param {unknown} error */
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Every market problem of an environment, empty when it is valid.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function marketProblems(env = process.env) {
  const problems = [];
  try {
    marketName(env);
  } catch (error) {
    problems.push(message(error));
  }
  for (const feature of FEATURES) {
    try {
      featureSwitch(env[feature.env], false, feature.env);
    } catch (error) {
      problems.push(message(error));
    }
  }
  try {
    vkIdClientId(env);
  } catch (error) {
    problems.push(message(error));
  }
  return problems;
}

/**
 * Throws when the market is misconfigured; otherwise returns the profile.
 * @param {Record<string, string | undefined>} [env]
 */
export function assertMarket(env = process.env) {
  const problems = marketProblems(env);
  if (problems.length)
    throw new Error("OMOBA market misconfigured, refusing to build or serve (fail closed):\n  - " + problems.join("\n  - "));
  return marketProfile(env);
}

/**
 * Route gating and nav are fixed when the app is built, so a build may only run
 * with the market and features it was built for.
 * @param {string | undefined} built the `describeMarket` line inlined at build time
 * @param {{market: string, features: Record<string, boolean>}} running
 */
export function assertBuiltMarket(built, running) {
  const actual = describeMarket(running);
  if (built !== actual)
    throw new Error(
      "OMOBA market mismatch, refusing to serve (fail closed): this build was made for " +
        (built || "<unknown>") + " but runs as " + actual + "; rebuild with the runtime " + MARKET_VARIABLE + " and OMOBA_FEATURE_*",
    );
}

/**
 * The feature a page needs, or null. `/market/x` belongs to `/market`.
 * @param {string} pathname
 * @returns {"ekza" | "supporter" | null}
 */
export function routeFeature(pathname) {
  for (const [route, feature] of Object.entries(FEATURE_ROUTES))
    if (pathname === route || pathname.startsWith(route + "/")) return /** @type {"ekza" | "supporter"} */ (feature);
  return null;
}

/**
 * @param {string} pathname
 * @param {{ekza: boolean, supporter: boolean}} features
 */
export function routeEnabled(pathname, features) {
  const feature = routeFeature(pathname);
  return feature === null || features[feature] === true;
}

/**
 * Keeps the links whose page exists in this market (sidebar, mobile nav, guest card).
 * @template {string | readonly [string, ...unknown[]]} T
 * @param {readonly T[]} items an href or a tuple starting with one
 * @param {{ekza: boolean, supporter: boolean}} features
 * @returns {T[]}
 */
export function navForMarket(items, features) {
  return items.filter((item) => routeEnabled(typeof item === "string" ? item : item[0], features));
}

/** @param {"global" | "ru" | "cn"} market */
export function marketLocale(market) {
  return MARKET_LOCALES[market] ?? null;
}
