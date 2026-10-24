// Sign in with VK ID (VK, OK and Mail.ru are one VK ID app: a public client,
// OAuth 2.1 with PKCE S256, no client secret). The portal only starts the
// authorization and forwards VK's answer server-to-server to the Account API,
// which exchanges the code, verifies the identity and answers with a session or
// an unlinked ticket. No VK token, code or verifier is ever rendered, logged or
// put into a portal URL; the attempt lives in one short HttpOnly cookie.
import { createHash, randomBytes } from 'node:crypto';
import { OPAQUE_SECRET, cookieOptions, expireCookie, safeEqual } from './security.mjs';
import { portalReturnTo } from './navigation.mjs';

export const VK_AUTHORIZE_URL = 'https://id.vk.ru/authorize';
export const VK_SCOPE = 'vkid.personal_info';
/** Which account type the player signs in with: VK, Odnoklassniki or Mail.ru. */
export const VK_METHODS = Object.freeze(['vkid', 'ok_ru', 'mail_ru']);
export const VK_CALLBACK_PATH = '/api/auth/vk/callback';
export const VK_ATTEMPT_MAX_AGE = 600;
export const SOCIAL_TICKET_MAX_AGE = 1800;
export const SESSION_MAX_AGE = 7 * 86400;
/** The only `?signin=` values the portal shows (each has a localized message). */
export const SIGNIN_FAILURES = Object.freeze(['failed', 'cancelled', 'rejected', 'provider_unavailable', 'unavailable', 'session_limit', 'rate_limited']);
const MAX_REPLY = 64 * 1024;

/** @param {Buffer} buffer */
export function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 S256: BASE64URL(SHA256(ASCII(code_verifier))). @param {string} verifier */
export function pkceChallenge(verifier) {
  return base64url(createHash('sha256').update(verifier, 'ascii').digest());
}

/** @param {unknown} value */
export function isVerifier(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

/**
 * A fresh attempt: 32 random bytes of state (hex) and a 43-character verifier.
 * @param {(size: number) => Buffer} [random]
 */
export function newVkAttempt(random = randomBytes) {
  return { state: random(32).toString('hex'), verifier: base64url(random(32)) };
}

/** `redirect_uri`, exactly as registered in the VK ID app. @param {string} origin */
export function vkRedirectUri(origin) {
  return origin + VK_CALLBACK_PATH;
}

/**
 * @param {{clientId: string, redirectUri: string, state: string, verifier: string, method: string}} options
 */
export function vkAuthorizeUrl({ clientId, redirectUri, state, verifier, method }) {
  const url = new URL(VK_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
    scope: VK_SCOPE,
    provider: method,
  }).toString();
  return url.toString();
}

/**
 * The attempt cookie: `state.verifier.method.returnTo` (returnTo base64url).
 * @param {{state: string, verifier: string, method: string, returnTo: string}} attempt
 */
export function encodeVkCookie({ state, verifier, method, returnTo }) {
  return [state, verifier, method, base64url(Buffer.from(returnTo, 'utf8'))].join('.');
}

/**
 * @param {string | undefined} raw
 * @param {{ekza: boolean, supporter: boolean}} features
 * @returns {{state: string, verifier: string, method: string, returnTo: string} | null}
 */
export function decodeVkCookie(raw, features) {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const [state, verifier, method, encoded] = parts;
  if (!OPAQUE_SECRET.test(state) || !isVerifier(verifier) || !VK_METHODS.includes(method) || !/^[A-Za-z0-9_-]{1,2800}$/.test(encoded)) return null;
  const returnTo = Buffer.from(encoded, 'base64url').toString('utf8');
  if (portalReturnTo(returnTo, features) !== returnTo) return null;
  return { state, verifier, method, returnTo };
}

/**
 * Where a failed sign-in lands: the login view shows the message and offers the
 * buttons again for the same destination.
 * @param {string} reason one of SIGNIN_FAILURES
 * @param {string} returnTo an allowlisted destination
 */
export function vkFailureLocation(reason, returnTo) {
  const params = new URLSearchParams({ signin: SIGNIN_FAILURES.includes(reason) ? reason : 'failed' });
  if (returnTo !== '/me') params.set('returnTo', returnTo);
  return '/login?' + params;
}

/**
 * @typedef {{set: [name: string, value: string, maxAge: number][], clear: string[]}} CookieChanges
 * @typedef {{vk: string, social: string, session: string, pair: string, csrf: string}} CookieNames
 */

/**
 * Applies cookie changes with the portal's attributes (HttpOnly, Lax, `/`,
 * Secure on HTTPS); deletions keep them (`expireCookie`).
 * @param {{set(name: string, value: string, options: object): unknown}} jar
 * @param {CookieChanges} changes
 * @param {boolean} secure
 */
export function applyCookies(jar, changes, secure) {
  for (const name of changes.clear) expireCookie(jar, name, secure);
  for (const [name, value, maxAge] of changes.set) jar.set(name, value, { ...cookieOptions(secure), maxAge });
}

