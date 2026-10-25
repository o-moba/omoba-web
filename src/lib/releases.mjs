// The game's download catalog as players see it (LR-22): the Account API's
// `GET /v1/releases` (OMOBA_RELEASE_CATALOG, written by the game's
// `scripts/release.py catalog`), checked, reduced to the direct downloads a browser
// may offer and formatted for the page language. Portable: no framework, network or
// Node-only APIs (also bundled for the browser).

/** Display order and names of the platforms the catalog lists. */
export const RELEASE_PLATFORMS = Object.freeze({
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
});

/** The only channel a web page offers: installed from the market's own downloads. */
export const DIRECT_CHANNEL = "direct";

/**
 * The release status labels the game's markets publish (scripts/markets.py
 * `release_label`), in every page language. An unknown label is shown as written.
 */
export const RELEASE_STATUS_LABELS = Object.freeze({
  "Открытая бета": Object.freeze({ en: "Open beta", ru: "Открытая бета", zh: "公开测试" }),
  playtest: Object.freeze({ en: "Playtest", ru: "Тестовая сборка", zh: "测试版" }),
});

/** Megabytes (2^20 bytes, as file managers count them) in each page language. */
const MEGABYTE = Object.freeze({ en: "MB", ru: "МБ", zh: "MB" });
const HEX64 = /^[0-9a-f]{64}$/;
const DECIMAL = /^[1-9][0-9]{0,15}$/;
const SHORT = /^[^\u0000-\u001f\u007f]{1,64}$/;

/** @param {unknown} value */
function httpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * One catalog entry as the page may show it, or null when it is not a direct download
 * of a known platform with an https link, a SHA-256 and a size.
 * @param {unknown} value
 * @returns {import('./releases.d.mts').Release | null}
 */
export function directRelease(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = /** @type {Record<string, unknown>} */ (value);
  if (entry.channel !== undefined && entry.channel !== DIRECT_CHANNEL) return null;
  if (typeof entry.platform !== "string" || !Object.hasOwn(RELEASE_PLATFORMS, entry.platform)) return null;
  const url = httpsUrl(entry.url);
  if (!url || typeof entry.sha256 !== "string" || !HEX64.test(entry.sha256)) return null;
  if (typeof entry.size_bytes !== "string" || !DECIMAL.test(entry.size_bytes)) return null;
  for (const key of ["architecture", "version", "published_at", "test_status"])
    if (typeof entry[key] !== "string" || !SHORT.test(/** @type {string} */ (entry[key]))) return null;
  return {
    platform: entry.platform,
    architecture: /** @type {string} */ (entry.architecture),
    version: /** @type {string} */ (entry.version),
    url,
    sha256: entry.sha256,
    size_bytes: entry.size_bytes,
    published_at: /** @type {string} */ (entry.published_at),
    instructions: typeof entry.instructions === "string" ? entry.instructions.slice(0, 1000) : "",
    test_status: /** @type {string} */ (entry.test_status),
  };
}

/**
 * The downloads a page offers: direct entries only, the newest per platform and
 * architecture, in platform order. Mirrors and store channels are never offered.
 * @param {unknown} catalog `{releases: [...]}` as the Account API answers
 * @returns {import('./releases.d.mts').Release[]}
 */
export function pageReleases(catalog) {
  const list = catalog && typeof catalog === "object" && Array.isArray(/** @type {{releases?: unknown}} */ (catalog).releases)
    ? /** @type {{releases: unknown[]}} */ (catalog).releases : [];
  /** @type {Map<string, import('./releases.d.mts').Release>} */
  const newest = new Map();
  for (const value of list.slice(0, 64)) {
    const release = directRelease(value);
    if (!release) continue;
    const key = release.platform + "/" + release.architecture;
    const seen = newest.get(key);
    if (!seen || Date.parse(release.published_at) > Date.parse(seen.published_at)) newest.set(key, release);
  }
  const order = Object.keys(RELEASE_PLATFORMS);
  return [...newest.values()].sort((a, b) =>
    order.indexOf(a.platform) - order.indexOf(b.platform) || a.architecture.localeCompare(b.architecture));
}

/**
 * A package size in megabytes for the page language: `312,4 МБ`, `312.4 MB`.
 * @param {string | number} bytes @param {"en" | "ru" | "zh"} locale
 */
export function releaseSize(bytes, locale) {
  const value = Number(bytes) / (1024 * 1024);
  const tag = locale === "zh" ? "zh-CN" : locale;
  const number = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  return number + " " + (MEGABYTE[locale] ?? MEGABYTE.en);
}

/**
 * The release status in the page language (`Открытая бета` → `Open beta`).
 * @param {string} status @param {"en" | "ru" | "zh"} locale
 */
export function releaseStatus(status, locale) {
  return Object.hasOwn(RELEASE_STATUS_LABELS, status) ? RELEASE_STATUS_LABELS[status][locale] : status;
}

/** @param {string} platform */
export function releasePlatform(platform) {
  return Object.hasOwn(RELEASE_PLATFORMS, platform) ? RELEASE_PLATFORMS[platform] : platform;
}
