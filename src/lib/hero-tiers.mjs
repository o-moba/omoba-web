// Hero tiers on the portal (LR-67, ADR-024/ADR-025): the seven monthly tiers, the
// prices the RU Supporter page offers through YooKassa, the quote the browser shows
// before a payment and the step-down of a player's current tier.
//
// Mirrors the game, value for value (tests/hero-tiers.test.mjs; with
// OMOBA_GAME_REPO=<omoba-bevy> it also reads the game's files):
// - shared/src/supporter.rs: `SupporterTier::points`, `AuraStyle` ids, `tier_until`;
// - account-api/src/supporter/yookassa.rs: `TIER_AMOUNTS_RUB`, `MIN_AMOUNT_MINOR`,
//   `MAX_AMOUNT_MINOR`, `GRANT_SECONDS`; yookassa/checkout.rs `quote` and `receipt_email`;
// - client/src/supporter.rs: the style colours and the Prism hue speeds;
// - client/i18n/<locale>/aura.json: the style names.
//
// Points are never shown to players: pages name tiers, prices in rubles and dates.
// Portable: no framework, network or Node-only APIs (also bundled for the browser).

/** Kopecks per ruble: amounts are integer kopecks, never floats. */
export const KOPECKS = 100;
/** The smallest payment: 100 ₽. */
export const MIN_RUB = 100;
/** The largest payment: 100 000 ₽. */
export const MAX_RUB = 100_000;
/** One payment's grant window in days. */
export const GRANT_DAYS = 30;

/**
 * The tiers, lowest first. `points` is the sum (1 ₽ = 1 point) of the payments inside
 * one 30-day window that reaches the tier; it is also the tier's price on the page.
 * `color` is the game's tint (client `color`), `prism` the hue cycles per second of a
 * shimmering tier (client `prism`; null for a solid colour).
 */
export const TIERS = Object.freeze([
  Object.freeze({ id: "rose", points: 100, color: "#ff6bb8", prism: null }),
  Object.freeze({ id: "jade", points: 250, color: "#1acc73", prism: null }),
  Object.freeze({ id: "azure", points: 500, color: "#267aff", prism: null }),
  Object.freeze({ id: "crimson", points: 1000, color: "#f21a2e", prism: null }),
  Object.freeze({ id: "prism_i", points: 2500, color: null, prism: 0.08 }),
  Object.freeze({ id: "prism_ii", points: 5000, color: null, prism: 0.16 }),
  Object.freeze({ id: "prism_iii", points: 10000, color: null, prism: 0.3 }),
]);

/** The amounts the page offers as cards (the Account API's `TIER_AMOUNTS_RUB`). */
export const TIER_AMOUNTS_RUB = Object.freeze(TIERS.map((tier) => tier.points));

/** The styles any active grant unlocks (Solar, Lunar, Verdant), with their tints. */
export const BASE_STYLES = Object.freeze([
  Object.freeze({ id: "solar", color: "#ffab3d" }),
  Object.freeze({ id: "lunar", color: "#6eb0ff" }),
  Object.freeze({ id: "verdant", color: "#40f5a6" }),
]);

/** Every aura style id, base styles first (shared `AuraStyle::ALL`). */
export const AURA_STYLES = Object.freeze([...BASE_STYLES.map((style) => style.id), ...TIERS.map((tier) => tier.id)]);

/**
 * The game's style names (client/i18n/<locale>/aura.json); the portal's `zh` is the
 * game's `zh-Hans`. Working names: the owner may rename them (LR-67).
 */
export const AURA_NAMES = Object.freeze({
  en: Object.freeze({ solar: "Solar", lunar: "Lunar", verdant: "Verdant", rose: "Rose", jade: "Jade", azure: "Azure", crimson: "Crimson", prism_i: "Prism I", prism_ii: "Prism II", prism_iii: "Prism III" }),
  ru: Object.freeze({ solar: "Солнечная", lunar: "Лунная", verdant: "Изумрудная", rose: "Роза", jade: "Нефрит", azure: "Лазурь", crimson: "Багрянец", prism_i: "Призма I", prism_ii: "Призма II", prism_iii: "Призма III" }),
  zh: Object.freeze({ solar: "日耀", lunar: "月华", verdant: "翠绿", rose: "花光", jade: "翠晶", azure: "天蓝", crimson: "血焰", prism_i: "流光 I", prism_ii: "流光 II", prism_iii: "流光 III" }),
});

/**
 * A style's name in the page language; an unknown id is shown as it is.
 * @param {string} id @param {"en" | "ru" | "zh"} locale
 */
export function auraName(id, locale) {
  const names = AURA_NAMES[locale] ?? AURA_NAMES.en;
  return Object.hasOwn(names, id) ? names[/** @type {"solar"} */ (id)] : id;
}

/**
 * The tier `points` reach, or null below 100 (`SupporterTier::for_points`).
 * @param {number} points
 */
export function tierFor(points) {
  if (!Number.isFinite(points)) return null;
  for (let index = TIERS.length - 1; index >= 0; index--) if (points >= TIERS[index].points) return TIERS[index];
  return null;
}

