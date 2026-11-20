// The BFF side of a YooKassa payment (LR-67): the Idempotency-Key of one payment
// attempt is generated here, on the server, and kept across retries of that attempt.
//
// The Account API keys an attempt by (profile, Idempotency-Key); the same key repeats
// the same attempt (and so the same YooKassa payment), never a second charge. The
// browser cannot choose the key: the BFF keeps it in an HttpOnly cookie together with a
// fingerprint of what defines the attempt for the API (the session, the amount, the
// receipt e-mail and the offer version; the quote is checked by the API, not part of
// the attempt). A retry with the same fingerprint (a double click, a lost reply, a
// reload) sends the same key; another amount, e-mail or offer starts a new attempt.
// The key is forgotten when the attempt is over: the API reports its payment succeeded,
// canceled or in review, or the player signs out. It lives one hour at most, the time
// after which the Account API closes an attempt that was never posted.
//
// Server-only (node:crypto). The rules mirror the owner's YooKassa integration
// (one key per checkout attempt, reset only when that attempt is finished).
import { createHash, randomBytes } from "node:crypto";
import { amountAllowed, receiptEmail } from "./hero-tiers.mjs";

/** The checkout and the owner's payment list (Account API, LR-67b). */
export const CHECKOUT_PATH = "me/supporter/yookassa/checkout";
export const PAYMENTS_PATH = "me/supporter/yookassa/payments";
/** The attempt cookie's lifetime (the Account API's `PRISTINE_SECONDS`). */
export const CHECKOUT_COOKIE_SECONDS = 3600;
/** 409 codes after which the attempt of this key is over: the next payment needs a new key. */
export const FINISHED_CODES = Object.freeze(["payment_succeeded", "payment_canceled", "payment_manual_review", "idempotency_conflict"]);
/** Payment-list statuses of a finished attempt. */
export const FINISHED_STATUSES = Object.freeze(["succeeded", "canceled", "review"]);

const HEX64 = /^[0-9a-f]{64}$/;
const ATTEMPT = /^[0-9a-f]{32}$/;
const OFFER_VERSION = /^[A-Za-z0-9._-]{1,40}$/;

/**
 * The checkout body the browser may send: exactly `amount_rub` (a whole amount from
 * 100 to 100 000), `receipt_email`, `quote` (an object, passed through for the API to
 * compare) and `offer_version`. Returns what identifies the attempt, or null.
 * @param {unknown} body
 * @returns {{amountRub: number, email: string, offerVersion: string} | null}
 */
export function checkoutRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = /** @type {Record<string, unknown>} */ (body);
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== "amount_rub,offer_version,quote,receipt_email") return null;
  const email = receiptEmail(value.receipt_email);
  if (!amountAllowed(value.amount_rub) || !email || typeof value.offer_version !== "string" || !OFFER_VERSION.test(value.offer_version)) return null;
  if (!value.quote || typeof value.quote !== "object" || Array.isArray(value.quote)) return null;
  return { amountRub: /** @type {number} */ (value.amount_rub), email, offerVersion: value.offer_version };
}

/**
 * What defines one attempt for this browser: the session and the API's attempt fields.
 * @param {string} session the session cookie ("" without one)
 * @param {{amountRub: number, email: string, offerVersion: string}} request
 */
export function checkoutFingerprint(session, request) {
  return createHash("sha256")
    .update(["omoba.yookassa.checkout.v1", session, String(request.amountRub), request.email, request.offerVersion].join("\0"))
    .digest("hex");
}

/** A new Idempotency-Key: 32 random bytes as 64 lowercase hex characters. */
export function newCheckoutKey() {
  return randomBytes(32).toString("hex");
}

/**
 * The attempt cookie: `<key>.<fingerprint>[.<attempt id>]`.
 * @param {{key: string, fingerprint: string, attempt?: string | null}} saved
 */
export function checkoutCookie(saved) {
  return [saved.key, saved.fingerprint, ...(saved.attempt ? [saved.attempt] : [])].join(".");
}

/**
 * @param {string | undefined | null} value
 * @returns {{key: string, fingerprint: string, attempt: string | null} | null}
 */
export function parseCheckoutCookie(value) {
  const parts = typeof value === "string" ? value.split(".") : [];
  if (parts.length < 2 || parts.length > 3 || !HEX64.test(parts[0]) || !HEX64.test(parts[1])) return null;
  if (parts.length === 3 && !ATTEMPT.test(parts[2])) return null;
  return { key: parts[0], fingerprint: parts[1], attempt: parts[2] ?? null };
}

/**
 * The key for this request: the saved one when the request repeats its attempt, else a
 * new one (and no attempt id yet).
 * @param {{key: string, fingerprint: string, attempt: string | null} | null} saved
 * @param {string} fingerprint
 * @param {() => string} [fresh]
 */
export function checkoutAttempt(saved, fingerprint, fresh = newCheckoutKey) {
  if (saved && saved.fingerprint === fingerprint) return { ...saved, reused: true };
  return { key: fresh(), fingerprint, attempt: null, reused: false };
}

/**
 * Whether an answer of the checkout ends the attempt of its key.
 * @param {number} status @param {unknown} code
 */
export function checkoutFinished(status, code) {
  return status === 409 && typeof code === "string" && FINISHED_CODES.includes(code);
}

/**
 * Whether the payment list shows the saved attempt as finished.
 * @param {unknown} result the Account API's `{payments: [...]}`
 * @param {string | null} attempt
 */
export function attemptFinished(result, attempt) {
  if (!attempt || !result || typeof result !== "object") return false;
  const payments = /** @type {{payments?: unknown}} */ (result).payments;
  if (!Array.isArray(payments)) return false;
  return payments.some((payment) => payment && payment.attempt_id === attempt && FINISHED_STATUSES.includes(payment.status));
}

/**
 * The YooKassa redirect the browser may follow: HTTPS, no credentials; else null.
 * @param {unknown} value
 */
export function confirmationUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * The attempt id the checkout answered with, when it is well formed.
 * @param {unknown} value
 */
export function attemptId(value) {
  return typeof value === "string" && ATTEMPT.test(value) ? value : null;
}