/**
 * `GET /api/auth/vk/start?method=…&returnTo=…`.
 * @param {{clientId: string, origin: string, names: CookieNames, features: {ekza: boolean, supporter: boolean},
 *   method: string | null, returnTo: string | null, random?: (size: number) => Buffer}} options
 * @returns {{location: string, cookies: CookieChanges} | {code: string, status: number}}
 */
export function vkStart({ clientId, origin, names, features, method, returnTo, random }) {
  if (!method || !VK_METHODS.includes(method)) return { code: 'invalid_method', status: 400 };
  const destination = portalReturnTo(returnTo || '/me', features);
  const { state, verifier } = newVkAttempt(random);
  return {
    location: vkAuthorizeUrl({ clientId, redirectUri: vkRedirectUri(origin), state, verifier, method }),
    cookies: { set: [[names.vk, encodeVkCookie({ state, verifier, method, returnTo: destination }), VK_ATTEMPT_MAX_AGE]], clear: [] },
  };
}

/** @param {unknown} value @param {number} max */
function printable(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && /^[\x21-\x7e]+$/.test(value);
}

/**
 * The Account API's error code to the login view's message.
 * @param {number} status @param {unknown} code
 */
export function signinFailure(status, code) {
  if (code === 'provider_rejected') return 'rejected';
  if (code === 'provider_unavailable') return 'provider_unavailable';
  if (code === 'session_limit' || status === 409) return 'session_limit';
  if (code === 'rate_limited' || status === 429) return 'rate_limited';
  if (code === 'invalid_request' || status === 400) return 'failed';
  if (status === 502) return 'rejected';
  return 'unavailable';
}

/** Seconds a ticket may live: its `expires_at`, at most 30 minutes. @param {unknown} expiresAt @param {number} now */
function ticketMaxAge(expiresAt, now) {
  const at = typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(at)) return SOCIAL_TICKET_MAX_AGE;
  return Math.max(1, Math.min(SOCIAL_TICKET_MAX_AGE, Math.floor((at - now) / 1000)));
}

/**
 * `GET /api/auth/vk/callback`: checks the attempt, forwards VK's answer to
 * `POST {api}/v1/auth/social/vk` and turns the reply into cookies + a redirect.
 * The attempt cookie is single use: every outcome clears it.
 * @param {{api: string, origin: string, names: CookieNames, features: {ekza: boolean, supporter: boolean},
 *   query: URLSearchParams, cookie: string | undefined, headers: Record<string, string>,
 *   fetch?: typeof fetch, now?: number, timeoutMs?: number}} options
 * @returns {Promise<{location: string, cookies: CookieChanges}>}
 */
export async function vkCallback({ api, origin, names, features, query, cookie, headers, fetch: request = fetch, now = Date.now(), timeoutMs = 12000 }) {
  const attempt = decodeVkCookie(cookie, features);
  const clearAttempt = cookie === undefined ? [] : [names.vk];
  const failure = (/** @type {string} */ reason) => ({
    location: vkFailureLocation(reason, attempt?.returnTo ?? '/me'),
    cookies: { set: [], clear: clearAttempt },
  });
  if (!attempt) return failure('failed');
  const state = query.get('state');
  // A foreign or replayed answer (no or another state) never reaches the API.
  if (!safeEqual(state ?? '', attempt.state)) return failure('failed');
  const error = query.get('error');
  if (error !== null) return failure(error === 'access_denied' || error === 'cancelled' ? 'cancelled' : 'failed');
  const code = query.get('code'), deviceId = query.get('device_id');
  if (!printable(code, 4096) || !printable(deviceId, 512)) return failure('failed');
  let reply;
  try {
    const upstream = await request(api + '/v1/auth/social/vk', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: attempt.method,
        code,
        code_verifier: attempt.verifier,
        device_id: deviceId,
        redirect_uri: vkRedirectUri(origin),
        state: attempt.state,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await upstream.text();
    let json = null;
    if (text.length <= MAX_REPLY) try { json = JSON.parse(text); } catch {}
    reply = { status: upstream.status, ok: upstream.ok, json: json && typeof json === 'object' && !Array.isArray(json) ? json : null };
  } catch {
    return failure('unavailable');
  }
  if (!reply.ok) return failure(signinFailure(reply.status, reply.json?.code));
  const result = reply.json;
  if (result?.state === 'signed_in' && typeof result.session_token === 'string' && OPAQUE_SECRET.test(result.session_token))
    // As pairing `complete`: a fresh session, the pre-login CSRF and pairing go.
    return { location: attempt.returnTo, cookies: { set: [[names.session, result.session_token, SESSION_MAX_AGE]], clear: [...clearAttempt, names.pair, names.csrf, names.social] } };
  if (result?.state === 'unlinked' && typeof result.social_ticket === 'string' && OPAQUE_SECRET.test(result.social_ticket))
    return { location: attempt.returnTo, cookies: { set: [[names.social, result.social_ticket, ticketMaxAge(result.expires_at, now)]], clear: clearAttempt } };
  return failure('unavailable');
}