/**
 * The tier of a style, or null for a base style or an unknown id.
 * @param {string} id
 */
export function tierOfStyle(id) {
  return TIERS.find((tier) => tier.id === id) ?? null;
}

/**
 * Whether a whole ruble amount can be paid (a tier or a custom amount, 100 to 100 000).
 * @param {unknown} rub
 */
export function amountAllowed(rub) {
  return Number.isSafeInteger(rub) && /** @type {number} */ (rub) >= MIN_RUB && /** @type {number} */ (rub) <= MAX_RUB;
}

/**
 * A typed custom amount: whole rubles, digits with optional spaces between groups
 * ("10 000"); null when it is not a whole amount from 100 to 100 000.
 * @param {unknown} input
 */
export function parseRubles(input) {
  if (typeof input !== "string") return null;
  const compact = input.trim().replace(/[\s  ]/g, "");
  if (!/^[1-9][0-9]{0,8}$/.test(compact)) return null;
  const rub = Number(compact);
  return amountAllowed(rub) ? rub : null;
}

/**
 * The quote the browser shows and sends with the payment: exactly the Account API's
 * `quote(amount_rub)` (amount in kopecks, the currency and period of the server's
 * offer, the tier this payment reaches by itself). A quote the server does not agree
 * with answers `409 reload`; the page then reloads the offer.
 * @param {number} rub
 * @param {{currency: string, duration_days: number}} offer the dashboard's `yookassa` block
 * @returns {{amount_minor: number, currency: string, duration_days: number, tier: string | null}}
 */
export function quoteFor(rub, offer) {
  return { amount_minor: rub * KOPECKS, currency: offer.currency, duration_days: offer.duration_days, tier: tierFor(rub)?.id ?? null };
}

/**
 * The receipt e-mail as the Account API accepts it (`receipt_email`): trimmed, at most
 * 254 characters, `local@domain.tld`, without spaces or control characters; else null.
 * @param {unknown} raw
 */
export function receiptEmail(raw) {
  if (typeof raw !== "string") return null;
  const email = raw.trim();
  const at = email.indexOf("@");
  if (at <= 0 || new TextEncoder().encode(email).length > 254 || /[\s\p{Cc}]/u.test(email)) return null;
  const domain = email.slice(at + 1);
  // One "@", and a dot inside the domain: neither its first nor its last character.
  const dotted = domain.slice(1, -1).includes(".");
  return dotted && !domain.includes("@") ? email : null;
}

/**
 * @typedef {{provider: string, valid_from: number, valid_until: number, revoked: boolean, tier_points?: number}} Grant
 * @typedef {{active: boolean, active_until: number | null, grants: Grant[], tier_points?: number, tier_until?: number | null}} Status
 */

/**
 * Tier points of the grants covering `at` (shared `points_at`).
 * @param {readonly Grant[]} grants @param {number} at
 */
export function pointsAt(grants, at) {
  let sum = 0;
  for (const grant of grants) if (!grant.revoked && grant.valid_from <= at && grant.valid_until > at) sum += grant.tier_points ?? 0;
  return sum;
}

/**
 * The step-down of a player's tier: the current tier until its end, then each lower
 * tier the remaining grants keep, until none is left. The current tier and its end
 * are the server's (`tier_points`, `tier_until`: the server's sum is unbounded); the
 * later steps sweep the grant ends after it, as shared `tier_until` does.
 * @param {Status} status @param {number} now epoch seconds
 * @returns {{tier: string, until: number}[]}
 */
export function tierSteps(status, now) {
  const current = status.active ? tierFor(status.tier_points ?? 0) : null;
  if (!current || typeof status.tier_until !== "number" || status.tier_until <= now) return [];
  const steps = [{ tier: current.id, until: status.tier_until }];
  const ends = [...new Set(status.grants
    .filter((grant) => !grant.revoked && (grant.tier_points ?? 0) > 0 && grant.valid_until > status.tier_until)
    .map((grant) => grant.valid_until))].sort((a, b) => a - b);
  let tier = tierFor(pointsAt(status.grants, status.tier_until));
  for (const end of ends) {
    if (!tier) break;
    const next = tierFor(pointsAt(status.grants, end));
    if (next?.id !== tier.id) {
      steps.push({ tier: tier.id, until: end });
      tier = next;
    }
  }
  return steps;
}

/**
 * Whether the player may wear `style` now (shared `AuraStyle::unlocked`): a base style
 * needs any active grant, a tier style also its tier's points.
 * @param {string} style @param {Status} status
 */
export function styleUnlocked(style, status) {
  if (!status.active) return false;
  const tier = tierOfStyle(style);
  return tier === null ? BASE_STYLES.some((base) => base.id === style) : (status.tier_points ?? 0) >= tier.points;
}

/**
 * A ruble amount in kopecks for the page: `1 000 ₽`, `₽1,000` or `₽1,000.50`.
 * @param {number} minor @param {string} locale a BCP 47 tag
 */
export function formatRubles(minor, locale) {
  const whole = minor % KOPECKS === 0;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "RUB", currencyDisplay: "narrowSymbol", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(minor / KOPECKS);
}
